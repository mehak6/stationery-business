'use client';

/**
 * Offline-First Database Adapter
 *
 * This adapter automatically routes database operations to either:
 * - Supabase (when online)
 * - Local PouchDB (when offline)
 *
 * It handles automatic syncing and conflict resolution.
 */

import { supabase } from '../supabase_client';
import type { 
  Product, 
  Sale, 
  Category,
  PartyPurchase,
  ProductInsert,
  SaleInsert,
  PartyPurchaseInsert 
} from '../supabase_client';
import * as OfflineDB from './offline-db';
import { addProductHistory } from './product-history';
import { 
  getFinancialYear, 
  getFYRange, 
  isDateInFY 
} from './date-utils';

// Network status
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let onlineStatusListeners: Set<(online: boolean) => void> = new Set();

// Initialize network detection
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    onlineStatusListeners.forEach(listener => listener(true));
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    onlineStatusListeners.forEach(listener => listener(false));
  });
}

// Subscribe to online status changes
export const subscribeToOnlineStatus = (callback: (online: boolean) => void) => {
  onlineStatusListeners.add(callback);
  callback(isOnline); // Call immediately with current status

  return () => {
    onlineStatusListeners.delete(callback);
  };
};

// ==================== PRODUCTS ====================

export const getProducts = async (limit?: number): Promise<Product[]> => {
  try {
    if (isOnline) {
      // Try online sync first
      const { data, error } = await (supabase.from('products') as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit || 1000);

      if (!error && data && data.length > 0) {
        // Update local cache but don't wait for it
        await Promise.all(data.map((product: Product) =>
          OfflineDB.saveProduct(product).catch(err =>
            console.warn('Failed to cache product:', err)
          )
        ));
      }
    }
    
    // CRITICAL: Always return data from Local DB as the source of truth
    // This ensures that local resets (0 stock) are shown immediately
    // even if the server hasn't updated yet.
    return await OfflineDB.getAllProducts();
    } catch (error) {
    console.error('Error in getProducts, using offline cache:', error);
    return await OfflineDB.getAllProducts();
    }
    };


export const createProduct = async (product: ProductInsert): Promise<Product> => {
  try {
    if (isOnline) {
      const { data, error } = await (supabase.from('products') as any)
        .insert(product)
        .select()
        .single();

      if (error) throw error;

      // Cache to local DB
      await OfflineDB.saveProduct(data);
      return data;
    } else {
      // Save to offline DB with pending sync flag
      const newProduct = await OfflineDB.createProduct({
        ...product,
        category_id: product.category_id ?? null,
        barcode: product.barcode ?? null,
        stock_quantity: product.stock_quantity ?? 0,
        min_stock_level: product.min_stock_level ?? 0,
        supplier_info: product.supplier_info ?? null,
        image_url: product.image_url ?? null,
        description: product.description ?? null
      });
      return newProduct;
    }
  } catch (error) {
    console.error('Error creating product online, saving offline:', error);
    // Fallback to offline
    return await OfflineDB.createProduct({
      ...product,
      category_id: product.category_id ?? null,
      barcode: product.barcode ?? null,
      stock_quantity: product.stock_quantity ?? 0,
      min_stock_level: product.min_stock_level ?? 0,
      supplier_info: product.supplier_info ?? null,
      image_url: product.image_url ?? null,
      description: product.description ?? null
    });
  }
};

export const updateProduct = async (productId: string, updates: Partial<ProductInsert>): Promise<Product> => {
  try {
    if (isOnline) {
      const { data, error } = await (supabase.from('products') as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', productId)
        .select()
        .single();

      if (error) throw error;

      // Update local cache
      await OfflineDB.saveProduct(data);
      return data;
    } else {
      // Update local DB
      const updatedProduct = await OfflineDB.updateProduct(productId, updates as Partial<Product>);
      if (!updatedProduct) throw new Error('Product not found in local DB');
      return updatedProduct;
    }
  } catch (error) {
    console.error('Error updating product online, marking offline:', error);
    // Update local DB
    const updatedProduct = await OfflineDB.updateProduct(productId, updates as Partial<Product>);
    if (!updatedProduct) throw new Error('Product not found in local DB');
    return updatedProduct;
  }
};

const recordInventoryTransaction = async (entry: {
  product_id: string;
  action: string;
  quantity_change: number;
  stock_before: number;
  stock_after: number;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) => {
  if (!isOnline) return;

  try {
    const { error } = await (supabase.from('inventory_transactions') as any)
      .insert({
        product_id: entry.product_id,
        sale_id: null,
        action: entry.action,
        quantity_change: entry.quantity_change,
        stock_before: entry.stock_before,
        stock_after: entry.stock_after,
        source: 'app',
        reason: entry.reason ?? null,
        metadata: entry.metadata ?? {}
      });

    if (error) {
      console.warn('Could not write inventory ledger entry:', error);
    }
  } catch (error) {
    console.warn('Could not write inventory ledger entry:', error);
  }
};

export const markDamagedStock = async (
  product: Product,
  quantity: number,
  reason: string,
  date?: string
): Promise<Product> => {
  const damagedQuantity = Math.floor(Number(quantity));
  if (!Number.isFinite(damagedQuantity) || damagedQuantity <= 0) {
    throw new Error('Damaged quantity must be greater than zero');
  }

  if (damagedQuantity > product.stock_quantity) {
    throw new Error(`Cannot mark more damaged stock than available. Available: ${product.stock_quantity}`);
  }

  const stockBefore = product.stock_quantity;
  const stockAfter = stockBefore - damagedQuantity;
  const cleanReason = reason?.trim() || 'Damaged stock removed';

  const updatedProduct = await updateProduct(product.id, { stock_quantity: stockAfter });

  await addProductHistory({
    product_id: product.id,
    product_name: product.name,
    action: 'damaged_stock_removed',
    quantity_change: -damagedQuantity,
    stock_before: stockBefore,
    stock_after: stockAfter,
    date: date || new Date().toISOString(),
    notes: cleanReason
  });

  await recordInventoryTransaction({
    product_id: product.id,
    action: 'damaged_stock_removed',
    quantity_change: -damagedQuantity,
    stock_before: stockBefore,
    stock_after: stockAfter,
    reason: cleanReason,
    metadata: {
      product_name: product.name,
      adjustment_date: date || new Date().toISOString()
    }
  });

  return {
    ...updatedProduct,
    stock_quantity: stockAfter
  } as Product;
};

export const deleteProduct = async (productId: string): Promise<void> => {
  try {
    if (isOnline) {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      // Remove from local cache
      await OfflineDB.deleteProduct(productId);
    } else {
      // Delete from local DB
      await OfflineDB.deleteProduct(productId);
    }
  } catch (error) {
    console.error('Error deleting product online, marking offline:', error);
    await OfflineDB.deleteProduct(productId);
  }
};

export const resetAllProductsStock = async (newYearLabel: string): Promise<boolean> => {
  try {
    // CRITICAL: Fetch products from LOCAL DB only to ensure reset can always proceed
    const products = await OfflineDB.getAllProducts();
    if (!products || products.length === 0) return true;

    const updates = products.map(p => ({
      id: p.id,
      updates: { stock_quantity: 0, updated_at: new Date().toISOString() }
    }));

    // Step 1: Update local PouchDB cache
    await OfflineDB.bulkUpdateProducts(updates as any);
    
    // Step 2: Save closing stock for the previous year
    // Extract previous year from the newYearLabel
    const [startYearStr] = newYearLabel.split('-');
    const startYear = parseInt(startYearStr);
    const prevYearLabel = `${startYear - 1}-${String(startYear % 100).padStart(2, '0')}`;
    
    const closingRecords = products.map(p => ({
      product_id: p.id,
      financial_year: prevYearLabel,
      closing_stock: p.stock_quantity
    }));
    await OfflineDB.saveYearlyClosingStock(closingRecords);

    // Step 3: Add to history in bulk
    const { addProductHistoryBulk } = await import('./product-history');
    const historyEntries = products.map(p => ({
      product_id: p.id,
      product_name: p.name,
      action: 'stock_reset' as any,
      quantity_change: -p.stock_quantity,
      stock_before: p.stock_quantity,
      stock_after: 0,
      notes: `Stock reset for new financial year ${newYearLabel}`
    }));
    await addProductHistoryBulk(historyEntries);

    // Note: We do NOT perform a direct online UPDATE here.
    // The changes are saved locally with a new 'updated_at' timestamp.
    // The background sync engine will naturally push these 0-stock levels
    // to Supabase during the next sync cycle. This bypasses any 
    // global "UPDATE requires a WHERE clause" restrictions.

    return true;
  } catch (error) {
    console.error('Error during stock reset:', error);
    return false;
  }
};

export const getClosingStockForYear = async (financialYear: string): Promise<Record<string, number>> => {
  return await OfflineDB.getClosingStockForYear(financialYear);
};

export const getSalesByDate = async (date: string): Promise<Sale[]> => {
  return await OfflineDB.getSalesByDate(date);
};

export const getSalesByProduct = async (productId: string): Promise<Sale[]> => {
  return await OfflineDB.getSalesByProduct(productId);
};

export const deletePartyPurchase = async (id: string): Promise<boolean> => {
  return await OfflineDB.deletePartyPurchase(id);
};

export const cleanupLocalOrphanSales = async (options: { dryRun?: boolean } = {}) => {
  return await OfflineDB.cleanupOrphanSales(options);
};

export const syncAllData = async () => {
  const { performFullSync } = await import('./supabase-sync');
  return await performFullSync();
};

// ==================== ANALYTICS ====================

export const getAnalytics = async (financialYear?: string) => {
  try {
    const targetFY = financialYear || getFinancialYear();
    const { start: fyStart, end: fyEnd } = getFYRange(targetFY);

    console.log(`📊 Analytics Range: ${fyStart} to ${fyEnd}`);

    // CRITICAL: Always use local data for analytics to ensure immediate visibility 
    // of new sales and products, even before they sync to Supabase.
    const products = await OfflineDB.getAllProducts();
    const allSales = await OfflineDB.getAllSales();
    
    // Filter sales by financial year
    const sales = allSales.filter(sale => {
      if (!sale.sale_date) return false;
      const saleDatePart = sale.sale_date.split('T')[0];
      return saleDatePart >= fyStart && saleDatePart <= fyEnd;
    });
    
    const totalProducts = products.length;
    const totalSales = sales.reduce((sum, sale) => sum + (Number(sale.total_amount) || 0), 0);
    const totalProfit = sales.reduce((sum, sale) => sum + (Number(sale.profit) || 0), 0);
    
    // Use local date for "Today" to avoid UTC mismatch
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const todaySalesData = sales.filter(sale => {
      if (!sale.sale_date) return false;
      return sale.sale_date.split('T')[0] === today;
    });
    const todaySales = todaySalesData.reduce((sum, sale) => sum + (Number(sale.total_amount) || 0), 0);
    const todayProfit = todaySalesData.reduce((sum, sale) => sum + (Number(sale.profit) || 0), 0);
    
    const lowStockProducts = products.filter(p => p.stock_quantity <= p.min_stock_level).length;

    console.log(`✅ Analytics calculated locally: ${sales.length} sales found.`);

    // In background, if online, we could fetch from Supabase to verify, 
    // but the local data is what the user sees for immediate feedback.
    if (isOnline) {
      // Just a quick check to keep server warm, but don't wait for it
      (supabase.from('sales') as any)
        .select('id', { count: 'exact', head: true })
        .gte('sale_date', fyStart)
        .lte('sale_date', fyEnd)
        .then(() => {});
    }

    return {
      totalProducts,
      totalSales,
      totalProfit,
      todaySales,
      todayProfit,
      lowStockProducts
    };
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return {
      totalProducts: 0,
      totalSales: 0,
      totalProfit: 0,
      todaySales: 0,
      todayProfit: 0,
      lowStockProducts: 0
    };
  }
};

// ==================== SALES ====================

export const getSales = async (limit?: number): Promise<Sale[]> => {
  try {
    const products = await OfflineDB.getAllProducts();
    const productMap = new Map(products.map(p => [p.id, p.name]));

    if (isOnline) {
      const { data, error } = await (supabase.from('sales') as any)
        .select(`
          *,
          products (
            id,
            name,
            purchase_price
          )
        `)
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit || 100);

      if (!error && data) {
        // Cache to local DB but don't wait
        await Promise.all((data || []).map((sale: any) =>
          OfflineDB.saveSale({
            ...sale,
            product_name: sale.products?.name || productMap.get(sale.product_id)
          } as any).catch(() => {})
        ));
      }
    }
    
    const localSales = await OfflineDB.getAllSales(limit);
    return localSales.map(s => ({
      ...s,
      product_name: (s as any).product_name || productMap.get(s.product_id) || 'Unknown Product'
    }));
  } catch (error) {
    console.error('Error fetching sales, using offline cache:', error);
    const localSales = await OfflineDB.getAllSales(limit);
    return localSales;
  }
};

export const getSalesByDateRange = async (startDate: string, endDate: string): Promise<Sale[]> => {
  try {
    const products = await OfflineDB.getAllProducts();
    const productMap = new Map(products.map(p => [p.id, p.name]));

    console.log(`🔍 Fetching sales between ${startDate} and ${endDate}`);

    if (isOnline) {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          products (
            id,
            name,
            purchase_price
          )
        `)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data) {
        const remoteSales = (data || []).map((sale: any) => ({
          ...sale,
          updated_at: sale.updated_at || sale.created_at,
          product_name: sale.products?.name || productMap.get(sale.product_id) || 'Unknown Product'
        }));

        await Promise.all(remoteSales.map((sale: any) =>
          OfflineDB.saveSale(sale as any).catch(() => {})
        ));

        const remoteIds = new Set(remoteSales.map((sale: Sale) => sale.id));
        const localOnlySales = (await OfflineDB.getSalesByDateRange(startDate, endDate))
          .filter(sale => !remoteIds.has(sale.id))
          .map(sale => ({
            ...sale,
            product_name: (sale as any).product_name || productMap.get(sale.product_id) || 'Unknown Product'
          }));

        return [...remoteSales, ...localOnlySales];
      }
    }
    
    // Always return from Local DB to include unsynced sales
    const localSales = await OfflineDB.getSalesByDateRange(startDate, endDate);
    console.log(`📍 Found ${localSales.length} local sales in range.`);

    return localSales.map(s => ({
      ...s,
      product_name: (s as any).product_name || productMap.get(s.product_id) || 'Unknown Product'
    }));
  } catch (error) {
    console.error('Error fetching sales by date range:', error);
    return await OfflineDB.getSalesByDateRange(startDate, endDate);
  }
};

const getSaleIdFromRpcResult = (data: any): string | null => {
  if (!data || typeof data !== 'object') return null;
  return data.sale_id || data.id || null;
};

const isMissingRemoteFeatureError = (error: any, feature: string): boolean => {
  const text = [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return text.includes(feature.toLowerCase()) &&
    (text.includes('does not exist') ||
      text.includes('schema cache') ||
      text.includes('could not find'));
};

const isOfflineFallbackError = (error: any): boolean => {
  const text = [error?.message, error?.details, error?.hint, error?.code, error?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return !isOnline ||
    text.includes('failed to fetch') ||
    text.includes('networkerror') ||
    text.includes('network error') ||
    text.includes('load failed') ||
    text.includes('timeout') ||
    text.includes('offline');
};

const buildSaleFromInsert = (id: string, sale: SaleInsert): Sale => {
  const now = new Date().toISOString();
  return {
    id,
    product_id: sale.product_id,
    quantity: sale.quantity,
    unit_price: sale.unit_price,
    total_amount: sale.total_amount,
    profit: sale.profit,
    customer_info: sale.customer_info ?? null,
    sale_date: sale.sale_date ?? now.split('T')[0],
    notes: sale.notes ?? null,
    created_at: now,
    updated_at: now
  } as Sale;
};

const cacheProductAfterRemoteStockChange = async (
  productId: string,
  fallbackStockQuantity?: number
): Promise<void> => {
  try {
    const { data, error } = await (supabase.from('products') as any)
      .select('*')
      .eq('id', productId)
      .single();

    if (error) throw error;
    if (data) {
      await OfflineDB.saveProduct(data);
      return;
    }
  } catch (error) {
    console.warn('Could not refresh product stock from Supabase:', error);
  }

  if (typeof fallbackStockQuantity === 'number') {
    try {
      await OfflineDB.updateProduct(productId, {
        stock_quantity: fallbackStockQuantity,
        updated_at: new Date().toISOString()
      } as Partial<Product>);
    } catch (error) {
      console.warn('Could not apply fallback product stock locally:', error);
    }
  }
};

const normalizeRemoteSaleResult = async (data: any, sale: SaleInsert): Promise<Sale> => {
  if (data && typeof data === 'object' && 'success' in data) {
    if (data.success === false) {
      throw new Error(data.error || 'Sale creation failed');
    }

    const saleId = getSaleIdFromRpcResult(data);
    if (!saleId) {
      throw new Error('Sale creation did not return a sale id');
    }

    const { data: saleRow, error } = await (supabase.from('sales') as any)
      .select('*')
      .eq('id', saleId)
      .single();

    if (!error && saleRow) {
      return saleRow as Sale;
    }

    console.warn('Could not fetch newly-created sale row; caching sale from request data:', error);
    return buildSaleFromInsert(saleId, sale);
  }

  return data as Sale;
};

const fetchRemoteSaleById = async (saleId: string): Promise<Sale & { product_name?: string }> => {
  const { data, error } = await (supabase.from('sales') as any)
    .select(`
      *,
      products (
        id,
        name,
        purchase_price
      )
    `)
    .eq('id', saleId)
    .single();

  if (error) throw error;

  return {
    ...data,
    updated_at: data.updated_at || data.created_at,
    product_name: (data as any).products?.name
  };
};

const fetchRemoteProduct = async (productId: string): Promise<Product | null> => {
  const { data, error } = await (supabase.from('products') as any)
    .select('*')
    .eq('id', productId)
    .single();

  if (error) throw error;
  return data || null;
};

const createSaleWithoutRpc = async (sale: SaleInsert): Promise<Sale> => {
  const productBefore = await fetchRemoteProduct(sale.product_id);
  if (!productBefore) throw new Error('Product not found');
  if (productBefore.stock_quantity < sale.quantity) {
    throw new Error(`Insufficient stock. Available: ${productBefore.stock_quantity}, Requested: ${sale.quantity}`);
  }

  const { data, error } = await (supabase.from('sales') as any)
    .insert({
      product_id: sale.product_id,
      quantity: sale.quantity,
      unit_price: sale.unit_price,
      total_amount: sale.total_amount,
      profit: sale.profit,
      customer_info: sale.customer_info ?? null,
      sale_date: sale.sale_date ?? new Date().toISOString().split('T')[0],
      notes: sale.notes ?? null
    })
    .select('*')
    .single();

  if (error) throw error;

  return {
    ...data,
    updated_at: data.updated_at || data.created_at
  } as Sale;
};

export const createSale = async (sale: SaleInsert): Promise<Sale> => {
  try {
    if (isOnline) {
      // Use RPC for atomic sale creation and stock check
      const { data, error } = await (supabase.rpc as any)('create_sale_with_stock_check', {
        p_product_id: sale.product_id,
        p_quantity: sale.quantity,
        p_unit_price: sale.unit_price,
        p_total_amount: sale.total_amount,
        p_profit: sale.profit,
        p_customer_info: sale.customer_info ?? null,
        p_sale_date: sale.sale_date ?? new Date().toISOString().split('T')[0],
        p_notes: sale.notes ?? null
      });

      if (error) {
        if (isMissingRemoteFeatureError(error, 'create_sale_with_stock_check')) {
          const directSale = await createSaleWithoutRpc(sale);
          try {
            await OfflineDB.saveSale(directSale);
          } catch (cacheError) {
            console.warn('Sale was created remotely but could not be cached locally:', cacheError);
          }
          await cacheProductAfterRemoteStockChange(directSale.product_id);
          return directSale;
        }
        throw error;
      }

      const remoteSale = await normalizeRemoteSaleResult(data, sale);
      const rpcStockQuantity = data && typeof data === 'object' ? data.new_stock_quantity : undefined;

      try {
        await OfflineDB.saveSale(remoteSale);
      } catch (cacheError) {
        console.warn('Sale was created remotely but could not be cached locally:', cacheError);
      }

      await cacheProductAfterRemoteStockChange(remoteSale.product_id, rpcStockQuantity);
      return remoteSale;
    } else {
      // Offline sale
      return await OfflineDB.createSale({
        product_id: sale.product_id,
        quantity: sale.quantity,
        unit_price: sale.unit_price,
        total_amount: sale.total_amount,
        profit: sale.profit,
        customer_info: sale.customer_info ?? null,
        sale_date: sale.sale_date ?? new Date().toISOString().split('T')[0],
        notes: sale.notes ?? null
      });
    }
  } catch (error) {
    console.error('Error creating sale online, saving offline:', error);
    if (!isOfflineFallbackError(error)) {
      throw error;
    }
    return await OfflineDB.createSale({
      product_id: sale.product_id,
      quantity: sale.quantity,
      unit_price: sale.unit_price,
      total_amount: sale.total_amount,
      profit: sale.profit,
      customer_info: sale.customer_info ?? {},
      sale_date: sale.sale_date ?? new Date().toISOString().split('T')[0],
      notes: sale.notes ?? ''
    });
  }
};

export const updateSale = async (id: string, updates: Partial<SaleInsert>): Promise<Sale> => {
  try {
    if (isOnline) {
      const { data: previousRemoteSale } = await (supabase.from('sales') as any)
        .select('id, product_id')
        .eq('id', id)
        .single();

      const updatePayload = { ...updates, updated_at: new Date().toISOString() };
      let data: any = null;
      let error: any = null;
      let rpcStockQuantity: number | undefined;

      const rpcResult = await (supabase.rpc as any)('update_sale_with_stock_check', {
        p_sale_id: id,
        p_product_id: updates.product_id ?? null,
        p_quantity: updates.quantity ?? null,
        p_unit_price: updates.unit_price ?? null,
        p_total_amount: updates.total_amount ?? null,
        p_profit: updates.profit ?? null,
        p_customer_info: updates.customer_info ?? null,
        p_sale_date: updates.sale_date ?? null,
        p_notes: updates.notes ?? null
      });

      if (!rpcResult.error) {
        if (rpcResult.data?.success === false) {
          throw new Error(rpcResult.data.error || 'Sale update failed');
        }
        const saleId = getSaleIdFromRpcResult(rpcResult.data) || id;
        data = await fetchRemoteSaleById(saleId);
        rpcStockQuantity = rpcResult.data?.new_stock_quantity;
      } else if (isMissingRemoteFeatureError(rpcResult.error, 'update_sale_with_stock_check')) {
        const tableResult = await (supabase.from('sales') as any)
          .update(updatePayload)
          .eq('id', id)
          .select(`
            *,
            products (
              id,
              name,
              purchase_price
            )
          `)
          .single();
        data = tableResult.data;
        error = tableResult.error;

        if (error && isMissingRemoteFeatureError(error, 'updated_at')) {
          const { updated_at, ...legacyPayload } = updatePayload as any;
          const legacyResult = await (supabase.from('sales') as any)
            .update(legacyPayload)
            .eq('id', id)
            .select(`
              *,
              products (
                id,
                name,
                purchase_price
              )
            `)
            .single();
          data = legacyResult.data;
          error = legacyResult.error;
        }
      } else {
        error = rpcResult.error;
      }

      if (error) throw error;

      const formattedSale = {
        ...data,
        updated_at: data.updated_at || data.created_at,
        product_name: (data as any).products?.name
      };

      try {
        await OfflineDB.saveSale(formattedSale);
      } catch (cacheError) {
        console.warn('Sale was updated remotely but could not be cached locally:', cacheError);
      }

      await cacheProductAfterRemoteStockChange(data.product_id, rpcStockQuantity);
      if (previousRemoteSale?.product_id && previousRemoteSale.product_id !== data.product_id) {
        await cacheProductAfterRemoteStockChange(previousRemoteSale.product_id);
      }
      return formattedSale;
    } else {
      const updated = await OfflineDB.updateSale(id, updates as Partial<Sale>);
      if (!updated) throw new Error('Sale not found locally');
      return updated;
    }
  } catch (error) {
    console.error('Error updating sale online, saving offline:', error);
    if (!isOfflineFallbackError(error)) {
      throw error;
    }
    const updated = await OfflineDB.updateSale(id, updates as Partial<Sale>);
    if (!updated) throw new Error('Sale not found locally');
    return updated;
  }
};

export const deleteSale = async (id: string): Promise<boolean> => {
  try {
    if (isOnline) {
      const { data: sale, error: getError } = await (supabase.from('sales') as any)
        .select('id, product_id')
        .eq('id', id)
        .single();

      let productId = sale?.product_id;
      let rpcStockQuantity: number | undefined;
      const rpcResult = await (supabase.rpc as any)('delete_sale_with_stock_check', {
        p_sale_id: id
      });

      let error = rpcResult.error;
      if (!error) {
        if (rpcResult.data?.success === false) {
          throw new Error(rpcResult.data.error || 'Sale delete failed');
        }
        productId = rpcResult.data?.product_id || productId;
        rpcStockQuantity = rpcResult.data?.new_stock_quantity;
      } else if (isMissingRemoteFeatureError(error, 'delete_sale_with_stock_check')) {
        const tableResult = await (supabase.from('sales') as any)
          .delete()
          .eq('id', id);
        error = tableResult.error;
      }

      if (error) throw error;

      // Remove from local cache (OfflineDB.deleteSale also restores local stock)
      const deletedLocally = await OfflineDB.deleteSale(id);
      if (!deletedLocally) {
        console.warn('Sale was deleted remotely but was not found in the local cache.');
      }
      if (!getError && productId) {
        await cacheProductAfterRemoteStockChange(productId, rpcStockQuantity);
      }
      return true;
    } else {
      return await OfflineDB.deleteSale(id);
    }
  } catch (error) {
    console.error('Error deleting sale online, marking offline:', error);
    if (!isOfflineFallbackError(error)) {
      throw error;
    }
    return await OfflineDB.deleteSale(id);
  }
};

// ==================== CATEGORIES ====================

export const getCategories = async (): Promise<Category[]> => {
  try {
    if (isOnline) {
      const { data, error } = await (supabase.from('categories') as any)
        .select('*')
        .order('name');

      if (error) throw error;

      // Cache to local DB
      await Promise.all((data || []).map((cat: Category) =>
        OfflineDB.saveCategory(cat).catch(err =>
          console.warn('Failed to cache category:', err)
        )
      ));

      return data || [];
    } else {
      return await OfflineDB.getAllCategories();
    }
  } catch (error) {
    console.error('Error fetching categories, using offline cache:', error);
    return await OfflineDB.getAllCategories();
  }
};

// ==================== PARTY PURCHASES ====================

export const getPartyPurchaseById = async (id: string): Promise<PartyPurchase | null> => {
  return await OfflineDB.getPartyPurchaseById(id);
};

export const getPartyPurchases = async (): Promise<PartyPurchase[]> => {
  try {
    if (isOnline) {
      const { data, error } = await (supabase.from('party_purchases') as any)
        .select('*')
        .order('purchase_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Cache to local DB
      await Promise.all((data || []).map((pp: any) =>
        OfflineDB.savePartyPurchase(pp as any).catch(err =>
          console.warn('Failed to cache party purchase:', err)
        )
      ));

      return data || [];
    } else {
      return await OfflineDB.getAllPartyPurchases();
    }
  } catch (error) {
    console.error('Error fetching party purchases, using offline cache:', error);
    return await OfflineDB.getAllPartyPurchases();
  }
};

export const createPartyPurchase = async (purchase: PartyPurchaseInsert): Promise<PartyPurchase> => {
  try {
    if (isOnline) {
      const { data, error } = await (supabase.from('party_purchases') as any)
        .insert(purchase)
        .select()
        .single();

      if (error) throw error;

      // Cache to local DB
      await OfflineDB.savePartyPurchase(data);
      return data;
    } else {
      return await OfflineDB.createPartyPurchase({
        ...purchase,
        barcode: purchase.barcode ?? null,
        notes: purchase.notes ?? null
      });
    }
  } catch (error) {
    console.error('Error creating party purchase online, saving offline:', error);
    return await OfflineDB.createPartyPurchase({
      ...purchase,
      barcode: purchase.barcode ?? null,
      notes: purchase.notes ?? null
    });
  }
};

export const updatePartyPurchase = async (id: string, updates: Partial<PartyPurchaseInsert>): Promise<PartyPurchase> => {
  try {
    if (isOnline) {
      const { data, error } = await (supabase.from('party_purchases') as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update local cache
      await OfflineDB.savePartyPurchase(data);
      return data;
    } else {
      const updated = await OfflineDB.updatePartyPurchase(id, updates as Partial<PartyPurchase>);
      if (!updated) throw new Error('Party purchase not found locally');
      return updated;
    }
  } catch (error) {
    console.error('Error updating party purchase online, marking offline:', error);
    const updated = await OfflineDB.updatePartyPurchase(id, updates as Partial<PartyPurchase>);
    if (!updated) throw new Error('Party purchase not found locally');
    return updated;
  }
};

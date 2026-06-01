'use client';

import {
  getProductsDB,
  getSalesDB,
  getCategoriesDB,
  getPartyPurchasesDB,
  getDeletionLogDB,
  generateUUID,
  toPouchID,
  fromPouchID,
  getCurrentTimestamp
} from './pouchdb-client';

// Yearly Stock record interface
export interface YearlyStockRecord {
  id: string; // product_id_year
  product_id: string;
  financial_year: string;
  closing_stock: number;
  recorded_at: string;
}

// Type definitions matching Supabase schema
export interface Product {
  id: string;
  name: string;
  category_id: string | null;
  barcode: string | null;
  purchase_price: number;
  selling_price: number;
  stock_quantity: number;
  min_stock_level: number;
  supplier_info: any | null;
  image_url: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  profit: number;
  customer_info: any | null;
  sale_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface PartyPurchase {
  id: string;
  party_name: string;
  item_name: string;
  barcode: string | null;
  purchase_price: number;
  selling_price: number;
  purchased_quantity: number;
  remaining_quantity: number;
  purchase_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ==================== PRODUCTS ====================

export const getAllProducts = async (): Promise<Product[]> => {
  try {
    const db = await getProductsDB();
    const result = await db.allDocs({
      include_docs: true,
      startkey: 'product_',
      endkey: 'product_\ufff0'
    });

    return result.rows.map(row => {
      const doc: any = row.doc;
      return {
        id: fromPouchID(doc._id),
        name: doc.name,
        category_id: doc.category_id,
        barcode: doc.barcode,
        purchase_price: doc.purchase_price,
        selling_price: doc.selling_price,
        stock_quantity: doc.stock_quantity,
        min_stock_level: doc.min_stock_level,
        supplier_info: doc.supplier_info,
        image_url: doc.image_url,
        description: doc.description,
        created_at: doc.created_at,
        updated_at: doc.updated_at
      };
    });
  } catch (error) {
    console.error('Error getting products:', error);
    return [];
  }
};

export const getProductById = async (id: string): Promise<Product | null> => {
  try {
    const db = await getProductsDB();
    const doc: any = await db.get(toPouchID('product', id));

    return {
      id: fromPouchID(doc._id),
      name: doc.name,
      category_id: doc.category_id,
      barcode: doc.barcode,
      purchase_price: doc.purchase_price,
      selling_price: doc.selling_price,
      stock_quantity: doc.stock_quantity,
      min_stock_level: doc.min_stock_level,
      supplier_info: doc.supplier_info,
      image_url: doc.image_url,
      description: doc.description,
      created_at: doc.created_at,
      updated_at: doc.updated_at
    };
  } catch (error) {
    console.error('Error getting product by ID:', error);
    return null;
  }
};

export const saveProduct = async (product: Product): Promise<Product> => {
  try {
    const db = await getProductsDB();
    const docId = toPouchID('product', product.id);

    let doc: any;
    try {
      doc = await db.get(docId);
      
      // CRITICAL: Only update if the incoming data is newer or equal in timestamp
      // This prevents stale Supabase data from overwriting fresh local resets
      const localUpdatedAt = new Date(doc.updated_at || 0).getTime();
      const incomingUpdatedAt = new Date(product.updated_at || 0).getTime();
      
      if (incomingUpdatedAt < localUpdatedAt) {
        // console.log(`Skipping update for ${product.name}: Local data is newer`);
        return {
          id: fromPouchID(doc._id),
          ...doc
        } as any;
      }

      // Update existing
      const updatedDoc = { ...doc, ...product, _id: docId, _rev: doc._rev };
      await db.put(updatedDoc);
    } catch {
      // Create new
      doc = {
        _id: docId,
        ...product
      };
      await db.put(doc);
    }

    return product;
  } catch (error) {
    console.error('Error saving product:', error);
    throw error;
  }
};

export const bulkSaveProducts = async (products: Product[]): Promise<void> => {
  try {
    const db = await getProductsDB();
    const pouchIds = products.map(p => toPouchID('product', p.id));
    
    // Fetch existing docs to get _rev for updates
    const existing = await db.allDocs({ keys: pouchIds, include_docs: true });
    const revMap = new Map();
    existing.rows.forEach((row: any) => {
      if (row.doc) revMap.set(row.key, row.doc._rev);
    });

    const docs = products.map(p => {
      const _id = toPouchID('product', p.id);
      const doc: any = { ...p, _id };
      if (revMap.has(_id)) doc._rev = revMap.get(_id);
      return doc;
    });

    await db.bulkDocs(docs);
  } catch (error) {
    console.error('Error bulk saving products:', error);
    throw error;
  }
};

export const createProduct = async (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> => {
  const db = await getProductsDB();
  const id = generateUUID();
  const now = getCurrentTimestamp();

  const doc = {
    _id: toPouchID('product', id),
    ...product,
    created_at: now,
    updated_at: now
  };

  await db.put(doc);

  return {
    id,
    ...product,
    created_at: now,
    updated_at: now
  };
};

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<Product | null> => {
  try {
    const db = await getProductsDB();
    const docId = toPouchID('product', id);
    const doc: any = await db.get(docId);

    const updatedDoc = {
      ...doc,
      ...updates,
      _id: docId,
      _rev: doc._rev,
      updated_at: getCurrentTimestamp()
    };

    await db.put(updatedDoc);

    return {
      id: fromPouchID(updatedDoc._id),
      name: updatedDoc.name,
      category_id: updatedDoc.category_id,
      barcode: updatedDoc.barcode,
      purchase_price: updatedDoc.purchase_price,
      selling_price: updatedDoc.selling_price,
      stock_quantity: updatedDoc.stock_quantity,
      min_stock_level: updatedDoc.min_stock_level,
      supplier_info: updatedDoc.supplier_info,
      image_url: updatedDoc.image_url,
      description: updatedDoc.description,
      created_at: updatedDoc.created_at,
      updated_at: updatedDoc.updated_at
    };
  } catch (error) {
    console.error('Error updating product:', error);
    return null;
  }
};

export const bulkUpdateProducts = async (updates: Array<{ id: string; updates: Partial<Product> }>): Promise<boolean> => {
  try {
    const db = await getProductsDB();
    const ids = updates.map(u => u.id);
    const pouchIds = ids.map(id => toPouchID('product', id));

    const result = await db.allDocs({
      include_docs: true,
      keys: pouchIds
    });

    const now = getCurrentTimestamp();
    const docsToUpdate = result.rows.map((row: any, index) => {
      if (row.error || !row.doc) return null;
      const updateData = updates[index].updates;
      return {
        ...row.doc,
        ...updateData,
        updated_at: now
      };
    }).filter(doc => doc !== null);

    if (docsToUpdate.length > 0) {
      await db.bulkDocs(docsToUpdate);
    }

    return true;
  } catch (error) {
    console.error('Error in bulk updating products:', error);
    return false;
  }
};

export const deleteProduct = async (id: string): Promise<boolean> => {
  try {
    const db = await getProductsDB();
    const docId = toPouchID('product', id);
    const doc = await db.get(docId);
    await db.remove(doc);
    
    // Log for sync
    await logDeletion('products', id);
    return true;
  } catch (error) {
    console.error('Error deleting product:', error);
    return false;
  }
};

// ==================== SALES ====================

const saleFromDoc = (doc: any): Sale => ({
  id: fromPouchID(doc._id),
  product_id: doc.product_id,
  quantity: doc.quantity,
  unit_price: doc.unit_price,
  total_amount: doc.total_amount,
  profit: doc.profit,
  customer_info: doc.customer_info,
  sale_date: doc.sale_date,
  notes: doc.notes,
  created_at: doc.created_at,
  updated_at: doc.updated_at || doc.created_at
});

export const getAllSales = async (limit?: number): Promise<Sale[]> => {
  try {
    const db = await getSalesDB();
    // For descending: true, startkey must be the HIGHER key and endkey the LOWER key
    const result = await db.allDocs({
      include_docs: true,
      startkey: 'sale_\ufff0',
      endkey: 'sale_',
      limit: limit,
      descending: true
    });

    return result.rows.map(row => saleFromDoc(row.doc));
  } catch (error) {
    console.error('Error getting sales:', error);
    return [];
  }
};

export const getSaleById = async (id: string): Promise<Sale | null> => {
  try {
    const db = await getSalesDB();
    const docId = toPouchID('sale', id);
    const doc: any = await db.get(docId);
    return saleFromDoc(doc);
  } catch (error) {
    console.error('Error getting sale by ID:', error);
    return null;
  }
};

export const saveSale = async (sale: Sale): Promise<Sale> => {
  try {
    const db = await getSalesDB();
    const docId = toPouchID('sale', sale.id);
    const normalizedSale = {
      ...sale,
      updated_at: sale.updated_at || sale.created_at
    };

    let doc: any;
    try {
      doc = await db.get(docId);
      // Update existing
      const updatedDoc = { ...doc, ...normalizedSale };
      await db.put(updatedDoc);
    } catch {
      // Create new
      doc = {
        _id: docId,
        ...normalizedSale
      };
      await db.put(doc);
    }

    return normalizedSale;
  } catch (error) {
    console.error('Error saving sale:', error);
    throw error;
  }
};

export const bulkSaveSales = async (sales: Sale[]): Promise<void> => {
  try {
    const db = await getSalesDB();
    const pouchIds = sales.map(s => toPouchID('sale', s.id));
    
    const existing = await db.allDocs({ keys: pouchIds, include_docs: true });
    const revMap = new Map();
    existing.rows.forEach((row: any) => {
      if (row.doc) revMap.set(row.key, row.doc._rev);
    });

    const docs = sales.map(s => {
      const _id = toPouchID('sale', s.id);
      const doc: any = { ...s, updated_at: s.updated_at || s.created_at, _id };
      if (revMap.has(_id)) doc._rev = revMap.get(_id);
      return doc;
    });

    await db.bulkDocs(docs);
  } catch (error) {
    console.error('Error bulk saving sales:', error);
    throw error;
  }
};

export const createSale = async (sale: Omit<Sale, 'id' | 'created_at' | 'updated_at'>): Promise<Sale> => {
  const productsDB = await getProductsDB();
  const salesDB = await getSalesDB();
  
  // 1. Fetch product to check stock and get its rev
  const productDocId = toPouchID('product', sale.product_id);
  const productDoc: any = await productsDB.get(productDocId);
  
  if (!productDoc) {
    throw new Error('Product not found');
  }
  
  if (productDoc.stock_quantity < sale.quantity) {
    throw new Error(`Insufficient stock. Available: ${productDoc.stock_quantity}, Requested: ${sale.quantity}`);
  }

  const id = generateUUID();
  const now = getCurrentTimestamp();

  // 2. Prepare updates
  const updatedProductDoc = {
    ...productDoc,
    stock_quantity: productDoc.stock_quantity - sale.quantity,
    updated_at: now
  };

  const saleDoc = {
    _id: toPouchID('sale', id),
    ...sale,
    created_at: now,
    updated_at: now
  };

  // 3. Update Product FIRST (Source of truth for stock)
  await productsDB.put(updatedProductDoc);

  try {
    // 4. Create sale record
    await salesDB.put(saleDoc);
  } catch (err) {
    // CRITICAL: If sale creation fails, we must attempt to ROLLBACK the stock deduction
    console.error('Failed to create sale record, attempting stock rollback:', err);
    try {
      const currentProduct: any = await productsDB.get(productDocId);
      await productsDB.put({
        ...currentProduct,
        stock_quantity: currentProduct.stock_quantity + sale.quantity
      });
    } catch (rollbackErr) {
      console.error('FAILED TO ROLLBACK STOCK! Inventory mismatch created:', rollbackErr);
    }
    throw err;
  }

  return {
    id,
    ...sale,
    created_at: now,
    updated_at: now
  };
};

export const updateSale = async (id: string, updates: Partial<Sale>): Promise<Sale> => {
  try {
    const productsDB = await getProductsDB();
    const salesDB = await getSalesDB();
    const docId = toPouchID('sale', id);
    const saleDoc: any = await salesDB.get(docId);

    // If quantity is being updated, adjust stock
    if (updates.quantity !== undefined && updates.quantity !== saleDoc.quantity) {
      const quantityDiff = updates.quantity - saleDoc.quantity;
      
      // Update product stock
      const productDocId = toPouchID('product', saleDoc.product_id);
      const productDoc: any = await productsDB.get(productDocId);
      
      if (productDoc.stock_quantity - quantityDiff < 0) {
        throw new Error(`Insufficient stock for update. Available: ${productDoc.stock_quantity}, Diff: ${quantityDiff}`);
      }

      await productsDB.put({
        ...productDoc,
        stock_quantity: productDoc.stock_quantity - quantityDiff,
        updated_at: getCurrentTimestamp()
      });
    }

    const updatedSaleDoc = { 
      ...saleDoc, 
      ...updates,
      // Recalculate if values changed
      total_amount: updates.quantity !== undefined || updates.unit_price !== undefined
        ? (updates.quantity ?? saleDoc.quantity) * (updates.unit_price ?? saleDoc.unit_price)
        : saleDoc.total_amount,
      updated_at: getCurrentTimestamp()
    };
    
    // Recalculate profit if quantity, unit_price or total_amount changed
    if (updates.quantity !== undefined || updates.unit_price !== undefined || updates.profit !== undefined) {
      if (updates.profit === undefined) {
        // We need the product's purchase price to calculate profit accurately
        try {
          const productDocId = toPouchID('product', saleDoc.product_id);
          const productDoc: any = await productsDB.get(productDocId);
          const purchasePrice = productDoc.purchase_price || 0;
          const currentQty = updates.quantity ?? saleDoc.quantity;
          const currentUnitPrice = updates.unit_price ?? saleDoc.unit_price;
          updatedSaleDoc.profit = (currentUnitPrice - purchasePrice) * currentQty;
        } catch (e) {
          console.warn('Could not fetch product for profit recalculation during sale update');
        }
      }
    }

    await salesDB.put(updatedSaleDoc);

    return saleFromDoc(updatedSaleDoc);
  } catch (error) {
    console.error('Error updating sale:', error);
    throw error;
  }
};

export const deleteSale = async (id: string): Promise<boolean> => {
  try {
    const productsDB = await getProductsDB();
    const salesDB = await getSalesDB();
    const docId = toPouchID('sale', id);
    const saleDoc: any = await salesDB.get(docId);

    // 1. Restore product stock
    const productDocId = toPouchID('product', saleDoc.product_id);
    try {
      const productDoc: any = await productsDB.get(productDocId);
      await productsDB.put({
        ...productDoc,
        stock_quantity: productDoc.stock_quantity + saleDoc.quantity,
        updated_at: getCurrentTimestamp()
      });
    } catch (err) {
      console.warn('Could not restore stock for deleted sale (product might be deleted):', err);
    }

    // 2. Delete sale
    await salesDB.remove(saleDoc);
    
    // 3. Log for sync
    await logDeletion('sales', id);
    return true;
  } catch (error) {
    console.error('Error deleting sale:', error);
    return false;
  }
};

export interface OrphanSaleCleanupResult {
  scanned: number;
  orphaned: number;
  removed: number;
  orphanSales: Sale[];
}

export const cleanupOrphanSales = async (
  options: { dryRun?: boolean } = {}
): Promise<OrphanSaleCleanupResult> => {
  const { dryRun = true } = options;
  const [products, sales] = await Promise.all([
    getAllProducts(),
    getAllSales()
  ]);
  const productIds = new Set(products.map(product => product.id));
  const orphanSales = sales.filter(sale => !productIds.has(sale.product_id));

  let removed = 0;
  if (!dryRun && orphanSales.length > 0) {
    const salesDB = await getSalesDB();
    for (const sale of orphanSales) {
      try {
        const doc = await salesDB.get(toPouchID('sale', sale.id));
        await salesDB.remove(doc);
        removed++;
      } catch (error) {
        console.warn('Could not remove orphan local sale:', { saleId: sale.id, error });
      }
    }
  }

  return {
    scanned: sales.length,
    orphaned: orphanSales.length,
    removed,
    orphanSales
  };
};

export const getSalesByDate = async (date: string): Promise<Sale[]> => {
  try {
    const db = await getSalesDB();
    const result = await db.find({
      selector: {
        _id: { $gte: 'sale_', $lt: 'sale_\ufff0' },
        sale_date: date
      },
      limit: 10000
    });

    return result.docs.map((doc: any) => saleFromDoc(doc));
  } catch (error) {
    console.error('Error getting sales by date:', error);
    return [];
  }
};

export const getSalesByProduct = async (productId: string): Promise<Sale[]> => {
  try {
    const db = await getSalesDB();
    const result = await db.find({
      selector: {
        product_id: productId
      },
      limit: 10000
    });

    return result.docs.map((doc: any) => saleFromDoc(doc));
  } catch (error) {
    console.warn('PouchDB find failed for getSalesByProduct, falling back to allDocs:', error);
    const db = await getSalesDB();
    const allDocs = await db.allDocs({
      include_docs: true,
      startkey: 'sale_',
      endkey: 'sale_\ufff0'
    });

    return allDocs.rows
      .map(row => row.doc as any)
      .filter(doc => doc && doc.product_id === productId)
      .map(doc => saleFromDoc(doc));
  }
};

export const getSalesByDateRange = async (startDate: string, endDate: string): Promise<Sale[]> => {
  try {
    const db = await getSalesDB();
    
    // Always use allDocs to guarantee 100% reliability and avoid stale Mango indexes
    const allDocs = await db.allDocs({
      include_docs: true,
      startkey: 'sale_',
      endkey: 'sale_\ufff0'
    });

    return allDocs.rows
      .map(row => row.doc as any)
      .filter(doc => {
        if (!doc.sale_date) return false;
        const saleDatePart = doc.sale_date.split('T')[0];
        return saleDatePart >= startDate && saleDatePart <= endDate;
      })
      .map(doc => saleFromDoc(doc));
  } catch (error) {
    console.error('Error getting sales by date range:', error);
    return [];
  }
};

// Helper: Update product stock
const updateProductStock = async (productId: string, quantityChange: number) => {
  try {
    const product = await getProductById(productId);
    if (product) {
      const newStock = product.stock_quantity + quantityChange;
      
      if (newStock < 0) {
        throw new Error(`Insufficient stock. Available: ${product.stock_quantity}, Requested change: ${quantityChange}`);
      }

      await updateProduct(productId, {
        stock_quantity: newStock
      });
    }
  } catch (error) {
    console.error('Error updating product stock:', error);
    throw error;
  }
};

// ==================== CATEGORIES ====================

export const getAllCategories = async (): Promise<Category[]> => {
  try {
    const db = await getCategoriesDB();
    const result = await db.allDocs({
      include_docs: true,
      startkey: 'category_',
      endkey: 'category_\\ufff0'
    });

    return result.rows.map(row => {
      const doc: any = row.doc;
      return {
        id: fromPouchID(doc._id),
        name: doc.name,
        description: doc.description,
        created_at: doc.created_at
      };
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    return [];
  }
};

export const getCategoryById = async (id: string): Promise<Category | null> => {
  try {
    const db = await getCategoriesDB();
    const docId = toPouchID('category', id);
    const doc: any = await db.get(docId);
    return {
      id: fromPouchID(doc._id),
      name: doc.name,
      description: doc.description,
      created_at: doc.created_at
    };
  } catch (error) {
    return null;
  }
};

export const createCategory = async (category: Omit<Category, 'id' | 'created_at'>): Promise<Category> => {
  const db = await getCategoriesDB();
  const id = generateUUID();
  const now = getCurrentTimestamp();

  const doc = {
    _id: toPouchID('category', id),
    ...category,
    created_at: now
  };

  await db.put(doc);

  return {
    id,
    ...category,
    created_at: now
  };
};

export const saveCategory = async (category: Category): Promise<Category> => {
  try {
    const db = await getCategoriesDB();
    const docId = toPouchID('category', category.id);

    let doc: any;
    try {
      doc = await db.get(docId);
      const updatedDoc = { ...doc, ...category, _id: docId, _rev: doc._rev };
      await db.put(updatedDoc);
    } catch {
      doc = {
        _id: docId,
        ...category
      };
      await db.put(doc);
    }

    return category;
  } catch (error) {
    console.error('Error saving category:', error);
    throw error;
  }
};

export const bulkSaveCategories = async (categories: Category[]): Promise<void> => {
  try {
    const db = await getCategoriesDB();
    const pouchIds = categories.map(c => toPouchID('category', c.id));
    
    const existing = await db.allDocs({ keys: pouchIds, include_docs: true });
    const revMap = new Map();
    existing.rows.forEach((row: any) => {
      if (row.doc) revMap.set(row.key, row.doc._rev);
    });

    const docs = categories.map(c => {
      const _id = toPouchID('category', c.id);
      const doc: any = { ...c, _id };
      if (revMap.has(_id)) doc._rev = revMap.get(_id);
      return doc;
    });

    await db.bulkDocs(docs);
  } catch (error) {
    console.error('Error bulk saving categories:', error);
    throw error;
  }
};

export const updateCategory = async (id: string, updates: Partial<Category>): Promise<Category | null> => {
  try {
    const db = await getCategoriesDB();
    const docId = toPouchID('category', id);
    const doc = await db.get(docId);
    const updatedDoc = { ...doc, ...updates, _id: docId, _rev: (doc as any)._rev };
    await db.put(updatedDoc);
    return await getCategoryById(id);
  } catch (error) {
    console.error('Error updating category:', error);
    return null;
  }
};

export const deleteCategory = async (id: string): Promise<boolean> => {
  try {
    const db = await getCategoriesDB();
    const docId = toPouchID('category', id);
    const doc = await db.get(docId);
    await db.remove(doc);
    return true;
  } catch (error) {
    console.error('Error deleting category:', error);
    return false;
  }
};

// ==================== PARTY PURCHASES ====================

export const getAllPartyPurchases = async (): Promise<PartyPurchase[]> => {
  try {
    const db = await getPartyPurchasesDB();
    const result = await db.allDocs({
      include_docs: true,
      startkey: 'party_',
      endkey: 'party_\ufff0'
    });

    return result.rows.map(row => {
      const doc: any = row.doc;
      return {
        id: fromPouchID(doc._id),
        party_name: doc.party_name,
        item_name: doc.item_name,
        barcode: doc.barcode,
        purchase_price: doc.purchase_price,
        selling_price: doc.selling_price,
        purchased_quantity: doc.purchased_quantity,
        remaining_quantity: doc.remaining_quantity,
        purchase_date: doc.purchase_date,
        notes: doc.notes,
        created_at: doc.created_at,
        updated_at: doc.updated_at
      };
    });
  } catch (error) {
    console.error('Error getting party purchases:', error);
    return [];
  }
};

export const savePartyPurchase = async (purchase: PartyPurchase): Promise<PartyPurchase> => {
  try {
    const db = await getPartyPurchasesDB();
    const docId = toPouchID('party', purchase.id);

    let doc: any;
    try {
      doc = await db.get(docId);
      // Update existing
      const updatedDoc = { ...doc, ...purchase };
      await db.put(updatedDoc);
    } catch {
      // Create new
      doc = {
        _id: docId,
        ...purchase
      };
      await db.put(doc);
    }

    return purchase;
  } catch (error) {
    console.error('Error saving party purchase:', error);
    throw error;
  }
};

export const bulkSavePartyPurchases = async (purchases: PartyPurchase[]): Promise<void> => {
  try {
    const db = await getPartyPurchasesDB();
    const pouchIds = purchases.map(p => toPouchID('party', p.id));
    
    const existing = await db.allDocs({ keys: pouchIds, include_docs: true });
    const revMap = new Map();
    existing.rows.forEach((row: any) => {
      if (row.doc) revMap.set(row.key, row.doc._rev);
    });

    const docs = purchases.map(p => {
      const _id = toPouchID('party', p.id);
      const doc: any = { ...p, _id };
      if (revMap.has(_id)) doc._rev = revMap.get(_id);
      return doc;
    });

    await db.bulkDocs(docs);
  } catch (error) {
    console.error('Error bulk saving party purchases:', error);
    throw error;
  }
};

export const createPartyPurchase = async (purchase: Omit<PartyPurchase, 'id' | 'created_at' | 'updated_at'>): Promise<PartyPurchase> => {
  const db = await getPartyPurchasesDB();
  const id = generateUUID();
  const now = getCurrentTimestamp();

  const doc = {
    _id: toPouchID('party', id),
    ...purchase,
    created_at: now,
    updated_at: now
  };

  await db.put(doc);

  return {
    id,
    ...purchase,
    created_at: now,
    updated_at: now
  };
};

export const updatePartyPurchase = async (id: string, updates: Partial<PartyPurchase>): Promise<PartyPurchase | null> => {
  try {
    const db = await getPartyPurchasesDB();
    const docId = toPouchID('party', id);
    const doc: any = await db.get(docId);

    const updatedDoc = {
      ...doc,
      ...updates,
      _id: docId,
      _rev: doc._rev,
      updated_at: getCurrentTimestamp()
    };

    await db.put(updatedDoc);

    return {
      id: fromPouchID(updatedDoc._id),
      party_name: updatedDoc.party_name,
      item_name: updatedDoc.item_name,
      barcode: updatedDoc.barcode,
      purchase_price: updatedDoc.purchase_price,
      selling_price: updatedDoc.selling_price,
      purchased_quantity: updatedDoc.purchased_quantity,
      remaining_quantity: updatedDoc.remaining_quantity,
      purchase_date: updatedDoc.purchase_date,
      notes: updatedDoc.notes,
      created_at: updatedDoc.created_at,
      updated_at: updatedDoc.updated_at
    };
  } catch (error) {
    console.error('Error updating party purchase:', error);
    return null;
  }
};

export const getPartyPurchaseById = async (id: string): Promise<PartyPurchase | null> => {
  try {
    const db = await getPartyPurchasesDB();
    const docId = toPouchID('party', id);
    const doc: any = await db.get(docId);
    return {
      id: fromPouchID(doc._id),
      party_name: doc.party_name,
      item_name: doc.item_name,
      barcode: doc.barcode,
      purchase_price: doc.purchase_price,
      selling_price: doc.selling_price,
      purchased_quantity: doc.purchased_quantity,
      remaining_quantity: doc.remaining_quantity,
      purchase_date: doc.purchase_date,
      notes: doc.notes,
      created_at: doc.created_at,
      updated_at: doc.updated_at
    };
  } catch (error) {
    console.error('Error getting party purchase by ID:', error);
    return null;
  }
};

export const deletePartyPurchase = async (id: string): Promise<boolean> => {
  try {
    const db = await getPartyPurchasesDB();
    const docId = toPouchID('party', id);
    const doc = await db.get(docId);
    await db.remove(doc);
    
    // Log for sync
    await logDeletion('party_purchases', id);
    return true;
  } catch (error) {
    console.error('Error deleting party purchase:', error);
    return false;
  }
};

// ==================== YEARLY CLOSING STOCK ====================

export const saveYearlyClosingStock = async (records: Omit<YearlyStockRecord, 'id' | 'recorded_at'>[]): Promise<void> => {
  try {
    const { getYearlyClosingStockDB } = await import('./pouchdb-client');
    const db = await getYearlyClosingStockDB();
    const now = getCurrentTimestamp();

    const docs = records.map(r => ({
      _id: `closing_${r.product_id}_${r.financial_year.replace('-', '_')}`,
      ...r,
      recorded_at: now
    }));

    // Use bulkDocs to save all records
    await db.bulkDocs(docs);
  } catch (error) {
    console.error('Error saving yearly closing stock:', error);
    throw error;
  }
};

export const getClosingStockForYear = async (financialYear: string): Promise<Record<string, number>> => {
  try {
    const { getYearlyClosingStockDB } = await import('./pouchdb-client');
    const db = await getYearlyClosingStockDB();
    const result = await db.find({
      selector: {
        financial_year: financialYear
      },
      limit: 10000
    });

    const stockMap: Record<string, number> = {};
    result.docs.forEach((doc: any) => {
      stockMap[doc.product_id] = doc.closing_stock;
    });

    return stockMap;
  } catch (error) {
    console.error('Error getting closing stock for year:', error);
    return {};
  }
};

let productHistoryDB: any = null;

const getProductHistoryDB = () => {
  if (!productHistoryDB && typeof window !== 'undefined') {
    const PouchDB = require('pouchdb-browser').default;
    productHistoryDB = new PouchDB('product_history');
  }
  return productHistoryDB;
};

export const saveProductHistory = async (entry: any): Promise<void> => {
  try {
    const db = getProductHistoryDB();
    const docId = `history_${entry.id}`;
    await db.put({
      _id: docId,
      ...entry
    });
  } catch (error) {
    console.error('Error saving product history:', error);
    throw error;
  }
};

export const saveProductHistoryBulk = async (entries: any[]): Promise<void> => {
  try {
    const db = getProductHistoryDB();
    const docs = entries.map(entry => ({
      _id: `history_${entry.id}`,
      ...entry
    }));
    await db.bulkDocs(docs);
  } catch (error) {
    console.error('Error saving product history bulk:', error);
    throw error;
  }
};

export const getAllProductHistory = async (): Promise<any[]> => {
  try {
    const db = getProductHistoryDB();
    const result = await db.allDocs({
      include_docs: true,
      startkey: 'history_',
      endkey: 'history_\\ufff0'
    });
    return result.rows.map((row: any) => ({
      id: row.doc.id,
      product_id: row.doc.product_id,
      product_name: row.doc.product_name,
      action: row.doc.action,
      quantity_change: row.doc.quantity_change,
      stock_before: row.doc.stock_before,
      stock_after: row.doc.stock_after,
      date: row.doc.date,
      notes: row.doc.notes
    }));
  } catch (error) {
    console.error('Error getting all product history:', error);
    return [];
  }
};

export const getProductHistory = async (productId: string): Promise<any[]> => {
  try {
    const db = getProductHistoryDB();
    const result = await db.allDocs({ include_docs: true });
    return result.rows
      .map((row: any) => row.doc)
      .filter((doc: any) => doc.product_id === productId)
      .map((doc: any) => ({
        id: doc.id,
        product_id: doc.product_id,
        product_name: doc.product_name,
        action: doc.action,
        quantity_change: doc.quantity_change,
        stock_before: doc.stock_before,
        stock_after: doc.stock_after,
        date: doc.date,
        notes: doc.notes
      }));
  } catch (error) {
    console.error('Error getting product history:', error);
    return [];
  }
};

export const deleteProductHistory = async (historyId: string): Promise<void> => {
  try {
    const db = getProductHistoryDB();
    const docId = `history_${historyId}`;
    const doc = await db.get(docId);
    await db.remove(doc);
  } catch (error) {
    console.error('Error deleting product history entry:', error);
    throw error;
  }
};
// ==================== DELETION LOG ====================

/**
 * Logs a deletion for offline synchronization
 */
const logDeletion = async (table: string, id: string): Promise<void> => {
  try {
    const db = await getDeletionLogDB();
    const docId = `del_${table}_${id}`;
    
    await db.put({
      _id: docId,
      table,
      record_id: id,
      deleted_at: getCurrentTimestamp()
    });
  } catch (error) {
    console.error(`Error logging deletion for ${table}:${id}:`, error);
  }
};

/**
 * Gets all pending deletions for synchronization
 */
export const getPendingDeletions = async (): Promise<any[]> => {
  try {
    const db = await getDeletionLogDB();
    const result = await db.allDocs({
      include_docs: true,
      startkey: 'del_',
      endkey: 'del_\\ufff0'
    });
    return result.rows.map(row => row.doc);
  } catch (error) {
    console.error('Error getting pending deletions:', error);
    return [];
  }
};

/**
 * Clears a deletion from the log after successful synchronization
 */
export const clearDeletion = async (logDoc: any): Promise<void> => {
  try {
    const db = await getDeletionLogDB();
    await db.remove(logDoc);
  } catch (error) {
    console.error('Error clearing deletion log:', error);
  }
};

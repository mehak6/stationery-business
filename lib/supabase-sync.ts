'use client';

import { supabase } from '../supabase_client';
import {
  getProductsDB,
  getSalesDB,
  getCategoriesDB,
  getPartyPurchasesDB,
  getSyncMetaDB
} from './pouchdb-client';
import type { Product, Sale, Category, PartyPurchase } from './offline-db';
import * as OfflineDB from './offline-db';
import { hasConflict, resolveEntityConflict } from './conflict-resolver';

/**
 * Supabase Synchronization Engine (Offline-First)
 * 
 * Strategy:
 * 1. Pull changes from Supabase since last sync
 * 2. Resolve conflicts locally using Last-Write-Wins (LWW)
 * 3. Push local changes to Supabase
 */

interface SyncMeta {
  _id: string;
  _rev?: string;
  last_sync_time: string;
}

const getSyncMeta = async (table: string): Promise<SyncMeta> => {
  const db = await getSyncMetaDB();
  const id = `sync_meta_${table}`;
  try {
    return await db.get(id);
  } catch {
    return { _id: id, last_sync_time: new Date(0).toISOString() };
  }
};

const updateSyncMeta = async (table: string, time: string): Promise<void> => {
  const db = await getSyncMetaDB();
  const meta = await getSyncMeta(table);
  await db.put({
    ...meta,
    last_sync_time: time
  });
};

/**
 * Sanitizes an object by removing PouchDB internal fields and ensuring 
 * only valid schema fields are sent to Supabase.
 */
const sanitizeForSupabase = (entity: string, data: any): any => {
  // Remove PouchDB internals
  const { _id, _rev, ...cleanData } = data;
  
  // Specific table filtering based on Database types
  switch (entity) {
    case 'product':
      return {
        id: cleanData.id,
        name: cleanData.name,
        category_id: cleanData.category_id,
        barcode: cleanData.barcode,
        purchase_price: Number(cleanData.purchase_price) || 0,
        selling_price: Number(cleanData.selling_price) || 0,
        stock_quantity: Number(cleanData.stock_quantity) || 0,
        min_stock_level: Number(cleanData.min_stock_level) || 0,
        supplier_info: cleanData.supplier_info,
        image_url: cleanData.image_url,
        description: cleanData.description,
        created_at: cleanData.created_at,
        updated_at: cleanData.updated_at
      };
    case 'sale':
      return {
        id: cleanData.id,
        product_id: cleanData.product_id,
        quantity: Number(cleanData.quantity) || 0,
        unit_price: Number(cleanData.unit_price) || 0,
        total_amount: Number(cleanData.total_amount) || 0,
        profit: Number(cleanData.profit) || 0,
        customer_info: cleanData.customer_info,
        sale_date: cleanData.sale_date,
        notes: cleanData.notes,
        created_at: cleanData.created_at
      };
    case 'category':
      return {
        id: cleanData.id,
        name: cleanData.name,
        description: cleanData.description,
        created_at: cleanData.created_at
      };
    case 'party_purchase':
      return {
        id: cleanData.id,
        party_name: cleanData.party_name,
        item_name: cleanData.item_name,
        barcode: cleanData.barcode,
        purchase_price: Number(cleanData.purchase_price) || 0,
        selling_price: Number(cleanData.selling_price) || 0,
        purchased_quantity: Number(cleanData.purchased_quantity) || 0,
        remaining_quantity: Number(cleanData.remaining_quantity) || 0,
        purchase_date: cleanData.purchase_date,
        notes: cleanData.notes,
        created_at: cleanData.created_at,
        updated_at: cleanData.updated_at
      };
    default:
      return cleanData;
  }
};

const logSupabaseError = (context: string, error: any) => {
  console.error(`❌ Supabase Error during ${context}:`, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint
  });
};

// ==================== PRODUCTS SYNC ====================

export const syncProducts = async () => {
  const meta = await getSyncMeta('products');
  const syncStartTime = new Date().toISOString();
  let stats = { pull: 0, push: 0, errors: 0 };

  try {
    // 1. PULL changes from Supabase
    const { data: remoteData, error: pullError } = await (supabase.from('products') as any)
      .select('*')
      .gt('updated_at', meta.last_sync_time);

    if (pullError) {
      logSupabaseError('pull products', pullError);
      throw pullError;
    }

    if (remoteData && remoteData.length > 0) {
      const remoteItems = remoteData as Product[];
      const localProducts = await OfflineDB.getAllProducts();
      const localMap = new Map(localProducts.map(p => [p.id, p]));
      
      const toSave: Product[] = [];
      for (const remote of remoteItems) {
        const local = localMap.get(remote.id);
        if (local && hasConflict(local, remote)) {
          const resolved = resolveEntityConflict('product', local, remote);
          toSave.push(resolved);
        } else {
          toSave.push(remote);
        }
      }
      
      await OfflineDB.bulkSaveProducts(toSave);
      stats.pull = toSave.length;
    }

    // 2. PUSH changes to Supabase
    const currentLocalProducts = await OfflineDB.getAllProducts();
    const toPush = currentLocalProducts
      .filter(p => p.updated_at > meta.last_sync_time)
      .map(p => sanitizeForSupabase('product', p));

    if (toPush.length > 0) {
      const { error: pushError } = await (supabase.from('products') as any)
        .upsert(toPush);

      if (pushError) {
        logSupabaseError('push products', pushError);
        throw pushError;
      }
      stats.push = toPush.length;
    }

    await updateSyncMeta('products', syncStartTime);
  } catch (err) {
    stats.errors++;
    throw err; // Propagate to stop sequential sync
  }

  return stats;
};

// ==================== SALES SYNC ====================

export const syncSales = async () => {
  const meta = await getSyncMeta('sales');
  const syncStartTime = new Date().toISOString();
  let stats = { pull: 0, push: 0, errors: 0 };

  try {
    // 1. PULL
    const { data: remoteData, error: pullError } = await (supabase.from('sales') as any)
      .select('*')
      .gt('created_at', meta.last_sync_time);

    if (pullError) {
      logSupabaseError('pull sales', pullError);
      throw pullError;
    }

    if (remoteData && remoteData.length > 0) {
      await OfflineDB.bulkSaveSales(remoteData as Sale[]);
      stats.pull = remoteData.length;
    }

    // 2. PUSH
    const localSales = await OfflineDB.getAllSales();
    const toPush = localSales
      .filter(s => s.created_at > meta.last_sync_time)
      .map(s => sanitizeForSupabase('sale', s));

    if (toPush.length > 0) {
      const { error: pushError } = await (supabase.from('sales') as any)
        .upsert(toPush);

      if (pushError) {
        logSupabaseError('push sales', pushError);
        throw pushError;
      }
      stats.push = toPush.length;
    }

    await updateSyncMeta('sales', syncStartTime);
  } catch (err) {
    stats.errors++;
    throw err;
  }

  return stats;
};

// ==================== CATEGORIES SYNC ====================

export const syncCategories = async () => {
  const meta = await getSyncMeta('categories');
  const syncStartTime = new Date().toISOString();
  let stats = { pull: 0, push: 0, errors: 0 };

  try {
    // 1. PULL
    const { data: remoteData, error: pullError } = await (supabase.from('categories') as any)
      .select('*')
      .gt('created_at', meta.last_sync_time);

    if (pullError) {
      logSupabaseError('pull categories', pullError);
      throw pullError;
    }

    if (remoteData && remoteData.length > 0) {
      await OfflineDB.bulkSaveCategories(remoteData as Category[]);
      stats.pull = remoteData.length;
    }

    // 2. PUSH
    const localCats = await OfflineDB.getAllCategories();
    const toPush = localCats
      .filter(c => c.created_at > meta.last_sync_time)
      .map(c => sanitizeForSupabase('category', c));

    if (toPush.length > 0) {
      const { error: pushError } = await (supabase.from('categories') as any)
        .upsert(toPush);
      
      if (pushError) {
        logSupabaseError('push categories', pushError);
        throw pushError;
      }
      stats.push = toPush.length;
    }

    await updateSyncMeta('categories', syncStartTime);
  } catch (err) {
    stats.errors++;
    throw err;
  }
  return stats;
};

// ==================== PARTY PURCHASES SYNC ====================

export const syncPartyPurchases = async () => {
  const meta = await getSyncMeta('party_purchases');
  const syncStartTime = new Date().toISOString();
  let stats = { pull: 0, push: 0, errors: 0 };

  try {
    // 1. PULL
    const { data: remoteData, error: pullError } = await (supabase.from('party_purchases') as any)
      .select('*')
      .gt('updated_at', meta.last_sync_time);

    if (pullError) {
      logSupabaseError('pull party_purchases', pullError);
      throw pullError;
    }

    if (remoteData && remoteData.length > 0) {
      const remoteItems = remoteData as PartyPurchase[];
      const localItems = await OfflineDB.getAllPartyPurchases();
      const localMap = new Map(localItems.map(p => [p.id, p]));
      
      const toSave: PartyPurchase[] = [];
      for (const remote of remoteItems) {
        const local = localMap.get(remote.id);
        if (local && hasConflict(local, remote)) {
          const resolved = resolveEntityConflict('party_purchase', local, remote);
          toSave.push(resolved);
        } else {
          toSave.push(remote);
        }
      }
      
      await OfflineDB.bulkSavePartyPurchases(toSave);
      stats.pull = toSave.length;
    }

    // 2. PUSH
    const localPP = await OfflineDB.getAllPartyPurchases();
    const toPush = localPP
      .filter(p => p.updated_at > meta.last_sync_time)
      .map(p => sanitizeForSupabase('party_purchase', p));

    if (toPush.length > 0) {
      const { error: pushError } = await (supabase.from('party_purchases') as any)
        .upsert(toPush);
      
      if (pushError) {
        logSupabaseError('push party_purchases', pushError);
        throw pushError;
      }
      stats.push = toPush.length;
    }

    await updateSyncMeta('party_purchases', syncStartTime);
  } catch (err) {
    stats.errors++;
    throw err;
  }
  return stats;
};

// ==================== DELETIONS SYNC ====================

export const syncDeletions = async () => {
  const pendingDeletions = await OfflineDB.getPendingDeletions();
  if (pendingDeletions.length === 0) return 0;

  const byTable: Record<string, any[]> = {};
  pendingDeletions.forEach(del => {
    if (!byTable[del.table]) byTable[del.table] = [];
    byTable[del.table].push(del);
  });

  let totalCount = 0;

  for (const table of Object.keys(byTable)) {
    const deletions = byTable[table];
    const ids = deletions.map(d => d.record_id);

    try {
      const { error } = await (supabase.from(table) as any)
        .delete()
        .in('id', ids);

      if (!error) {
        for (const del of deletions) {
          await OfflineDB.clearDeletion(del);
        }
        totalCount += deletions.length;
      } else {
        logSupabaseError(`delete from ${table}`, error);
      }
    } catch (err) {
      console.error(`Exception during batch deletion for ${table}:`, err);
    }
  }

  return totalCount;
};

// ==================== FULL SYNC ====================

export const performFullSync = async () => {
  console.log('Starting sequential synchronization with pre-flight checks...');
  
  const stats: any = {
    products: { pull: 0, push: 0, errors: 0 },
    sales: { pull: 0, push: 0, errors: 0 },
    categories: { pull: 0, push: 0, errors: 0 },
    partyPurchases: { pull: 0, push: 0, errors: 0 },
    deletions: 0,
    timestamp: new Date().toISOString()
  };

  try {
    // 0. Pre-flight check: Auth session
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError) throw authError;
    if (!session) throw new Error('No active Supabase session. Please log in again.');

    // 1. Sync Categories first
    console.log('Syncing categories...');
    stats.categories = await syncCategories();

    // 2. Sync Products
    console.log('Syncing products...');
    stats.products = await syncProducts();

    // 3. Sync Sales and Party Purchases
    console.log('Syncing sales...');
    stats.sales = await syncSales();

    console.log('Syncing party purchases...');
    stats.partyPurchases = await syncPartyPurchases();

    // 4. Sync Deletions
    console.log('Syncing deletions...');
    stats.deletions = await syncDeletions();

    console.log('Sync completed successfully:', stats);
    return stats;
  } catch (err: any) {
    console.error('Critical sync failure:', err);
    throw new Error(`Sync failed: ${err.message || 'Check browser console for detailed Supabase error.'}`);
  }
};

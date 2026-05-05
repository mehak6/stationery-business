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

// ==================== PRODUCTS SYNC ====================

export const syncProducts = async () => {
  const meta = await getSyncMeta('products');
  const syncStartTime = new Date().toISOString();
  
  let stats = { pull: 0, push: 0, errors: 0 };

  try {
    // 1. PULL changes from Supabase (Batch)
    const { data: remoteData, error: pullError } = await (supabase.from('products') as any)
      .select('*')
      .gt('updated_at', meta.last_sync_time);

    if (pullError) throw pullError;

    if (remoteData && (remoteData as any[]).length > 0) {
      const remoteItems = remoteData as Product[];
      // Optimization: Resolve all conflicts in memory before bulk save
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

    // 2. PUSH changes to Supabase (Batch)
    const currentLocalProducts = await OfflineDB.getAllProducts();
    const toPush = currentLocalProducts.filter(p => p.updated_at > meta.last_sync_time);

    if (toPush.length > 0) {
      // Bulk upsert to Supabase is much faster than sequential
      const { error: pushError } = await (supabase.from('products') as any)
        .upsert(toPush);

      if (pushError) throw pushError;
      stats.push = toPush.length;
    }

    await updateSyncMeta('products', syncStartTime);
  } catch (err) {
    console.error('Products sync failed:', err);
    stats.errors++;
  }

  return stats;
};

// ==================== SALES SYNC ====================

export const syncSales = async () => {
  const meta = await getSyncMeta('sales');
  const syncStartTime = new Date().toISOString();
  let stats = { pull: 0, push: 0, errors: 0 };

  try {
    // 1. PULL (Batch)
    const { data: remoteData, error: pullError } = await (supabase.from('sales') as any)
      .select('*')
      .gt('created_at', meta.last_sync_time);

    if (pullError) throw pullError;

    if (remoteData && (remoteData as any[]).length > 0) {
      await OfflineDB.bulkSaveSales(remoteData as Sale[]);
      stats.pull = (remoteData as any[]).length;
    }

    // 2. PUSH (Batch)
    const localSales = await OfflineDB.getAllSales();
    const toPush = localSales.filter(s => s.created_at > meta.last_sync_time);

    if (toPush.length > 0) {
      const { error: pushError } = await (supabase.from('sales') as any)
        .upsert(toPush);

      if (pushError) throw pushError;
      stats.push = toPush.length;
    }

    await updateSyncMeta('sales', syncStartTime);
  } catch (err) {
    console.error('Sales sync failed:', err);
    stats.errors++;
  }

  return stats;
};

// ==================== CATEGORIES SYNC ====================

export const syncCategories = async () => {
  const meta = await getSyncMeta('categories');
  const syncStartTime = new Date().toISOString();
  let stats = { pull: 0, push: 0, errors: 0 };

  try {
    // 1. PULL (Batch)
    const { data: remoteData, error: pullError } = await (supabase.from('categories') as any)
      .select('*')
      .gt('created_at', meta.last_sync_time);

    if (pullError) throw pullError;

    if (remoteData && (remoteData as any[]).length > 0) {
      await OfflineDB.bulkSaveCategories(remoteData as Category[]);
      stats.pull = (remoteData as any[]).length;
    }

    // 2. PUSH (Batch)
    const localCats = await OfflineDB.getAllCategories();
    const toPush = localCats.filter(c => c.created_at > meta.last_sync_time);

    if (toPush.length > 0) {
      const { error: pushError } = await (supabase.from('categories') as any)
        .upsert(toPush);
      if (pushError) throw pushError;
      stats.push = toPush.length;
    }

    await updateSyncMeta('categories', syncStartTime);
  } catch (err) {
    console.error('Categories sync failed:', err);
    stats.errors++;
  }
  return stats;
};

// ==================== PARTY PURCHASES SYNC ====================

export const syncPartyPurchases = async () => {
  const meta = await getSyncMeta('party_purchases');
  const syncStartTime = new Date().toISOString();
  let stats = { pull: 0, push: 0, errors: 0 };

  try {
    // 1. PULL (Batch)
    const { data: remoteData, error: pullError } = await (supabase.from('party_purchases') as any)
      .select('*')
      .gt('updated_at', meta.last_sync_time);

    if (pullError) throw pullError;

    if (remoteData && (remoteData as any[]).length > 0) {
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

    // 2. PUSH (Batch)
    const localPP = await OfflineDB.getAllPartyPurchases();
    const toPush = localPP.filter(p => p.updated_at > meta.last_sync_time);

    if (toPush.length > 0) {
      const { error: pushError } = await (supabase.from('party_purchases') as any)
        .upsert(toPush);
      if (pushError) throw pushError;
      stats.push = toPush.length;
    }

    await updateSyncMeta('party_purchases', syncStartTime);
  } catch (err) {
    console.error('Party purchases sync failed:', err);
    stats.errors++;
  }
  return stats;
};

// ==================== DELETIONS SYNC ====================

export const syncDeletions = async () => {
  const pendingDeletions = await OfflineDB.getPendingDeletions();
  if (pendingDeletions.length === 0) return 0;

  // Group deletions by table
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
        console.error(`Failed to batch sync deletions for ${table}:`, error);
      }
    } catch (err) {
      console.error(`Exception during batch deletion for ${table}:`, err);
    }
  }

  return totalCount;
};

// ==================== FULL SYNC ====================

export const performFullSync = async () => {
  console.log('Starting sequential synchronization...');
  
  const stats: any = {
    products: { pull: 0, push: 0, errors: 0 },
    sales: { pull: 0, push: 0, errors: 0 },
    categories: { pull: 0, push: 0, errors: 0 },
    partyPurchases: { pull: 0, push: 0, errors: 0 },
    deletions: 0,
    timestamp: new Date().toISOString()
  };

  try {
    // 1. Sync Categories first (Dependency for Products)
    console.log('Syncing categories...');
    stats.categories = await syncCategories();

    // 2. Sync Products (Dependency for Sales)
    console.log('Syncing products...');
    stats.products = await syncProducts();

    // 3. Sync Sales and Party Purchases (Leaf nodes)
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
    console.error('Sync failed at some stage:', err);
    // Return partial stats so UI can see where it failed if needed
    throw new Error(`Sync failed: ${err.message || 'Unknown error'}`);
  }
};

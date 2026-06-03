'use client';

// Lazy load PouchDB only on client side
let PouchDB: any = null;
let PouchDBFind: any = null;

const loadPouchDB = async () => {
  if (typeof window === 'undefined') return;
  if (PouchDB) return; // Already loaded

  try {
    PouchDB = (await import('pouchdb-browser')).default;
    PouchDBFind = (await import('pouchdb-find')).default;
    PouchDB.plugin(PouchDBFind);
  } catch (err) {
    console.error('Failed to load PouchDB:', err);
  }
};

// Database version for migrations
const DB_VERSION = 1;

// Initialize PouchDB instances for each collection
let productsDB: PouchDB.Database | null = null;
let salesDB: PouchDB.Database | null = null;
let categoriesDB: PouchDB.Database | null = null;
let partyPurchasesDB: PouchDB.Database | null = null;
let yearlyClosingStockDB: PouchDB.Database | null = null;
let syncMetaDB: PouchDB.Database | null = null;
let deletionLogDB: PouchDB.Database | null = null;

// Initialization state tracking
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

// Initialize databases only on client side
export const initializeDatabases = async () => {
  if (typeof window === 'undefined') return;

  // If already initialized, return immediately
  if (isInitialized) return;

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    await initializationPromise;
    return;
  }

  // Start initialization
  initializationPromise = (async () => {
    // Load PouchDB first
    await loadPouchDB();
    if (!PouchDB) return;

    if (!productsDB) {
      productsDB = new PouchDB('inventory_products', {
        auto_compaction: true,
        revs_limit: 10
      });
    }

    if (!salesDB) {
      salesDB = new PouchDB('inventory_sales', {
        auto_compaction: true,
        revs_limit: 10
      });
    }

    if (!categoriesDB) {
      categoriesDB = new PouchDB('inventory_categories', {
        auto_compaction: true,
        revs_limit: 10
      });
    }

    if (!partyPurchasesDB) {
      partyPurchasesDB = new PouchDB('inventory_party_purchases', {
        auto_compaction: true,
        revs_limit: 10
      });
    }

    if (!yearlyClosingStockDB) {
      yearlyClosingStockDB = new PouchDB('inventory_yearly_closing_stock', {
        auto_compaction: true,
        revs_limit: 10
      });
    }

    if (!syncMetaDB) {
      syncMetaDB = new PouchDB('inventory_sync_meta', {
        auto_compaction: true,
        revs_limit: 5
      });
    }

    if (!deletionLogDB) {
      deletionLogDB = new PouchDB('inventory_deletion_log', {
        auto_compaction: true,
        revs_limit: 100
      });
    }

    // Create indexes for better query performance and wait for them!
    await createIndexes();

    isInitialized = true;
    console.log('✅ PouchDB databases initialized successfully');
  })();

  await initializationPromise;
};

// Check if databases are initialized
export const isDatabaseInitialized = (): boolean => {
  return isInitialized;
};

// Wait for database initialization
export const waitForDatabaseInit = async (): Promise<void> => {
  if (isInitialized) return;
  if (initializationPromise) {
    await initializationPromise;
    return;
  }
  await initializeDatabases();
};

// Create indexes for each database
const createIndexes = async () => {
  try {
    // Products indexes
    if (productsDB) {
      await productsDB.createIndex({
        index: { fields: ['name'] }
      });
      await productsDB.createIndex({
        index: { fields: ['barcode'] }
      });
      await productsDB.createIndex({
        index: { fields: ['category_id'] }
      });
      await productsDB.createIndex({
        index: { fields: ['stock_quantity'] }
      });
      await productsDB.createIndex({
        index: { fields: ['created_at'] }
      });
    }

    // Sales indexes
    if (salesDB) {
      await salesDB.createIndex({
        index: { fields: ['product_id'] }
      });
      await salesDB.createIndex({
        index: { fields: ['sale_date'] }
      });
      await salesDB.createIndex({
        index: { fields: ['created_at'] }
      });
    }

    // Categories indexes
    if (categoriesDB) {
      await categoriesDB.createIndex({
        index: { fields: ['name'] }
      });
    }

    // Party purchases indexes
    if (partyPurchasesDB) {
      await partyPurchasesDB.createIndex({
        index: { fields: ['party_name'] }
      });
      await partyPurchasesDB.createIndex({
        index: { fields: ['item_name'] }
      });
      await partyPurchasesDB.createIndex({
        index: { fields: ['purchase_date'] }
      });
    }

    if (yearlyClosingStockDB) {
      await yearlyClosingStockDB.createIndex({
        index: { fields: ['financial_year'] }
      });
    }

    console.log('✅ PouchDB indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  }
};

// Get database instances (async to ensure initialization)
export const getProductsDB = async (): Promise<PouchDB.Database> => {
  await waitForDatabaseInit();
  if (!productsDB) {
    throw new Error('Products database not initialized');
  }
  return productsDB;
};

export const getSalesDB = async (): Promise<PouchDB.Database> => {
  await waitForDatabaseInit();
  if (!salesDB) {
    throw new Error('Sales database not initialized');
  }
  return salesDB;
};

export const getCategoriesDB = async (): Promise<PouchDB.Database> => {
  await waitForDatabaseInit();
  if (!categoriesDB) {
    throw new Error('Categories database not initialized');
  }
  return categoriesDB;
};

export const getPartyPurchasesDB = async (): Promise<PouchDB.Database> => {
  await waitForDatabaseInit();
  if (!partyPurchasesDB) {
    throw new Error('Party purchases database not initialized');
  }
  return partyPurchasesDB;
};

export const getYearlyClosingStockDB = async (): Promise<PouchDB.Database> => {
  await waitForDatabaseInit();
  if (!yearlyClosingStockDB) {
    throw new Error('Yearly closing stock database not initialized');
  }
  return yearlyClosingStockDB;
};

export const getSyncMetaDB = async (): Promise<PouchDB.Database> => {
  await waitForDatabaseInit();
  if (!syncMetaDB) {
    throw new Error('Sync meta database not initialized');
  }
  return syncMetaDB;
};

export const getDeletionLogDB = async (): Promise<PouchDB.Database> => {
  await waitForDatabaseInit();
  if (!deletionLogDB) {
    throw new Error('Deletion log database not initialized');
  }
  return deletionLogDB;
};

// Utility: Generate UUID for document IDs
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Utility: Convert UUID to PouchDB ID format
export const toPouchID = (prefix: string, uuid: string): string => {
  return `${prefix}_${uuid}`;
};

// Utility: Extract UUID from PouchDB ID
export const fromPouchID = (pouchId: string): string => {
  const parts = pouchId.split('_');
  return parts.slice(1).join('_');
};

// Utility: Get current timestamp
export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

// Database info and stats
export const getDatabaseInfo = async () => {
  const info = {
    products: await productsDB?.info(),
    sales: await salesDB?.info(),
    categories: await categoriesDB?.info(),
    partyPurchases: await partyPurchasesDB?.info(),
    syncMeta: await syncMetaDB?.info(),
  };
  return info;
};

// Clear operational cache databases and recreate them.
export const clearOperationalDatabases = async () => {
  try {
    await initializeDatabases();
    await productsDB?.destroy();
    await salesDB?.destroy();
    await categoriesDB?.destroy();
    await partyPurchasesDB?.destroy();
    await syncMetaDB?.destroy();
    await deletionLogDB?.destroy();

    productsDB = null;
    salesDB = null;
    categoriesDB = null;
    partyPurchasesDB = null;
    syncMetaDB = null;
    deletionLogDB = null;
    isInitialized = false;
    initializationPromise = null;

    await initializeDatabases();
    console.log('Operational cache databases cleared and reinitialized');
  } catch (error) {
    console.error('Error clearing operational cache databases:', error);
    throw error;
  }
};

// Clear all databases (for testing/reset)
export const clearAllDatabases = async () => {
  try {
    await productsDB?.destroy();
    await salesDB?.destroy();
    await categoriesDB?.destroy();
    await partyPurchasesDB?.destroy();
    await syncMetaDB?.destroy();
    await deletionLogDB?.destroy();

    // Reinitialize
    productsDB = null;
    salesDB = null;
    categoriesDB = null;
    partyPurchasesDB = null;
    syncMetaDB = null;
    deletionLogDB = null;

    initializeDatabases();

    console.log('✅ All databases cleared and reinitialized');
  } catch (error) {
    console.error('❌ Error clearing databases:', error);
  }
};

// Export database version
export { DB_VERSION };

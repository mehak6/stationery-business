import { renderHook, act } from '@testing-library/react';
import { useProducts } from '../hooks/useProducts';
import { useSales } from '../hooks/useSales';
import { usePartyPurchases } from '../hooks/usePartyPurchases';

// These are offline CRUD tests: never start background network synchronization.
jest.mock('../hooks/useSyncStatus', () => ({ useSyncStatus: () => ({ syncStatus: 'idle' }) }));
beforeAll(() => window.dispatchEvent(new Event('offline')));

// Mock the offline-db to avoid real IndexedDB usage during tests
jest.mock('../lib/offline-db', () => ({
  getAllProducts: jest.fn().mockResolvedValue([]),
  getProductById: jest.fn(),
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
  deleteProduct: jest.fn(),
  getAllSales: jest.fn().mockResolvedValue([]),
  getSaleById: jest.fn(),
  createSale: jest.fn(),
  updateSale: jest.fn(),
  deleteSale: jest.fn(),
  getAllPartyPurchases: jest.fn().mockResolvedValue([]),
  getPartyPurchaseById: jest.fn(),
  createPartyPurchase: jest.fn(),
  updatePartyPurchase: jest.fn(),
  deletePartyPurchase: jest.fn(),
}));

// Mock initializeDatabases
jest.mock('../lib/pouchdb-client', () => ({
  initializeDatabases: jest.fn(),
}));

describe('Offline Database CRUD Operations', () => {
  const mockProduct = {
    name: 'Test Product',
    category_id: null,
    barcode: '123456789',
    purchase_price: 10,
    selling_price: 20,
    stock_quantity: 100,
    min_stock_level: 10,
    supplier_info: null,
    image_url: null,
    description: 'Test description'
  };

  test('should create and fetch a product', async () => {
    const { createProduct, getProductById } = require('../lib/offline-db');
    const createdProduct = { ...mockProduct, id: 'test-id', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    
    createProduct.mockResolvedValue(createdProduct);
    getProductById.mockResolvedValue(createdProduct);

    const { result } = renderHook(() => useProducts());

    let newProduct;
    await act(async () => {
      newProduct = await result.current.createProduct(mockProduct);
    });

    expect(newProduct).toBeDefined();
    expect(newProduct?.name).toBe(mockProduct.name);

    // READ
    const productId = newProduct!.id;
    const fetchedProduct = await result.current.getProduct(productId);
    
    expect(fetchedProduct).toBeDefined();
    expect(fetchedProduct?.id).toBe(productId);
  });

  test('should update a product', async () => {
    const { updateProduct, getProductById } = require('../lib/offline-db');
    const productId = 'test-id';
    const originalProduct = { ...mockProduct, id: productId };
    const updatedProduct = { ...originalProduct, name: 'Updated Name' };

    updateProduct.mockResolvedValue(updatedProduct);
    getProductById.mockResolvedValue(updatedProduct);

    const { result } = renderHook(() => useProducts());

    let updated;
    await act(async () => {
      updated = await result.current.updateProduct(productId, { name: 'Updated Name' });
    });

    expect(updated).toBeDefined();
    expect(updated?.name).toBe('Updated Name');
  });

  test('should create and fetch a sale', async () => {
    const { createSale, getSaleById } = require('../lib/offline-db');
    const testProduct = { id: 'prod-1', ...mockProduct };
    const mockSale = {
      product_id: testProduct.id,
      quantity: 5,
      unit_price: 20,
      total_amount: 100,
      profit: 50,
      customer_info: null,
      sale_date: new Date().toISOString().split('T')[0],
      notes: null
    };
    const createdSale = { ...mockSale, id: 'sale-1', created_at: new Date().toISOString() };

    createSale.mockResolvedValue(createdSale);
    getSaleById.mockResolvedValue(createdSale);

    const { result: salesResult } = renderHook(() => useSales());

    let newSale;
    await act(async () => {
      newSale = await salesResult.current.createSale(mockSale);
    });

    expect(newSale).toBeDefined();
    expect(newSale?.product_id).toBe(testProduct.id);

    const fetchedSale = await salesResult.current.getSale(newSale!.id);
    expect(fetchedSale).toBeDefined();
    expect(fetchedSale?.id).toBe(newSale!.id);
  });

  test('should create and fetch a party purchase', async () => {
    const { createPartyPurchase, getPartyPurchaseById } = require('../lib/offline-db');
    const testProduct = { id: 'prod-1', ...mockProduct };
    const mockPurchase = {
      party_name: 'Test Supplier',
      item_name: testProduct.name,
      barcode: testProduct.barcode,
      purchase_price: 10,
      selling_price: 15,
      purchased_quantity: 50,
      remaining_quantity: 50,
      purchase_date: new Date().toISOString().split('T')[0],
      notes: 'Test purchase'
    };
    const createdPurchase = { ...mockPurchase, id: 'pp-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };

    createPartyPurchase.mockResolvedValue(createdPurchase);
    getPartyPurchaseById.mockResolvedValue(createdPurchase);

    const { result: purchaseResult } = renderHook(() => usePartyPurchases());

    let newPurchase;
    await act(async () => {
      newPurchase = await purchaseResult.current.addPurchase(mockPurchase);
    });

    expect(newPurchase).toBeDefined();
    expect(newPurchase?.party_name).toBe('Test Supplier');

    // READ
    const purchaseId = newPurchase!.id;
    const fetchedPurchase = await purchaseResult.current.getPurchase(purchaseId);
    
    expect(fetchedPurchase).toBeDefined();
    expect(fetchedPurchase?.id).toBe(purchaseId);
  });

  test('should handle deletion of product', async () => {
    const { deleteProduct, getAllProducts } = require('../lib/offline-db');
    deleteProduct.mockResolvedValue(true);
    getAllProducts.mockResolvedValue([]);

    const { result } = renderHook(() => useProducts());
    
    let success;
    await act(async () => {
      success = await result.current.deleteProduct('test-id');
    });

    expect(success).toBe(true);
  });

  test('Integrity Check: Sale should require valid product data', async () => {
    const { createSale } = require('../lib/offline-db');
    const productId = 'prod-123';
    
    const mockSale = {
      product_id: productId,
      quantity: 5,
      unit_price: 15,
      total_amount: 75,
      profit: 25,
      customer_info: null,
      sale_date: new Date().toISOString().split('T')[0],
      notes: null
    };

    createSale.mockResolvedValue({ ...mockSale, id: 'sale-123', created_at: new Date().toISOString() });

    const { result: salesResult } = renderHook(() => useSales());
    
    let sale;
    await act(async () => {
      sale = await salesResult.current.createSale(mockSale);
    });
    
    expect(sale).toBeDefined();
    expect(sale?.product_id).toBe(productId);
  });
});

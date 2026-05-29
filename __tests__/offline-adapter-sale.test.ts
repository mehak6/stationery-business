import { createSale } from '../lib/offline-adapter';
import * as OfflineDB from '../lib/offline-db';
import { supabase } from '../supabase_client';

jest.mock('../lib/offline-db', () => ({
  createSale: jest.fn(),
  updateProduct: jest.fn(),
  saveSale: jest.fn(),
  saveProduct: jest.fn(),
}));

jest.mock('../supabase_client', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

const setOnlineStatus = (online: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: online,
  });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
};

describe('offline-adapter sale stock handling', () => {
  const saleInput = {
    product_id: 'product-1',
    quantity: 3,
    unit_price: 20,
    total_amount: 60,
    profit: 15,
    customer_info: null,
    sale_date: '2026-05-29',
    notes: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setOnlineStatus(true);
  });

  test('offline sale delegates stock deduction to OfflineDB.createSale only once', async () => {
    const createdSale = {
      id: 'sale-1',
      ...saleInput,
      created_at: '2026-05-29T10:00:00.000Z',
      updated_at: '2026-05-29T10:00:00.000Z',
    };
    (OfflineDB.createSale as jest.Mock).mockResolvedValue(createdSale);

    setOnlineStatus(false);

    await expect(createSale(saleInput)).resolves.toEqual(createdSale);
    expect(OfflineDB.createSale).toHaveBeenCalledTimes(1);
    expect(OfflineDB.updateProduct).not.toHaveBeenCalled();
  });

  test('online RPC result caches sale and refreshed product stock without offline fallback', async () => {
    const remoteSale = {
      id: 'sale-remote',
      ...saleInput,
      created_at: '2026-05-29T10:00:00.000Z',
      updated_at: '2026-05-29T10:00:00.000Z',
    };
    const remoteProduct = {
      id: 'product-1',
      name: 'Notebook',
      stock_quantity: 7,
      updated_at: '2026-05-29T10:00:01.000Z',
    };

    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        sale_id: remoteSale.id,
        new_stock_quantity: remoteProduct.stock_quantity,
      },
      error: null,
    });

    (supabase.from as jest.Mock).mockImplementation((table: string) => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue(
            table === 'sales'
              ? { data: remoteSale, error: null }
              : { data: remoteProduct, error: null }
          ),
        })),
      })),
    }));

    await expect(createSale(saleInput)).resolves.toEqual(remoteSale);
    expect(OfflineDB.saveSale).toHaveBeenCalledWith(remoteSale);
    expect(OfflineDB.saveProduct).toHaveBeenCalledWith(remoteProduct);
    expect(OfflineDB.createSale).not.toHaveBeenCalled();
  });
});

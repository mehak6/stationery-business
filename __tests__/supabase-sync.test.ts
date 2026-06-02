import { syncSales } from '../lib/supabase-sync';
import * as OfflineDB from '../lib/offline-db';
import { supabase } from '../supabase_client';

const syncMetaPut = jest.fn();

jest.mock('../lib/pouchdb-client', () => ({
  getSyncMetaDB: jest.fn(() => Promise.resolve({
    get: jest.fn(() => Promise.reject(new Error('missing'))),
    put: syncMetaPut,
  })),
}));

jest.mock('../lib/offline-db', () => ({
  getAllSales: jest.fn(),
  getAllProducts: jest.fn(),
  bulkSaveSales: jest.fn(),
}));

jest.mock('../lib/conflict-resolver', () => ({
  hasConflict: jest.fn(() => false),
  resolveEntityConflict: jest.fn((_: string, __: unknown, remote: unknown) => remote),
}));

jest.mock('../supabase_client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('supabase sales sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('skips stale local sales that fail remote stock checks', async () => {
    const upsert = jest
      .fn()
      .mockResolvedValueOnce({
        error: {
          message: 'Insufficient stock. Available: 0, Requested: 7',
        },
      })
      .mockResolvedValueOnce({
        error: {
          message: 'Insufficient stock. Available: 0, Requested: 7',
        },
      })
      .mockResolvedValueOnce({ error: null });

    (OfflineDB.getAllProducts as jest.Mock).mockResolvedValue([
      { id: 'product-1' },
      { id: 'product-2' },
    ]);
    (OfflineDB.getAllSales as jest.Mock).mockResolvedValue([
      {
        id: 'sale-stale',
        product_id: 'product-1',
        quantity: 7,
        unit_price: 10,
        total_amount: 70,
        profit: 20,
        customer_info: null,
        sale_date: '2026-06-01',
        notes: null,
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
      },
      {
        id: 'sale-good',
        product_id: 'product-2',
        quantity: 1,
        unit_price: 10,
        total_amount: 10,
        profit: 5,
        customer_info: null,
        sale_date: '2026-06-01',
        notes: null,
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
      },
    ]);
    (OfflineDB.bulkSaveSales as jest.Mock).mockResolvedValue(undefined);

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          select: jest.fn(() => ({
            range: jest.fn().mockResolvedValue({
              data: [{ id: 'product-1' }, { id: 'product-2' }],
              error: null,
            }),
          })),
        };
      }

      return {
        select: jest.fn((fields: string) => ({
          or: jest.fn().mockResolvedValue({ data: [], error: null }),
          range: jest.fn().mockResolvedValue({
            data: fields === 'id' ? [] : [],
            error: null,
          }),
        })),
        upsert,
      };
    });

    const result = await syncSales();

    expect(result.errors).toBe(0);
    expect(result.recovered).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.push).toBe(1);
    expect(upsert).toHaveBeenCalledTimes(3);
    expect(syncMetaPut).toHaveBeenCalled();
  });

  test('does not push local sales that already exist remotely', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });

    (OfflineDB.getAllProducts as jest.Mock).mockResolvedValue([
      { id: 'product-1' },
    ]);
    (OfflineDB.getAllSales as jest.Mock).mockResolvedValue([
      {
        id: 'sale-existing',
        product_id: 'product-1',
        quantity: 5,
        unit_price: 10,
        total_amount: 50,
        profit: 25,
        customer_info: null,
        sale_date: '2026-06-01',
        notes: null,
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
      },
    ]);
    (OfflineDB.bulkSaveSales as jest.Mock).mockResolvedValue(undefined);

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          select: jest.fn(() => ({
            range: jest.fn().mockResolvedValue({
              data: [{ id: 'product-1' }],
              error: null,
            }),
          })),
        };
      }

      return {
        select: jest.fn((fields: string) => ({
          or: jest.fn().mockResolvedValue({ data: [], error: null }),
          range: jest.fn().mockResolvedValue({
            data: fields === 'id' ? [{ id: 'sale-existing' }] : [],
            error: null,
          }),
        })),
        upsert,
      };
    });

    const result = await syncSales();

    expect(result.errors).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.push).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
    expect(syncMetaPut).toHaveBeenCalled();
  });
});

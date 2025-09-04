import { createClient } from '@supabase/supabase-js'
import { Database } from './lib/database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 2
    }
  }
})

// Type definitions for our database tables
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type Sale = Database['public']['Tables']['sales']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Customer = Database['public']['Tables']['customers']['Row']

export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type SaleInsert = Database['public']['Tables']['sales']['Insert']
export type CategoryInsert = Database['public']['Tables']['categories']['Insert']
export type CustomerInsert = Database['public']['Tables']['customers']['Insert']

// Party purchases type definitions
export interface PartyPurchase {
  id: string;
  party_name: string;
  item_name: string;
  barcode?: string;
  purchase_price: number;
  selling_price: number;
  purchased_quantity: number;
  remaining_quantity: number;
  purchase_date: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export type PartyPurchaseInsert = Omit<PartyPurchase, 'id' | 'created_at' | 'updated_at'>;

// Helper functions for common operations

// Products
export const getProducts = async () => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export const getProductById = async (id: string) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export const createProduct = async (product: ProductInsert) => {
  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .select()
    .single()

  if (error) throw error
  return data
}

export const updateProduct = async (id: string, updates: Partial<ProductInsert>) => {
  const { data, error } = await supabase
    .from('products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export const deleteProduct = async (id: string) => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// Sales
export const getSales = async (limit?: number) => {
  let query = supabase
    .from('sales')
    .select(`
      *,
      products (
        id,
        name
      )
    `)
    .order('created_at', { ascending: false })

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) throw error
  return data
}

export const createSale = async (sale: SaleInsert) => {
  const { data, error } = await supabase
    .from('sales')
    .insert(sale)
    .select()
    .single()

  if (error) throw error
  return data
}

export const deleteSale = async (saleId: string) => {
  const { data, error } = await supabase
    .from('sales')
    .delete()
    .eq('id', saleId)
    .select()
    .single()

  if (error) throw error
  return data
}

export const getSalesByDate = async (date: string) => {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      *,
      products (
        id,
        name
      )
    `)
    .eq('sale_date', date)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export const getSalesByDateRange = async (startDate: string, endDate: string) => {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      *,
      products (
        id,
        name
      )
    `)
    .gte('sale_date', startDate)
    .lte('sale_date', endDate)
    .order('sale_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// Categories
export const getCategories = async () => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name')

  if (error) throw error
  return data
}

export const createCategory = async (category: CategoryInsert) => {
  const { data, error } = await supabase
    .from('categories')
    .insert(category)
    .select()
    .single()

  if (error) throw error
  return data
}

// Analytics
export const getAnalytics = async () => {
  try {
    // Get total products
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })

    // Get total sales amount
    const { data: salesData } = await supabase
      .from('sales')
      .select('total_amount, profit, created_at')

    const totalSales = salesData?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0
    const totalProfit = salesData?.reduce((sum, sale) => sum + (sale.profit || 0), 0) || 0

    // Get today's sales
    const today = new Date().toISOString().split('T')[0]
    const { data: todaySalesData } = await supabase
      .from('sales')
      .select('total_amount, profit')
      .eq('sale_date', today)

    const todaySales = todaySalesData?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0
    const todayProfit = todaySalesData?.reduce((sum, sale) => sum + (sale.profit || 0), 0) || 0

    // Get low stock products
    const { count: lowStockCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .lt('stock_quantity', 5)

    return {
      totalProducts: totalProducts || 0,
      totalSales,
      totalProfit,
      todaySales,
      todayProfit,
      lowStockProducts: lowStockCount || 0
    }
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return {
      totalProducts: 0,
      totalSales: 0,
      totalProfit: 0,
      todaySales: 0,
      todayProfit: 0,
      lowStockProducts: 0
    }
  }
}

// Real-time subscriptions
export const subscribeToProducts = (callback: (payload: any) => void) => {
  return supabase
    .channel('products-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'products' }, 
      callback
    )
    .subscribe()
}

export const subscribeToSales = (callback: (payload: any) => void) => {
  return supabase
    .channel('sales-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'sales' }, 
      callback
    )
    .subscribe()
}

// Party Purchases
export const getPartyPurchases = async () => {
  console.log('[DEBUG] getPartyPurchases: Starting function call');
  console.log('[DEBUG] getPartyPurchases: Checking Supabase environment variables');
  console.log('[DEBUG] getPartyPurchases: NEXT_PUBLIC_SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('[DEBUG] getPartyPurchases: NEXT_PUBLIC_SUPABASE_ANON_KEY exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  try {
    // First, let's check if table exists by trying a simple query
    console.log('[DEBUG] getPartyPurchases: Testing table existence');

    // Try to query the table
    const { data, error } = await supabase
      .from('party_purchases')
      .select('count', { count: 'exact', head: true })

    if (error) {
      const tableErrorMessage = 'Could not find the table';
      if (error.message.includes(tableErrorMessage) || error.details?.includes(tableErrorMessage)) {
        console.error('[DEBUG] getPartyPurchases: CRITICAL ERROR - party_purchases table does not exist!');
        console.error('[DEBUG] getPartyPurchases: Please run supabase_party_purchases.sql in your Supabase SQL editor');
        console.error('[DEBUG] getPartyPurchases: Table creation error details:', error);

        throw new Error('DATABASE TABLE MISSING: party_purchases table not found. Please run the SQL setup script in Supabase.');
      }

      console.error('[DEBUG] getPartyPurchases: Supabase query error:', error);
      console.error('[DEBUG] getPartyPurchases: Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }

    console.log('[DEBUG] getPartyPurchases: Table count query successful');

    // Now get actual data
    const { data: actualData, error: dataError } = await supabase
      .from('party_purchases')
      .select('*')
      .order('created_at', { ascending: false })

    if (dataError) {
      console.error('[DEBUG] getPartyPurchases: Data fetch error:', dataError);
      throw dataError;
    }

    console.log('[DEBUG] getPartyPurchases: Query successful, data returned:', actualData);
    console.log('[DEBUG] getPartyPurchases: Number of records:', actualData?.length || 0);
    return actualData || [];
  } catch (error) {
    console.error('[DEBUG] getPartyPurchases: Unexpected error:', error);
    throw error;
  }
}

export const createPartyPurchase = async (purchase: PartyPurchaseInsert) => {
  const { data, error } = await supabase
    .from('party_purchases')
    .insert(purchase)
    .select()
    .single()

  if (error) throw error
  return data
}

export const updatePartyPurchase = async (id: string, updates: Partial<PartyPurchaseInsert>) => {
  const { data, error } = await supabase
    .from('party_purchases')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export const deletePartyPurchase = async (id: string) => {
  const { error } = await supabase
    .from('party_purchases')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// Authentication helpers
export const signUp = async (email: string, password: string, userData?: any) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userData
    }
  })

  if (error) throw error
  return data
}

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) throw error
  return data
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

export const getCurrentProfile = async () => {
  const user = await getCurrentUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) throw error
  return data
}
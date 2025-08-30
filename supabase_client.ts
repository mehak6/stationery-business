import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

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

// Helper functions for common operations

// Products
export const getProducts = async () => {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      categories (
        id,
        name
      )
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export const getProductById = async (id: string) => {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      categories (
        id,
        name
      )
    `)
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
      ),
      profiles (
        id,
        full_name
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
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          name: string | null
          email: string | null
          role: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name?: string | null
          email?: string | null
          role?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          email?: string | null
          role?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          name: string
          phone: string | null
          email: string | null
          address: string | null
          total_purchases: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          email?: string | null
          address?: string | null
          total_purchases?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          email?: string | null
          address?: string | null
          total_purchases?: number
          created_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          category_id: string | null
          barcode: string | null
          purchase_price: number
          selling_price: number
          stock_quantity: number
          min_stock_level: number
          supplier_info: Json | null
          image_url: string | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category_id?: string | null
          barcode?: string | null
          purchase_price: number
          selling_price: number
          stock_quantity?: number
          min_stock_level?: number
          supplier_info?: Json | null
          image_url?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category_id?: string | null
          barcode?: string | null
          purchase_price?: number
          selling_price?: number
          stock_quantity?: number
          min_stock_level?: number
          supplier_info?: Json | null
          image_url?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sales: {
        Row: {
          id: string
          product_id: string
          quantity: number
          unit_price: number
          total_amount: number
          profit: number
          customer_info: Json | null
          sale_date: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          quantity: number
          unit_price: number
          total_amount: number
          profit: number
          customer_info?: Json | null
          sale_date?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          total_amount?: number
          profit?: number
          customer_info?: Json | null
          sale_date?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      party_purchases: {
        Row: {
          id: string
          party_name: string
          item_name: string
          barcode: string | null
          purchase_price: number
          selling_price: number
          purchased_quantity: number
          remaining_quantity: number
          purchase_date: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          party_name: string
          item_name: string
          barcode?: string | null
          purchase_price: number
          selling_price: number
          purchased_quantity: number
          remaining_quantity: number
          purchase_date: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          party_name?: string
          item_name?: string
          barcode?: string | null
          purchase_price?: number
          selling_price?: number
          purchased_quantity?: number
          remaining_quantity?: number
          purchase_date?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      product_analytics: {
        Row: {
          id: string
          name: string
          category_id: string | null
          category_name: string | null
          barcode: string | null
          stock_quantity: number
          min_stock_level: number
          purchase_price: number
          selling_price: number
          profit_per_unit: number
          profit_margin_percent: number | null
          total_sold: number
          total_revenue: number
          total_profit: number
          stock_status: string
          created_at: string
          updated_at: string
        }
      }
      daily_sales_summary: {
        Row: {
          sale_date: string
          transaction_count: number
          total_items_sold: number
          total_revenue: number
          total_profit: number
          average_transaction: number
          min_transaction: number
          max_transaction: number
        }
      }
      category_performance: {
        Row: {
          id: string
          category_name: string
          description: string | null
          total_products: number
          total_stock: number
          inventory_value: number
          total_sold: number
          total_revenue: number
          total_profit: number
          avg_profit_margin: number
          created_at: string
        }
      }
      low_stock_products: {
        Row: {
          id: string
          name: string
          category_name: string | null
          barcode: string | null
          stock_quantity: number
          min_stock_level: number
          purchase_price: number
          selling_price: number
          stock_deficit: number
          last_updated: string
        }
      }
      monthly_sales_trends: {
        Row: {
          month: string
          transaction_count: number
          total_items_sold: number
          total_revenue: number
          total_profit: number
          avg_transaction_value: number
          unique_products_sold: number
        }
      }
      party_purchases_summary: {
        Row: {
          party_name: string
          total_purchases: number
          total_items_purchased: number
          total_items_remaining: number
          total_items_transferred: number
          total_purchase_value: number
          remaining_inventory_value: number
          first_purchase_date: string
          last_purchase_date: string
        }
      }
    }
    Functions: {
      create_sale_with_stock_check: {
        Args: {
          p_product_id: string
          p_quantity: number
          p_unit_price: number
          p_total_amount: number
          p_profit: number
          p_customer_info: Json
          p_sale_date: string
          p_notes: string
        }
        Returns: {
          id: string
          product_id: string
          quantity: number
          unit_price: number
          total_amount: number
          profit: number
          customer_info: Json
          sale_date: string
          notes: string
          created_at: string
        }
      }
      get_dashboard_stats: {
        Args: Record<string, never>
        Returns: {
          total_products: number
          total_sales: number
          today_sales: number
          low_stock_count: number
        }[]
      }
      check_product_availability: {
        Args: {
          p_product_id: string
          p_quantity: number
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

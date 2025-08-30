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
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
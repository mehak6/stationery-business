/**
 * Shared TypeScript types and interfaces for the Inventory Management System
 */

import type { Product, Sale, PartyPurchase } from '../../../supabase_client';

export type { Product, Sale, PartyPurchase };

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface DateSummary {
  totalProducts: number;
  totalAmount: number;
  totalProfit: number;
}

export interface SalesData {
  todaySales: number;
  todayProfit: number;
  totalProducts: number;
  lowStockCount: number;
  todayDate: string;
  todaySalesData: Sale[];
}

export interface ProductHistory {
  id: string;
  product_id: string;
  product_name: string;
  action: 'stock_added' | 'stock_reduced' | 'damaged_stock_removed' | 'price_updated' | 'product_created';
  quantity_change?: number;
  stock_before?: number;
  stock_after?: number;
  price_before?: number;
  price_after?: number;
  notes?: string;
  created_at: string;
}

export interface UndoData {
  productId: string;
  productName: string;
  fieldName: string;
  oldValue: any;
  newValue: any;
}

export interface PartyPurchaseInsert {
  party_name: string;
  item_name: string;
  barcode?: string;
  purchased_quantity: number;
  remaining_quantity: number;
  purchase_price: number;
  selling_price: number;
  purchase_date: string;
}

export type ViewType = 'dashboard' | 'quicksale' | 'products' | 'party' | 'reports';

export type ProductView = 'card' | 'list';

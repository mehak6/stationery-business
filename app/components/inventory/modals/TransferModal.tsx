'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import { adjustProductStock, createProduct, getPartyPurchaseById, getProducts } from 'lib/offline-adapter';
import { formatDateToDisplay, parseDisplayDate } from 'lib/date-utils';
import type { PartyPurchase, Product } from 'supabase_client';

interface TransferModalProps {
  purchase: PartyPurchase;
  onClose: () => void;
  onTransferComplete: (updatedPurchase: PartyPurchase) => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning', duration?: number) => void;
}

export default function TransferModal({ purchase, onClose, onTransferComplete, showToast }: TransferModalProps) {
  const [transferQuantity, setTransferQuantity] = useState(1);
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [displayDate, setDisplayDate] = useState(formatDateToDisplay(transferDate));
  const [existingProduct, setExistingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkExistingProduct = async () => {
      try {
        const allProducts = await getProducts();
        const existing = allProducts.find(p =>
          p.name.toUpperCase() === purchase.item_name.toUpperCase()
        );
        setExistingProduct(existing || null);
      } catch (error) {
        console.error('Error checking for existing product:', error);
      } finally {
        setLoading(false);
      }
    };
    checkExistingProduct();
  }, [purchase.item_name]);

  const handleTransfer = async () => {
    if (transferQuantity > purchase.remaining_quantity) return;

    setLoading(true);
    try {
      let targetProduct: Product;

      if (existingProduct) {
        targetProduct = existingProduct;
      } else {
        targetProduct = await createProduct({
          name: purchase.item_name,
          barcode: purchase.barcode || null,
          purchase_price: purchase.purchase_price,
          selling_price: purchase.selling_price,
          stock_quantity: 0,
          min_stock_level: 5,
          description: `Transferred from ${purchase.party_name} purchase`,
          category_id: null
        });
        showToast(`Created new product "${purchase.item_name}"`, 'success');
      }

      await adjustProductStock({
        product: targetProduct,
        mode: 'party_transfer',
        quantity: transferQuantity,
        reason: `Transferred ${transferQuantity} units from ${purchase.party_name}`,
        date: transferDate,
        partyPurchase: purchase
      });

      const updatedPurchase = await getPartyPurchaseById(purchase.id) || {
        ...purchase,
        remaining_quantity: purchase.remaining_quantity - transferQuantity
      };
      showToast(`Transferred ${transferQuantity} units to "${targetProduct.name}"`, 'success');
      onTransferComplete(updatedPurchase);
    } catch (error) {
      console.error('Error transferring:', error);
      showToast(error instanceof Error ? error.message : 'Error transferring to products', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Transfer Stock</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
          </div>
          <div className="space-y-6">
            <div className="p-4 bg-primary-50 rounded-2xl border border-primary-100">
              <p className="font-black text-primary-900 text-lg">{purchase.item_name}</p>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm font-bold text-primary-600 uppercase tracking-wider">Party: {purchase.party_name}</span>
                <span className="text-sm font-black bg-white px-3 py-1 rounded-lg shadow-sm border border-primary-100">
                  {purchase.remaining_quantity} Units left
                </span>
              </div>
            </div>

            {existingProduct && (
              <div className="p-3 bg-yellow-50 text-yellow-800 text-xs font-bold rounded-xl border border-yellow-100 flex items-start gap-2">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>Product already exists. Stock will be merged. Current stock: {existingProduct.stock_quantity}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 ml-1">Quantity</label>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setTransferQuantity(Math.max(1, transferQuantity - 1))} 
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-black transition-colors"
                  >
                    -
                  </button>
                  <input 
                    type="number" 
                    value={transferQuantity} 
                    onChange={(e) => setTransferQuantity(Math.min(purchase.remaining_quantity, parseInt(e.target.value) || 1))} 
                    className="flex-1 h-10 bg-gray-50 border border-gray-200 rounded-xl text-center font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button 
                    onClick={() => setTransferQuantity(Math.min(purchase.remaining_quantity, transferQuantity + 1))} 
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-black transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 ml-1">Transfer Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={displayDate}
                    onChange={(e) => {
                      setDisplayDate(e.target.value);
                      if (/^\d{2}\/\d{2}\/\d{4}$/.test(e.target.value)) {
                        setTransferDate(parseDisplayDate(e.target.value));
                      }
                    }}
                    className="w-full h-10 bg-gray-50 border border-gray-200 rounded-xl pl-9 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={onClose} className="flex-1 py-3 px-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button 
                onClick={handleTransfer} 
                disabled={loading} 
                className="flex-1 py-3 px-4 rounded-2xl font-black text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 shadow-lg shadow-gray-200 transition-all transform active:scale-95"
              >
                {loading ? 'Processing...' : 'Transfer Now'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Trash2,
  Edit,
  Check,
  X,
  Undo2,
  Gift,
  Calendar
} from 'lucide-react';
import {
  getPartyPurchases,
  deletePartyPurchase,
  updatePartyPurchase,
  getProducts
} from 'lib/offline-adapter';
import { addProductHistory } from 'lib/product-history';
import { formatDateToDisplay, parseDisplayDate } from 'lib/date-utils';
import type { PartyPurchase, Product } from 'supabase_client';
import { useToast } from 'app/context/ToastContext';

// Import modals
import AddPurchaseModal from '../modals/AddPurchaseModal';
import TransferModal from '../modals/TransferModal';
import RevertModal from '../modals/RevertModal';
import FileUploadModal from '../modals/FileUploadModal';

interface PartyManagementProps {
  onNavigate: (view: string) => void;
}

export default function PartyManagement({ onNavigate }: PartyManagementProps) {
  const { showToast } = useToast();
  const [partyPurchases, setPartyPurchases] = useState<PartyPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDeductModal, setShowDeductModal] = useState(false);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PartyPurchase | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editingPurchase, setEditingPurchase] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getPartyPurchases();
        setPartyPurchases(data || []);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredPurchases = partyPurchases.filter(p =>
    p.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.party_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeletePurchase = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deletePartyPurchase(id);
      setPartyPurchases(prev => prev.filter(p => p.id !== id));
      showToast('Purchase deleted', 'success');
    } catch (error) {
      showToast('Error deleting purchase', 'error');
    }
  };

  const startEditing = (id: string, field: string, val: any) => {
    setEditingPurchase(id);
    setEditingField(field);
    setEditValue(val.toString());
  };

  const saveEdit = async (id: string, field: string, val: string) => {
    try {
      let processed: any = val;
      if (field === 'purchased_quantity') processed = parseInt(val);
      if (field === 'purchase_price' || field === 'selling_price') processed = parseFloat(val);
      
      await updatePartyPurchase(id, { [field]: processed });
      setPartyPurchases(prev => prev.map(p => p.id === id ? { ...p, [field]: processed } : p));
      setEditingPurchase(null);
    } catch (error) {
      showToast('Error updating', 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-primary-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Party Purchases</h1>
          <p className="text-gray-600 mt-2">Manage your purchased inventory from suppliers</p>
        </div>
        <div className="flex gap-3 mt-4 sm:mt-0">
          <button onClick={() => setShowFileUpload(true)} className="btn-outline">Import File</button>
          <button onClick={() => setShowAddForm(true)} className="btn-primary"><Plus className="h-5 w-5 mr-2" /> Add Purchase</button>
        </div>
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input type="text" placeholder="Search purchases..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input-field pl-10" />
        </div>
      </div>

      {loading ? (
        <p className="text-center py-8">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredPurchases.map(purchase => (
            <div key={purchase.id} className="card hover:shadow-md transition-shadow">
              <div className="flex justify-between mb-2">
                <span className="badge-info">{purchase.party_name}</span>
                <div className="flex gap-2">
                  <button onClick={() => { setSelectedPurchase(purchase); setShowTransferModal(true); }} className="p-1 text-gray-400 hover:text-primary-600" title="Transfer to Shop Inventory"><Package className="h-4 w-4" /></button>
                  <button onClick={() => { setSelectedPurchase(purchase); setShowDeductModal(true); }} className="p-1 text-gray-400 hover:text-orange-600" title="Deduct as Gift/Personal Use"><Gift className="h-4 w-4" /></button>
                  <button onClick={() => handleDeletePurchase(purchase.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <h3 className="font-bold text-gray-900 uppercase">{purchase.item_name}</h3>
              <p className="text-xs text-gray-500 mb-4">{new Date(purchase.purchase_date).toLocaleDateString()}</p>
              
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Purchased:</span>
                  <span className="font-medium">{purchase.purchased_quantity} units</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining:</span>
                  <span className={`font-bold ${purchase.remaining_quantity <= 0 ? 'text-red-600' : 'text-accent-600'}`}>{purchase.remaining_quantity} units</span>
                </div>
                <div className="flex justify-between pt-2 border-t mt-2">
                  <span className="font-semibold text-gray-700">Total:</span>
                  <span className="font-bold text-orange-600">₹{(purchase.purchase_price * purchase.purchased_quantity).toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddForm && <AddPurchaseModal onClose={() => setShowAddForm(false)} onPurchaseAdded={(p) => { setPartyPurchases([p, ...partyPurchases]); setShowAddForm(false); }} />}
      {showFileUpload && <FileUploadModal onClose={() => setShowFileUpload(false)} onFileProcessed={(ps) => { setPartyPurchases([...ps, ...partyPurchases]); }} />}
      {showTransferModal && selectedPurchase && (
        <TransferModal
          purchase={selectedPurchase}
          onClose={() => { setShowTransferModal(false); setSelectedPurchase(null); }}
          onTransferComplete={(p) => { setPartyPurchases(prev => prev.map(old => old.id === p.id ? p : old)); setShowTransferModal(false); }}
          showToast={showToast}
        />
      )}
      {showDeductModal && selectedPurchase && (
        <DeductPartyStockModal
          purchase={selectedPurchase}
          onClose={() => { setShowDeductModal(false); setSelectedPurchase(null); }}
          onDeductionComplete={(p) => { 
            setPartyPurchases(prev => prev.map(old => old.id === p.id ? p : old)); 
            setShowDeductModal(false); 
            setSelectedPurchase(null);
          }}
        />
      )}
    </div>
  );
}

function DeductPartyStockModal({ purchase, onClose, onDeductionComplete }: { purchase: PartyPurchase; onClose: () => void; onDeductionComplete: (updated: PartyPurchase) => void }) {
  const [quantity, setQuantity] = useState(1);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [displayDate, setDisplayDate] = useState(formatDateToDisplay(date));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleDeduct = async () => {
    if (quantity > purchase.remaining_quantity || quantity <= 0) return;
    setLoading(true);
    try {
      // 1. Find linked product to record history
      const allProducts = await getProducts();
      const product = allProducts.find(p => p.name.toUpperCase() === purchase.item_name.toUpperCase());
      
      if (product) {
        await addProductHistory({
          product_id: product.id,
          product_name: product.name,
          action: 'stock_updated',
          quantity_change: -quantity,
          stock_before: 0, 
          stock_after: 0,
          date: date,
          notes: `Deducted from ${purchase.party_name} stock: ${notes || 'Gift/Personal Use'}`
        });
      }

      // 2. Reduce remaining quantity in party purchase
      const updated = await updatePartyPurchase(purchase.id, {
        remaining_quantity: purchase.remaining_quantity - quantity
      });

      showToast(`Deducted ${quantity} units from ${purchase.party_name} stock`, 'success');
      onDeductionComplete(updated);
    } catch (error) {
      console.error('Error deducting stock:', error);
      showToast('Error deducting stock', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-orange-100 p-2 rounded-lg">
              <Gift className="h-5 w-5 text-orange-600" />
            </div>
            <h3 className="text-xl font-black text-gray-900">Deduct / Gift</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-sm font-black text-gray-900 uppercase">{purchase.item_name}</p>
          <p className="text-xs font-bold text-gray-500 uppercase mt-1">Party: {purchase.party_name}</p>
          <p className="text-xs font-bold text-orange-600 mt-2">Available: {purchase.remaining_quantity} Units</p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-black text-gray-400 mb-1 ml-1">Quantity to Deduct</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 font-black text-lg transition-colors">-</button>
              <input type="number" value={quantity} onChange={(e) => setQuantity(Math.min(purchase.remaining_quantity, Math.max(1, parseInt(e.target.value) || 0)))} className="flex-1 h-10 bg-white border-2 border-gray-100 rounded-xl text-center font-black text-lg focus:outline-none focus:border-orange-500" />
              <button onClick={() => setQuantity(Math.min(purchase.remaining_quantity, quantity + 1))} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 font-black text-lg transition-colors">+</button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-black text-gray-400 mb-1 ml-1">Date (dd/mm/yyyy)</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" value={displayDate} onChange={(e) => { setDisplayDate(e.target.value); if (/^\d{2}\/\d{2}\/\d{4}$/.test(e.target.value)) { setDate(parseDisplayDate(e.target.value)); } }} className="w-full h-10 bg-white border-2 border-gray-100 rounded-xl pl-10 pr-4 font-bold text-gray-900 focus:outline-none focus:border-orange-500" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-black text-gray-400 mb-1 ml-1">Reason / Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Gift for kids, Home use" className="w-full h-10 bg-white border-2 border-gray-100 rounded-xl px-4 font-bold text-gray-900 focus:outline-none focus:border-orange-500" />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleDeduct} disabled={loading} className="flex-1 py-3 px-4 rounded-xl bg-orange-600 text-white font-black hover:bg-orange-700 disabled:opacity-50 shadow-lg shadow-orange-100 transition-all transform active:scale-95">{loading ? 'Processing...' : 'Deduct Now'}</button>
        </div>
      </div>
    </div>
  );
}

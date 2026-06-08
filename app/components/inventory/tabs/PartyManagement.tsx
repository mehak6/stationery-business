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
  getProducts,
  getPartyPurchasePerformance,
  recordPartyPurchaseDeduction,
  type PartyPurchasePerformance
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
  const [performanceByPurchase, setPerformanceByPurchase] = useState<Record<string, PartyPurchasePerformance>>({});
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

  const refreshPerformance = async (purchases: PartyPurchase[]) => {
    const performance = await getPartyPurchasePerformance(purchases.map(p => p.id));
    setPerformanceByPurchase(performance);
  };

  const replacePurchase = async (updatedPurchase: PartyPurchase) => {
    const nextPurchases = partyPurchases.map(p => p.id === updatedPurchase.id ? updatedPurchase : p);
    setPartyPurchases(nextPurchases);
    await refreshPerformance(nextPurchases);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getPartyPurchases();
        const purchases = data || [];
        setPartyPurchases(purchases);
        await refreshPerformance(purchases);
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
  const activePurchases = filteredPurchases.filter(p => p.remaining_quantity > 0);
  const completedPurchases = filteredPurchases.filter(p => p.remaining_quantity <= 0);
  const activeStockValue = partyPurchases
    .filter(p => p.remaining_quantity > 0)
    .reduce((sum, p) => sum + p.purchase_price * p.remaining_quantity, 0);
  const completedPurchaseCost = partyPurchases
    .filter(p => p.remaining_quantity <= 0)
    .reduce((sum, p) => sum + p.purchase_price * p.purchased_quantity, 0);
  const completedProfitLoss = partyPurchases
    .filter(p => p.remaining_quantity <= 0)
    .reduce((sum, p) => {
      const performance = performanceByPurchase[p.id];
      return sum + ((performance?.soldProfit || 0) - (performance?.deductedCost || 0));
    }, 0);

  const getPerformance = (purchase: PartyPurchase) =>
    performanceByPurchase[purchase.id] || {
      partyPurchaseId: purchase.id,
      transferredQuantity: 0,
      deductedQuantity: 0,
      soldQuantity: 0,
      soldAmount: 0,
      soldProfit: 0,
      deductedCost: 0,
      remainingBatchQuantity: 0,
      completedAt: null
    };

  const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const handleDeletePurchase = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deletePartyPurchase(id);
      const nextPurchases = partyPurchases.filter(p => p.id !== id);
      setPartyPurchases(nextPurchases);
      await refreshPerformance(nextPurchases);
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
      const purchase = partyPurchases.find(p => p.id === id);
      if (!purchase) return;

      let processed: any = val;
      let updates: any = { [field]: processed };

      if (field === 'purchased_quantity') {
        processed = parseInt(val);
        if (isNaN(processed)) return;
        updates[field] = processed;
        const delta = processed - purchase.purchased_quantity;
        updates.remaining_quantity = purchase.remaining_quantity + delta;
      } else if (field === 'purchase_price' || field === 'selling_price') {
        processed = parseFloat(val);
        if (isNaN(processed)) return;
        updates[field] = processed;
      } else if (field === 'item_name') {
        processed = val.toUpperCase();
        updates[field] = processed;
      } else if (field === 'purchase_date') {
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
          showToast('Invalid date format (dd/mm/yyyy)', 'error');
          return;
        }
        processed = parseDisplayDate(val);
        updates[field] = processed;
      }

      await updatePartyPurchase(id, updates);
      const nextPurchases = partyPurchases.map(p => p.id === id ? { ...p, ...updates } : p);
      setPartyPurchases(nextPurchases);
      await refreshPerformance(nextPurchases);
      setEditingPurchase(null);
      setEditingField(null);
      showToast('Updated successfully', 'success');
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-xs font-bold text-gray-500 uppercase">Active Stock Value</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{formatCurrency(activeStockValue)}</p>
          <p className="text-xs text-gray-500 mt-1">{partyPurchases.filter(p => p.remaining_quantity > 0).length} active purchases</p>
        </div>
        <div className="card">
          <p className="text-xs font-bold text-gray-500 uppercase">Completed Purchase Cost</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{formatCurrency(completedPurchaseCost)}</p>
          <p className="text-xs text-gray-500 mt-1">{partyPurchases.filter(p => p.remaining_quantity <= 0).length} completed purchases</p>
        </div>
        <div className="card">
          <p className="text-xs font-bold text-gray-500 uppercase">Completed Realized P/L</p>
          <p className={`text-2xl font-black mt-1 ${completedProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(completedProfitLoss)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Sales profit minus gifted/deducted cost</p>
        </div>
      </div>

      {loading ? (
        <p className="text-center py-8">Loading...</p>
      ) : (
        <div className="space-y-8">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-gray-900">Active Purchases</h2>
              <span className="text-xs font-bold text-gray-500">{activePurchases.length} rows</span>
            </div>
            {activePurchases.length === 0 ? (
              <div className="card text-center py-8 text-gray-500 font-bold">No active party stock found.</div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {activePurchases.map(purchase => (
            <div key={purchase.id} className="card hover:shadow-md transition-shadow">
              <div className="flex justify-between mb-2">
                {editingPurchase === purchase.id && editingField === 'party_name' ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(purchase.id, 'party_name', editValue);
                        if (e.key === 'Escape') setEditingPurchase(null);
                      }}
                      className="text-xs px-2 py-1 border-2 border-primary-500 rounded focus:outline-none"
                      autoFocus
                    />
                    <button onClick={() => saveEdit(purchase.id, 'party_name', editValue)} className="text-green-600"><Check className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <span 
                    className="badge-info cursor-pointer hover:bg-primary-100 flex items-center gap-1"
                    onClick={() => startEditing(purchase.id, 'party_name', purchase.party_name)}
                  >
                    {purchase.party_name}
                    <Edit className="h-2.5 w-2.5 opacity-50" />
                  </span>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setSelectedPurchase(purchase); setShowTransferModal(true); }} className="p-1 text-gray-400 hover:text-primary-600" title="Transfer to Shop Inventory"><Package className="h-4 w-4" /></button>
                  <button onClick={() => { setSelectedPurchase(purchase); setShowDeductModal(true); }} className="p-1 text-gray-400 hover:text-orange-600" title="Deduct as Gift/Personal Use"><Gift className="h-4 w-4" /></button>
                  <button onClick={() => handleDeletePurchase(purchase.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              {editingPurchase === purchase.id && editingField === 'item_name' ? (
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(purchase.id, 'item_name', editValue);
                      if (e.key === 'Escape') setEditingPurchase(null);
                    }}
                    className="flex-1 font-bold text-gray-900 uppercase border-2 border-primary-500 rounded px-2 py-1 focus:outline-none"
                    autoFocus
                  />
                  <button onClick={() => saveEdit(purchase.id, 'item_name', editValue)} className="p-1 bg-green-100 text-green-600 rounded"><Check className="h-4 w-4" /></button>
                  <button onClick={() => setEditingPurchase(null)} className="p-1 bg-gray-100 text-gray-600 rounded"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <h3 
                  className="font-bold text-gray-900 uppercase flex items-center gap-2 cursor-pointer group"
                  onClick={() => startEditing(purchase.id, 'item_name', purchase.item_name)}
                >
                  {purchase.item_name}
                  <Edit className="h-4 w-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
                </h3>
              )}

              <div className="flex items-center gap-2 mb-4">
                {editingPurchase === purchase.id && editingField === 'purchase_date' ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(purchase.id, 'purchase_date', editValue);
                        if (e.key === 'Escape') setEditingPurchase(null);
                      }}
                      placeholder="dd/mm/yyyy"
                      className="text-[10px] px-2 py-0.5 border border-primary-500 rounded focus:outline-none w-24"
                      autoFocus
                    />
                    <button onClick={() => saveEdit(purchase.id, 'purchase_date', editValue)} className="text-green-600"><Check className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <p 
                    className="text-xs text-gray-500 cursor-pointer hover:text-primary-600 flex items-center gap-1"
                    onClick={() => startEditing(purchase.id, 'purchase_date', formatDateToDisplay(purchase.purchase_date))}
                  >
                    <Calendar className="h-3 w-3" />
                    {formatDateToDisplay(purchase.purchase_date)}
                  </p>
                )}
                <span className="text-gray-300 text-[10px]">•</span>
                {editingPurchase === purchase.id && editingField === 'barcode' ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(purchase.id, 'barcode', editValue);
                        if (e.key === 'Escape') setEditingPurchase(null);
                      }}
                      className="text-[10px] px-1 border border-primary-500 rounded focus:outline-none"
                      autoFocus
                    />
                    <button onClick={() => saveEdit(purchase.id, 'barcode', editValue)} className="text-green-600"><Check className="h-2 w-2" /></button>
                  </div>
                ) : (
                  <p 
                    className="text-[10px] text-gray-400 uppercase cursor-pointer hover:text-primary-500"
                    onClick={() => startEditing(purchase.id, 'barcode', purchase.barcode || 'NO BARCODE')}
                  >
                    Code: {purchase.barcode || 'N/A'}
                  </p>
                )}
              </div>
              
              <div className="space-y-1 text-sm">
                <div className="flex justify-between items-center">
                  <span>Purchased:</span>
                  {editingPurchase === purchase.id && editingField === 'purchased_quantity' ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(purchase.id, 'purchased_quantity', editValue);
                          if (e.key === 'Escape') setEditingPurchase(null);
                        }}
                        className="w-16 px-1 border-2 border-primary-500 rounded text-right"
                        autoFocus
                      />
                      <button onClick={() => saveEdit(purchase.id, 'purchased_quantity', editValue)} className="text-green-600"><Check className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <span 
                      className="font-medium cursor-pointer hover:bg-gray-100 px-1 rounded"
                      onClick={() => startEditing(purchase.id, 'purchased_quantity', purchase.purchased_quantity)}
                    >
                      {purchase.purchased_quantity} units
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span>Purchase Price:</span>
                  {editingPurchase === purchase.id && editingField === 'purchase_price' ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(purchase.id, 'purchase_price', editValue);
                          if (e.key === 'Escape') setEditingPurchase(null);
                        }}
                        className="w-20 px-1 border-2 border-primary-500 rounded text-right"
                        autoFocus
                      />
                      <button onClick={() => saveEdit(purchase.id, 'purchase_price', editValue)} className="text-green-600"><Check className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <span 
                      className="font-medium cursor-pointer hover:bg-gray-100 px-1 rounded text-primary-600"
                      onClick={() => startEditing(purchase.id, 'purchase_price', purchase.purchase_price)}
                    >
                      ₹{purchase.purchase_price.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span>Selling Price:</span>
                  {editingPurchase === purchase.id && editingField === 'selling_price' ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(purchase.id, 'selling_price', editValue);
                          if (e.key === 'Escape') setEditingPurchase(null);
                        }}
                        className="w-20 px-1 border-2 border-primary-500 rounded text-right"
                        autoFocus
                      />
                      <button onClick={() => saveEdit(purchase.id, 'selling_price', editValue)} className="text-green-600"><Check className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <span 
                      className="font-medium cursor-pointer hover:bg-gray-100 px-1 rounded text-secondary-600"
                      onClick={() => startEditing(purchase.id, 'selling_price', purchase.selling_price)}
                    >
                      ₹{purchase.selling_price.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center">
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
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-gray-900">Completed Purchases</h2>
              <span className="text-xs font-bold text-gray-500">{completedPurchases.length} rows</span>
            </div>
            {completedPurchases.length === 0 ? (
              <div className="card text-center py-8 text-gray-500 font-bold">No completed party purchases yet.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {completedPurchases.map(purchase => {
                  const performance = getPerformance(purchase);
                  const purchaseCost = purchase.purchase_price * purchase.purchased_quantity;
                  const realizedProfitLoss = performance.soldProfit - performance.deductedCost;
                  const completedDate = performance.completedAt || purchase.updated_at || purchase.purchase_date;

                  return (
                    <div key={purchase.id} className="card border-l-4 border-l-green-500">
                      <div className="flex justify-between gap-3 mb-4">
                        <div>
                          <span className="badge-success">{purchase.party_name}</span>
                          <h3 className="font-black text-gray-900 uppercase mt-2">{purchase.item_name}</h3>
                          <p className="text-xs text-gray-500 mt-1">Completed: {formatDateToDisplay(completedDate.split('T')[0])}</p>
                        </div>
                        <button onClick={() => handleDeletePurchase(purchase.id)} className="p-1 text-gray-400 hover:text-red-600 h-8" title="Delete purchase"><Trash2 className="h-4 w-4" /></button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] font-black text-gray-400 uppercase">Purchased</p>
                          <p className="font-black text-gray-900">{purchase.purchased_quantity} units</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] font-black text-gray-400 uppercase">Transferred</p>
                          <p className="font-black text-primary-700">{performance.transferredQuantity} units</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] font-black text-gray-400 uppercase">Deducted/Gifted</p>
                          <p className="font-black text-orange-700">{performance.deductedQuantity} units</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] font-black text-gray-400 uppercase">Sold From Batch</p>
                          <p className="font-black text-green-700">{performance.soldQuantity} units</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] font-black text-gray-400 uppercase">In Shop Stock</p>
                          <p className="font-black text-gray-900">{performance.remainingBatchQuantity} units</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] font-black text-gray-400 uppercase">Remaining Party</p>
                          <p className="font-black text-gray-900">{purchase.remaining_quantity} units</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase">Purchase Cost</p>
                          <p className="font-black text-gray-900">{formatCurrency(purchaseCost)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase">Sold Amount</p>
                          <p className="font-black text-blue-700">{formatCurrency(performance.soldAmount)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase">Realized P/L</p>
                          <p className={`font-black ${realizedProfitLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {formatCurrency(realizedProfitLoss)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showAddForm && <AddPurchaseModal onClose={() => setShowAddForm(false)} onPurchaseAdded={async (p) => { const next = [p, ...partyPurchases]; setPartyPurchases(next); await refreshPerformance(next); setShowAddForm(false); }} />}
      {showFileUpload && <FileUploadModal onClose={() => setShowFileUpload(false)} onFileProcessed={async (ps) => { const next = [...ps, ...partyPurchases]; setPartyPurchases(next); await refreshPerformance(next); }} />}
      {showTransferModal && selectedPurchase && (
        <TransferModal
          purchase={selectedPurchase}
          onClose={() => { setShowTransferModal(false); setSelectedPurchase(null); }}
          onTransferComplete={async (p) => { await replacePurchase(p); setShowTransferModal(false); setSelectedPurchase(null); }}
          showToast={showToast}
        />
      )}
      {showDeductModal && selectedPurchase && (
        <DeductPartyStockModal
          purchase={selectedPurchase}
          onClose={() => { setShowDeductModal(false); setSelectedPurchase(null); }}
          onDeductionComplete={async (p) => {
            await replacePurchase(p);
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
    if (!notes.trim()) {
      showToast('Reason is required for party stock deduction', 'error');
      return;
    }
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

      const updated = await recordPartyPurchaseDeduction({
        purchase,
        quantity,
        date,
        reason: notes,
        action: 'deducted'
      });

      showToast(`Deducted ${quantity} units from ${purchase.party_name} stock`, 'success');
      onDeductionComplete(updated);
    } catch (error) {
      console.error('Error deducting stock:', error);
      showToast(error instanceof Error ? error.message : 'Error deducting stock', 'error');
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
          <button onClick={handleDeduct} disabled={loading || !notes.trim()} className="flex-1 py-3 px-4 rounded-xl bg-orange-600 text-white font-black hover:bg-orange-700 disabled:opacity-50 shadow-lg shadow-orange-100 transition-all transform active:scale-95">{loading ? 'Processing...' : 'Deduct Now'}</button>
        </div>
      </div>
    </div>
  );
}

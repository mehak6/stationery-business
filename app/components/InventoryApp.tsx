'use client';

import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Package,
  Users,
  Menu,
  ArrowLeft,
  Home,
  FileText,
  Database,
  LogOut,
  Activity
} from 'lucide-react';

// Import contexts
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// Import components
import InstallPrompt from './InstallPrompt';
import SyncIndicator from './SyncIndicator';
import OfflineIndicator from './OfflineIndicator';
import BackupRestore from './BackupRestore';

// Import Tabs
import Dashboard from './inventory/tabs/Dashboard';
import ProductManagement from './inventory/tabs/ProductManagement';
import QuickSale from './inventory/tabs/QuickSale';
import PartyManagement from './inventory/tabs/PartyManagement';
import Reports from './inventory/tabs/Reports';
import InventoryLedger from './inventory/tabs/InventoryLedger';

// Import utilities
import { isBackupDue } from '../../lib/backup-utils';

function InventoryApp() {
  const { showToast } = useToast();
  const { signOut, user } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [viewHistory, setViewHistory] = useState(['dashboard']);
  const [showBackupModal, setShowBackupModal] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      showToast('Signed out successfully', 'success');
    } catch (error) {
      showToast('Error signing out', 'error');
    }
  };

  // Check if backup is due on mount
  useEffect(() => {
    if (isBackupDue()) {
      setTimeout(() => {
        showToast('Backup is overdue! Click the database icon to create a backup.', 'warning');
      }, 3000);
    }
  }, []);

  // Initialize offline database on mount
  useEffect(() => {
    const initOfflineDB = async () => {
      try {
        const { initializeDatabases } = await import('../../lib/pouchdb-client');
        await initializeDatabases();
        console.log('Offline database initialized');
      } catch (error) {
        console.error('Error initializing offline database:', error);
      }
    };

    initOfflineDB();
  }, []);

  const handleNavigate = (view: string) => {
    if (view !== currentView) {
      setViewHistory(prev => [...prev, view]);
      setCurrentView(view);
      setMobileMenuOpen(false);
    }
  };

  const handleBack = () => {
    if (viewHistory.length > 1) {
      const newHistory = [...viewHistory];
      newHistory.pop();
      const previousView = newHistory[newHistory.length - 1];
      setViewHistory(newHistory);
      setCurrentView(previousView);
    } else {
      setCurrentView('dashboard');
      setViewHistory(['dashboard']);
    }
  };

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();
      handleBack();
    };

    if (typeof window !== 'undefined') {
      window.history.pushState({ view: currentView }, '', `#${currentView}`);
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('popstate', handlePopState);
      }
    };
  }, [currentView]);

  const getViewTitle = (view: string) => {
    switch (view) {
      case 'dashboard': return 'Dashboard';
      case 'products': return 'Products';
      case 'quick-sale': return 'Quick Sale';
      case 'party': return 'Party Purchases';
      case 'ledger': return 'Inventory Ledger';
      case 'reports': return 'Reports';
      default: return 'Dashboard';
    }
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'products':
        return <ProductManagement onNavigate={handleNavigate} />;
      case 'quick-sale':
        return <QuickSale onNavigate={handleNavigate} />;
      case 'party':
        return <PartyManagement onNavigate={handleNavigate} />;
      case 'ledger':
        return <InventoryLedger onNavigate={handleNavigate} />;
      case 'reports':
        return <Reports onNavigate={handleNavigate} />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50/30 to-gray-50">
      <InstallPrompt />
      <OfflineIndicator />

      <nav className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex md:hidden mr-3">
                {currentView !== 'dashboard' && (
                  <button onClick={handleBack} className="p-2 text-gray-600 hover:text-primary-600"><ArrowLeft className="h-5 w-5" /></button>
                )}
              </div>

              <button onClick={() => handleNavigate('dashboard')} className="text-xl font-bold text-primary-600">Inventory Pro</button>

              <div className="hidden md:flex ml-10 space-x-4">
                <button onClick={() => handleNavigate('dashboard')} className={`nav-link ${currentView === 'dashboard' ? 'nav-link-active' : ''}`}><Home className="h-4 w-4 mr-2" />Dashboard</button>
                <button onClick={() => handleNavigate('products')} className={`nav-link ${currentView === 'products' ? 'nav-link-active' : ''}`}><Package className="h-4 w-4 mr-2" />Products</button>
                <button onClick={() => handleNavigate('quick-sale')} className={`nav-link ${currentView === 'quick-sale' ? 'nav-link-active' : ''}`}><ShoppingCart className="h-4 w-4 mr-2" />Quick Sale</button>
                <button onClick={() => handleNavigate('party')} className={`nav-link ${currentView === 'party' ? 'nav-link-active' : ''}`}><Users className="h-4 w-4 mr-2" />Party</button>
                <button onClick={() => handleNavigate('ledger')} className={`nav-link ${currentView === 'ledger' ? 'nav-link-active' : ''}`}><Activity className="h-4 w-4 mr-2" />Ledger</button>
                <button onClick={() => handleNavigate('reports')} className={`nav-link ${currentView === 'reports' ? 'nav-link-active' : ''}`}><FileText className="h-4 w-4 mr-2" />Reports</button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-sm text-gray-600 mr-2">{user?.email}</span>
              <button onClick={() => setShowBackupModal(true)} className="p-2 text-gray-600 hover:text-primary-600" title="Backup"><Database className="h-5 w-5" /></button>
              <button onClick={handleSignOut} className="hidden md:flex p-2 text-gray-600 hover:text-red-600" title="Sign out"><LogOut className="h-5 w-5" /></button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-gray-600"><Menu className="h-5 w-5" /></button>
            </div>
          </div>
        </div>
        
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t p-2 space-y-1 shadow-lg">
            <button onClick={() => handleNavigate('dashboard')} className="mobile-nav-link"><Home className="h-5 w-5 mr-3" />Dashboard</button>
            <button onClick={() => handleNavigate('products')} className="mobile-nav-link"><Package className="h-5 w-5 mr-3" />Products</button>
            <button onClick={() => handleNavigate('quick-sale')} className="mobile-nav-link"><ShoppingCart className="h-5 w-5 mr-3" />Quick Sale</button>
            <button onClick={() => handleNavigate('party')} className="mobile-nav-link"><Users className="h-5 w-5 mr-3" />Party</button>
            <button onClick={() => handleNavigate('ledger')} className="mobile-nav-link"><Activity className="h-5 w-5 mr-3" />Ledger</button>
            <button onClick={() => handleNavigate('reports')} className="mobile-nav-link"><FileText className="h-5 w-5 mr-3" />Reports</button>
            <button onClick={handleSignOut} className="mobile-nav-link text-red-600 border-t pt-2"><LogOut className="h-5 w-5 mr-3" />Sign Out</button>
          </div>
        )}
      </nav>
      
      <div className="md:hidden bg-white border-b px-4 py-3">
        <h1 className="text-lg font-semibold">{getViewTitle(currentView)}</h1>
      </div>

      <main>{renderCurrentView()}</main>
      <SyncIndicator />
      {showBackupModal && <BackupRestore onClose={() => setShowBackupModal(false)} showToast={showToast} />}
    </div>
  );
}

export default InventoryApp;

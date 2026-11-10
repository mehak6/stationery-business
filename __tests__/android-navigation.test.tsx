import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import InventoryApp from '../app/components/InventoryApp';

jest.mock('../app/context/AuthContext', () => ({ useAuth: () => ({ user: { email: 'admin@example.com' }, signOut: jest.fn() }) }));
jest.mock('../app/context/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../lib/backup-utils', () => ({ isBackupDue: () => false }));
jest.mock('../lib/pouchdb-client', () => ({ initializeDatabases: jest.fn() }));
jest.mock('../app/components/InstallPrompt', () => () => null);
jest.mock('../app/components/SyncIndicator', () => () => null);
jest.mock('../app/components/OfflineIndicator', () => () => null);
jest.mock('../app/components/BackupRestore', () => () => null);
jest.mock('../app/components/inventory/tabs/Dashboard', () => () => <div>Dashboard content</div>);
jest.mock('../app/components/inventory/tabs/ProductManagement', () => () => <div>Products content</div>);
jest.mock('../app/components/inventory/tabs/QuickSale', () => () => <div>Quick sale content</div>);
jest.mock('../app/components/inventory/tabs/PartyManagement', () => () => <div>Party content</div>);
jest.mock('../app/components/inventory/tabs/InventoryLedger', () => () => <div>Ledger content</div>);
jest.mock('../app/components/inventory/tabs/Reports', () => () => <div>Reports content</div>);

it('restores the tab from Android/browser back without pushing a replacement history entry', () => {
  window.history.replaceState({}, '', '/#dashboard');
  window.scrollTo = jest.fn();
  const push = jest.spyOn(window.history, 'pushState');
  render(<InventoryApp />);
  fireEvent.click(screen.getByRole('button', { name: 'Products' }));
  expect(screen.getByText('Products content')).toBeInTheDocument();
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  fireEvent.click(screen.getByRole('button', { name: 'Reports' }));
  expect(screen.getByText('Reports content')).toBeInTheDocument();
  const pushesBeforeBack = push.mock.calls.length;
  act(() => {
    window.history.replaceState({ view: 'products' }, '', '/#products');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(screen.getByText('Products content')).toBeInTheDocument();
  expect(push).toHaveBeenCalledTimes(pushesBeforeBack);
  push.mockRestore();
});

'use client'

import React, { Suspense, Component, ReactNode } from 'react';
import InventoryApp from './components/InventoryApp';

/**
 * Props for the ErrorBoundary component
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackRender: ({ error, resetError }: { error: Error; resetError: () => void }) => ReactNode;
}

/**
 * State for the ErrorBoundary component
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Custom error boundary component to catch JavaScript errors anywhere in the child component tree
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallbackRender({
        error: this.state.error,
        resetError: this.resetError
      });
    }

    return this.props.children;
  }
}

/**
 * Loading fallback component for the inventory app
 */
function InventoryLoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <div className="flex flex-col items-center space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">Loading Inventory...</h2>
          <p className="text-gray-600 text-sm">Please wait while we prepare your dashboard</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Error fallback component for critical errors
 */
function InventoryErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-600 text-sm mb-4">
            We encountered an error while loading the inventory application.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <details className="text-left mb-4">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                Error Details (Development)
              </summary>
              <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                {error.message}
              </pre>
            </details>
          )}
          <button
            onClick={resetError}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Main page component for the inventory management system
 * This serves as the entry point for the Next.js application
 *
 * Features:
 * - Error boundary for graceful error handling
 * - Suspense for lazy loading support
 * - Loading states for better UX
 * - Accessibility considerations
 */
export default function Home() {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetError }) => (
        <InventoryErrorFallback error={error} resetError={resetError} />
      )}
    >
      <Suspense fallback={<InventoryLoadingFallback />}>
        <InventoryApp />
      </Suspense>
    </ErrorBoundary>
  );
}
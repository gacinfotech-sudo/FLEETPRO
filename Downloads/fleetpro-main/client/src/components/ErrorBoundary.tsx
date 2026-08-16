import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Component Error:', error);
    console.error('Error Info:', errorInfo);

    this.setState({ errorInfo });

    // Log to error tracking service (Sentry, etc.)
    try {
      if (typeof window !== 'undefined' && (window as any).logError) {
        (window as any).logError({
          type: 'React Error Boundary',
          error: error.toString(),
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error('Failed to log error:', e);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Optionally reload the page
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
            <div className="flex justify-center mb-4">
              <AlertCircle className="text-red-600" size={48} />
            </div>

            <h1 className="text-2xl font-bold text-center text-gray-900 mb-4">
              Something Went Wrong
            </h1>

            <p className="text-gray-600 text-center mb-6">
              We encountered an unexpected error. Please try again or contact support if the problem persists.
            </p>

            {this.state.error && (
              <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
                <p className="text-red-800 text-sm font-mono">
                  {this.state.error.message}
                </p>
              </div>
            )}

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mb-6 text-xs">
                <summary className="cursor-pointer text-gray-700 font-semibold mb-2">
                  Error Details (Development Only)
                </summary>
                <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-40 text-gray-700">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition"
              >
                <RefreshCw size={18} />
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium py-2 px-4 rounded transition"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

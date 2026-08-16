import { useCallback, useState } from 'react';
import React from 'react';

interface ErrorRecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number) => void;
  onFinal?: (error: Error) => void;
}

/**
 * Hook for handling and recovering from errors
 */
export function useErrorRecovery() {
  const retryAsync = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      options: ErrorRecoveryOptions = {}
    ): Promise<T | null> => {
      const {
        maxRetries = 3,
        retryDelay = 1000,
        onRetry = () => {},
        onFinal = () => {}
      } = options;

      let lastError: Error | null = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await fn();
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (attempt < maxRetries - 1) {
            onRetry(attempt + 1);
            // Wait before retrying with exponential backoff
            const delay = retryDelay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      if (lastError) {
        onFinal(lastError);
      }
      return null;
    },
    []
  );

  const recoverFromNetworkError = useCallback((error: Error) => {
    // Classify the error
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return {
        type: 'network',
        message: 'Network connection lost. Please check your connection and try again.',
        retryable: true
      };
    }

    if (error.message.includes('timeout')) {
      return {
        type: 'timeout',
        message: 'Request took too long. Please try again.',
        retryable: true
      };
    }

    if (error.message.includes('JSON')) {
      return {
        type: 'parseError',
        message: 'Received invalid data from server. Please refresh and try again.',
        retryable: true
      };
    }

    return {
      type: 'unknown',
      message: error.message || 'An unexpected error occurred',
      retryable: false
    };
  }, []);

  const handleQueryError = useCallback((error: any) => {
    const isNetworkError = error?.code === 'NETWORK_ERROR';
    const isTimeout = error?.code === 'TIMEOUT';
    const shouldRetry = isNetworkError || isTimeout || error?.status === 503;

    return {
      shouldRetry,
      message: error?.message || 'An error occurred',
      code: error?.code || 'UNKNOWN'
    };
  }, []);

  return {
    retryAsync,
    recoverFromNetworkError,
    handleQueryError
  };
}

/**
 * Hook for managing error state
 */
export function useErrorState() {
  const [error, setError] = useState<Error | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const clearError = useCallback(() => {
    setError(null);
    setIsRecovering(false);
  }, []);

  const captureError = useCallback((err: Error | string) => {
    const error = err instanceof Error ? err : new Error(String(err));
    setError(error);
    setIsRecovering(false);
  }, []);

  const retry = useCallback(() => {
    setIsRecovering(true);
  }, []);

  return {
    error,
    isRecovering,
    clearError,
    captureError,
    retry
  };
}

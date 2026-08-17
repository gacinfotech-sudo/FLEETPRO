/**
 * Retry Utilities with Exponential Backoff
 * Handles transient failures gracefully with exponential backoff strategy
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, delay: number, error: Error) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  onRetry: () => {}
};

/**
 * Execute a function with automatic retry and exponential backoff
 * @param fn Function to execute
 * @param options Retry configuration
 * @returns Promise with result
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this was the last attempt, throw the error
      if (attempt === config.maxRetries) {
        throw lastError;
      }

      // Calculate exponential backoff delay
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelay
      );

      // Add jitter to prevent thundering herd
      const jitteredDelay = delay + Math.random() * (delay * 0.1);


      config.onRetry(attempt + 1, jitteredDelay, lastError);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, jitteredDelay));
    }
  }

  // This should never be reached due to the throw above
  throw lastError || new Error('Retry exhausted without error');
}

/**
 * Retry only on specific HTTP status codes
 * @param fn Function to execute
 * @param retryableStatuses HTTP status codes to retry on (default: 429, 503, 504)
 * @param options Retry configuration
 */
export async function retryOnHttpError<T>(
  fn: () => Promise<T>,
  retryableStatuses: number[] = [429, 503, 504],
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this is an HTTP error we should retry
      const statusMatch = lastError.message.match(/HTTP (\d{3})/);
      const status = statusMatch ? parseInt(statusMatch[1]) : null;

      if (status && !retryableStatuses.includes(status)) {
        // Non-retryable error, throw immediately
        throw lastError;
      }

      // If this was the last attempt, throw the error
      if (attempt === config.maxRetries) {
        throw lastError;
      }

      // Calculate exponential backoff delay
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelay
      );

      const jitteredDelay = delay + Math.random() * (delay * 0.1);


      config.onRetry(attempt + 1, jitteredDelay, lastError);
      await new Promise(resolve => setTimeout(resolve, jitteredDelay));
    }
  }

  throw lastError || new Error('HTTP retry exhausted');
}

/**
 * Circuit breaker for failing operations
 * Stops trying after repeated failures
 */
export class CircuitBreaker<T> {
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private fn: () => Promise<T>,
    private options = {
      failureThreshold: 5,
      resetTimeout: 60000 // 1 minute
    }
  ) {}

  async execute(): Promise<T> {
    // Check if circuit should be reset
    if (
      this.state === 'OPEN' &&
      this.lastFailureTime &&
      Date.now() - this.lastFailureTime > this.options.resetTimeout
    ) {
      this.state = 'HALF_OPEN';
    }

    // If circuit is open, fail fast
    if (this.state === 'OPEN') {
      throw new Error(
        `Circuit breaker is OPEN. Service unavailable. ` +
        `Will retry in ${this.options.resetTimeout}ms`
      );
    }

    try {
      const result = await this.fn();

      // Success - reset the circuit
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      console.error(
        `[CircuitBreaker] Failure ${this.failureCount}/${this.options.failureThreshold}: ` +
        `${error instanceof Error ? error.message : String(error)}`
      );

      // Open circuit if threshold exceeded
      if (this.failureCount >= this.options.failureThreshold) {
        this.state = 'OPEN';
        console.error('[CircuitBreaker] Circuit opened due to repeated failures');
      }

      throw error;
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime) : null
    };
  }

  reset() {
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED';
  }
}

/**
 * API Error Handler Utility
 * Provides robust error handling for HTTP requests with proper JSON parsing
 */

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errorCode?: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Safely fetch and parse JSON response
 * Handles empty responses, non-JSON responses, and parse errors gracefully
 */
export async function fetchWithErrorHandling<T = any>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });

    const contentType = response.headers.get('content-type');
    let data: any;

    // Check if response claims to be JSON
    if (contentType?.includes('application/json')) {
      try {
        // Check if there's actually content to parse
        const text = await response.text();
        if (text) {
          data = JSON.parse(text);
        } else {
          data = { message: 'Empty response' };
        }
      } catch (parseError) {
        // Response claimed JSON but isn't valid - return error object
        console.error(`Failed to parse JSON from ${url}:`, parseError);
        data = {
          error: 'Invalid JSON response',
          originalError: parseError instanceof Error ? parseError.message : String(parseError)
        };
      }
    } else {
      // Non-JSON response
      const text = await response.text();
      data = {
        error: `Non-JSON response (${contentType || 'no content-type'})`,
        body: text.substring(0, 200) // Include first 200 chars for debugging
      };
    }

    // Check for HTTP errors
    if (!response.ok) {
      const errorMessage = data?.message || data?.error || `HTTP ${response.status}`;
      const errorCode = data?.code || `HTTP_${response.status}`;

      console.error(`API Error [${response.status}]: ${errorMessage}`);

      return {
        ok: false,
        status: response.status,
        error: errorMessage,
        errorCode
      };
    }

    return {
      ok: true,
      status: response.status,
      data
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Network error on ${url}:`, errorMessage);

    return {
      ok: false,
      status: 0,
      error: `Network error: ${errorMessage}`,
      errorCode: 'NETWORK_ERROR'
    };
  }
}

/**
 * Fetch with timeout
 * Prevents hanging requests
 */
export async function fetchWithTimeout<T = any>(
  url: string,
  timeoutMs: number = 30000,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return await fetchWithErrorHandling(url, options);
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ok: false,
        status: 0,
        error: `Request timeout after ${timeoutMs}ms`,
        errorCode: 'TIMEOUT'
      };
    }

    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
      errorCode: 'NETWORK_ERROR'
    };
  }
}

/**
 * Handle and log API errors consistently
 */
export function handleApiError(
  error: any,
  context: string = 'API Call'
): ApiError {
  let apiError: ApiError;

  if (error instanceof ApiError) {
    apiError = error;
  } else if (error instanceof Error) {
    apiError = new ApiError(0, 'UNKNOWN_ERROR', error.message, error);
  } else {
    apiError = new ApiError(0, 'UNKNOWN_ERROR', String(error));
  }

  console.error(`${context} failed:`, {
    status: apiError.status,
    code: apiError.code,
    message: apiError.message
  });

  return apiError;
}

/**
 * Normalize API errors for client consumption
 */
export function normalizeApiError(
  error: any
): { message: string; code: string; statusCode: number } {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.status
    };
  }

  return {
    message: error?.message || 'An unexpected error occurred',
    code: error?.code || 'UNKNOWN_ERROR',
    statusCode: error?.status || 500
  };
}

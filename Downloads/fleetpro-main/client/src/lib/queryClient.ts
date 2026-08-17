import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Global session expiry handler - will be set by AuthProvider
let sessionExpiryHandler: (() => void) | null = null;

export function setQuerySessionExpiryHandler(handler: () => void) {
  sessionExpiryHandler = handler;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Handle session expiry globally
    if (res.status === 401 && sessionExpiryHandler) {
      sessionExpiryHandler();
      throw new Error("Session expired");
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    // Handle session expiry
    if (res.status === 401 && sessionExpiryHandler) {
      sessionExpiryHandler();
      throw new Error("Session expired");
    }

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    // Enhanced error handling for network failures
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error("Network connection failed. Please check your internet connection.");
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
      });

      if (res.status === 401) {
        if (sessionExpiryHandler) {
          sessionExpiryHandler();
          throw new Error("Session expired");
        }
        if (unauthorizedBehavior === "returnNull") {
          return null;
        }
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      // Enhanced error handling for network failures
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error("Network connection failed. Please check your internet connection.");
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Global session expiry handler - will be set by AuthProvider
let sessionExpiryHandler: (() => void) | null = null;

// Get API base URL from environment variable or use relative path for production
const getAPIBase = (): string => {
  // Use environment variable if available (set in .env or build process)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== 'undefined') {
    // In production, use relative URLs to the same domain
    if (window.location.protocol === 'https:') {
      return 'https://' + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
    }
    // In development, default to localhost:5050
    return 'http://localhost:5050';
  }

  return 'http://localhost:5050';
};

const API_BASE = getAPIBase();

export function setSessionExpiryHandler(handler: () => void) {
  sessionExpiryHandler = handler;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  const res = await fetch(fullUrl, {
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

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  
  return res;
}

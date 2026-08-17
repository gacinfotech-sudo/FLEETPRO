// Global session expiry handler - will be set by AuthProvider
let sessionExpiryHandler: (() => void) | null = null;

export function setSessionExpiryHandler(handler: () => void) {
  sessionExpiryHandler = handler;
}

// The backend now requires an X-CSRF-Token header on every mutating
// (non-GET) request for a logged-in session (see server/middleware/security.ts).
// We cache the token in memory and fetch it lazily; it's re-fetched
// automatically if a request comes back 403 with an invalid-token message so
// that a stale in-memory token (e.g. after a server restart cleared old
// sessions) self-heals without requiring a manual page reload.
let csrfTokenCache: string | null = null;

export async function fetchCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch("http://localhost:5050/api/csrf-token", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    csrfTokenCache = data.csrfToken ?? null;
    return csrfTokenCache;
  } catch {
    return null;
  }
}

export function getCachedCsrfToken(): string | null {
  return csrfTokenCache;
}

export const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const needsCsrf = MUTATING_METHODS.has(method.toUpperCase());
  if (needsCsrf && !csrfTokenCache) {
    await fetchCsrfToken();
  }

  const buildHeaders = () => {
    const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
    if (needsCsrf && csrfTokenCache) {
      headers["X-CSRF-Token"] = csrfTokenCache;
    }
    return headers;
  };

  let res = await fetch(url, {
    method,
    headers: buildHeaders(),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Self-heal once if the CSRF token was stale/missing.
  if (needsCsrf && res.status === 403) {
    const clone = res.clone();
    const body = await clone.json().catch(() => null);
    if (body?.message?.toLowerCase().includes("csrf")) {
      await fetchCsrfToken();
      res = await fetch(url, {
        method,
        headers: buildHeaders(),
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
    }
  }

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

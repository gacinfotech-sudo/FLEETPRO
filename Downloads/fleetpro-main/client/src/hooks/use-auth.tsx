import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { apiRequest, setSessionExpiryHandler } from "../lib/api";
import { setQuerySessionExpiryHandler } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Get API base URL - same logic as api.ts but exported separately for use here
const getAPIBase = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    if (window.location.protocol === 'https:') {
      return 'https://' + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
    }
    return 'http://localhost:5050';
  }
  return 'http://localhost:5050';
};

interface User {
  id: number;
  userId: string;
  role: string;
  tenantId?: number;
  mustResetPassword?: boolean;
  hasCompletedOnboarding?: boolean;
  lastLogin?: Date;
  lastLoginIP?: string;
  lastLoginUserAgent?: string;
  loginAttempts?: number;
  failedLoginAttempts?: number;
  accountLocked?: boolean;
  lockoutTime?: Date;
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  login: (userId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (newPassword: string, confirmPassword: string) => Promise<void>;
  loading: boolean;
  handleSessionExpiry: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthProviderInner({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Only check auth status once on mount
    checkAuthStatus().catch(error => {
      console.error("Initial auth check failed:", error);
    });
    
    // Register global session expiry handlers
    setSessionExpiryHandler(handleSessionExpiry);
    setQuerySessionExpiryHandler(handleSessionExpiry);
  }, []); // Only run once on mount

  const handleSessionExpiry = () => {
    setUser(null);
    toast({
      variant: "destructive",
      title: "Session Expired",
      description: "Your session has expired. Please login again.",
    });
    
    // Redirect to login after a brief delay to show the toast
    setTimeout(() => {
      setLocation("/login");
    }, 1500);
  };

  const checkAuthStatus = async () => {
    try {
      const apiBase = getAPIBase();
      const response = await fetch(`${apiBase}/api/auth/me`, {
        credentials: "include",
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);

        // Store user data in sessionStorage only (cleared on browser close)
        // This prevents XSS from stealing persistent credentials
        sessionStorage.setItem('fleetpro_user_session', JSON.stringify({
          userId: data.user.userId,
          role: data.user.role,
          tenantId: data.user.tenantId,
          lastValidated: Date.now()
        }));
      } else if (response.status === 401) {
        // Clear session storage on auth failure
        sessionStorage.removeItem('fleetpro_user_session');
        localStorage.removeItem('fleetpro_user');

        // Only trigger session expiry if user was previously authenticated
        if (user) {
          handleSessionExpiry();
        } else {
          setUser(null);
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error);

      // For PWA: Try to restore minimal user info from sessionStorage during network errors
      if (!user && !navigator.onLine) {
        const storedUser = sessionStorage.getItem('fleetpro_user_session');
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

            if (parsedUser.lastValidated && parsedUser.lastValidated > oneWeekAgo) {
              setUser(parsedUser as User);
            } else {
              sessionStorage.removeItem('fleetpro_user_session');
            }
          } catch (e) {
            sessionStorage.removeItem('fleetpro_user_session');
          }
        }
      }

      if (user && navigator.onLine) {
        handleSessionExpiry();
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (userId: string, password: string) => {
    try {
      const apiBase = getAPIBase();
      const response = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, password }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.message || "Login failed");
        (error as any).status = response.status;
        (error as any).code = errorData.code;
        throw error;
      }

      const text = await response.text();
      const data = JSON.parse(text);
      
      // Set user data immediately
      setUser(data.user);
      setLoading(false);
      
      // Store user data locally
      localStorage.setItem('fleetpro_user', JSON.stringify({
        ...data.user,
        lastValidated: Date.now()
      }));
      
      // Navigate to appropriate dashboard
      if (data.user.role === "admin") {
        setLocation("/admin");
      } else {
        setLocation("/dashboard");
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      setUser(null);
      
      // Clear PWA localStorage data
      localStorage.removeItem('fleetpro_user');
      
      setLocation("/");
      // Force page refresh to clear all cached state
      window.location.reload();
    } catch (error) {
      console.error("Logout failed:", error);
      // Even if logout API fails, clear local state and redirect
      setUser(null);
      
      // Clear PWA localStorage data
      localStorage.removeItem('fleetpro_user');
      
      setLocation("/");
      // Force page refresh to clear all cached state
      window.location.reload();
    }
  };

  const resetPassword = async (newPassword: string, confirmPassword: string) => {
    try {
      await apiRequest("POST", "/api/auth/reset-password", {
        newPassword,
        confirmPassword
      });
      // Clear user state to force re-login
      setUser(null);
      // Add a small delay to ensure state is cleared, then redirect
      setTimeout(() => {
        setLocation("/login");
        // Force a page refresh to clear any cached state
        window.location.reload();
      }, 1000);
    } catch (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, resetPassword, loading, handleSessionExpiry }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthProviderInner>{children}</AuthProviderInner>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

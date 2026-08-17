import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { OfflineNotification } from "@/components/offline-notification";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LandingPage from "./pages/landing";
import LoginPage from "./pages/login";
import AdminPanel from "./pages/admin-panel";
import Dashboard from "./pages/dashboard";
import TenantSettings from "./pages/TenantSettings";
import ForcedPasswordResetPage from "./pages/forced-password-reset";
import NotFound from "@/pages/not-found";
import ProtectedRoute from "@/components/auth/protected-route";

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  return (
    <Switch>
      {/* Public Landing Page */}
      <Route path="/" component={LandingPage} />
      
      {/* Login Page */}
      <Route path="/login">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user ? (
          // Redirect authenticated users to their respective dashboards
          user.role === "admin" ? <AdminPanel key={user.userId} /> : <Dashboard key={user.userId} />
        ) : (
          <LoginPage />
        )}
      </Route>
      
      {/* Password Reset Page */}
      <Route path="/reset-password">
        <ProtectedRoute allowedRoles={["client", "manager"]}>
          {user && user.mustResetPassword ? (
            <ForcedPasswordResetPage />
          ) : (
            <Dashboard key={user?.userId} />
          )}
        </ProtectedRoute>
      </Route>

      {/* Admin Panel */}
      <Route path="/admin">
        <ProtectedRoute requiredRole="admin">
          <AdminPanel key={user?.userId} />
        </ProtectedRoute>
      </Route>

      {/* Dashboard */}
      <Route path="/dashboard/:section?">
        <ProtectedRoute allowedRoles={["client", "manager"]}>
          {user && user.mustResetPassword ? (
            <ForcedPasswordResetPage />
          ) : (
            <Dashboard key={user?.userId} />
          )}
        </ProtectedRoute>
      </Route>

      {/* Tenant Settings */}
      <Route path="/tenant-settings/:tab?">
        <ProtectedRoute allowedRoles={["client", "admin"]}>
          <TenantSettings key={user?.userId} />
        </ProtectedRoute>
      </Route>

      {/* Fallback route for any unknown paths - redirects to appropriate dashboard */}
      <Route>
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user ? (
          // Redirect to appropriate dashboard based on role
          user.role === "admin" ? <AdminPanel key={user.userId} /> : <Dashboard key={user.userId} />
        ) : (
          <LoginPage />
        )}
      </Route>
    </Switch>
  );
}

function Router() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <OfflineNotification />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

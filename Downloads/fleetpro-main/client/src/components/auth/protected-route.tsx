import { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: "admin" | "client" | "manager";
  allowedRoles?: ("admin" | "client" | "manager")[];
}

export default function ProtectedRoute({ 
  children, 
  requiredRole, 
  allowedRoles 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    setLocation("/login");
    return null;
  }

  // Check role-based access
  if (requiredRole && user.role !== requiredRole) {
    setLocation("/dashboard");
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role as any)) {
    setLocation("/dashboard");
    return null;
  }

  return <>{children}</>;
}
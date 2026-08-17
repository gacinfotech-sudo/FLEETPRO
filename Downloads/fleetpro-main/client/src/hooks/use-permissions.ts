import { useAuth } from "./use-auth";

export function usePermissions() {
  const { user } = useAuth();

  const hasPermission = (permission: string) => {
    if (!user) return false;
    
    // Admin has all permissions
    if (user.role === 'admin') return true;
    
    // Client has most permissions except some admin-only ones
    if (user.role === 'client') {
      const adminOnlyPermissions = ['manage_tenants', 'manage_admins'];
      return !adminOnlyPermissions.includes(permission);
    }
    
    // Manager only has specific permissions
    if (user.role === 'manager') {
      const permissions = (user as any).permissions as string[] | undefined;
      return permissions?.includes(permission) || false;
    }
    
    return false;
  };

  const canManageFleet = () => hasPermission('manage_fleet');
  const canManageDrivers = () => hasPermission('manage_drivers');
  const canCreateBooking = () => hasPermission('create_booking');
  const canEditBooking = () => hasPermission('edit_booking');
  const canDeleteBooking = () => hasPermission('delete_booking');
  const canGenerateInvoice = () => hasPermission('generate_invoice');
  const canViewBookings = () => hasPermission('view_bookings');
  const canViewRevenue = () => hasPermission('view_revenue');
  const canManageUsers = () => user?.role === 'admin' || user?.role === 'client';

  return {
    hasPermission,
    canManageFleet,
    canManageDrivers,
    canCreateBooking,
    canEditBooking,
    canDeleteBooking,
    canGenerateInvoice,
    canViewBookings,
    canViewRevenue,
    canManageUsers,
    user
  };
}
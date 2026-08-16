import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage-mongodb';

export interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

// Permission check middleware
export function requirePermission(permission: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const hasPermission = await storage.checkUserPermission(req.userId, permission);
      
      if (!hasPermission) {
        return res.status(403).json({ 
          message: 'Access denied', 
          requiredPermission: permission 
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
}

// Check if user can manage sub-users (only admins and clients can)
export function requireUserManagement(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'client')) {
    return res.status(403).json({ 
      message: 'Access denied. Only admins and clients can manage users.' 
    });
  }
  next();
}

// Available permissions
export const PERMISSIONS = {
  CREATE_BOOKING: 'create_booking',
  DELETE_BOOKING: 'delete_booking',
  EDIT_BOOKING: 'edit_booking',
  VIEW_BOOKINGS: 'view_bookings',
  GENERATE_INVOICE: 'generate_invoice',
  MANAGE_VEHICLES: 'manage_vehicles',
  MANAGE_DRIVERS: 'manage_drivers',
  VIEW_REVENUE: 'view_revenue',
  MANAGE_USERS: 'manage_users'
} as const;
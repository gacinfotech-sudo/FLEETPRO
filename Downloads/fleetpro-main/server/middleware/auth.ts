import { Request, Response, NextFunction } from "express";
import { storage } from "../storage-mongodb";

export interface AuthRequest extends Request {
  user?: any;
  userId?: string;
  tenantId?: string;
}

export const authenticateUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Check if session exists
    if (!req.session) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Require proper session ID for user lookup
    const sessionId = (req.session as any)?.userId;
    if (!sessionId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Always lookup from database to ensure user data is current
    // Never use cached session data as fallback (prevents using deactivated user accounts)
    const user = await storage.getUserBySessionId(sessionId);
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: "Invalid session" });
    }

    req.user = user;
    req.userId = user.userId;
    // Handle both populated and non-populated tenantId
    if (user.tenantId) {
      req.tenantId = typeof user.tenantId === 'object' && '_id' in user.tenantId
        ? (user.tenantId as any)._id.toString()
        : (user.tenantId as any).toString();
    }
    
    // Debug logging
    
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ message: "Authentication error" });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  
  // Optional: Add IP-based security check
  const clientIP = req.ip || req.connection.remoteAddress;
  
  // Optional: Check for admin session timeout (stricter than regular users)
  const lastActivity = (req.session as any)?.lastActivity;
  const adminSessionTimeout = 30 * 60 * 1000; // 30 minutes for admin
  
  if (lastActivity && Date.now() - lastActivity > adminSessionTimeout) {
    req.session.destroy((err) => {
    });
    return res.status(401).json({ message: "Admin session expired" });
  }
  
  (req.session as any).lastActivity = Date.now();
  next();
};

export const requireTenant = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Admin users can access all tenant resources
  if (req.user?.role === "admin") {
    return next();
  }
  
  // Client users must have a tenantId
  if (!req.tenantId && req.user?.role === "client") {
    return res.status(403).json({ message: "Tenant access required" });
  }
  
  next();
};

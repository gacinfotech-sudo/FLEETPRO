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

    const sessionId = (req.session as any)?.userId;
    
    if (!sessionId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await storage.getUserBySessionId(sessionId);
    
    if (!user) {
      // Clear invalid session
      req.session.destroy((err) => {
        if (err) console.error('Error destroying session:', err);
      });
      return res.status(401).json({ message: "Invalid session" });
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
    console.log("User authenticated:", {
      userId: user.userId,
      role: user.role,
      tenantId: typeof user.tenantId === 'object' ? user.tenantId._id : user.tenantId,
      tenantIdString: req.tenantId
    });
    
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
  console.log(`Admin access from IP: ${clientIP} by user: ${req.user.userId}`);
  
  // Optional: Check for admin session timeout (stricter than regular users)
  const lastActivity = (req.session as any)?.lastActivity;
  const adminSessionTimeout = 30 * 60 * 1000; // 30 minutes for admin
  
  if (lastActivity && Date.now() - lastActivity > adminSessionTimeout) {
    req.session.destroy((err) => {
      console.log('Admin session expired due to inactivity');
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
    console.log("Tenant access denied for user:", req.user?.userId, "tenantId:", req.tenantId);
    return res.status(403).json({ message: "Tenant access required" });
  }
  
  next();
};

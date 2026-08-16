import { Request, Response, NextFunction } from 'express';
import { adminLimiter, authLimiter, loginProtector } from './rateLimiter.js';
import { logger } from '../utils/logger.js';

// Apply rate limiting to admin endpoints
export const protectAdminEndpoint = [
  adminLimiter,
  (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).userId;
    const role = (req as any).role;

    if (role !== 'admin') {
      logger.logSecurity(
        `Unauthorized admin endpoint access attempt: ${req.method} ${req.path}`,
        { userId, role, ip: req.ip },
        'HIGH'
      );
      return res.status(403).json({
        error: 'Admin access required',
        message: 'This endpoint is restricted to administrators'
      });
    }

    next();
  }
];

// Apply rate limiting to auth endpoints
export const protectAuthEndpoint = [
  authLimiter,
  (req: Request, res: Response, next: NextFunction) => {
    next();
  }
];

// Protect login endpoint with brute force detection
export const protectLoginEndpoint = [
  authLimiter,
  (req: Request, res: Response, next: NextFunction) => {
    const userId = req.body?.userId;
    const ip = req.ip || 'unknown';

    if (!userId) {
      return next();
    }

    // Check if user is being brute forced
    const check = loginProtector.check(userId);

    if (!check.allowed) {
      logger.logSecurity(
        `Login brute force detected: ${userId}`,
        { ip, remainingLockoutTime: '15 minutes' },
        'HIGH'
      );
      return res.status(429).json({
        error: 'Account locked',
        message: 'Too many failed login attempts. Please try again in 15 minutes.',
        retryAfter: 900
      });
    }

    // Attach check result to request for use in route handler
    (req as any).bruteForceCheck = check;

    next();
  }
];

// Middleware to record failed login attempt
export const recordFailedLogin = (req: Request, res: Response, next: NextFunction) => {
  const userId = req.body?.userId;

  // Hook into response to check if login failed
  const originalJson = res.json;
  res.json = function(data: any) {
    if (res.statusCode === 401 || res.statusCode === 429) {
      if (userId) {
        loginProtector.record(userId);
        logger.warn(
          `Failed login recorded for user ${userId}`,
          { remainingAttempts: 5 - loginProtector.getAttempts(userId), ip: req.ip },
          'Auth'
        );
      }
    }
    return originalJson.call(this, data);
  };

  next();
};

// Middleware to clear brute force on successful login
export const clearBruteForceOnSuccess = (userId: string) => {
  loginProtector.reset(userId);
  logger.info(`Brute force protection cleared for user ${userId}`, {}, 'Auth');
};

// Admin endpoints that need extra protection
export const criticalAdminEndpoints = [
  '/api/admin/subscription-requests',
  '/api/admin/billing-summary',
  '/api/admin/pending-renewals',
  '/api/admin/locked-tenants',
  '/api/admin/cleanup-tokens',
  '/api/admin/logs/recent',
  '/api/admin/logs/errors'
];

// Check if endpoint is critical
export const isCriticalEndpoint = (path: string): boolean => {
  return criticalAdminEndpoints.some(endpoint => path.startsWith(endpoint));
};

// Enhanced rate limiter for critical operations
export const criticalOperationLimiter = (req: Request, res: Response, next: NextFunction) => {
  const path = req.path;

  if (isCriticalEndpoint(path)) {
    // Apply stricter limits to critical endpoints
    adminLimiter(req, res, () => {
      logger.debug(`Critical admin operation: ${req.method} ${path}`, { userId: (req as any).userId }, 'Security');
      next();
    });
  } else {
    next();
  }
};

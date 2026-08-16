import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { logger } from '../utils/logger.js';

// CORS whitelist for different environments
const corsWhitelist = {
  development: [
    'http://localhost:5173',
    'http://localhost:5050',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5050'
  ],
  production: [
    process.env.FRONTEND_URL || 'https://fleetpro.example.com',
    process.env.BACKEND_URL || 'https://api.fleetpro.example.com'
  ],
  staging: [
    'https://staging.fleetpro.example.com',
    'https://staging-api.fleetpro.example.com'
  ]
};

const allowedOrigins = corsWhitelist[process.env.NODE_ENV as keyof typeof corsWhitelist] || corsWhitelist.development;

// CORS validation middleware
export const corsValidator = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.get('origin');

  if (!origin) {
    // No origin header (same-origin or non-browser request)
    return next();
  }

  if (!allowedOrigins.includes(origin)) {
    logger.logSecurity(
      `CORS origin rejected: ${origin}`,
      { method: req.method, path: req.path, ip: req.ip },
      'MEDIUM'
    );
    return res.status(403).json({
      error: 'CORS policy violation',
      origin
    });
  }

  // Set CORS headers for allowed origin
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-ID');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
};

// Tenant isolation middleware
export const tenantIsolationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestUserId = (req as any).userId;
  const requestTenantId = (req as any).tenantId;
  const tenantIdHeader = req.get('X-Tenant-ID') || req.query.tenantId;

  // Check if tenant ID is provided in request
  if (tenantIdHeader && tenantIdHeader !== requestTenantId) {
    logger.logSecurity(
      `Tenant isolation violation attempt: User ${requestUserId} trying to access tenant ${tenantIdHeader}`,
      { userTenant: requestTenantId, requestTenant: tenantIdHeader, ip: req.ip },
      'HIGH'
    );
    return res.status(403).json({
      error: 'Tenant isolation violation',
      message: 'You do not have permission to access this tenant'
    });
  }

  // Add tenant ID to response headers for verification
  if (requestTenantId) {
    res.header('X-Tenant-ID', requestTenantId);
  }

  next();
};

// Content Security Policy
export const cspMiddleware = helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'", 'http://localhost:*', 'https://'],
    fontSrc: ["'self'", 'data:'],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: []
  }
});

// Security headers middleware
export const securityHeadersMiddleware = helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
});

// SQL Injection & NoSQL injection detection
export const injectionDetection = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /(\bunion\b|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b)/gi, // SQL
    /(\$where|\bdb\./gi, // NoSQL
    /(<script|javascript:|onerror=|onload=)/gi // XSS
  ];

  const checkString = (value: string): boolean => {
    return suspiciousPatterns.some(pattern => pattern.test(value));
  };

  // Check query parameters
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string' && checkString(value)) {
      logger.logSecurity(
        `Potential injection detected in query parameter: ${key}`,
        { value: value.substring(0, 50), ip: req.ip },
        'HIGH'
      );
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Suspicious characters detected in request'
      });
    }
  }

  // Check body parameters
  if (req.body && typeof req.body === 'object') {
    const checkBody = (obj: any, depth = 0): boolean => {
      if (depth > 5) return false; // Prevent deep recursion
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && checkString(value)) {
          logger.logSecurity(
            `Potential injection detected in body: ${key}`,
            { value: value.substring(0, 50), ip: req.ip },
            'HIGH'
          );
          return true;
        }
        if (typeof value === 'object' && value !== null && checkBody(value as any, depth + 1)) {
          return true;
        }
      }
      return false;
    };

    if (checkBody(req.body)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Suspicious characters detected in request'
      });
    }
  }

  next();
};

// Rate limit breach handler
export const rateLimitBreach = (req: Request, res: Response, next: NextFunction) => {
  if (res.statusCode === 429) {
    logger.logSecurity(
      `Rate limit breach: ${req.method} ${req.path}`,
      { ip: req.ip, userId: (req as any).userId },
      'MEDIUM'
    );
  }
  next();
};

// Input validation middleware
export const inputValidationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Check for excessively large payloads
  const maxBodySize = 5 * 1024 * 1024; // 5MB
  const contentLength = parseInt(req.get('content-length') || '0');

  if (contentLength > maxBodySize) {
    logger.logSecurity(
      `Payload too large: ${contentLength} bytes`,
      { ip: req.ip, userId: (req as any).userId },
      'MEDIUM'
    );
    return res.status(413).json({
      error: 'Payload too large',
      maxSize: maxBodySize
    });
  }

  next();
};

// Request validation middleware
export const requestValidationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Ensure required headers
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    const contentType = req.get('content-type');
    if (contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
      logger.warn(
        `Unsupported content type: ${contentType}`,
        { method: req.method, path: req.path },
        'Security'
      );
    }
  }

  next();
};

// Setup all security middleware
export const setupSecurityMiddleware = (app: any) => {
  app.use(securityHeadersMiddleware);
  app.use(corsValidator);
  app.use(inputValidationMiddleware);
  app.use(requestValidationMiddleware);
  app.use(injectionDetection);
  app.use(tenantIsolationMiddleware);
};

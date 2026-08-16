import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

// Password strength validation
export const validatePasswordStrength = (password: string): { isValid: boolean; message?: string } => {
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/\d/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character' };
  }
  
  return { isValid: true };
};

// Login attempt rate limiting
export const loginRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 attempts per window per IP
  message: {
    error: 'Too many failed login attempts. Please wait 5 minutes before trying again.',
    retryAfter: 300 // 5 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests
  skipSuccessfulRequests: true,
  trustProxy: true, // Match app's trust proxy setting
  // Use X-Forwarded-For for proper IP detection behind proxy
  keyGenerator: (req: Request) => {
    // Get real IP from X-Forwarded-For header if available
    const forwarded = req.headers['x-forwarded-for'] as string;
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  // Reset window on successful login
  handler: (req: any, res: Response) => {
    res.status(429).json({
      message: 'Too many failed login attempts. Please wait 5 minutes or contact support.',
      retryAfter: req.rateLimit?.resetTime ? Math.round((req.rateLimit.resetTime - Date.now()) / 1000) : 300
    });
  }
});

// Speed limiting for login attempts
export const loginSpeedLimit = slowDown({
  windowMs: 5 * 60 * 1000, // 5 minutes
  delayAfter: 2, // Allow 2 requests per window without delay
  delayMs: () => 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  validate: { delayMs: false }
});

// HTTPS redirect middleware
export const httpsRedirect = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(`https://${req.header('host')}${req.url}`);
  }
  next();
};

// Enhanced security headers with Helmet
export const securityHeaders = helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'development' ? false : {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      fontSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "same-origin" },
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  } : false,
  noSniff: true,
  xssFilter: process.env.NODE_ENV === 'production' ? true : false,
  frameguard: process.env.NODE_ENV === 'production' ? { action: 'deny' } : false,
  permittedCrossDomainPolicies: false,
  hidePoweredBy: true,
  dnsPrefetchControl: { allow: false },
  ieNoOpen: true,
  crossOriginOpenerPolicy: process.env.NODE_ENV === 'production' ? { policy: "same-origin" } : false,
  crossOriginResourcePolicy: process.env.NODE_ENV === 'production' ? { policy: "same-origin" } : false
});

// Track login attempts per user
export interface LoginAttempt {
  userId: string;
  ip: string;
  timestamp: Date;
  success: boolean;
  userAgent: string;
}

export const loginAttempts = new Map<string, LoginAttempt[]>();

// IP-based blocking for suspicious activity
export const suspiciousIPs = new Set<string>();
export const blockedIPs = new Set<string>();

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove potentially dangerous characters
      return obj.replace(/[<>\"'%;()&+]/g, '');
    }
    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    return obj;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

// Advanced IP blocking middleware
export const ipBlockingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Check if IP is blocked
  if (blockedIPs.has(clientIP)) {
    return res.status(403).json({ 
      message: 'Access denied. Your IP has been blocked due to suspicious activity.' 
    });
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\b(union|select|insert|delete|update|drop|create|alter|exec|script)\b/i,
    /<script[^>]*>.*?<\/script>/i,
    /javascript:/i,
    /vbscript:/i,
    /onload|onerror|onclick/i
  ];

  const requestData = JSON.stringify(req.body || {}) + JSON.stringify(req.query || {});
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      suspiciousIPs.add(clientIP);
      console.log(`Suspicious activity detected from IP: ${clientIP}`);
      
      // Block IP after 3 suspicious attempts
      const attempts = Array.from(suspiciousIPs).filter(ip => ip === clientIP).length;
      if (attempts >= 3) {
        blockedIPs.add(clientIP);
        console.log(`IP blocked due to repeated suspicious activity: ${clientIP}`);
      }
      
      return res.status(400).json({ 
        message: 'Invalid request detected.' 
      });
    }
  }

  next();
};

// Session hijacking protection
export const sessionSecurityMiddleware = (req: any, res: Response, next: NextFunction) => {
  if (req.session && req.session.userId) {
    const currentUA = req.headers['user-agent'] || '';
    const currentIP = req.ip || req.connection.remoteAddress || 'unknown';

    // Store initial session fingerprint
    if (!req.session.fingerprint) {
      req.session.fingerprint = {
        userAgent: currentUA,
        ip: currentIP,
        timestamp: Date.now()
      };
    } else {
      // Verify session fingerprint
      const storedFingerprint = req.session.fingerprint;
      
      // Check for session hijacking indicators
      if (storedFingerprint.userAgent !== currentUA || 
          storedFingerprint.ip !== currentIP) {
        
        console.log(`Potential session hijacking detected for user: ${req.session.userId}`);
        req.session.destroy(() => {
          res.status(401).json({ 
            message: 'Session security violation detected. Please log in again.' 
          });
        });
        return;
      }
    }
  }

  next();
};

export const trackLoginAttempt = (userId: string, ip: string, success: boolean, userAgent: string = '') => {
  const attempt: LoginAttempt = {
    userId,
    ip,
    timestamp: new Date(),
    success,
    userAgent
  };

  if (!loginAttempts.has(userId)) {
    loginAttempts.set(userId, []);
  }

  const userAttempts = loginAttempts.get(userId)!;
  userAttempts.push(attempt);

  // Keep only last 10 attempts per user
  if (userAttempts.length > 10) {
    userAttempts.shift();
  }

  // Clean up old attempts (older than 24 hours)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  loginAttempts.set(userId, userAttempts.filter(attempt => attempt.timestamp > twentyFourHoursAgo));
};

export const getRecentFailedAttempts = (userId: string): number => {
  const userAttempts = loginAttempts.get(userId) || [];
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  return userAttempts.filter(attempt => 
    attempt.timestamp > fiveMinutesAgo && !attempt.success
  ).length;
};

export const getLastLoginInfo = (userId: string): LoginAttempt | null => {
  const userAttempts = loginAttempts.get(userId) || [];
  const successfulAttempts = userAttempts.filter(attempt => attempt.success);
  
  return successfulAttempts.length > 0 ? successfulAttempts[successfulAttempts.length - 1] : null;
};

// User lockout middleware
export const checkUserLockout = (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.body;
  
  if (userId) {
    const recentFailedAttempts = getRecentFailedAttempts(userId);
    
    if (recentFailedAttempts >= 5) {
      return res.status(429).json({
        message: 'Account temporarily locked due to too many failed login attempts. Please wait 5 minutes or contact support.',
        lockoutTime: 5 * 60 // 5 minutes in seconds
      });
    }
  }
  
  next();
};

// Database security middleware for NoSQL injection prevention
export const databaseSecurityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const checkForNoSQLInjection = (obj: any): boolean => {
    if (typeof obj === 'string') {
      const mongoOperators = ['$where', '$ne', '$in', '$nin', '$gt', '$lt', '$gte', '$lte', '$regex', '$exists', '$type', '$mod', '$all', '$size', '$elemMatch'];
      return mongoOperators.some(op => obj.includes(op));
    }
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (key.startsWith('$') || checkForNoSQLInjection(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };

  if (req.body && checkForNoSQLInjection(req.body)) {
    return res.status(400).json({ message: 'Invalid request format detected.' });
  }

  if (req.query && checkForNoSQLInjection(req.query)) {
    return res.status(400).json({ message: 'Invalid query parameters detected.' });
  }

  next();
};
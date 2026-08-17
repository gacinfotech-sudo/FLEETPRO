import { Request, Response, NextFunction } from 'express';
import { apiKeyService } from '../services/APIKeyService';

export interface AuthenticatedRequest extends Request {
  apiKey?: any;
  tenantId?: string;
  userId?: string;
}

/**
 * Middleware to authenticate requests using API key
 * Looks for key in:
 * 1. Authorization header (Bearer <key>)
 * 2. X-API-Key header
 * 3. api_key query parameter
 */
export async function authenticateAPIKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    let apiKey = null;

    // Check Authorization header first (Bearer scheme)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }

    // Check X-API-Key header
    if (!apiKey && req.headers['x-api-key']) {
      apiKey = req.headers['x-api-key'] as string;
    }

    // Check query parameter
    if (!apiKey && req.query.api_key) {
      apiKey = req.query.api_key as string;
    }

    if (!apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key is required. Provide via Authorization header, X-API-Key header, or api_key query parameter'
      });
    }

    // Validate the API key
    const validatedKey = await apiKeyService.validateAPIKey(apiKey);

    if (!validatedKey) {
      return res.status(401).json({
        error: 'Invalid API Key',
        message: 'The provided API key is invalid, expired, or inactive'
      });
    }

    // Check IP whitelist if configured
    if (validatedKey.allowedIPs && validatedKey.allowedIPs.length > 0) {
      const clientIP = req.ip || req.connection.remoteAddress || '';
      if (!validatedKey.allowedIPs.includes(clientIP)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Your IP address is not whitelisted for this API key'
        });
      }
    }

    // Check rate limit
    const withinRateLimit = await apiKeyService.checkRateLimit(validatedKey.id);
    if (!withinRateLimit) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Max ${validatedKey.rateLimit} requests per minute`
      });
    }

    // Attach validated key info to request
    req.apiKey = validatedKey;
    req.tenantId = validatedKey.tenantId.toString();

    // Track request start time for response time calculation
    (req as any).startTime = Date.now();

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/**
 * Middleware to record API key usage after response
 */
export async function recordAPIKeyUsage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const originalSend = res.send;

  res.send = function(data: any) {
    // Calculate response time
    const startTime = (req as any).startTime || Date.now();
    const responseTime = Date.now() - startTime;

    // Record usage if we have an API key
    if (req.apiKey) {
      apiKeyService.recordUsage(
        req.apiKey.id,
        req.path,
        req.method,
        res.statusCode,
        responseTime
      ).catch(err => console.error('Failed to record API key usage:', err));
    }

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Middleware to check specific permission for API key
 */
export function requireAPIKeyPermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hasPermission = req.apiKey.permissions.includes(permission) ||
      req.apiKey.permissions.includes('*');

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This API key does not have '${permission}' permission`
      });
    }

    next();
  };
}

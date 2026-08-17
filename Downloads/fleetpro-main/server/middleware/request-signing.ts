import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

interface SignatureConfig {
  enabled: boolean;
  algorithm: 'sha256' | 'sha512';
  timestampWindow: number; // milliseconds
  requiredHeaders: string[];
}

const defaultConfig: SignatureConfig = {
  enabled: process.env.REQUEST_SIGNING_ENABLED !== 'false',
  algorithm: 'sha256',
  timestampWindow: 5 * 60 * 1000, // 5 minutes
  requiredHeaders: ['x-request-timestamp', 'x-request-signature']
};

class RequestSigningManager {
  private config: SignatureConfig;
  private adminKeys = new Map<string, { key: string; createdAt: Date; active: boolean }>();

  constructor(config: Partial<SignatureConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.initializeAdminKeys();
  }

  private initializeAdminKeys() {
    // Initialize with default admin key from environment
    const defaultKey = process.env.REQUEST_SIGNING_KEY;
    if (defaultKey) {
      this.adminKeys.set('admin-default', {
        key: defaultKey,
        createdAt: new Date(),
        active: true
      });
    }

    logger.info(`Request signing: ${this.config.enabled ? 'ENABLED' : 'DISABLED'}`, {}, 'RequestSigning');
  }

  /**
   * Generate signature for a request
   */
  generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac(this.config.algorithm, secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Create signable payload from request
   */
  createPayload(method: string, path: string, timestamp: string, body?: any): string {
    const bodyStr = body ? JSON.stringify(body) : '';
    return `${method}:${path}:${timestamp}:${bodyStr}`;
  }

  /**
   * Verify request signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Validate timestamp (prevent replay attacks)
   */
  validateTimestamp(timestamp: string): { valid: boolean; error?: string } {
    try {
      const requestTime = parseInt(timestamp);
      const now = Date.now();
      const diff = Math.abs(now - requestTime);

      if (diff > this.config.timestampWindow) {
        return {
          valid: false,
          error: `Request timestamp too old (${diff}ms > ${this.config.timestampWindow}ms)`
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: 'Invalid timestamp format'
      };
    }
  }

  /**
   * Middleware for signature validation
   */
  middleware(protectedPaths: string[] = ['/api/admin', '/api/auth']) {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Skip if not enabled
      if (!this.config.enabled) {
        return next();
      }

      // Check if path is protected
      const isProtected = protectedPaths.some(path => req.path.startsWith(path));
      if (!isProtected) {
        return next();
      }

      // Skip GET requests (can't have body)
      if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
      }

      try {
        // Extract headers
        const timestamp = req.get('x-request-timestamp');
        const signature = req.get('x-request-signature');
        const keyId = req.get('x-request-key-id') || 'admin-default';

        if (!timestamp || !signature) {
          logger.logSecurity(
            `Missing signature headers: ${req.method} ${req.path}`,
            { ip: req.ip, keyId },
            'HIGH'
          );
          return res.status(400).json({
            error: 'Missing required signature headers',
            required: ['x-request-timestamp', 'x-request-signature']
          });
        }

        // Validate timestamp
        const timestampValid = this.validateTimestamp(timestamp);
        if (!timestampValid.valid) {
          logger.logSecurity(
            `Invalid request timestamp: ${timestampValid.error}`,
            { ip: req.ip, method: req.method, path: req.path },
            'MEDIUM'
          );
          return res.status(400).json({
            error: 'Invalid request timestamp',
            message: timestampValid.error
          });
        }

        // Get admin key
        const adminKeyObj = this.adminKeys.get(keyId);
        if (!adminKeyObj || !adminKeyObj.active) {
          logger.logSecurity(
            `Invalid or inactive signing key: ${keyId}`,
            { ip: req.ip, method: req.method, path: req.path },
            'HIGH'
          );
          return res.status(401).json({
            error: 'Invalid signing key'
          });
        }

        // Create payload and verify signature
        const payload = this.createPayload(
          req.method,
          req.path,
          timestamp,
          req.body
        );

        try {
          const isValid = this.verifySignature(payload, signature, adminKeyObj.key);

          if (!isValid) {
            logger.logSecurity(
              `Invalid request signature: ${req.method} ${req.path}`,
              { ip: req.ip, keyId },
              'HIGH'
            );
            return res.status(401).json({
              error: 'Invalid request signature'
            });
          }

          // Signature valid, attach key info to request
          (req as any).signedBy = keyId;
          (req as any).signatureValid = true;

          logger.debug(
            `Request signature verified: ${req.method} ${req.path}`,
            { keyId, ip: req.ip },
            'RequestSigning'
          );

          next();
        } catch (error) {
          logger.error(
            `Signature verification error: ${(error as Error).message}`,
            { keyId, path: req.path },
            'RequestSigning'
          );
          return res.status(500).json({
            error: 'Signature verification failed'
          });
        }
      } catch (error) {
        logger.error(
          `Request signing middleware error: ${(error as Error).message}`,
          { path: req.path },
          'RequestSigning'
        );
        return res.status(500).json({
          error: 'Internal server error'
        });
      }
    };
  }

  /**
   * Add/rotate admin signing key
   */
  addAdminKey(keyId: string, secret: string): boolean {
    try {
      this.adminKeys.set(keyId, {
        key: secret,
        createdAt: new Date(),
        active: true
      });
      logger.info(`Admin signing key added: ${keyId}`, {}, 'RequestSigning');
      return true;
    } catch (error) {
      logger.error(`Failed to add admin key: ${(error as Error).message}`, {}, 'RequestSigning');
      return false;
    }
  }

  /**
   * Deactivate signing key
   */
  deactivateKey(keyId: string): boolean {
    const keyObj = this.adminKeys.get(keyId);
    if (!keyObj) {
      return false;
    }

    keyObj.active = false;
    logger.info(`Admin signing key deactivated: ${keyId}`, {}, 'RequestSigning');
    return true;
  }

  /**
   * Get key status (admin endpoint)
   */
  getKeyStatus(keyId?: string) {
    if (keyId) {
      const key = this.adminKeys.get(keyId);
      if (!key) {
        return { error: 'Key not found' };
      }
      return {
        keyId,
        active: key.active,
        createdAt: key.createdAt
      };
    }

    // Return all keys (without revealing the secret)
    const keys: Record<string, any> = {};
    this.adminKeys.forEach((value, key) => {
      keys[key] = {
        active: value.active,
        createdAt: value.createdAt,
        algorithm: this.config.algorithm
      };
    });

    return keys;
  }

  /**
   * Generate a new signing key for testing/new admins
   */
  generateNewKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get configuration
   */
  getConfig(): SignatureConfig {
    return this.config;
  }

  /**
   * Enable/disable signing
   */
  setEnabled(enabled: boolean) {
    this.config.enabled = enabled;
    logger.info(`Request signing ${enabled ? 'ENABLED' : 'DISABLED'}`, {}, 'RequestSigning');
  }
}

export const requestSigning = new RequestSigningManager();

/**
 * Helper class for client-side request signing
 */
export class SignedRequestBuilder {
  private keyId: string;
  private secret: string;
  private algorithm: 'sha256' | 'sha512';

  constructor(keyId: string, secret: string, algorithm: 'sha256' | 'sha512' = 'sha256') {
    this.keyId = keyId;
    this.secret = secret;
    this.algorithm = algorithm;
  }

  /**
   * Build signed request headers
   */
  buildHeaders(method: string, path: string, body?: any): Record<string, string> {
    const timestamp = Date.now().toString();
    const bodyStr = body ? JSON.stringify(body) : '';
    const payload = `${method}:${path}:${timestamp}:${bodyStr}`;

    const signature = crypto
      .createHmac(this.algorithm, this.secret)
      .update(payload)
      .digest('hex');

    return {
      'x-request-timestamp': timestamp,
      'x-request-signature': signature,
      'x-request-key-id': this.keyId
    };
  }

  /**
   * Build complete signed request
   */
  buildRequest(method: string, path: string, body?: any): {
    headers: Record<string, string>;
    method: string;
    path: string;
    body?: any;
  } {
    return {
      headers: this.buildHeaders(method, path, body),
      method,
      path,
      body
    };
  }
}

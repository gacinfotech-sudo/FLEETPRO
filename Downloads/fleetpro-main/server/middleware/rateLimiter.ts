import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Store } from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { logger } from '../utils/logger.js';

// Custom store for rate limiter using memory
class MemoryStore implements Store {
  private hits: Map<string, number[]> = new Map();
  private windowMs: number;

  constructor(windowMs: number = 60000) {
    this.windowMs = windowMs;
    this.cleanup();
  }

  private cleanup() {
    setInterval(() => {
      const now = Date.now();
      this.hits.forEach((timestamps, key) => {
        const recent = timestamps.filter(t => now - t < this.windowMs);
        if (recent.length === 0) {
          this.hits.delete(key);
        } else {
          this.hits.set(key, recent);
        }
      });
    }, this.windowMs);
  }

  incr(key: string, cb: (err: Error | null, current?: number) => void) {
    const now = Date.now();
    const timestamps = this.hits.get(key) || [];
    timestamps.push(now);
    this.hits.set(key, timestamps.filter(t => now - t < this.windowMs));
    cb(null, timestamps.length);
  }

  decrement(key: string, cb?: (err?: Error | null) => void) {
    const timestamps = this.hits.get(key);
    if (timestamps && timestamps.length > 0) {
      timestamps.pop();
      if (timestamps.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, timestamps);
      }
    }
    if (cb) cb(null);
  }

  resetKey(key: string, cb?: (err?: Error | null) => void) {
    this.hits.delete(key);
    if (cb) cb(null);
  }

  reset(cb?: (err?: Error | null) => void) {
    this.hits.clear();
    if (cb) cb(null);
  }
}

const memoryStore = new MemoryStore(60000);

// Admin endpoints - strict rate limit (5 requests per minute per IP)
export const adminLimiter: RateLimitRequestHandler = rateLimit({
  store: memoryStore,
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: 'Too many admin requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Don't rate limit health checks
    return req.path === '/api/health';
  },
  handler: (req, res) => {
    logger.logSecurity(
      `Rate limit exceeded on admin endpoint: ${req.method} ${req.path}`,
      { ip: req.ip, userId: (req as any).userId },
      'MEDIUM'
    );
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: req.rateLimit?.resetTime
    });
  },
  keyGenerator: (req) => {
    // Use IP address as key
    return req.ip || 'unknown';
  }
});

// Auth endpoints - moderate rate limit (10 attempts per 15 minutes)
export const authLimiter: RateLimitRequestHandler = rateLimit({
  store: memoryStore,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    logger.logSecurity(
      `Rate limit exceeded on auth endpoint: ${req.method} ${req.path}`,
      { ip: req.ip },
      'MEDIUM'
    );
    res.status(429).json({
      error: 'Too many login attempts. Please try again later.'
    });
  },
  keyGenerator: (req) => {
    // Use combination of IP and username if available
    const identifier = (req.body as any)?.userId || req.ip || 'unknown';
    return `${req.ip}-${identifier}`;
  }
});

// API endpoints - general rate limit (100 requests per minute)
export const apiLimiter: RateLimitRequestHandler = rateLimit({
  store: memoryStore,
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Don't rate limit health checks
    return req.path === '/api/health';
  },
  keyGenerator: (req) => {
    return req.ip || 'unknown';
  }
});

// Speed limiter - gradually slows down responses
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 100,
  delayMs: (hits) => hits * 100
});

// Brute force protection for specific endpoints
export class BruteForceProtector {
  private attempts: Map<string, { count: number; timestamp: number }> = new Map();
  private maxAttempts = 5;
  private lockoutDuration = 15 * 60 * 1000; // 15 minutes

  check(identifier: string): { allowed: boolean; remainingAttempts: number } {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    if (!record) {
      return { allowed: true, remainingAttempts: this.maxAttempts };
    }

    // Check if lockout has expired
    if (now - record.timestamp > this.lockoutDuration) {
      this.attempts.delete(identifier);
      return { allowed: true, remainingAttempts: this.maxAttempts };
    }

    // Check if max attempts exceeded
    if (record.count >= this.maxAttempts) {
      return { allowed: false, remainingAttempts: 0 };
    }

    return { allowed: true, remainingAttempts: this.maxAttempts - record.count };
  }

  record(identifier: string) {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    if (!record) {
      this.attempts.set(identifier, { count: 1, timestamp: now });
    } else {
      record.count += 1;
      record.timestamp = now;
    }
  }

  reset(identifier: string) {
    this.attempts.delete(identifier);
  }

  getAttempts(identifier: string): number {
    const record = this.attempts.get(identifier);
    if (!record) return 0;
    if (Date.now() - record.timestamp > this.lockoutDuration) {
      this.attempts.delete(identifier);
      return 0;
    }
    return record.count;
  }
}

export const loginProtector = new BruteForceProtector();

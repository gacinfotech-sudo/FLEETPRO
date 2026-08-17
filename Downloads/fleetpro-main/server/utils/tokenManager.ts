import jwt, { JwtPayload } from 'jsonwebtoken';
import { logger } from './logger.js';

interface TokenPayload extends JwtPayload {
  userId: string;
  role: string;
  tenantId?: string;
  iat?: number;
  exp?: number;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

class TokenManager {
  private accessTokenSecret = process.env.JWT_SECRET;
  private refreshTokenSecret = process.env.JWT_REFRESH_SECRET;
  private accessTokenExpiry = '15m';
  private refreshTokenExpiry = '7d';

  constructor() {
    if (!this.accessTokenSecret) {
      throw new Error('JWT_SECRET environment variable is required but not set');
    }
    if (!this.refreshTokenSecret) {
      throw new Error('JWT_REFRESH_SECRET environment variable is required but not set');
    }
    this.startCleanupInterval();
  }
  private revokedTokens: Set<string> = new Set();
  private refreshTokens: Map<string, { refreshToken: string; userId: string; expiresAt: number }> = new Map();

  private startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      this.refreshTokens.forEach((value, key) => {
        if (value.expiresAt < now) {
          this.refreshTokens.delete(key);
          cleanedCount++;
        }
      });

      if (cleanedCount > 0) {
        logger.debug(`Cleaned up ${cleanedCount} expired refresh tokens`, {}, 'TokenManager');
      }
    }, 60 * 60 * 1000); // Every hour
  }

  // Generate token pair (access + refresh)
  generateTokenPair(payload: Omit<TokenPayload, 'iat' | 'exp'>): TokenPair {
    const accessToken = jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry
    });

    const refreshToken = jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiry
    });

    // Store refresh token for revocation tracking
    const decoded = jwt.decode(refreshToken) as TokenPayload;
    if (decoded?.exp) {
      this.refreshTokens.set(refreshToken, {
        refreshToken,
        userId: payload.userId,
        expiresAt: decoded.exp * 1000
      });
    }

    const accessDecoded = jwt.decode(accessToken) as TokenPayload;
    const expiresIn = accessDecoded?.exp ? (accessDecoded.exp * 1000 - Date.now()) / 1000 : 900;

    logger.info(`Generated token pair for user ${payload.userId}`, {}, 'TokenManager');

    return {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(expiresIn)
    };
  }

  // Verify access token
  verifyAccessToken(token: string): TokenPayload | null {
    try {
      // Check if token is revoked
      if (this.isTokenRevoked(token)) {
        logger.warn(`Attempt to use revoked token`, { token: token.substring(0, 20) + '...' }, 'TokenManager');
        return null;
      }

      const decoded = jwt.verify(token, this.accessTokenSecret) as TokenPayload;
      return decoded;
    } catch (error) {
      logger.debug(`Access token verification failed: ${(error as Error).message}`, {}, 'TokenManager');
      return null;
    }
  }

  // Verify refresh token and generate new access token
  refreshAccessToken(refreshToken: string): { accessToken: string; expiresIn: number } | null {
    try {
      // Check if refresh token is revoked
      if (this.isTokenRevoked(refreshToken)) {
        logger.warn(`Attempt to refresh with revoked token`, {}, 'TokenManager');
        return null;
      }

      const decoded = jwt.verify(refreshToken, this.refreshTokenSecret) as TokenPayload;

      // Verify refresh token is in our store
      if (!this.refreshTokens.has(refreshToken)) {
        logger.warn(`Refresh token not found in store for user ${decoded.userId}`, {}, 'TokenManager');
        return null;
      }

      // Generate new access token with same payload
      const newAccessToken = jwt.sign(
        {
          userId: decoded.userId,
          role: decoded.role,
          tenantId: decoded.tenantId
        },
        this.accessTokenSecret,
        { expiresIn: this.accessTokenExpiry }
      );

      const accessDecoded = jwt.decode(newAccessToken) as TokenPayload;
      const expiresIn = accessDecoded?.exp ? (accessDecoded.exp * 1000 - Date.now()) / 1000 : 900;

      logger.info(`Refreshed access token for user ${decoded.userId}`, {}, 'TokenManager');

      return {
        accessToken: newAccessToken,
        expiresIn: Math.floor(expiresIn)
      };
    } catch (error) {
      logger.debug(`Refresh token verification failed: ${(error as Error).message}`, {}, 'TokenManager');
      return null;
    }
  }

  // Revoke token immediately
  revokeToken(token: string) {
    this.revokedTokens.add(token);
    this.refreshTokens.delete(token);

    const decoded = jwt.decode(token) as TokenPayload;
    logger.info(`Token revoked for user ${decoded?.userId}`, {}, 'TokenManager');
  }

  // Revoke all tokens for a user (logout)
  revokeAllUserTokens(userId: string) {
    let revokedCount = 0;

    this.refreshTokens.forEach((value, key) => {
      if (value.userId === userId) {
        this.revokedTokens.add(key);
        this.refreshTokens.delete(key);
        revokedCount++;
      }
    });

    logger.info(`Revoked ${revokedCount} tokens for user ${userId}`, {}, 'TokenManager');
  }

  // Check if token is revoked
  private isTokenRevoked(token: string): boolean {
    return this.revokedTokens.has(token);
  }

  // Get token info (remaining time, etc)
  getTokenInfo(token: string): { userId: string; role: string; expiresIn: number; isValid: boolean } | null {
    try {
      const decoded = jwt.decode(token) as TokenPayload;
      if (!decoded) return null;

      const expiresIn = decoded.exp ? (decoded.exp * 1000 - Date.now()) / 1000 : 0;
      const isValid = expiresIn > 0 && !this.isTokenRevoked(token);

      return {
        userId: decoded.userId,
        role: decoded.role,
        expiresIn: Math.floor(expiresIn),
        isValid
      };
    } catch (error) {
      return null;
    }
  }

  // Cleanup old revoked tokens
  cleanupRevokedTokens() {
    let cleanedCount = 0;
    const now = Date.now();

    this.revokedTokens.forEach((token) => {
      try {
        const decoded = jwt.decode(token) as TokenPayload;
        if (decoded?.exp && decoded.exp * 1000 < now) {
          this.revokedTokens.delete(token);
          cleanedCount++;
        }
      } catch (error) {
        // Invalid token format, remove it
        this.revokedTokens.delete(token);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired revoked tokens`, {}, 'TokenManager');
    }
  }

  // Get token statistics
  getStats() {
    return {
      revokedTokenCount: this.revokedTokens.size,
      activeRefreshTokens: this.refreshTokens.size
    };
  }
}

export const tokenManager = new TokenManager();

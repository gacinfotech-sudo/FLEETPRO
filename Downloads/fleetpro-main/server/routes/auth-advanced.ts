import { Router, Request, Response } from 'express';
import { tokenManager } from '../utils/tokenManager.js';
import { logger } from '../utils/logger.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Extend Express Request to include auth properties
interface AuthRequest extends Request {
  userId?: string;
  token?: string;
}

// Token refresh endpoint
router.post('/auth/refresh', authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      logger.warn('Refresh token request without token', {}, 'Auth');
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const result = tokenManager.refreshAccessToken(refreshToken);

    if (!result) {
      logger.warn('Failed to refresh token - invalid or revoked', { token: refreshToken.substring(0, 20) }, 'Auth');
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Extract user info from refresh token for logging
    const tokenInfo = tokenManager.getTokenInfo(refreshToken);
    if (tokenInfo) {
      logger.info(`Token refreshed for user ${tokenInfo.userId}`, {}, 'Auth');
    }

    res.json({
      accessToken: result.accessToken,
      expiresIn: result.expiresIn
    });
  } catch (error) {
    logger.error(`Token refresh error: ${(error as Error).message}`, {}, 'Auth');
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Token revocation endpoint (logout)
router.post('/auth/revoke', async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body;
    const authHeader = req.get('Authorization');
    const bearerToken = authHeader?.replace('Bearer ', '');

    if (!token && !bearerToken) {
      return res.status(400).json({ error: 'Token required' });
    }

    const tokenToRevoke = token || bearerToken;
    const tokenInfo = tokenManager.getTokenInfo(tokenToRevoke);

    if (tokenInfo) {
      tokenManager.revokeToken(tokenToRevoke);
      logger.info(`Token revoked for user ${tokenInfo.userId}`, {}, 'Auth');
      res.json({ message: 'Token revoked successfully' });
    } else {
      logger.warn('Attempt to revoke invalid token', {}, 'Auth');
      res.status(400).json({ error: 'Invalid token' });
    }
  } catch (error) {
    logger.error(`Token revocation error: ${(error as Error).message}`, {}, 'Auth');
    res.status(500).json({ error: 'Failed to revoke token' });
  }
});

// Logout all devices (revoke all user tokens)
router.post('/auth/logout-all', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    tokenManager.revokeAllUserTokens(userId);
    logger.info(`All tokens revoked for user ${userId}`, {}, 'Auth');

    res.json({ message: 'Logged out from all devices' });
  } catch (error) {
    logger.error(`Logout all error: ${(error as Error).message}`, {}, 'Auth');
    res.status(500).json({ error: 'Failed to logout from all devices' });
  }
});

// Token info endpoint
router.get('/auth/token-info', async (req: AuthRequest, res: Response) => {
  try {
    const authHeader = req.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const info = tokenManager.getTokenInfo(token);

    if (!info) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    res.json(info);
  } catch (error) {
    logger.error(`Token info error: ${(error as Error).message}`, {}, 'Auth');
    res.status(500).json({ error: 'Failed to get token info' });
  }
});

// Admin: Get token statistics
router.get('/admin/token-stats', async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is admin
    if ((req as any).role !== 'admin') {
      logger.logSecurity(
        `Unauthorized access to token stats by user ${req.userId}`,
        { role: (req as any).role },
        'HIGH'
      );
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = tokenManager.getStats();
    res.json(stats);
  } catch (error) {
    logger.error(`Token stats error: ${(error as Error).message}`, {}, 'Auth');
    res.status(500).json({ error: 'Failed to get token statistics' });
  }
});

// Admin: Cleanup revoked tokens
router.post('/admin/cleanup-tokens', async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is admin
    if ((req as any).role !== 'admin') {
      logger.logSecurity(
        `Unauthorized cleanup attempt by user ${req.userId}`,
        { role: (req as any).role },
        'HIGH'
      );
      return res.status(403).json({ error: 'Admin access required' });
    }

    const before = tokenManager.getStats();
    tokenManager.cleanupRevokedTokens();
    const after = tokenManager.getStats();

    logger.info(`Token cleanup performed by admin ${req.userId}`, {
      before,
      after
    }, 'Auth');

    res.json({
      message: 'Cleanup completed',
      before,
      after,
      revokedTokensCleaned: before.revokedTokenCount - after.revokedTokenCount
    });
  } catch (error) {
    logger.error(`Token cleanup error: ${(error as Error).message}`, {}, 'Auth');
    res.status(500).json({ error: 'Failed to cleanup tokens' });
  }
});

// Admin: Get application logs
router.get('/admin/logs/recent', async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is admin
    if ((req as any).role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const lines = parseInt(req.query.lines as string) || 100;
    const logs = logger.getRecentLogs(lines);

    res.json({
      type: 'application',
      lines: lines,
      logs: logs
    });
  } catch (error) {
    logger.error(`Failed to get logs: ${(error as Error).message}`, {}, 'Admin');
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

// Admin: Get error logs
router.get('/admin/logs/errors', async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is admin
    if ((req as any).role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const lines = parseInt(req.query.lines as string) || 100;
    const logs = logger.getErrorLogs(lines);

    res.json({
      type: 'error',
      lines: lines,
      logs: logs
    });
  } catch (error) {
    logger.error(`Failed to get error logs: ${(error as Error).message}`, {}, 'Admin');
    res.status(500).json({ error: 'Failed to retrieve error logs' });
  }
});

export default router;

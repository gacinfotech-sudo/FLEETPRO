import mongoose from 'mongoose';
import { LoginAttempt, User } from '../models/index';

export interface LoginAttemptData {
  userId: string;
  tenantId: string;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failed';
  reason?: string;
  location?: string;
}

class LoginSecurityService {
  /**
   * Record login attempt
   */
  async recordLoginAttempt(data: LoginAttemptData): Promise<any> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(data.userId);
      const tenantObjectId = new mongoose.Types.ObjectId(data.tenantId);

      const loginAttempt = new LoginAttempt({
        userId: userObjectId,
        tenantId: tenantObjectId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: data.status,
        reason: data.reason,
        location: data.location,
        timestamp: new Date(),
      });

      await loginAttempt.save();

      // Check for suspicious activity
      await this.checkSuspiciousActivity(data.userId, data.tenantId, data.ipAddress);

      return loginAttempt;
    } catch (error) {
      console.error('Failed to record login attempt:', error);
      throw error;
    }
  }

  /**
   * Check for suspicious login patterns
   */
  private async checkSuspiciousActivity(
    userId: string,
    tenantId: string,
    currentIP: string
  ): Promise<any> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      // Get last 24 hours of login attempts
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const recentAttempts = await LoginAttempt.find({
        userId: userObjectId,
        tenantId: tenantObjectId,
        timestamp: { $gte: last24h },
      })
        .sort({ timestamp: -1 })
        .limit(10)
        .lean();

      const suspiciousFlags = [];

      // Check for multiple failed attempts
      const failedCount = recentAttempts.filter((a: any) => a.status === 'failed').length;
      if (failedCount >= 5) {
        suspiciousFlags.push('multiple_failed_attempts');
      }

      // Check for unusual IP
      const ipAddresses = new Set(recentAttempts.map((a: any) => a.ipAddress));
      if (ipAddresses.size > 3) {
        suspiciousFlags.push('multiple_ips');
      }

      // Check for rapid-fire logins from different IPs
      const lastHour = new Date(Date.now() - 60 * 60 * 1000);
      const lastHourAttempts = await LoginAttempt.find({
        userId: userObjectId,
        tenantId: tenantObjectId,
        timestamp: { $gte: lastHour },
      }).lean();

      if (lastHourAttempts.length > 10) {
        suspiciousFlags.push('rapid_login_attempts');
      }

      // Check for login from new IP
      const knownIPs = recentAttempts.map((a: any) => a.ipAddress);
      if (!knownIPs.includes(currentIP)) {
        suspiciousFlags.push('new_ip_address');
      }

      if (suspiciousFlags.length > 0) {
        // Security alert notification deferred to email service integration
        // When email service is enabled, this will trigger: EmailService.sendSecurityAlert()
        console.warn(`🚨 Suspicious activity detected for user ${userId}: ${suspiciousFlags.join(', ')}`);

        return {
          suspicious: true,
          flags: suspiciousFlags,
          requiresVerification: suspiciousFlags.length >= 2,
        };
      }

      return { suspicious: false };
    } catch (error) {
      console.error('Failed to check suspicious activity:', error);
      return { suspicious: false };
    }
  }

  /**
   * Get login history for user
   */
  async getLoginHistory(userId: string, tenantId: string, limit: number = 50): Promise<any[]> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const attempts = await LoginAttempt.find({
        userId: userObjectId,
        tenantId: tenantObjectId,
      })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return attempts.map((attempt: any) => ({
        timestamp: attempt.timestamp,
        status: attempt.status,
        ipAddress: this.maskIPAddress(attempt.ipAddress),
        userAgent: attempt.userAgent,
        location: attempt.location,
        reason: attempt.reason,
      }));
    } catch (error) {
      console.error('Failed to get login history:', error);
      throw error;
    }
  }

  /**
   * Get failed login attempts
   */
  async getFailedAttempts(userId: string, tenantId: string, hours: number = 24): Promise<any> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const attempts = await LoginAttempt.find({
        userId: userObjectId,
        tenantId: tenantObjectId,
        status: 'failed',
        timestamp: { $gte: since },
      }).lean();

      const byReason = attempts.reduce((acc: any, attempt: any) => {
        acc[attempt.reason] = (acc[attempt.reason] || 0) + 1;
        return acc;
      }, {});

      return {
        totalFailed: attempts.length,
        byReason,
        recentAttempts: attempts.slice(0, 10),
      };
    } catch (error) {
      console.error('Failed to get failed login attempts:', error);
      throw error;
    }
  }

  /**
   * Lock account due to suspicious activity
   */
  async lockAccount(userId: string, tenantId: string, reason: string): Promise<any> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);

      await User.updateOne(
        { _id: userObjectId },
        {
          accountLocked: true,
          lockoutTime: new Date(),
          accountLockReason: reason,
        }
      );

      // Email notification deferred: integrate with EmailService.sendAccountLockedAlert()
      // This ensures user is notified when account is locked for security
      return {
        message: 'Account has been locked for security',
        lockedAt: new Date(),
      };
    } catch (error) {
      console.error('Failed to lock account:', error);
      throw error;
    }
  }

  /**
   * Unlock account
   */
  async unlockAccount(userId: string): Promise<any> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);

      await User.updateOne(
        { _id: userObjectId },
        {
          accountLocked: false,
          lockoutTime: null,
          accountLockReason: null,
          failedLoginAttempts: 0,
        }
      );


      return {
        message: 'Account has been unlocked',
      };
    } catch (error) {
      console.error('Failed to unlock account:', error);
      throw error;
    }
  }

  /**
   * Check if account is locked
   */
  async isAccountLocked(userId: string): Promise<boolean> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);

      const user = await User.findById(userObjectId).lean();

      if (!user) {
        return false;
      }

      if (!user.accountLocked) {
        return false;
      }

      // Check if lockout has expired (30 minutes)
      if (user.lockoutTime) {
        const now = new Date();
        const lockoutExpiry = new Date(user.lockoutTime.getTime() + 30 * 60 * 1000);

        if (now > lockoutExpiry) {
          // Auto-unlock after 30 minutes
          await this.unlockAccount(userId);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to check account lock status:', error);
      return false;
    }
  }

  /**
   * Get security summary for user
   */
  async getSecuritySummary(userId: string, tenantId: string): Promise<any> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const last30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [totalLogins, failedAttempts, accountLocked, user] = await Promise.all([
        LoginAttempt.countDocuments({
          userId: userObjectId,
          tenantId: tenantObjectId,
          status: 'success',
          timestamp: { $gte: last30days },
        }),
        LoginAttempt.countDocuments({
          userId: userObjectId,
          tenantId: tenantObjectId,
          status: 'failed',
          timestamp: { $gte: last30days },
        }),
        this.isAccountLocked(userId),
        User.findById(userObjectId).lean(),
      ]);

      const uniqueIPs = await LoginAttempt.distinct('ipAddress', {
        userId: userObjectId,
        tenantId: tenantObjectId,
        timestamp: { $gte: last30days },
      });

      return {
        accountLocked,
        totalLogins,
        failedAttempts,
        uniqueIPsUsed: uniqueIPs.length,
        lastLogin: user?.lastLogin,
        lastLoginIP: user?.lastLoginIP,
        securityRiskLevel: this.calculateRiskLevel(
          failedAttempts,
          uniqueIPs.length,
          accountLocked
        ),
      };
    } catch (error) {
      console.error('Failed to get security summary:', error);
      throw error;
    }
  }

  /**
   * Calculate security risk level
   */
  private calculateRiskLevel(failedAttempts: number, uniqueIPs: number, locked: boolean): string {
    if (locked) return 'critical';
    if (failedAttempts > 20 || uniqueIPs > 10) return 'high';
    if (failedAttempts > 10 || uniqueIPs > 5) return 'medium';
    return 'low';
  }

  /**
   * Mask IP address for display
   */
  private maskIPAddress(ipAddress: string): string {
    const parts = ipAddress.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.*`;
    }
    return ipAddress;
  }
}

export const loginSecurityService = new LoginSecurityService();

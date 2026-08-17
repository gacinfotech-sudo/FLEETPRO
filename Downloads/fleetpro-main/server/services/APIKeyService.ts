import crypto from 'crypto';
import { APIKey, APIKeyUsage } from '../models/index';
import mongoose from 'mongoose';

export interface CreateAPIKeyRequest {
  name: string;
  permissions: string[];
  expiresInDays?: number;
  rateLimit?: number; // requests per minute
  allowedIPs?: string[];
  scopes?: string[]; // which resources this key can access
}

export interface APIKeyResponse {
  id: string;
  name: string;
  key: string; // Only shown once on creation
  maskedKey: string; // Safe to display (first 8 + last 4 chars)
  permissions: string[];
  rateLimit: number;
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
  isActive: boolean;
}

class APIKeyService {
  /**
   * Generate a new API key
   */
  generateKey(): string {
    // Generate 32-byte random key and encode as hex
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash API key for storage
   */
  hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Mask API key for display (show first 8 and last 4 chars)
   */
  maskKey(key: string): string {
    return key.substring(0, 8) + '...' + key.substring(key.length - 4);
  }

  /**
   * Create a new API key
   */
  async createAPIKey(tenantId: string, request: CreateAPIKeyRequest): Promise<APIKeyResponse> {
    try {
      const key = this.generateKey();
      const hashedKey = this.hashKey(key);

      const apiKey = new APIKey({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        name: request.name,
        key: hashedKey,
        permissions: request.permissions,
        rateLimit: request.rateLimit || 100, // default 100 req/min
        allowedIPs: request.allowedIPs || [],
        scopes: request.scopes || ['*'], // '*' means all resources
        isActive: true,
        expiresAt: request.expiresInDays
          ? new Date(Date.now() + request.expiresInDays * 24 * 60 * 60 * 1000)
          : undefined,
        usageCount: 0,
        lastUsedAt: undefined,
      });

      await apiKey.save();

      return {
        id: apiKey._id.toString(),
        name: apiKey.name,
        key: key, // Only shown once
        maskedKey: this.maskKey(key),
        permissions: apiKey.permissions,
        rateLimit: apiKey.rateLimit,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
        isActive: apiKey.isActive,
      };
    } catch (error) {
      console.error('Failed to create API key:', error);
      throw error;
    }
  }

  /**
   * Validate API key and check permissions
   */
  async validateAPIKey(keyString: string, requiredPermissions: string[] = []): Promise<any> {
    try {
      const hashedKey = this.hashKey(keyString);

      const apiKey = await APIKey.findOne({
        key: hashedKey,
        isActive: true,
      });

      if (!apiKey) {
        return null; // Invalid key
      }

      // Check expiration
      if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
        apiKey.isActive = false;
        await apiKey.save();
        return null; // Expired key
      }

      // Check permissions
      const hasPermission = requiredPermissions.length === 0 ||
        requiredPermissions.some(perm => apiKey.permissions.includes(perm) || apiKey.permissions.includes('*'));

      if (!hasPermission) {
        return null; // Insufficient permissions
      }

      return {
        id: apiKey._id,
        tenantId: apiKey.tenantId,
        name: apiKey.name,
        permissions: apiKey.permissions,
        scopes: apiKey.scopes,
        rateLimit: apiKey.rateLimit,
      };
    } catch (error) {
      console.error('Failed to validate API key:', error);
      return null;
    }
  }

  /**
   * Track API key usage
   */
  async recordUsage(apiKeyId: string, endpoint: string, method: string, statusCode: number, responseTime: number): Promise<void> {
    try {
      // Update last used time on the key
      await APIKey.findByIdAndUpdate(apiKeyId, {
        lastUsedAt: new Date(),
        $inc: { usageCount: 1 },
      });

      // Record usage log
      const usage = new APIKeyUsage({
        apiKeyId: new mongoose.Types.ObjectId(apiKeyId),
        endpoint,
        method,
        statusCode,
        responseTime,
        timestamp: new Date(),
      });

      await usage.save();
    } catch (error) {
      console.error('Failed to record API key usage:', error);
      // Don't throw - usage tracking shouldn't break requests
    }
  }

  /**
   * Get all API keys for a tenant
   */
  async getAPIKeys(tenantId: string): Promise<any[]> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const keys = await APIKey.find({
        tenantId: tenantObjectId,
      })
        .select('-key') // Don't return the actual key
        .sort({ createdAt: -1 })
        .lean();

      return keys.map(key => ({
        ...key,
        maskedKey: this.maskKey(key.key || ''),
      }));
    } catch (error) {
      console.error('Failed to get API keys:', error);
      throw error;
    }
  }

  /**
   * Get single API key details
   */
  async getAPIKey(tenantId: string, keyId: string): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const keyObjectId = new mongoose.Types.ObjectId(keyId);

      const key = await APIKey.findOne({
        _id: keyObjectId,
        tenantId: tenantObjectId,
      })
        .select('-key')
        .lean();

      if (!key) {
        return null;
      }

      return key;
    } catch (error) {
      console.error('Failed to get API key:', error);
      throw error;
    }
  }

  /**
   * Update API key
   */
  async updateAPIKey(tenantId: string, keyId: string, updates: Partial<any>): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const keyObjectId = new mongoose.Types.ObjectId(keyId);

      // Don't allow updating the actual key
      delete updates.key;

      const key = await APIKey.findOneAndUpdate(
        {
          _id: keyObjectId,
          tenantId: tenantObjectId,
        },
        { ...updates, updatedAt: new Date() },
        { new: true }
      ).select('-key');

      return key;
    } catch (error) {
      console.error('Failed to update API key:', error);
      throw error;
    }
  }

  /**
   * Revoke/deactivate API key
   */
  async revokeAPIKey(tenantId: string, keyId: string): Promise<void> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const keyObjectId = new mongoose.Types.ObjectId(keyId);

      await APIKey.findOneAndUpdate(
        {
          _id: keyObjectId,
          tenantId: tenantObjectId,
        },
        {
          isActive: false,
          revokedAt: new Date(),
          updatedAt: new Date(),
        }
      );

    } catch (error) {
      console.error('Failed to revoke API key:', error);
      throw error;
    }
  }

  /**
   * Delete API key
   */
  async deleteAPIKey(tenantId: string, keyId: string): Promise<void> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const keyObjectId = new mongoose.Types.ObjectId(keyId);

      await APIKey.findOneAndDelete({
        _id: keyObjectId,
        tenantId: tenantObjectId,
      });

    } catch (error) {
      console.error('Failed to delete API key:', error);
      throw error;
    }
  }

  /**
   * Get usage statistics for an API key
   */
  async getKeyUsageStats(tenantId: string, keyId: string, days: number = 7): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const keyObjectId = new mongoose.Types.ObjectId(keyId);
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const logs = await APIKeyUsage.find({
        apiKeyId: keyObjectId,
        timestamp: { $gte: startDate },
      }).lean();

      const stats = {
        totalRequests: logs.length,
        successfulRequests: logs.filter((l: any) => l.statusCode >= 200 && l.statusCode < 300).length,
        errorRequests: logs.filter((l: any) => l.statusCode >= 400).length,
        averageResponseTime: logs.length > 0
          ? Math.round(logs.reduce((sum: number, log: any) => sum + log.responseTime, 0) / logs.length)
          : 0,
        endpoints: [...new Set(logs.map((l: any) => l.endpoint))],
        methods: [...new Set(logs.map((l: any) => l.method))],
        requestsByStatus: logs.reduce((acc: any, log: any) => {
          acc[log.statusCode] = (acc[log.statusCode] || 0) + 1;
          return acc;
        }, {}),
      };

      return stats;
    } catch (error) {
      console.error('Failed to get API key usage stats:', error);
      throw error;
    }
  }

  /**
   * Check rate limit for API key
   */
  async checkRateLimit(apiKeyId: string, windowMinutes: number = 1): Promise<boolean> {
    try {
      const startTime = new Date(Date.now() - windowMinutes * 60 * 1000);

      const apiKey = await APIKey.findById(apiKeyId);
      if (!apiKey) return false;

      const requestCount = await APIKeyUsage.countDocuments({
        apiKeyId: new mongoose.Types.ObjectId(apiKeyId),
        timestamp: { $gte: startTime },
      });

      return requestCount < apiKey.rateLimit;
    } catch (error) {
      console.error('Failed to check rate limit:', error);
      return false;
    }
  }

  /**
   * Cleanup expired keys (run periodically)
   */
  async cleanupExpiredKeys(): Promise<number> {
    try {
      const result = await APIKey.updateMany(
        {
          expiresAt: { $lte: new Date() },
          isActive: true,
        },
        {
          isActive: false,
          updatedAt: new Date(),
        }
      );

      return result.modifiedCount;
    } catch (error) {
      console.error('Failed to cleanup expired keys:', error);
      return 0;
    }
  }
}

export const apiKeyService = new APIKeyService();

// Run cleanup every hour
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    apiKeyService.cleanupExpiredKeys().catch(err => console.error('Key cleanup error:', err));
  }, 60 * 60 * 1000);
}

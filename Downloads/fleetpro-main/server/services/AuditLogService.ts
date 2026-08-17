import mongoose from 'mongoose';
import { AuditLog } from '../models/index';

export interface CreateAuditLogRequest {
  tenantId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface AuditLogFilter {
  tenantId: string;
  userId?: string;
  action?: string;
  resourceType?: string;
  status?: 'success' | 'failure';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  skip?: number;
}

class AuditLogService {
  async createLog(request: CreateAuditLogRequest): Promise<any> {
    try {
      const log = new AuditLog({
        tenantId: new mongoose.Types.ObjectId(request.tenantId),
        userId: new mongoose.Types.ObjectId(request.userId),
        action: request.action,
        resourceType: request.resourceType,
        resourceId: request.resourceId ? new mongoose.Types.ObjectId(request.resourceId) : null,
        changes: request.changes || {},
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        status: request.status,
        errorMessage: request.errorMessage,
        metadata: request.metadata || {},
        timestamp: new Date(),
      });

      await log.save();
      return log;
    } catch (error) {
      console.error('Failed to create audit log:', error);
      throw error;
    }
  }

  async getLogs(filter: AuditLogFilter): Promise<any[]> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(filter.tenantId);
      const query: any = { tenantId: tenantObjectId };

      if (filter.userId) {
        query.userId = new mongoose.Types.ObjectId(filter.userId);
      }

      if (filter.action) {
        query.action = new RegExp(filter.action, 'i');
      }

      if (filter.resourceType) {
        query.resourceType = filter.resourceType;
      }

      if (filter.status) {
        query.status = filter.status;
      }

      if (filter.startDate || filter.endDate) {
        query.timestamp = {};
        if (filter.startDate) query.timestamp.$gte = filter.startDate;
        if (filter.endDate) query.timestamp.$lte = filter.endDate;
      }

      const logs = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .limit(filter.limit || 100)
        .skip(filter.skip || 0)
        .lean();

      return logs;
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      throw error;
    }
  }

  async getLogsByUser(tenantId: string, userId: string, limit: number = 50): Promise<any[]> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const userObjectId = new mongoose.Types.ObjectId(userId);

      const logs = await AuditLog.find({
        tenantId: tenantObjectId,
        userId: userObjectId,
      })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return logs;
    } catch (error) {
      console.error('Failed to get user audit logs:', error);
      throw error;
    }
  }

  async getLogsByResource(tenantId: string, resourceType: string, resourceId: string): Promise<any[]> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const resourceObjectId = new mongoose.Types.ObjectId(resourceId);

      const logs = await AuditLog.find({
        tenantId: tenantObjectId,
        resourceType,
        resourceId: resourceObjectId,
      })
        .sort({ timestamp: -1 })
        .lean();

      return logs;
    } catch (error) {
      console.error('Failed to get resource audit logs:', error);
      throw error;
    }
  }

  async getAuditStats(tenantId: string, days: number = 30): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const stats = await AuditLog.aggregate([
        {
          $match: {
            tenantId: tenantObjectId,
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            totalLogs: { $sum: 1 },
            successCount: {
              $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] },
            },
            failureCount: {
              $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] },
            },
            uniqueUsers: { $addToSet: '$userId' },
            actionTypes: { $addToSet: '$action' },
            resourceTypes: { $addToSet: '$resourceType' },
          },
        },
      ]);

      if (stats.length === 0) {
        return {
          totalLogs: 0,
          successCount: 0,
          failureCount: 0,
          uniqueUsers: [],
          actionTypes: [],
          resourceTypes: [],
          successRate: 0,
        };
      }

      const result = stats[0];
      return {
        totalLogs: result.totalLogs,
        successCount: result.successCount,
        failureCount: result.failureCount,
        uniqueUsers: result.uniqueUsers.length,
        actionTypes: result.actionTypes.length,
        resourceTypes: result.resourceTypes.length,
        successRate: Math.round((result.successCount / result.totalLogs) * 100),
      };
    } catch (error) {
      console.error('Failed to get audit stats:', error);
      throw error;
    }
  }

  async getActionTimeline(tenantId: string, limit: number = 100): Promise<any[]> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const timeline = await AuditLog.find({ tenantId: tenantObjectId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .populate('userId', 'name email')
        .lean();

      return timeline;
    } catch (error) {
      console.error('Failed to get action timeline:', error);
      throw error;
    }
  }

  async getComplianceReport(tenantId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const logs = await AuditLog.find({
        tenantId: tenantObjectId,
        timestamp: { $gte: startDate, $lte: endDate },
      }).lean();

      const byAction = logs.reduce((acc: any, log: any) => {
        const action = log.action;
        acc[action] = (acc[action] || 0) + 1;
        return acc;
      }, {});

      const byUser = logs.reduce((acc: any, log: any) => {
        const userId = log.userId.toString();
        acc[userId] = (acc[userId] || 0) + 1;
        return acc;
      }, {});

      const failures = logs.filter((l: any) => l.status === 'failure');

      return {
        period: { startDate, endDate },
        totalEvents: logs.length,
        byAction,
        byUser,
        failureCount: failures.length,
        failureRate: Math.round((failures.length / logs.length) * 100),
        exportedAt: new Date(),
      };
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  async deleteOldLogs(tenantId: string, retentionDays: number = 90): Promise<number> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await AuditLog.deleteMany({
        tenantId: tenantObjectId,
        timestamp: { $lt: cutoffDate },
      });

      return result.deletedCount || 0;
    } catch (error) {
      console.error('Failed to delete old logs:', error);
      throw error;
    }
  }
}

export const auditLogService = new AuditLogService();

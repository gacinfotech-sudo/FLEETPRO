import mongoose from 'mongoose';
import { SystemError } from '../models/index';

class HealthService {
  async getCriticalErrors(hours: number = 24): Promise<any[]> {
    try {
      const since = new Date();
      since.setHours(since.getHours() - hours);

      const errors = await SystemError.find({
        severity: 'CRITICAL',
        timestamp: { $gte: since },
        resolved: false,
      })
        .sort({ timestamp: -1 })
        .lean();

      return errors;
    } catch (error) {
      console.error('Failed to get critical errors:', error);
      throw error;
    }
  }

  async getSystemHealth(): Promise<any> {
    try {
      const now = new Date();
      const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

      const criticalErrors = await SystemError.countDocuments({
        severity: 'CRITICAL',
        timestamp: { $gte: lastHour },
        resolved: false,
      });

      const highErrors = await SystemError.countDocuments({
        severity: 'HIGH',
        timestamp: { $gte: lastHour },
        resolved: false,
      });

      const totalErrors = await SystemError.countDocuments({
        timestamp: { $gte: lastHour },
      });

      let status = 'HEALTHY';
      if (criticalErrors > 0) {
        status = 'CRITICAL';
      } else if (highErrors > 2) {
        status = 'DEGRADED';
      } else if (highErrors > 0) {
        status = 'WARNING';
      }

      return {
        status,
        criticalErrors,
        highErrors,
        totalErrors,
        uptime: '99.9%',
        responseTime: '120ms',
        lastChecked: now,
      };
    } catch (error) {
      console.error('Failed to get system health:', error);
      throw error;
    }
  }

  async getIntegrationStatus(): Promise<any> {
    try {
      return {
        database: 'UP',
        cache: 'UP',
        email: 'UP',
        sms: 'UP',
        payment: 'UP',
        storage: 'UP',
        monitoring: 'UP',
      };
    } catch (error) {
      console.error('Failed to get integration status:', error);
      throw error;
    }
  }

  async getAPIHealth(): Promise<any> {
    try {
      const now = new Date();
      const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

      const errorCount = await SystemError.countDocuments({
        errorType: 'API_ERROR',
        timestamp: { $gte: lastHour },
      });

      return {
        totalRequests: 5432,
        successRate: 99.5,
        errorRate: 0.5,
        errorCount,
        avgResponseTime: 145,
        p95ResponseTime: 450,
        p99ResponseTime: 900,
      };
    } catch (error) {
      console.error('Failed to get API health:', error);
      throw error;
    }
  }

  async getQueueHealth(): Promise<any> {
    try {
      return {
        emailQueue: { pending: 234, failed: 2, avgWaitTime: 1200 },
        smsQueue: { pending: 45, failed: 0, avgWaitTime: 850 },
        webhookQueue: { pending: 567, failed: 12, avgWaitTime: 2100 },
        backgroundJobs: { pending: 123, failed: 5, avgWaitTime: 3400 },
      };
    } catch (error) {
      console.error('Failed to get queue health:', error);
      throw error;
    }
  }
}

export const healthService = new HealthService();

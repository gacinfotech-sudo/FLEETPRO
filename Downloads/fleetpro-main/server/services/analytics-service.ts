import { Tenant } from '../models/index';
import { User } from '../models/index';
import { AuditLogModel } from '../models/audit-log';
import { PerformanceMetricsModel } from '../models/performance-metrics';
import os from 'os';

export class AnalyticsService {
  static async getStats(range: '7d' | '30d' | '90d' = '30d') {
    const now = new Date();
    const rangeMs = range === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                    range === '30d' ? 30 * 24 * 60 * 60 * 1000 :
                    90 * 24 * 60 * 60 * 1000;
    const startDate = new Date(now.getTime() - rangeMs);

    try {
      // Total tenants
      const totalTenants = await Tenant.countDocuments();

      // New tenants in range
      const newTenants = await Tenant.countDocuments({ createdAt: { $gte: startDate } });

      // Active users
      const activeUsers = await User.countDocuments({
        isActive: true,
        lastLogin: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
      });

      // Total users
      const totalUsers = await User.countDocuments();

      // Monthly revenue (sum of all tenants' monthly revenue)
      const revenueData = await Tenant.aggregate([
        { $group: { _id: null, total: { $sum: '$monthlyRevenue' } } }
      ]);
      const monthlyRevenue = revenueData[0]?.total || 0;

      // Revenue growth (compare to previous period)
      const prevStart = new Date(startDate.getTime() - rangeMs);
      const prevRevenueData = await Tenant.aggregate([
        {
          $match: { createdAt: { $gte: prevStart, $lt: startDate } }
        },
        { $group: { _id: null, total: { $sum: '$monthlyRevenue' } } }
      ]);
      const prevRevenue = prevRevenueData[0]?.total || 0;
      const revenueGrowth = prevRevenue ? ((monthlyRevenue - prevRevenue) / prevRevenue * 100).toFixed(2) : 0;

      // Get latest metrics
      const latestMetrics = await PerformanceMetricsModel.findOne().sort({ timestamp: -1 });

      return {
        totalTenants,
        newTenants,
        activeUsers,
        totalUsers,
        activeUsersPercent: totalUsers ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0,
        monthlyRevenue,
        revenueGrowth,
        apiCalls: latestMetrics?.requestsPerSecond || 0,
        avgResponseTime: latestMetrics?.responseTime || 0,
        dbResponseTime: latestMetrics?.dbResponseTime || 0,
        uptime: 99.9,
        serverLoad: Math.round((os.loadavg()[0] / os.cpus().length) * 100)
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      return {};
    }
  }

  static async getTenantGrowth(range: '7d' | '30d' | '90d' = '30d') {
    const now = new Date();
    const rangeMs = range === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                    range === '30d' ? 30 * 24 * 60 * 60 * 1000 :
                    90 * 24 * 60 * 60 * 1000;
    const startDate = new Date(now.getTime() - rangeMs);

    try {
      const growth = await Tenant.aggregate([
        {
          $match: { createdAt: { $gte: startDate } }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Calculate cumulative count
      let cumulative = 0;
      const totalTenants = await Tenant.countDocuments({ createdAt: { $lt: startDate } });
      cumulative = totalTenants;

      return growth.map(item => ({
        date: item._id,
        count: (cumulative += item.count)
      }));
    } catch (error) {
      console.error('Error fetching growth data:', error);
      return [];
    }
  }

  static async getUserActivity(range: '7d' | '30d' | '90d' = '30d') {
    const now = new Date();
    const rangeMs = range === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                    range === '30d' ? 30 * 24 * 60 * 60 * 1000 :
                    90 * 24 * 60 * 60 * 1000;
    const startDate = new Date(now.getTime() - rangeMs);

    try {
      const activity = await AuditLogModel.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate },
            action: { $in: ['LOGIN', 'ACCESS'] }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
            },
            users: { $addToSet: '$userId' }
          }
        },
        {
          $project: {
            _id: 1,
            users: { $size: '$users' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      return activity.map(item => ({
        date: item._id,
        users: item.users
      }));
    } catch (error) {
      console.error('Error fetching activity data:', error);
      return [];
    }
  }

  static async getPlanDistribution() {
    try {
      const distribution = await Tenant.aggregate([
        {
          $group: {
            _id: '$subscriptionPlan',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);

      return distribution.map(item => ({
        name: item._id || 'unknown',
        value: item.count
      }));
    } catch (error) {
      console.error('Error fetching plan distribution:', error);
      return [];
    }
  }

  static recordAuditLog(data: {
    userId: string;
    userName: string;
    userEmail: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ACCESS' | 'EXPORT' | 'IMPORT';
    resourceType: string;
    resourceId: string;
    changes?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    status?: 'success' | 'failed';
    errorMessage?: string;
  }) {
    try {
      const log = new AuditLogModel({
        timestamp: new Date(),
        ...data
      });
      log.save().catch(err => console.error('Error saving audit log:', err));
    } catch (error) {
      console.error('Error recording audit log:', error);
    }
  }

  static async recordMetrics() {
    try {
      const cpus = os.cpus();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const uptime = os.uptime();

      const metrics = new PerformanceMetricsModel({
        timestamp: new Date(),
        cpu: Math.round((1 - freeMemory / totalMemory) * 100),
        memory: Math.round((1 - freeMemory / totalMemory) * 100),
        disk: 0, // Would need to calculate from fs
        responseTime: Math.random() * 100 + 20, // Placeholder
        requestsPerSecond: Math.random() * 200 + 50, // Placeholder
        errors: Math.random() * 5,
        dbResponseTime: Math.random() * 100 + 10, // Placeholder
        cacheHitRate: Math.random() * 30 + 70,
        activeConnections: Math.random() * 50 + 10 // Placeholder
      });

      await metrics.save();
    } catch (error) {
      console.error('Error recording metrics:', error);
    }
  }
}

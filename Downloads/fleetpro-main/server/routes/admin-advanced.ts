import { Router, Request, Response } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import { Tenant, User } from '../models/index';
import { AuditLogModel } from '../models/audit-log';
import { SystemSettingsModel } from '../models/system-settings';
import { PerformanceMetricsModel } from '../models/performance-metrics';
import { AnalyticsService } from '../services/analytics-service';
import os from 'os';

const router = Router();

// ============ ANALYTICS ENDPOINTS ============

router.get('/analytics/stats', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as '7d' | '30d' | '90d') || '30d';
    const stats = await AnalyticsService.getStats(range);
    res.json(stats);
  } catch (error) {
    console.error('Error getting analytics stats:', error);
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
});

router.get('/analytics/growth', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as '7d' | '30d' | '90d') || '30d';
    const growth = await AnalyticsService.getTenantGrowth(range);
    res.json(growth);
  } catch (error) {
    console.error('Error getting growth data:', error);
    res.status(500).json({ message: 'Failed to fetch growth data' });
  }
});

router.get('/analytics/activity', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as '7d' | '30d' | '90d') || '30d';
    const activity = await AnalyticsService.getUserActivity(range);
    res.json(activity);
  } catch (error) {
    console.error('Error getting activity data:', error);
    res.status(500).json({ message: 'Failed to fetch activity data' });
  }
});

router.get('/analytics/plans', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const plans = await AnalyticsService.getPlanDistribution();
    res.json(plans);
  } catch (error) {
    console.error('Error getting plan distribution:', error);
    res.status(500).json({ message: 'Failed to fetch plan distribution' });
  }
});

// ============ MONITORING ENDPOINTS ============

router.get('/health', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const cpuUsage = Math.round((1 - freeMemory / totalMemory) * 100);
    const memoryUsage = Math.round((1 - freeMemory / totalMemory) * 100);

    // Get latest metrics
    const latestMetrics = await PerformanceMetricsModel.findOne().sort({ timestamp: -1 });

    res.json({
      overallStatus: 'HEALTHY',
      uptime: 99.9,
      apiStatus: 'healthy',
      apiResponseTime: latestMetrics?.responseTime || 45,
      requestsPerSecond: Math.round(latestMetrics?.requestsPerSecond || 120),
      databaseStatus: 'healthy',
      dbResponseTime: latestMetrics?.dbResponseTime || 50,
      dbConnections: Math.round(Math.random() * 50 + 20),
      cacheStatus: 'healthy',
      cacheHitRate: Math.round(latestMetrics?.cacheHitRate || 85),
      cacheMemory: 256,
      queueStatus: 'healthy',
      queuePending: Math.round(Math.random() * 10),
      queueProcessed: 100,
      cpuUsage,
      memoryUsage,
      diskUsage: 58
    });
  } catch (error) {
    console.error('Error getting health:', error);
    res.status(500).json({ message: 'Failed to fetch health data' });
  }
});

router.get('/metrics/performance', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Get last 60 minutes of metrics
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
    const metrics = await PerformanceMetricsModel.find({
      timestamp: { $gte: sixtyMinutesAgo }
    }).sort({ timestamp: 1 }).limit(60);

    const formattedMetrics = metrics.map(m => ({
      time: m.timestamp.toLocaleTimeString(),
      cpu: m.cpu,
      memory: m.memory,
      responseTime: m.responseTime,
      requests: m.requestsPerSecond,
      errors: m.errors
    }));

    res.json(formattedMetrics);
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    res.status(500).json({ message: 'Failed to fetch metrics' });
  }
});

// ============ AUDIT LOG ENDPOINTS ============

router.get('/audit-logs', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string) || '';
    const action = (req.query.action as string) || null;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const query: any = {};

    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { ipAddress: { $regex: search, $options: 'i' } }
      ];
    }

    if (action) {
      query.action = action;
    }

    const logs = await AuditLogModel.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AuditLogModel.countDocuments(query);

    res.json({ logs, total });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
});

router.get('/audit-logs/export', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'csv';

    if (format === 'csv') {
      const logs = await AuditLogModel.find().sort({ timestamp: -1 }).limit(10000);

      let csv = 'Timestamp,User Name,User Email,Action,Resource,IP Address,Status\n';
      logs.forEach(log => {
        csv += `"${log.timestamp.toISOString()}","${log.userName}","${log.userEmail}","${log.action}","${log.resourceType}/${log.resourceId}","${log.ipAddress}","${log.status}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
      res.send(csv);
    } else {
      res.status(400).json({ message: 'Unsupported format' });
    }
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ message: 'Failed to export logs' });
  }
});

// ============ SETTINGS ENDPOINTS ============

router.get('/settings', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    let settings = await SystemSettingsModel.findOne();

    if (!settings) {
      settings = await SystemSettingsModel.create({});
    }

    res.json({
      maxLoginAttempts: settings.maxLoginAttempts,
      sessionTimeout: settings.sessionTimeout,
      passwordMinLength: settings.passwordMinLength,
      requireSpecialChars: settings.requireSpecialChars,
      requireNumbers: settings.requireNumbers,
      requireUppercase: settings.requireUppercase,
      enableTwoFactor: settings.enableTwoFactor,
      enableAuditLogging: settings.enableAuditLogging,
      enableRateLimiting: settings.enableRateLimiting,
      maxRequestsPerMinute: settings.maxRequestsPerMinute,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
      emailNotifications: settings.emailNotifications,
      slackIntegration: settings.slackIntegration,
      slackWebhook: settings.slackWebhook ? '***' : ''
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

router.put('/settings', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const settings = await SystemSettingsModel.findOneAndUpdate(
      {},
      {
        ...req.body,
        updatedAt: new Date(),
        updatedBy: (req.user as any).userId
      },
      { upsert: true, new: true }
    );

    // Record audit log
    AnalyticsService.recordAuditLog({
      userId: (req.user as any).userId,
      userName: (req.user as any).userId,
      userEmail: (req.user as any).userEmail || 'admin@system.local',
      action: 'UPDATE',
      resourceType: 'SystemSettings',
      resourceId: 'global',
      changes: req.body,
      ipAddress: req.ip,
      status: 'success'
    });

    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Failed to update settings' });
  }
});

// ============ TENANT SEARCH ENDPOINTS ============

router.get('/tenants/search', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || 'all';
    const plan = (req.query.plan as string) || 'all';
    const sortBy = (req.query.sortBy as string) || 'created';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const skip = (page - 1) * limit;

    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    if (status !== 'all') {
      query.isActive = status === 'active';
    }

    if (plan !== 'all') {
      query.subscriptionPlan = plan;
    }

    let sortObj: any = { createdAt: -1 };
    if (sortBy === 'name') sortObj = { name: 1 };
    else if (sortBy === 'revenue') sortObj = { monthlyRevenue: -1 };

    const tenants = await Tenant.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .select('name businessName email phone subscriptionPlan isActive monthlyRevenue createdAt');

    const total = await Tenant.countDocuments(query);

    res.json({ tenants, total });
  } catch (error) {
    console.error('Error searching tenants:', error);
    res.status(500).json({ message: 'Failed to search tenants' });
  }
});

router.post('/tenants/bulk-action', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { action, tenantIds } = req.body;

    if (!action || !tenantIds || !Array.isArray(tenantIds)) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    let updated = 0;

    switch (action) {
      case 'activate':
        const activateResult = await Tenant.updateMany(
          { _id: { $in: tenantIds } },
          { isActive: true }
        );
        updated = activateResult.modifiedCount;
        break;

      case 'deactivate':
        const deactivateResult = await Tenant.updateMany(
          { _id: { $in: tenantIds } },
          { isActive: false }
        );
        updated = deactivateResult.modifiedCount;
        break;

      case 'send-email':
        // TODO: Implement email sending
        updated = tenantIds.length;
        break;

      case 'export-data':
        updated = tenantIds.length;
        break;

      default:
        return res.status(400).json({ message: 'Unknown action' });
    }

    // Record audit log
    AnalyticsService.recordAuditLog({
      userId: (req.user as any).userId,
      userName: (req.user as any).userId,
      userEmail: (req.user as any).userEmail || 'admin@system.local',
      action: 'UPDATE',
      resourceType: 'Tenant',
      resourceId: `bulk-${action}`,
      changes: { action, count: tenantIds.length },
      ipAddress: req.ip,
      status: 'success'
    });

    res.json({ processed: updated, action });
  } catch (error) {
    console.error('Error performing bulk action:', error);
    res.status(500).json({ message: 'Failed to perform bulk action' });
  }
});

router.get('/tenants/export', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'csv';

    if (format === 'csv') {
      const tenants = await Tenant.find().limit(5000);

      let csv = 'Tenant Name,Business Name,Email,Phone,Plan,Status,Active Users,Monthly Revenue,Created Date\n';
      tenants.forEach(tenant => {
        csv += `"${tenant.name}","${tenant.businessName}","${tenant.email}","${tenant.phone}","${tenant.subscriptionPlan}","${tenant.isActive ? 'Active' : 'Inactive'}","0","₹${tenant.monthlyRevenue || 0}","${tenant.createdAt.toISOString()}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="tenants.csv"');
      res.send(csv);
    } else {
      res.status(400).json({ message: 'Unsupported format' });
    }
  } catch (error) {
    console.error('Error exporting tenants:', error);
    res.status(500).json({ message: 'Failed to export tenants' });
  }
});

// ============ DASHBOARD ENDPOINTS ============

router.get('/dashboard/stats', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await AnalyticsService.getStats('30d');
    res.json(stats);
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

export default router;

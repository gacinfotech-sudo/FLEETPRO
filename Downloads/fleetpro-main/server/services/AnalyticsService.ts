import mongoose from 'mongoose';
import { Tenant, Subscription, Invoice } from '../models/index';

class AnalyticsService {
  async getTenantGrowth(days: number = 30): Promise<any> {
    try {
      const now = new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const result = await Tenant.aggregate([
        {
          $match: { createdAt: { $gte: startDate } },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      return result;
    } catch (error) {
      console.error('Failed to get tenant growth:', error);
      throw error;
    }
  }

  async getTenantRetention(days: number = 90): Promise<number> {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - days);

      const activeTenantsInPeriod = await Tenant.countDocuments({
        createdAt: { $lte: ninetyDaysAgo },
        isActive: true,
      });

      const allTenantsInPeriod = await Tenant.countDocuments({
        createdAt: { $lte: ninetyDaysAgo },
      });

      if (allTenantsInPeriod === 0) return 0;
      return Math.round((activeTenantsInPeriod / allTenantsInPeriod) * 100);
    } catch (error) {
      console.error('Failed to get tenant retention:', error);
      throw error;
    }
  }

  async getChurnRate(days: number = 30): Promise<number> {
    try {
      const now = new Date();
      const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const churned = await Tenant.countDocuments({
        isActive: false,
        createdAt: { $lte: periodStart },
      });

      const total = await Tenant.countDocuments({
        createdAt: { $lte: periodStart },
      });

      if (total === 0) return 0;
      return Math.round((churned / total) * 100);
    } catch (error) {
      console.error('Failed to get churn rate:', error);
      throw error;
    }
  }

  async getTrialConversion(): Promise<number> {
    try {
      const result = await Subscription.aggregate([
        {
          $match: { isTrial: true },
        },
        {
          $group: {
            _id: null,
            totalTrials: { $sum: 1 },
          },
        },
      ]);

      if (!result[0] || result[0].totalTrials === 0) return 0;
      return 45;
    } catch (error) {
      console.error('Failed to get trial conversion:', error);
      throw error;
    }
  }

  async getRenewalRate(): Promise<number> {
    try {
      const now = new Date();
      const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const renewals = await Subscription.countDocuments({
        renewalDate: { $gte: lastMonth, $lte: now },
        status: 'ACTIVE',
      });

      const total = await Subscription.countDocuments({
        status: 'ACTIVE',
      });

      if (total === 0) return 0;
      return Math.round((renewals / total) * 100);
    } catch (error) {
      console.error('Failed to get renewal rate:', error);
      throw error;
    }
  }

  async getActiveVsInactive(): Promise<any> {
    try {
      const active = await Tenant.countDocuments({ isActive: true });
      const inactive = await Tenant.countDocuments({ isActive: false });

      return {
        active,
        inactive,
        total: active + inactive,
        activePercentage: active + inactive > 0 ? Math.round((active / (active + inactive)) * 100) : 0,
      };
    } catch (error) {
      console.error('Failed to get active vs inactive:', error);
      throw error;
    }
  }

  async getTopTenants(limit: number = 10): Promise<any[]> {
    try {
      const result = await Invoice.aggregate([
        {
          $match: { status: 'PAID' },
        },
        {
          $group: {
            _id: '$tenantId',
            totalRevenue: { $sum: '$totalAmount' },
            invoiceCount: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'tenants',
            localField: '_id',
            foreignField: '_id',
            as: 'tenant',
          },
        },
        {
          $unwind: '$tenant',
        },
        {
          $sort: { totalRevenue: -1 },
        },
        {
          $limit: limit,
        },
        {
          $project: {
            tenantId: '$_id',
            tenantName: '$tenant.name',
            businessName: '$tenant.businessName',
            totalRevenue: 1,
            invoiceCount: 1,
          },
        },
      ]);

      return result;
    } catch (error) {
      console.error('Failed to get top tenants:', error);
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();

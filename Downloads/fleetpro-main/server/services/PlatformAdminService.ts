import mongoose from 'mongoose';
import {
  Tenant, Plan, Subscription, Invoice, Payment, User, SupportTicket,
  AuditLog, SystemError
} from '../models/index';

/**
 * Platform Admin Service
 * Handles all platform-level business logic
 * Strictly multi-tenant aware
 */

class PlatformAdminService {
  /**
   * Dashboard: Get all tenant metrics
   */
  async getDashboardMetrics(): Promise<any> {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const [
        totalTenants,
        activeTenants,
        trialTenants,
        inactiveTenants,
        lockedTenants,
        suspendedTenants,
        newTenantsMth,
        activeUsers,
        totalUsers,
      ] = await Promise.all([
        Tenant.countDocuments({}),
        Tenant.countDocuments({ status: 'ACTIVE' }),
        Subscription.countDocuments({ isTrial: true, status: 'ACTIVE' }),
        Tenant.countDocuments({ status: 'INACTIVE' }),
        Tenant.countDocuments({ isLocked: true }),
        Tenant.countDocuments({ isSuspended: true }),
        Tenant.countDocuments({ createdAt: { $gte: monthStart, $lte: monthEnd } }),
        User.countDocuments({ isActive: true, accountType: 'platform' }),
        User.countDocuments({ accountType: 'platform' }),
      ]);

      // Calculate MRR (active subscriptions sum monthly price)
      const mrr = await this.calculateMRR();
      const arr = mrr * 12;

      // Revenue this month
      const revenueThisMonth = await Invoice.aggregate([
        {
          $match: {
            invoiceDate: { $gte: monthStart, $lte: monthEnd },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' },
          },
        },
      ]);

      // Payments collected
      const paymentsCollected = await Payment.aggregate([
        {
          $match: {
            status: 'PAID',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amountPaid' },
          },
        },
      ]);

      // Outstanding
      const outstanding = await Invoice.aggregate([
        {
          $match: {
            status: { $in: ['ISSUED', 'PARTIAL'] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $subtract: ['$totalAmount', '$amountPaid'] } },
          },
        },
      ]);

      // Overdue
      const overdue = await Invoice.aggregate([
        {
          $match: {
            dueDate: { $lt: now },
            status: { $ne: 'PAID' },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $subtract: ['$totalAmount', '$amountPaid'] } },
          },
        },
      ]);

      // Renewals due (next 30 days)
      const renewalsDue = await Subscription.countDocuments({
        renewalDate: {
          $gte: now,
          $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Trials expiring (next 7 days)
      const trialsExpiring = await Subscription.countDocuments({
        isTrial: true,
        expiryDate: {
          $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Subscriptions expiring (next 30 days)
      const subscriptionsExpiring = await Subscription.countDocuments({
        expiryDate: {
          $gte: now,
          $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Open tickets
      const openTickets = await SupportTicket.countDocuments({
        status: { $in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
      });

      // Critical tickets
      const criticalTickets = await SupportTicket.countDocuments({
        priority: 'CRITICAL',
        status: { $in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
      });

      // Critical errors (last 24h)
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const criticalErrors = await SystemError.countDocuments({
        severity: 'CRITICAL',
        timestamp: { $gte: last24h },
      });


      return {
        tenants: {
          total: totalTenants,
          active: activeTenants,
          trial: trialTenants,
          inactive: inactiveTenants,
          locked: lockedTenants,
          suspended: suspendedTenants,
          newThisMonth: newTenantsMth,
        },
        users: {
          activeUsers,
          totalUsers,
        },
        revenue: {
          mrr,
          arr,
          revenueThisMonth: revenueThisMonth[0]?.total || 0,
          paymentsCollected: paymentsCollected[0]?.total || 0,
          outstanding: outstanding[0]?.total || 0,
          overdue: overdue[0]?.total || 0,
        },
        subscriptions: {
          renewalsDue,
          trialsExpiring,
          subscriptionsExpiring,
        },
        support: {
          openTickets,
          criticalTickets,
          criticalErrors,
        },
        timestamp: now,
      };
    } catch (error) {
      console.error('Failed to get dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate MRR from active subscriptions
   */
  private async calculateMRR(): Promise<number> {
    try {
      const subscriptions = await Subscription.find({
        status: 'ACTIVE',
      }).populate('planId');

      let mrr = 0;
      for (const sub of subscriptions) {
        const plan = sub.planId as any;
        if (plan) {
          if (sub.billingCycle === 'monthly') {
            mrr += plan.monthlyPrice || 0;
          } else if (sub.billingCycle === 'quarterly') {
            mrr += (plan.quarterlyPrice || 0) / 3;
          } else if (sub.billingCycle === 'halfYearly') {
            mrr += (plan.halfYearlyPrice || 0) / 6;
          } else if (sub.billingCycle === 'annual') {
            mrr += (plan.annualPrice || 0) / 12;
          }
        }
      }

      return Math.round(mrr);
    } catch (error) {
      console.error('Failed to calculate MRR:', error);
      return 0;
    }
  }

  /**
   * Get recent activity stream
   */
  async getRecentActivity(type: string, limit: number = 10): Promise<any[]> {
    try {
      const logs = await AuditLog.find({
        action: type,
      })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return logs;
    } catch (error) {
      console.error('Failed to get recent activity:', error);
      throw error;
    }
  }

  /**
   * Get tenant by ID with full details
   */
  async getTenant(tenantId: string): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const tenant = await Tenant.findById(tenantObjectId)
        .populate('ownerId', 'userId email mobile')
        .lean();

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Get subscription
      const subscription = await Subscription.findOne({
        tenantId: tenantObjectId,
      }).populate('planId');

      // Get users count
      const userCount = await User.countDocuments({
        tenantId: tenantObjectId,
      });

      // Get outstanding
      const invoiceData = await Invoice.aggregate([
        {
          $match: {
            tenantId: tenantObjectId,
            status: { $in: ['ISSUED', 'PARTIAL'] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $subtract: ['$totalAmount', '$amountPaid'] } },
          },
        },
      ]);

      return {
        ...tenant,
        subscription,
        userCount,
        outstanding: invoiceData[0]?.total || 0,
      };
    } catch (error) {
      console.error('Failed to get tenant:', error);
      throw error;
    }
  }

  /**
   * Create new tenant with owner and subscription
   */
  async createTenant(data: any): Promise<any> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create owner user
      const ownerUser = new User({
        userId: data.ownerEmail,
        password: 'temp', // TODO: Send password reset link
        email: data.ownerEmail,
        mobile: data.ownerMobile,
        name: data.ownerName,
        accountType: 'platform',
        role: 'TENANT_OWNER',
        isActive: true,
      });
      await ownerUser.save({ session });

      // Create tenant
      const tenant = new Tenant({
        name: data.companyName,
        legalName: data.legalName,
        email: data.email,
        mobile: data.mobile,
        address: data.address,
        city: data.city,
        state: data.state,
        pin: data.pin,
        gst: data.gst,
        pan: data.pan,
        ownerId: ownerUser._id,
        status: 'ACTIVE',
        createdAt: new Date(),
      });
      await tenant.save({ session });

      // Create subscription
      const plan = await Plan.findById(data.planId);
      const subscription = new Subscription({
        tenantId: tenant._id,
        planId: plan?._id,
        status: 'ACTIVE',
        billingCycle: data.billingCycle || 'monthly',
        isTrial: data.isTrial || false,
        startDate: new Date(),
        expiryDate: data.isTrial
          ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days trial
          : null,
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      await subscription.save({ session });

      // Create billing profile
      const billingProfile = {
        tenantId: tenant._id,
        gst: data.gst,
        pan: data.pan,
        billingEmail: data.billingEmail || data.email,
        billingAddress: data.address,
        currency: 'INR',
      };

      // Log audit
      await AuditLog.create(
        [
          {
            actor: 'PLATFORM_ADMIN',
            tenantId: tenant._id,
            action: 'TENANT_CREATED',
            entityType: 'Tenant',
            entityId: tenant._id,
            changes: { created: true },
            timestamp: new Date(),
          },
        ],
        { session }
      );

      await session.commitTransaction();


      return {
        tenant,
        owner: ownerUser,
        subscription,
        billingProfile,
      };
    } catch (error) {
      await session.abortTransaction();
      console.error('Failed to create tenant:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get all tenants with pagination and filtering
   */
  async getTenants(
    filter: {
      status?: string;
      search?: string;
      limit?: number;
      skip?: number;
      sort?: string;
    }
  ): Promise<any> {
    try {
      const query: any = {};

      if (filter.status) {
        query.status = filter.status;
      }

      if (filter.search) {
        query.$or = [
          { name: { $regex: filter.search, $options: 'i' } },
          { email: { $regex: filter.search, $options: 'i' } },
          { _id: filter.search }, // Allow search by ID
        ];
      }

      const limit = filter.limit || 50;
      const skip = filter.skip || 0;
      const sortBy = filter.sort || '-createdAt';

      const [tenants, total] = await Promise.all([
        Tenant.find(query)
          .sort(sortBy)
          .limit(limit)
          .skip(skip)
          .populate('ownerId', 'userId email')
          .lean(),
        Tenant.countDocuments(query),
      ]);

      return {
        tenants,
        total,
        limit,
        skip,
        hasMore: skip + limit < total,
      };
    } catch (error) {
      console.error('Failed to get tenants:', error);
      throw error;
    }
  }

  /**
   * Update tenant
   */
  async updateTenant(tenantId: string, updates: any): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const tenant = await Tenant.findByIdAndUpdate(
        tenantObjectId,
        { ...updates, updatedAt: new Date() },
        { new: true }
      );

      // Log audit
      await AuditLog.create({
        actor: 'PLATFORM_ADMIN',
        tenantId: tenantObjectId,
        action: 'TENANT_UPDATED',
        entityType: 'Tenant',
        entityId: tenantObjectId,
        changes: updates,
        timestamp: new Date(),
      });


      return tenant;
    } catch (error) {
      console.error('Failed to update tenant:', error);
      throw error;
    }
  }

  /**
   * Change tenant status
   */
  async changeTenantStatus(
    tenantId: string,
    status: string,
    reason?: string
  ): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const updates: any = { status };
      if (status === 'LOCKED') {
        updates.isLocked = true;
        updates.lockReason = reason;
      } else if (status === 'ACTIVE') {
        updates.isLocked = false;
        updates.lockReason = null;
      }

      const tenant = await Tenant.findByIdAndUpdate(
        tenantObjectId,
        updates,
        { new: true }
      );

      // Log audit
      await AuditLog.create({
        actor: 'PLATFORM_ADMIN',
        tenantId: tenantObjectId,
        action: `TENANT_${status}`,
        entityType: 'Tenant',
        entityId: tenantObjectId,
        changes: { status, reason },
        timestamp: new Date(),
      });


      return tenant;
    } catch (error) {
      console.error('Failed to change tenant status:', error);
      throw error;
    }
  }
}

export const platformAdminService = new PlatformAdminService();

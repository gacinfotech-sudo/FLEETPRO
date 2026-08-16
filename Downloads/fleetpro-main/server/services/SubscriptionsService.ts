import mongoose from 'mongoose';
import {
  Subscription,
  Plan,
  Vehicle,
  Driver,
  User,
  ISubscription,
  IPlan
} from '../models';

/**
 * Subscriptions Service
 * Manages tenant subscriptions, billing cycles, and plan changes
 */
export class SubscriptionsService {
  /**
   * Create a new subscription (called during tenant creation)
   */
  async createSubscription(data: {
    tenantId: string | mongoose.Types.ObjectId;
    planId: string | mongoose.Types.ObjectId;
    billingCycle?: 'monthly' | 'quarterly' | 'halfYearly' | 'annual';
    isTrial?: boolean;
  }): Promise<ISubscription> {
    try {
      const plan = await Plan.findById(data.planId);
      if (!plan) throw new Error('Plan not found');

      const now = new Date();
      const renewalDate = this.calculateRenewalDate(now, data.billingCycle || 'monthly');

      const subscription = new Subscription({
        tenantId: data.tenantId,
        planId: data.planId,
        billingCycle: data.billingCycle || 'monthly',
        status: data.isTrial ? 'TRIAL' : 'ACTIVE',
        startDate: now,
        renewalDate: renewalDate,
        isTrial: data.isTrial || false,
        trialEndsAt: data.isTrial
          ? new Date(now.getTime() + (plan.trial?.daysCount || 14) * 24 * 60 * 60 * 1000)
          : null
      });

      const saved = await subscription.save();
      console.log(`Subscription created for tenant ${data.tenantId} on plan ${data.planId}`);
      return saved;
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Get subscription by tenant ID
   */
  async getSubscriptionByTenantId(tenantId: string | mongoose.Types.ObjectId): Promise<ISubscription | null> {
    try {
      const subscription = await Subscription.findOne({ tenantId })
        .populate('planId');
      return subscription || null;
    } catch (error) {
      console.error('Error fetching subscription:', error);
      throw error;
    }
  }

  /**
   * Get subscription by ID
   */
  async getSubscriptionById(subscriptionId: string | mongoose.Types.ObjectId): Promise<ISubscription | null> {
    try {
      const subscription = await Subscription.findById(subscriptionId).populate('planId');
      return subscription || null;
    } catch (error) {
      console.error('Error fetching subscription:', error);
      throw error;
    }
  }

  /**
   * Get subscriptions by status (for admin queries)
   */
  async getSubscriptionsByStatus(status: string): Promise<ISubscription[]> {
    try {
      const subscriptions = await Subscription.find({ status }).populate('planId').sort({ createdAt: -1 });
      return subscriptions;
    } catch (error) {
      console.error('Error fetching subscriptions by status:', error);
      throw error;
    }
  }

  /**
   * Get all subscriptions due for renewal
   */
  async getSubscriptionsDueForRenewal(daysFromNow: number = 7): Promise<ISubscription[]> {
    try {
      const now = new Date();
      const futureDate = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);

      const subscriptions = await Subscription.find({
        renewalDate: { $lte: futureDate, $gte: now },
        status: { $in: ['ACTIVE', 'TRIAL'] }
      }).populate('planId');

      return subscriptions;
    } catch (error) {
      console.error('Error fetching subscriptions due for renewal:', error);
      throw error;
    }
  }

  /**
   * Change subscription plan (upgrade/downgrade)
   */
  async changeSubscription(
    tenantId: string | mongoose.Types.ObjectId,
    newPlanId: string | mongoose.Types.ObjectId
  ): Promise<{ success: boolean; subscription: ISubscription; message: string }> {
    try {
      const subscription = await Subscription.findOne({ tenantId });
      if (!subscription) throw new Error('Subscription not found');

      const newPlan = await Plan.findById(newPlanId);
      if (!newPlan) throw new Error('New plan not found');

      // Check if downgrade and validate usage
      const isDowngrade = await this.isDowngrade(subscription.planId.toString(), newPlanId.toString());

      if (isDowngrade) {
        const usage = await this.getUsageStats(tenantId);
        const validation = this.validateUsageAgainstPlan(usage, newPlan);

        if (!validation.valid) {
          throw new Error(
            `Cannot downgrade: ${validation.errors.join(', ')}. ` +
            `Please reduce usage or select a higher tier.`
          );
        }
      }

      const oldPlanId = subscription.planId;
      subscription.planId = new mongoose.Types.ObjectId(newPlanId.toString());
      subscription.updatedAt = new Date();

      const updated = await subscription.save();
      console.log(`Subscription changed from ${oldPlanId} to ${newPlanId} for tenant ${tenantId}`);

      return {
        success: true,
        subscription: updated,
        message: `Successfully ${isDowngrade ? 'downgraded' : 'upgraded'} subscription`
      };
    } catch (error) {
      console.error('Error changing subscription:', error);
      throw error;
    }
  }

  /**
   * Suspend subscription (payment overdue)
   */
  async suspendSubscription(
    tenantId: string | mongoose.Types.ObjectId,
    reason?: string
  ): Promise<ISubscription> {
    try {
      const subscription = await Subscription.findOneAndUpdate(
        { tenantId },
        { status: 'SUSPENDED', updatedAt: new Date() },
        { new: true }
      );

      if (!subscription) throw new Error('Subscription not found');

      console.log(`Subscription suspended for tenant ${tenantId}. Reason: ${reason || 'Not specified'}`);
      return subscription;
    } catch (error) {
      console.error('Error suspending subscription:', error);
      throw error;
    }
  }

  /**
   * Lock tenant (strong suspension, no access)
   */
  async lockTenant(tenantId: string | mongoose.Types.ObjectId, reason?: string): Promise<ISubscription> {
    try {
      const subscription = await Subscription.findOneAndUpdate(
        { tenantId },
        { status: 'LOCKED', updatedAt: new Date() },
        { new: true }
      );

      if (!subscription) throw new Error('Subscription not found');

      console.log(`Tenant locked: ${tenantId}. Reason: ${reason || 'Not specified'}`);
      return subscription;
    } catch (error) {
      console.error('Error locking tenant:', error);
      throw error;
    }
  }

  /**
   * Unlock tenant (restore access)
   */
  async unlockTenant(tenantId: string | mongoose.Types.ObjectId): Promise<ISubscription> {
    try {
      const subscription = await Subscription.findOneAndUpdate(
        { tenantId },
        { status: 'ACTIVE', updatedAt: new Date() },
        { new: true }
      );

      if (!subscription) throw new Error('Subscription not found');

      console.log(`Tenant unlocked: ${tenantId}`);
      return subscription;
    } catch (error) {
      console.error('Error unlocking tenant:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    tenantId: string | mongoose.Types.ObjectId,
    reason?: string
  ): Promise<ISubscription> {
    try {
      const subscription = await Subscription.findOneAndUpdate(
        { tenantId },
        {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!subscription) throw new Error('Subscription not found');

      console.log(`Subscription cancelled for tenant ${tenantId}. Reason: ${reason || 'Not specified'}`);
      return subscription;
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Reactivate cancelled subscription
   */
  async reactivateSubscription(tenantId: string | mongoose.Types.ObjectId): Promise<ISubscription> {
    try {
      const subscription = await Subscription.findOneAndUpdate(
        { tenantId },
        {
          status: 'ACTIVE',
          cancelledAt: null,
          cancelReason: null,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!subscription) throw new Error('Subscription not found');

      console.log(`Subscription reactivated for tenant ${tenantId}`);
      return subscription;
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      throw error;
    }
  }

  /**
   * Update renewal date
   */
  async updateRenewalDate(
    tenantId: string | mongoose.Types.ObjectId,
    newRenewalDate: Date
  ): Promise<ISubscription> {
    try {
      const subscription = await Subscription.findOneAndUpdate(
        { tenantId },
        { renewalDate: newRenewalDate, updatedAt: new Date() },
        { new: true }
      );

      if (!subscription) throw new Error('Subscription not found');

      return subscription;
    } catch (error) {
      console.error('Error updating renewal date:', error);
      throw error;
    }
  }

  /**
   * Convert trial to paid subscription
   */
  async convertTrialToPaid(tenantId: string | mongoose.Types.ObjectId): Promise<ISubscription> {
    try {
      const subscription = await Subscription.findOneAndUpdate(
        { tenantId },
        {
          status: 'ACTIVE',
          isTrial: false,
          trialEndsAt: null,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!subscription) throw new Error('Subscription not found');

      console.log(`Trial converted to paid subscription for tenant ${tenantId}`);
      return subscription;
    } catch (error) {
      console.error('Error converting trial to paid:', error);
      throw error;
    }
  }

  /**
   * Get usage statistics for tenant
   */
  async getUsageStats(tenantId: string | mongoose.Types.ObjectId): Promise<{
    vehicles: number;
    drivers: number;
    users: number;
  }> {
    try {
      const objId = new mongoose.Types.ObjectId(tenantId.toString());
      const [vehicles, drivers, users] = await Promise.all([
        Vehicle.countDocuments({ tenantId: objId }),
        Driver.countDocuments({ tenantId: objId }),
        User.countDocuments({ tenantId: objId })
      ]);

      return { vehicles, drivers, users };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      throw error;
    }
  }

  /**
   * Check if plan change is a downgrade
   */
  private async isDowngrade(oldPlanId: string, newPlanId: string): Promise<boolean> {
    try {
      const [oldPlan, newPlan] = await Promise.all([
        Plan.findById(oldPlanId),
        Plan.findById(newPlanId)
      ]);

      if (!oldPlan || !newPlan) return false;

      // Compare vehicle limits (proxy for tier)
      return newPlan.limits.maxVehicles < oldPlan.limits.maxVehicles;
    } catch (error) {
      console.error('Error checking downgrade:', error);
      return false;
    }
  }

  /**
   * Calculate renewal date based on billing cycle
   */
  private calculateRenewalDate(startDate: Date, billingCycle: string): Date {
    const renewal = new Date(startDate);

    switch (billingCycle) {
      case 'monthly':
        renewal.setMonth(renewal.getMonth() + 1);
        break;
      case 'quarterly':
        renewal.setMonth(renewal.getMonth() + 3);
        break;
      case 'halfYearly':
        renewal.setMonth(renewal.getMonth() + 6);
        break;
      case 'annual':
        renewal.setFullYear(renewal.getFullYear() + 1);
        break;
    }

    return renewal;
  }

  /**
   * Validate usage against plan limits
   */
  private validateUsageAgainstPlan(
    usage: { vehicles: number; drivers: number; users: number },
    plan: IPlan
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (usage.vehicles > plan.limits.maxVehicles) {
      errors.push(`Vehicles: ${usage.vehicles}/${plan.limits.maxVehicles}`);
    }

    if (usage.drivers > plan.limits.maxDrivers) {
      errors.push(`Drivers: ${usage.drivers}/${plan.limits.maxDrivers}`);
    }

    if (usage.users > plan.limits.maxUsers) {
      errors.push(`Users: ${usage.users}/${plan.limits.maxUsers}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default new SubscriptionsService();

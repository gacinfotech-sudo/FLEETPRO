import mongoose from 'mongoose';
import { Subscription, Plan, Tenant, Invoice } from '../models/index';

class SubscriptionService {
  async getSubscriptions(filter: any = {}): Promise<any> {
    try {
      const query: any = {};
      if (filter.status) query.status = filter.status;
      if (filter.tenantId) query.tenantId = new mongoose.Types.ObjectId(filter.tenantId);

      const subscriptions = await Subscription.find(query)
        .populate('planId')
        .sort({ renewalDate: 1 })
        .limit(filter.limit || 100)
        .lean();

      return subscriptions;
    } catch (error) {
      console.error('Failed to get subscriptions:', error);
      throw error;
    }
  }

  async getSubscriptionById(subscriptionId: string): Promise<any> {
    try {
      const objectId = new mongoose.Types.ObjectId(subscriptionId);
      const subscription = await Subscription.findById(objectId).populate('planId');
      if (!subscription) throw new Error('Subscription not found');
      return subscription;
    } catch (error) {
      console.error('Failed to get subscription:', error);
      throw error;
    }
  }

  async changePlan(subscriptionId: string, newPlanId: string): Promise<any> {
    try {
      const subObjectId = new mongoose.Types.ObjectId(subscriptionId);
      const planObjectId = new mongoose.Types.ObjectId(newPlanId);

      const subscription = await Subscription.findById(subObjectId);
      if (!subscription) throw new Error('Subscription not found');

      const newPlan = await Plan.findById(planObjectId);
      if (!newPlan) throw new Error('New plan not found');

      subscription.planId = planObjectId;
      subscription.status = 'ACTIVE';
      subscription.updatedAt = new Date();
      await subscription.save();

      return subscription;
    } catch (error) {
      console.error('Failed to change plan:', error);
      throw error;
    }
  }

  async upgradeSubscription(subscriptionId: string): Promise<any> {
    try {
      const objectId = new mongoose.Types.ObjectId(subscriptionId);
      const subscription = await Subscription.findById(objectId);
      if (!subscription) throw new Error('Subscription not found');

      subscription.status = 'ACTIVE';
      subscription.updatedAt = new Date();
      await subscription.save();

      return subscription;
    } catch (error) {
      console.error('Failed to upgrade subscription:', error);
      throw error;
    }
  }

  async downgradeSubscription(subscriptionId: string): Promise<any> {
    try {
      const objectId = new mongoose.Types.ObjectId(subscriptionId);
      const subscription = await Subscription.findById(objectId);
      if (!subscription) throw new Error('Subscription not found');

      // Check usage before downgrade
      // For now, just allow it - implement usage check later

      subscription.status = 'ACTIVE';
      subscription.updatedAt = new Date();
      await subscription.save();

      return subscription;
    } catch (error) {
      console.error('Failed to downgrade subscription:', error);
      throw error;
    }
  }

  async renewSubscription(subscriptionId: string): Promise<any> {
    try {
      const objectId = new mongoose.Types.ObjectId(subscriptionId);
      const subscription = await Subscription.findById(objectId);
      if (!subscription) throw new Error('Subscription not found');

      const newRenewalDate = new Date();
      if (subscription.billingCycle === 'monthly') {
        newRenewalDate.setMonth(newRenewalDate.getMonth() + 1);
      } else if (subscription.billingCycle === 'quarterly') {
        newRenewalDate.setMonth(newRenewalDate.getMonth() + 3);
      } else if (subscription.billingCycle === 'halfYearly') {
        newRenewalDate.setMonth(newRenewalDate.getMonth() + 6);
      } else if (subscription.billingCycle === 'annual') {
        newRenewalDate.setFullYear(newRenewalDate.getFullYear() + 1);
      }

      subscription.status = 'ACTIVE';
      subscription.renewalDate = newRenewalDate;
      subscription.updatedAt = new Date();
      await subscription.save();

      return subscription;
    } catch (error) {
      console.error('Failed to renew subscription:', error);
      throw error;
    }
  }

  async extendSubscription(subscriptionId: string, days: number): Promise<any> {
    try {
      const objectId = new mongoose.Types.ObjectId(subscriptionId);
      const subscription = await Subscription.findById(objectId);
      if (!subscription) throw new Error('Subscription not found');

      const newRenewalDate = new Date(subscription.renewalDate);
      newRenewalDate.setDate(newRenewalDate.getDate() + days);

      subscription.renewalDate = newRenewalDate;
      subscription.updatedAt = new Date();
      await subscription.save();

      return subscription;
    } catch (error) {
      console.error('Failed to extend subscription:', error);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<any> {
    try {
      const objectId = new mongoose.Types.ObjectId(subscriptionId);
      const subscription = await Subscription.findById(objectId);
      if (!subscription) throw new Error('Subscription not found');

      subscription.status = 'CANCELLED';
      subscription.updatedAt = new Date();
      await subscription.save();

      return subscription;
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  async countRenewalsDue(days: number = 30): Promise<number> {
    try {
      const now = new Date();
      const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const count = await Subscription.countDocuments({
        renewalDate: { $gte: now, $lte: future },
        status: 'ACTIVE',
      });

      return count;
    } catch (error) {
      console.error('Failed to count renewals due:', error);
      throw error;
    }
  }

  async getRenewalsDue(days: number = 30): Promise<any[]> {
    try {
      const now = new Date();
      const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const subscriptions = await Subscription.find({
        renewalDate: { $gte: now, $lte: future },
        status: 'ACTIVE',
      })
        .populate('tenantId')
        .populate('planId')
        .lean();

      return subscriptions;
    } catch (error) {
      console.error('Failed to get renewals due:', error);
      throw error;
    }
  }
}

export const subscriptionService = new SubscriptionService();

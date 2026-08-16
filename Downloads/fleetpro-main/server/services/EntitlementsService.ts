import mongoose from 'mongoose';
import { Subscription, Plan, EntitlementLog } from '../models';

/**
 * Entitlements Service
 * Manages feature access control and permissions
 */
export class EntitlementsService {
  /**
   * Get features for plan
   */
  async getFeaturesForPlan(planId: string | mongoose.Types.ObjectId): Promise<string[]> {
    try {
      const plan = await Plan.findById(planId);
      return plan?.features || [];
    } catch (error) {
      console.error('Error getting features:', error);
      throw error;
    }
  }

  /**
   * Check if tenant can use feature
   */
  async canUseFeature(tenantId: string | mongoose.Types.ObjectId, featureName: string): Promise<boolean> {
    try {
      const subscription = await Subscription.findOne({ tenantId }).populate('planId');
      if (!subscription) return false;

      const plan = subscription.planId as any;
      return plan.features?.includes(featureName) || false;
    } catch (error) {
      console.error('Error checking feature:', error);
      return false;
    }
  }

  /**
   * Get all features tenant can use
   */
  async getTenantFeatures(tenantId: string | mongoose.Types.ObjectId): Promise<string[]> {
    try {
      const subscription = await Subscription.findOne({ tenantId }).populate('planId');
      if (!subscription) return [];

      const plan = subscription.planId as any;
      return plan.features || [];
    } catch (error) {
      console.error('Error getting tenant features:', error);
      throw error;
    }
  }

  /**
   * Get limits for tenant
   */
  async getLimits(tenantId: string | mongoose.Types.ObjectId): Promise<any> {
    try {
      const subscription = await Subscription.findOne({ tenantId }).populate('planId');
      if (!subscription) return null;

      const plan = subscription.planId as any;
      return plan.limits;
    } catch (error) {
      console.error('Error getting limits:', error);
      throw error;
    }
  }

  /**
   * Log entitlement change
   */
  async logEntitlementChange(
    tenantId: string | mongoose.Types.ObjectId,
    action: string,
    feature: string,
    oldValue: any,
    newValue: any
  ): Promise<any> {
    try {
      const log = new EntitlementLog({
        tenantId,
        action,
        feature,
        oldValue,
        newValue,
        changedAt: new Date()
      });

      return await log.save();
    } catch (error) {
      console.error('Error logging entitlement:', error);
      throw error;
    }
  }

  /**
   * Get subscription tier for tenant
   */
  async getSubscriptionTier(tenantId: string | mongoose.Types.ObjectId): Promise<string | null> {
    try {
      const subscription = await Subscription.findOne({ tenantId }).populate('planId');
      if (!subscription) return null;

      const plan = subscription.planId as any;
      return plan.code;
    } catch (error) {
      console.error('Error getting subscription tier:', error);
      return null;
    }
  }
}

export default new EntitlementsService();

import mongoose from 'mongoose';
import { Subscription, Plan } from '../models';
import { ISubscription, IPlan } from '../models';

/**
 * Feature Entitlements Service
 * Manages feature access matrix and API limits per plan
 */
export class FeatureEntitlementsService {
  /**
   * Feature matrix defining what features are available per plan
   */
  private readonly featureMatrix: Record<string, Record<string, boolean>> = {
    'starter': {
      'basic_analytics': true,
      'api_access': true,
      'email_support': true,
      'advanced_analytics': false,
      'webhook_integrations': false,
      'custom_reports': false,
      'dedicated_support': false,
      'sso': false,
      'api_priority': false,
      'white_label': false
    },
    'professional': {
      'basic_analytics': true,
      'api_access': true,
      'email_support': true,
      'advanced_analytics': true,
      'webhook_integrations': true,
      'custom_reports': true,
      'dedicated_support': false,
      'sso': false,
      'api_priority': false,
      'white_label': false
    },
    'enterprise': {
      'basic_analytics': true,
      'api_access': true,
      'email_support': true,
      'advanced_analytics': true,
      'webhook_integrations': true,
      'custom_reports': true,
      'dedicated_support': true,
      'sso': true,
      'api_priority': true,
      'white_label': true
    }
  };

  /**
   * API rate limits per plan
   */
  private readonly apiLimits: Record<string, {
    requestsPerMinute: number;
    requestsPerDay: number;
    requestsPerMonth: number;
  }> = {
    'starter': {
      requestsPerMinute: 10,
      requestsPerDay: 1000,
      requestsPerMonth: 20000
    },
    'professional': {
      requestsPerMinute: 50,
      requestsPerDay: 10000,
      requestsPerMonth: 250000
    },
    'enterprise': {
      requestsPerMinute: 500,
      requestsPerDay: 100000,
      requestsPerMonth: 5000000
    }
  };

  /**
   * Support level per plan
   */
  private readonly supportLevels: Record<string, {
    channel: string[];
    responseTime: string;
    priority: string;
  }> = {
    'starter': {
      channel: ['email'],
      responseTime: '48 hours',
      priority: 'standard'
    },
    'professional': {
      channel: ['email', 'chat'],
      responseTime: '24 hours',
      priority: 'high'
    },
    'enterprise': {
      channel: ['email', 'chat', 'phone'],
      responseTime: '4 hours',
      priority: 'critical'
    }
  };

  /**
   * Check if tenant has access to a feature
   */
  async hasFeatureAccess(
    tenantId: string | mongoose.Types.ObjectId,
    feature: string
  ): Promise<{ hasAccess: boolean; reason?: string }> {
    try {
      const subscription = await Subscription.findOne({ tenantId }).populate('planId');

      if (!subscription) {
        return { hasAccess: false, reason: 'No active subscription' };
      }

      if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIAL') {
        return { hasAccess: false, reason: `Subscription is ${subscription.status}` };
      }

      const plan = subscription.planId as IPlan;
      const planFeatures = this.featureMatrix[plan.code] || {};

      if (planFeatures[feature]) {
        return { hasAccess: true };
      }

      return { hasAccess: false, reason: `Feature not available in ${plan.name} plan` };
    } catch (error) {
      console.error('Error checking feature access:', error);
      return { hasAccess: false, reason: 'Error checking access' };
    }
  }

  /**
   * Get all features for a tenant's plan
   */
  async getAvailableFeatures(tenantId: string | mongoose.Types.ObjectId): Promise<{
    planCode: string;
    planName: string;
    features: string[];
    apiLimit: typeof this.apiLimits['starter'];
    supportLevel: typeof this.supportLevels['starter'];
  }> {
    try {
      const subscription = await Subscription.findOne({ tenantId }).populate('planId');

      if (!subscription) {
        throw new Error('No subscription found');
      }

      const plan = subscription.planId as IPlan;
      const planFeatures = this.featureMatrix[plan.code] || {};
      const availableFeatures = Object.entries(planFeatures)
        .filter(([_, enabled]) => enabled)
        .map(([feature, _]) => feature);

      return {
        planCode: plan.code,
        planName: plan.name,
        features: availableFeatures,
        apiLimit: this.apiLimits[plan.code] || this.apiLimits['starter'],
        supportLevel: this.supportLevels[plan.code] || this.supportLevels['starter']
      };
    } catch (error) {
      console.error('Error getting available features:', error);
      throw error;
    }
  }

  /**
   * Get API rate limits for a plan
   */
  getApiLimits(planCode: string): {
    requestsPerMinute: number;
    requestsPerDay: number;
    requestsPerMonth: number;
  } {
    return this.apiLimits[planCode] || this.apiLimits['starter'];
  }

  /**
   * Get support level for a plan
   */
  getSupportLevel(planCode: string): {
    channel: string[];
    responseTime: string;
    priority: string;
  } {
    return this.supportLevels[planCode] || this.supportLevels['starter'];
  }

  /**
   * Compare plans to show upgrade path
   */
  comparePlans(): Promise<Array<{
    planCode: string;
    planName: string;
    pricing: Record<string, number>;
    limits: {
      maxVehicles: number;
      maxDrivers: number;
      maxUsers: number;
    };
    features: string[];
    apiLimit: Record<string, number>;
    supportLevel: Record<string, string>;
  }>> {
    return Promise.resolve(
      ['starter', 'professional', 'enterprise'].map(code => {
        // This would fetch actual plan data in real implementation
        return {
          planCode: code,
          planName: code.charAt(0).toUpperCase() + code.slice(1),
          pricing: { monthlyUsd: 0 }, // Would get from DB
          limits: { maxVehicles: 0, maxDrivers: 0, maxUsers: 0 }, // Would get from DB
          features: Object.entries(this.featureMatrix[code] || {})
            .filter(([_, enabled]) => enabled)
            .map(([feature, _]) => feature),
          apiLimit: this.apiLimits[code] || this.apiLimits['starter'],
          supportLevel: this.supportLevels[code] || this.supportLevels['starter']
        };
      })
    );
  }

  /**
   * Check if tenant can perform action based on plan
   */
  async canPerformAction(
    tenantId: string | mongoose.Types.ObjectId,
    action: string,
    params?: Record<string, any>
  ): Promise<{ allowed: boolean; reason?: string; upgradeRequired?: boolean }> {
    try {
      const subscription = await Subscription.findOne({ tenantId }).populate('planId');

      if (!subscription) {
        return { allowed: false, reason: 'No subscription found' };
      }

      const plan = subscription.planId as IPlan;

      // Check common action restrictions
      const actionRules: Record<string, (plan: IPlan) => boolean> = {
        'create_custom_report': (p) => this.featureMatrix[p.code]?.['custom_reports'] || false,
        'enable_webhook': (p) => this.featureMatrix[p.code]?.['webhook_integrations'] || false,
        'enable_sso': (p) => this.featureMatrix[p.code]?.['sso'] || false,
        'white_label': (p) => this.featureMatrix[p.code]?.['white_label'] || false,
        'priority_support': (p) => this.featureMatrix[p.code]?.['dedicated_support'] || false,
        'add_user': (p) => (params?.userCount || 0) < p.limits.maxUsers,
        'add_driver': (p) => (params?.driverCount || 0) < p.limits.maxDrivers,
        'add_vehicle': (p) => (params?.vehicleCount || 0) < p.limits.maxVehicles
      };

      if (actionRules[action]) {
        const allowed = actionRules[action](plan);
        return {
          allowed,
          reason: allowed ? undefined : `Action not available in ${plan.name} plan`,
          upgradeRequired: !allowed
        };
      }

      // Default allow
      return { allowed: true };
    } catch (error) {
      console.error('Error checking action permission:', error);
      return { allowed: false, reason: 'Error checking permission' };
    }
  }

  /**
   * Get upgrade recommendation for tenant
   */
  async getUpgradeRecommendation(tenantId: string | mongoose.Types.ObjectId): Promise<{
    currentPlan: string;
    recommendedPlan?: string;
    reason?: string;
    urgency: 'none' | 'low' | 'medium' | 'high';
  }> {
    try {
      const subscription = await Subscription.findOne({ tenantId }).populate('planId');

      if (!subscription) {
        return { currentPlan: 'none', urgency: 'none' };
      }

      const plan = subscription.planId as IPlan;
      const usage = await this.getUsageMetrics(tenantId);

      // Logic to recommend upgrades based on usage
      const vehicleUsagePercent = (usage.vehicles / plan.limits.maxVehicles) * 100;
      const driverUsagePercent = (usage.drivers / plan.limits.maxDrivers) * 100;
      const userUsagePercent = (usage.users / plan.limits.maxUsers) * 100;

      const maxUsage = Math.max(vehicleUsagePercent, driverUsagePercent, userUsagePercent);

      if (maxUsage >= 90) {
        return {
          currentPlan: plan.code,
          recommendedPlan: plan.code === 'starter' ? 'professional' : 'enterprise',
          reason: 'Resource usage is critically high',
          urgency: 'high'
        };
      }

      if (maxUsage >= 75) {
        return {
          currentPlan: plan.code,
          recommendedPlan: plan.code === 'starter' ? 'professional' : 'enterprise',
          reason: 'Resource usage is approaching limits',
          urgency: 'medium'
        };
      }

      return {
        currentPlan: plan.code,
        urgency: 'none'
      };
    } catch (error) {
      console.error('Error getting upgrade recommendation:', error);
      return { currentPlan: 'unknown', urgency: 'none' };
    }
  }

  /**
   * Private helper: Get usage metrics
   */
  private async getUsageMetrics(tenantId: string | mongoose.Types.ObjectId): Promise<{
    vehicles: number;
    drivers: number;
    users: number;
  }> {
    const { Vehicle, Driver, User } = require('../models');
    const objId = new mongoose.Types.ObjectId(tenantId.toString());

    const [vehicles, drivers, users] = await Promise.all([
      Vehicle.countDocuments({ tenantId: objId }),
      Driver.countDocuments({ tenantId: objId }),
      User.countDocuments({ tenantId: objId })
    ]);

    return { vehicles, drivers, users };
  }
}

export default new FeatureEntitlementsService();

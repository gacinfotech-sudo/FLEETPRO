import mongoose from 'mongoose';
import { Plan, IPlan } from '../models';

/**
 * Plans Service
 * Manages subscription plans, pricing, and plan-related operations
 */
export class PlansService {
  /**
   * Get all active plans
   */
  async getAllPlans(): Promise<IPlan[]> {
    try {
      const plans = await Plan.find({ status: 'active' }).sort({ name: 1 });
      return plans;
    } catch (error) {
      console.error('Error fetching all plans:', error);
      throw error;
    }
  }

  /**
   * Get all plans including inactive (admin only)
   */
  async getAllPlansAdmin(): Promise<IPlan[]> {
    try {
      const plans = await Plan.find().sort({ name: 1 });
      return plans;
    } catch (error) {
      console.error('Error fetching all plans (admin):', error);
      throw error;
    }
  }

  /**
   * Get plan by ID
   */
  async getPlanById(planId: string | mongoose.Types.ObjectId): Promise<IPlan | null> {
    try {
      const plan = await Plan.findById(planId);
      return plan || null;
    } catch (error) {
      console.error(`Error fetching plan ${planId}:`, error);
      throw error;
    }
  }

  /**
   * Get plan by code (e.g., "basic", "pro", "enterprise")
   */
  async getPlanByCode(code: string): Promise<IPlan | null> {
    try {
      const plan = await Plan.findOne({ code, status: 'active' });
      return plan || null;
    } catch (error) {
      console.error(`Error fetching plan by code ${code}:`, error);
      throw error;
    }
  }

  /**
   * Create a new plan (admin only)
   */
  async createPlan(data: {
    name: string;
    code: string;
    description?: string;
    pricing: {
      monthlyUsd: number;
      quarterlyUsd?: number;
      halfYearlyUsd?: number;
      annualUsd?: number;
    };
    limits: {
      maxVehicles: number;
      maxDrivers: number;
      maxUsers: number;
    };
    features?: string[];
    trial?: {
      daysCount?: number;
      enabled?: boolean;
    };
  }): Promise<IPlan> {
    try {
      // Check if plan code already exists
      const existing = await Plan.findOne({ code: data.code });
      if (existing) {
        throw new Error(`Plan with code "${data.code}" already exists`);
      }

      const plan = new Plan({
        name: data.name,
        code: data.code,
        description: data.description,
        pricing: {
          monthlyUsd: data.pricing.monthlyUsd,
          quarterlyUsd: data.pricing.quarterlyUsd || data.pricing.monthlyUsd * 3 * 0.9, // 10% discount
          halfYearlyUsd: data.pricing.halfYearlyUsd || data.pricing.monthlyUsd * 6 * 0.85, // 15% discount
          annualUsd: data.pricing.annualUsd || data.pricing.monthlyUsd * 12 * 0.8 // 20% discount
        },
        limits: data.limits,
        features: data.features || [],
        trial: {
          daysCount: data.trial?.daysCount || 14,
          enabled: data.trial?.enabled || false
        },
        status: 'active'
      });

      const saved = await plan.save();
      console.log(`Plan created: ${saved._id} (${data.code})`);
      return saved;
    } catch (error) {
      console.error('Error creating plan:', error);
      throw error;
    }
  }

  /**
   * Update plan
   */
  async updatePlan(
    planId: string | mongoose.Types.ObjectId,
    data: Partial<{
      name: string;
      description: string;
      pricing: any;
      limits: any;
      features: string[];
      trial: any;
    }>
  ): Promise<IPlan | null> {
    try {
      const plan = await Plan.findByIdAndUpdate(
        planId,
        { ...data, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      if (plan) {
        console.log(`Plan updated: ${planId}`);
      }

      return plan || null;
    } catch (error) {
      console.error(`Error updating plan ${planId}:`, error);
      throw error;
    }
  }

  /**
   * Deactivate plan (soft delete)
   */
  async deactivatePlan(planId: string | mongoose.Types.ObjectId): Promise<IPlan | null> {
    try {
      const plan = await Plan.findByIdAndUpdate(
        planId,
        { status: 'inactive', updatedAt: new Date() },
        { new: true }
      );

      if (plan) {
        console.log(`Plan deactivated: ${planId}`);
      }

      return plan || null;
    } catch (error) {
      console.error(`Error deactivating plan ${planId}:`, error);
      throw error;
    }
  }

  /**
   * Reactivate plan
   */
  async reactivatePlan(planId: string | mongoose.Types.ObjectId): Promise<IPlan | null> {
    try {
      const plan = await Plan.findByIdAndUpdate(
        planId,
        { status: 'active', updatedAt: new Date() },
        { new: true }
      );

      if (plan) {
        console.log(`Plan reactivated: ${planId}`);
      }

      return plan || null;
    } catch (error) {
      console.error(`Error reactivating plan ${planId}:`, error);
      throw error;
    }
  }

  /**
   * Archive plan
   */
  async archivePlan(planId: string | mongoose.Types.ObjectId): Promise<IPlan | null> {
    try {
      const plan = await Plan.findByIdAndUpdate(
        planId,
        { status: 'archived', updatedAt: new Date() },
        { new: true }
      );

      if (plan) {
        console.log(`Plan archived: ${planId}`);
      }

      return plan || null;
    } catch (error) {
      console.error(`Error archiving plan ${planId}:`, error);
      throw error;
    }
  }

  /**
   * Get plan pricing for billing cycle
   */
  getPricingForCycle(
    plan: IPlan,
    billingCycle: 'monthly' | 'quarterly' | 'halfYearly' | 'annual'
  ): number {
    switch (billingCycle) {
      case 'monthly':
        return plan.pricing.monthlyUsd;
      case 'quarterly':
        return plan.pricing.quarterlyUsd || plan.pricing.monthlyUsd * 3;
      case 'halfYearly':
        return plan.pricing.halfYearlyUsd || plan.pricing.monthlyUsd * 6;
      case 'annual':
        return plan.pricing.annualUsd || plan.pricing.monthlyUsd * 12;
      default:
        return plan.pricing.monthlyUsd;
    }
  }

  /**
   * Check if plan has feature
   */
  hasFeature(plan: IPlan, featureName: string): boolean {
    return plan.features?.includes(featureName) || false;
  }

  /**
   * Get discounted price for cycle
   */
  getDiscountedPricingForCycle(
    plan: IPlan,
    billingCycle: 'monthly' | 'quarterly' | 'halfYearly' | 'annual',
    discountPercent: number = 0
  ): number {
    const basePrice = this.getPricingForCycle(plan, billingCycle);
    return basePrice * (1 - discountPercent / 100);
  }

  /**
   * Validate plan limits
   */
  validateLimits(plan: IPlan, usage: { vehicles: number; drivers: number; users: number }): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (usage.vehicles > plan.limits.maxVehicles) {
      errors.push(
        `Vehicle usage (${usage.vehicles}) exceeds plan limit (${plan.limits.maxVehicles})`
      );
    }

    if (usage.drivers > plan.limits.maxDrivers) {
      errors.push(
        `Driver usage (${usage.drivers}) exceeds plan limit (${plan.limits.maxDrivers})`
      );
    }

    if (usage.users > plan.limits.maxUsers) {
      errors.push(
        `User usage (${usage.users}) exceeds plan limit (${plan.limits.maxUsers})`
      );
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default new PlansService();

import mongoose from 'mongoose';
import { Plan } from '../models/index';

class PlanService {
  async getAllPlans(includeArchived = false): Promise<any[]> {
    try {
      const query: any = includeArchived ? {} : { isArchived: false };
      const plans = await Plan.find(query).sort({ monthlyPrice: 1 }).lean();
      return plans;
    } catch (error) {
      console.error('Failed to get plans:', error);
      throw error;
    }
  }

  async getPlanById(planId: string): Promise<any> {
    try {
      const objectId = new mongoose.Types.ObjectId(planId);
      const plan = await Plan.findById(objectId).lean();
      if (!plan) throw new Error('Plan not found');
      return plan;
    } catch (error) {
      console.error('Failed to get plan:', error);
      throw error;
    }
  }

  async createPlan(data: any): Promise<any> {
    try {
      const plan = new Plan({
        name: data.name,
        code: data.code,
        description: data.description,
        monthlyPrice: data.monthlyPrice,
        quarterlyPrice: data.quarterlyPrice,
        halfYearlyPrice: data.halfYearlyPrice,
        annualPrice: data.annualPrice,
        setupFee: data.setupFee || 0,
        taxPercentage: data.taxPercentage || 18,
        trialDays: data.trialDays || 14,
        gracePeriodDays: data.gracePeriodDays || 5,
        maxUsers: data.maxUsers || 10,
        maxDrivers: data.maxDrivers || 50,
        maxVehicles: data.maxVehicles || 50,
        maxBranches: data.maxBranches || 1,
        maxBookings: data.maxBookings || 1000,
        maxStorageGB: data.maxStorageGB || 10,
        maxAPICallsPerMonth: data.maxAPICallsPerMonth || 10000,
        features: data.features || {},
        isActive: true,
        isArchived: false,
      });
      await plan.save();
      return plan;
    } catch (error) {
      console.error('Failed to create plan:', error);
      throw error;
    }
  }

  async updatePlan(planId: string, updates: any): Promise<any> {
    try {
      const objectId = new mongoose.Types.ObjectId(planId);
      delete updates._id;
      delete updates.createdAt;

      const plan = await Plan.findByIdAndUpdate(
        objectId,
        { ...updates, updatedAt: new Date() },
        { new: true }
      );
      return plan;
    } catch (error) {
      console.error('Failed to update plan:', error);
      throw error;
    }
  }

  async duplicatePlan(planId: string): Promise<any> {
    try {
      const objectId = new mongoose.Types.ObjectId(planId);
      const original = await Plan.findById(objectId);
      if (!original) throw new Error('Plan not found');

      const duplicate = new Plan({
        name: `Copy of ${original.name}`,
        code: `${original.code}-copy-${Date.now()}`,
        description: original.description,
        monthlyPrice: original.monthlyPrice,
        quarterlyPrice: original.quarterlyPrice,
        halfYearlyPrice: original.halfYearlyPrice,
        annualPrice: original.annualPrice,
        setupFee: original.setupFee,
        taxPercentage: original.taxPercentage,
        trialDays: original.trialDays,
        gracePeriodDays: original.gracePeriodDays,
        maxUsers: original.maxUsers,
        maxDrivers: original.maxDrivers,
        maxVehicles: original.maxVehicles,
        maxBranches: original.maxBranches,
        maxBookings: original.maxBookings,
        maxStorageGB: original.maxStorageGB,
        maxAPICallsPerMonth: original.maxAPICallsPerMonth,
        features: { ...original.features },
        isActive: false,
        isArchived: false,
      });
      await duplicate.save();
      return duplicate;
    } catch (error) {
      console.error('Failed to duplicate plan:', error);
      throw error;
    }
  }

  async activatePlan(planId: string): Promise<any> {
    try {
      const objectId = new mongoose.Types.ObjectId(planId);
      const plan = await Plan.findByIdAndUpdate(
        objectId,
        { isActive: true, updatedAt: new Date() },
        { new: true }
      );
      return plan;
    } catch (error) {
      console.error('Failed to activate plan:', error);
      throw error;
    }
  }

  async deactivatePlan(planId: string): Promise<any> {
    try {
      const objectId = new mongoose.Types.ObjectId(planId);
      const plan = await Plan.findByIdAndUpdate(
        objectId,
        { isActive: false, updatedAt: new Date() },
        { new: true }
      );
      return plan;
    } catch (error) {
      console.error('Failed to deactivate plan:', error);
      throw error;
    }
  }

  async archivePlan(planId: string): Promise<any> {
    try {
      const objectId = new mongoose.Types.ObjectId(planId);
      const plan = await Plan.findByIdAndUpdate(
        objectId,
        { isArchived: true, isActive: false, updatedAt: new Date() },
        { new: true }
      );
      return plan;
    } catch (error) {
      console.error('Failed to archive plan:', error);
      throw error;
    }
  }
}

export const planService = new PlanService();

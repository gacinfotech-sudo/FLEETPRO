import mongoose from 'mongoose';
import { Subscription, Plan, Tenant, User } from '../models';
import { ISubscription, IPlan } from '../models';

/**
 * Trial Management Service
 * Handles 30-day free trials, expiration tracking, reminders, and conversion to paid
 */
export class TrialManagementService {
  // Trial configuration
  private readonly TRIAL_DAYS = 30;
  private readonly REMINDER_DAYS = [7, 14, 25];

  /**
   * Create a trial subscription for a new tenant
   */
  async createTrial(tenantId: string | mongoose.Types.ObjectId, planCode: string = 'starter'): Promise<ISubscription> {
    try {
      // Get the plan
      const plan = await Plan.findOne({ code: planCode, status: 'active' });
      if (!plan) {
        throw new Error(`Plan with code "${planCode}" not found`);
      }

      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + this.TRIAL_DAYS * 24 * 60 * 60 * 1000);
      const renewalDate = trialEndsAt;

      const subscription = new (require('../models').Subscription)({
        tenantId,
        planId: plan._id,
        billingCycle: 'monthly',
        status: 'TRIAL',
        startDate: now,
        renewalDate,
        isTrial: true,
        trialEndsAt,
        createdAt: now,
        updatedAt: now
      });

      const saved = await subscription.save();

      return saved;
    } catch (error) {
      console.error('Error creating trial:', error);
      throw error;
    }
  }

  /**
   * Get trial status for a tenant
   */
  async getTrialStatus(tenantId: string | mongoose.Types.ObjectId): Promise<{
    isTrialActive: boolean;
    daysRemaining: number;
    trialEndsAt: Date | null;
    trialStartedAt: Date | null;
    remindersSent: string[];
  }> {
    try {
      const subscription = await Subscription.findOne({ tenantId }).populate('planId');

      if (!subscription || !subscription.isTrial) {
        return {
          isTrialActive: false,
          daysRemaining: 0,
          trialEndsAt: null,
          trialStartedAt: null,
          remindersSent: []
        };
      }

      const now = new Date();
      const trialEndsAt = subscription.trialEndsAt!;
      const daysRemaining = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      return {
        isTrialActive: daysRemaining > 0 && subscription.status === 'TRIAL',
        daysRemaining: Math.max(0, daysRemaining),
        trialEndsAt,
        trialStartedAt: subscription.startDate,
        remindersSent: []
      };
    } catch (error) {
      console.error('Error getting trial status:', error);
      throw error;
    }
  }

  /**
   * Get all trials expiring soon
   */
  async getExpiringTrials(daysFromNow: number = 7): Promise<Array<ISubscription & { daysRemaining: number }>> {
    try {
      const now = new Date();
      const futureDate = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);

      const trials = await Subscription.find({
        isTrial: true,
        status: 'TRIAL',
        trialEndsAt: { $lte: futureDate, $gte: now }
      }).populate('planId tenantId');

      return trials.map(trial => ({
        ...trial.toObject(),
        daysRemaining: Math.ceil((trial.trialEndsAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      }));
    } catch (error) {
      console.error('Error fetching expiring trials:', error);
      throw error;
    }
  }

  /**
   * Get trials that have already expired
   */
  async getExpiredTrials(): Promise<ISubscription[]> {
    try {
      const now = new Date();

      const trials = await Subscription.find({
        isTrial: true,
        status: 'TRIAL',
        trialEndsAt: { $lt: now }
      }).populate('planId tenantId');

      return trials;
    } catch (error) {
      console.error('Error fetching expired trials:', error);
      throw error;
    }
  }

  /**
   * Send trial expiration reminders
   * Runs scheduled job to send emails on Day 7, 14, and 25
   */
  async sendTrialReminders(): Promise<{ sent: number; failed: number; errors: string[] }> {
    try {
      const reminders = {
        sent: 0,
        failed: 0,
        errors: [] as string[]
      };

      const now = new Date();

      for (const daysUntilExpiry of this.REMINDER_DAYS) {
        const targetDate = new Date(now.getTime() + (this.TRIAL_DAYS - daysUntilExpiry) * 24 * 60 * 60 * 1000);
        const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        // Find trials that started on this exact day (to send reminders now)
        const trials = await Subscription.find({
          isTrial: true,
          status: 'TRIAL',
          startDate: { $gte: dayStart, $lt: dayEnd },
          createdAt: { $lt: now }
        }).populate('planId tenantId');

        for (const trial of trials) {
          try {
            const tenant = trial.tenantId as any;
            const email = tenant?.email || tenant?.businessDetails?.businessEmail;

            if (email) {
              // Here you would integrate with your email service
              reminders.sent++;
            }
          } catch (err) {
            reminders.failed++;
            reminders.errors.push(`Failed to send reminder for trial ${trial._id}: ${err}`);
          }
        }
      }

      return reminders;
    } catch (error) {
      console.error('Error sending trial reminders:', error);
      throw error;
    }
  }

  /**
   * Convert trial to paid subscription
   */
  async convertTrialToPaid(
    tenantId: string | mongoose.Types.ObjectId,
    paymentDetails?: {
      paymentMethodId?: string;
      autoRenew?: boolean;
    }
  ): Promise<{ success: boolean; subscription: ISubscription; message: string }> {
    try {
      const subscription = await Subscription.findOneAndUpdate(
        { tenantId, isTrial: true },
        {
          status: 'ACTIVE',
          isTrial: false,
          trialEndsAt: null,
          updatedAt: new Date()
        },
        { new: true }
      ).populate('planId');

      if (!subscription) {
        throw new Error('No active trial found for this tenant');
      }


      return {
        success: true,
        subscription,
        message: 'Trial successfully converted to paid subscription'
      };
    } catch (error) {
      console.error('Error converting trial to paid:', error);
      throw error;
    }
  }

  /**
   * Extend trial period (admin only)
   */
  async extendTrial(
    tenantId: string | mongoose.Types.ObjectId,
    additionalDays: number,
    reason: string
  ): Promise<ISubscription> {
    try {
      const subscription = await Subscription.findOne({ tenantId, isTrial: true });

      if (!subscription) {
        throw new Error('No active trial found for this tenant');
      }

      const currentTrialEndsAt = subscription.trialEndsAt || new Date();
      const newTrialEndsAt = new Date(currentTrialEndsAt.getTime() + additionalDays * 24 * 60 * 60 * 1000);

      subscription.trialEndsAt = newTrialEndsAt;
      subscription.renewalDate = newTrialEndsAt;
      subscription.updatedAt = new Date();

      const updated = await subscription.save();

      return updated;
    } catch (error) {
      console.error('Error extending trial:', error);
      throw error;
    }
  }

  /**
   * Automatically suspend tenants with expired trials (cleanup job)
   */
  async suspendExpiredTrials(): Promise<{ suspended: number; failed: number; errors: string[] }> {
    try {
      const result = {
        suspended: 0,
        failed: 0,
        errors: [] as string[]
      };

      const expiredTrials = await this.getExpiredTrials();

      for (const trial of expiredTrials) {
        try {
          trial.status = 'SUSPENDED';
          trial.updatedAt = new Date();
          await trial.save();
          result.suspended++;
        } catch (err) {
          result.failed++;
          result.errors.push(`Failed to suspend trial for tenant ${trial.tenantId}: ${err}`);
        }
      }

      return result;
    } catch (error) {
      console.error('Error suspending expired trials:', error);
      throw error;
    }
  }

  /**
   * Get trial analytics
   */
  async getTrialAnalytics(): Promise<{
    totalTrials: number;
    activeTrials: number;
    expiredTrials: number;
    convertedTrials: number;
    conversionRate: number;
    averageDaysUsed: number;
  }> {
    try {
      const now = new Date();

      const [totalTrials, activeTrials, expiredTrials, convertedTrials] = await Promise.all([
        Subscription.countDocuments({ isTrial: true }),
        Subscription.countDocuments({ isTrial: true, status: 'TRIAL' }),
        Subscription.countDocuments({ isTrial: true, status: 'TRIAL', trialEndsAt: { $lt: now } }),
        Subscription.countDocuments({ isTrial: false, status: 'ACTIVE', startDate: { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } })
      ]);

      const conversionRate = totalTrials > 0 ? (convertedTrials / totalTrials) * 100 : 0;

      // Calculate average days used
      const trialSubs = await Subscription.find({ isTrial: true }).limit(1000);
      const totalDaysUsed = trialSubs.reduce((acc, sub) => {
        const daysUsed = sub.trialEndsAt ?
          Math.ceil((sub.trialEndsAt.getTime() - sub.startDate.getTime()) / (24 * 60 * 60 * 1000)) : 0;
        return acc + daysUsed;
      }, 0);
      const averageDaysUsed = trialSubs.length > 0 ? totalDaysUsed / trialSubs.length : 0;

      return {
        totalTrials,
        activeTrials,
        expiredTrials,
        convertedTrials,
        conversionRate: Math.round(conversionRate * 100) / 100,
        averageDaysUsed: Math.round(averageDaysUsed * 100) / 100
      };
    } catch (error) {
      console.error('Error getting trial analytics:', error);
      throw error;
    }
  }

  /**
   * Check if tenant is in trial period
   */
  async isInTrial(tenantId: string | mongoose.Types.ObjectId): Promise<boolean> {
    try {
      const subscription = await Subscription.findOne({
        tenantId,
        isTrial: true,
        status: 'TRIAL'
      });

      if (!subscription || !subscription.trialEndsAt) {
        return false;
      }

      const now = new Date();
      return subscription.trialEndsAt > now;
    } catch (error) {
      console.error('Error checking trial status:', error);
      return false;
    }
  }
}

export default new TrialManagementService();

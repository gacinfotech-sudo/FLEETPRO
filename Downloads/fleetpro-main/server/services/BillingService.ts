import mongoose from 'mongoose';
import { Subscription, Plan, User, Tenant } from '../models';
import { ISubscription, IPlan } from '../models';

/**
 * Billing Service
 * Manages billing cycles, invoice generation, payment processing, and failed payment recovery
 */
export class BillingService {
  /**
   * Generate invoice for subscription renewal
   */
  async generateInvoice(subscriptionId: string | mongoose.Types.ObjectId): Promise<{
    invoiceId: string;
    tenantId: string;
    planName: string;
    amount: number;
    tax: number;
    total: number;
    dueDate: Date;
    billingPeriod: { start: Date; end: Date };
  }> {
    try {
      const subscription = await Subscription.findById(subscriptionId).populate('planId tenantId');

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const plan = subscription.planId as IPlan;
      const tenant = subscription.tenantId as any;
      const billingCycle = subscription.billingCycle;

      // Calculate billing amount based on cycle
      const amount = this.getPricingForCycle(plan, billingCycle);
      const tax = amount * 0.18; // 18% GST for India
      const total = amount + tax;

      // Calculate billing period
      const periodStart = new Date(subscription.renewalDate);
      periodStart.setDate(periodStart.getDate() - 30); // Previous period
      const periodEnd = subscription.renewalDate;

      // Due date is typically 15 days from invoice date
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 15);

      const invoiceId = `INV-${Date.now()}-${subscriptionId.toString().slice(-6).toUpperCase()}`;


      return {
        invoiceId,
        tenantId: tenant._id.toString(),
        planName: plan.name,
        amount,
        tax,
        total,
        dueDate,
        billingPeriod: {
          start: periodStart,
          end: periodEnd
        }
      };
    } catch (error) {
      console.error('Error generating invoice:', error);
      throw error;
    }
  }

  /**
   * Process payment for subscription
   */
  async processPayment(subscriptionId: string | mongoose.Types.ObjectId, paymentDetails: {
    amount: number;
    paymentMethod: 'card' | 'bank_transfer' | 'upi' | 'wallet';
    transactionId: string;
    status: 'success' | 'pending' | 'failed';
  }): Promise<{
    success: boolean;
    message: string;
    subscription: ISubscription | null;
  }> {
    try {
      const subscription = await Subscription.findById(subscriptionId);

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (paymentDetails.status === 'success') {
        // Update renewal date
        const newRenewalDate = new Date(subscription.renewalDate);
        const billingCycle = subscription.billingCycle;

        switch (billingCycle) {
          case 'monthly':
            newRenewalDate.setMonth(newRenewalDate.getMonth() + 1);
            break;
          case 'quarterly':
            newRenewalDate.setMonth(newRenewalDate.getMonth() + 3);
            break;
          case 'halfYearly':
            newRenewalDate.setMonth(newRenewalDate.getMonth() + 6);
            break;
          case 'annual':
            newRenewalDate.setFullYear(newRenewalDate.getFullYear() + 1);
            break;
        }

        subscription.renewalDate = newRenewalDate;
        subscription.status = 'ACTIVE';
        subscription.updatedAt = new Date();
        await subscription.save();


        return {
          success: true,
          message: 'Payment processed successfully',
          subscription
        };
      } else if (paymentDetails.status === 'failed') {
        // Record failed payment attempt
        subscription.updatedAt = new Date();
        await subscription.save();

        return {
          success: false,
          message: 'Payment failed. Please retry or update payment method.',
          subscription: null
        };
      }

      return {
        success: false,
        message: 'Payment status pending',
        subscription: null
      };
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    }
  }

  /**
   * Handle failed payment and initiate recovery flow (dunning)
   */
  async initiateDunning(subscriptionId: string | mongoose.Types.ObjectId, retryAttempt: number = 1): Promise<{
    success: boolean;
    message: string;
    nextRetryDate: Date | null;
    shouldSuspend: boolean;
  }> {
    try {
      const subscription = await Subscription.findById(subscriptionId).populate('planId tenantId');

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const MAX_RETRY_ATTEMPTS = 3;
      const RETRY_INTERVAL_DAYS = 3; // Retry every 3 days

      if (retryAttempt >= MAX_RETRY_ATTEMPTS) {
        // Suspend after max retries
        subscription.status = 'SUSPENDED';
        subscription.updatedAt = new Date();
        await subscription.save();


        return {
          success: false,
          message: 'Payment failed multiple times. Subscription suspended.',
          nextRetryDate: null,
          shouldSuspend: true
        };
      }

      const nextRetryDate = new Date();
      nextRetryDate.setDate(nextRetryDate.getDate() + RETRY_INTERVAL_DAYS);

      // Would send email notification here
      const tenant = subscription.tenantId as any;
      const email = tenant?.email || tenant?.businessDetails?.businessEmail;
      if (email) {
      }

      return {
        success: true,
        message: `Payment retry scheduled for ${nextRetryDate.toLocaleDateString()}`,
        nextRetryDate,
        shouldSuspend: false
      };
    } catch (error) {
      console.error('Error initiating dunning:', error);
      throw error;
    }
  }

  /**
   * Get billing history for a tenant
   */
  async getBillingHistory(tenantId: string | mongoose.Types.ObjectId, limit: number = 12): Promise<Array<{
    date: Date;
    amount: number;
    status: 'paid' | 'pending' | 'failed' | 'refunded';
    billingCycle: string;
    description: string;
  }>> {
    try {
      const subscriptions = await Subscription.find({ tenantId }).populate('planId').sort({ createdAt: -1 }).limit(limit);

      const history = subscriptions.map(sub => ({
        date: sub.renewalDate,
        amount: this.getPricingForCycle(sub.planId as IPlan, sub.billingCycle),
        status: sub.status === 'CANCELLED' ? 'refunded' : sub.status === 'ACTIVE' ? 'paid' : 'pending' as const,
        billingCycle: sub.billingCycle,
        description: `${(sub.planId as IPlan).name} - ${sub.billingCycle} billing`
      }));

      return history;
    } catch (error) {
      console.error('Error getting billing history:', error);
      throw error;
    }
  }

  /**
   * Calculate pro-rata credit for plan downgrade
   */
  calculateProRataCredit(
    currentPlan: IPlan,
    newPlan: IPlan,
    billingCycle: 'monthly' | 'quarterly' | 'halfYearly' | 'annual',
    renewalDate: Date
  ): {
    currentPeriodCharge: number;
    creditAmount: number;
    finalAmount: number;
    daysRemaining: number;
  } {
    const now = new Date();
    const totalDaysInCycle = this.getDaysInBillingCycle(billingCycle);
    const cycleStartDate = new Date(renewalDate);

    // Calculate cycle start date based on billing cycle
    switch (billingCycle) {
      case 'monthly':
        cycleStartDate.setMonth(cycleStartDate.getMonth() - 1);
        break;
      case 'quarterly':
        cycleStartDate.setMonth(cycleStartDate.getMonth() - 3);
        break;
      case 'halfYearly':
        cycleStartDate.setMonth(cycleStartDate.getMonth() - 6);
        break;
      case 'annual':
        cycleStartDate.setFullYear(cycleStartDate.getFullYear() - 1);
        break;
    }

    const daysUsed = Math.ceil((now.getTime() - cycleStartDate.getTime()) / (24 * 60 * 60 * 1000));
    const daysRemaining = totalDaysInCycle - daysUsed;

    const currentCost = this.getPricingForCycle(currentPlan, billingCycle);
    const newCost = this.getPricingForCycle(newPlan, billingCycle);

    const dailyRateCurrent = currentCost / totalDaysInCycle;
    const dailyRateNew = newCost / totalDaysInCycle;

    const currentPeriodCharge = dailyRateNew * daysRemaining;
    const creditAmount = dailyRateCurrent * daysRemaining;
    const finalAmount = creditAmount - currentPeriodCharge;

    return {
      currentPeriodCharge,
      creditAmount,
      finalAmount,
      daysRemaining
    };
  }

  /**
   * Get subscription costs and billing details
   */
  async getSubscriptionCosts(subscriptionId: string | mongoose.Types.ObjectId): Promise<{
    planName: string;
    monthlyAmount: number;
    currentBillingCycleAmount: number;
    renewalDate: Date;
    nextInvoiceDate: Date;
    daysUntilRenewal: number;
    status: string;
  }> {
    try {
      const subscription = await Subscription.findById(subscriptionId).populate('planId');

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const plan = subscription.planId as IPlan;
      const monthlyAmount = plan.pricing.monthlyUsd;
      const billingCycleAmount = this.getPricingForCycle(plan, subscription.billingCycle);

      const now = new Date();
      const daysUntilRenewal = Math.ceil((subscription.renewalDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      const nextInvoiceDate = new Date(subscription.renewalDate);
      nextInvoiceDate.setDate(nextInvoiceDate.getDate() - 5); // Invoice sent 5 days before renewal

      return {
        planName: plan.name,
        monthlyAmount,
        currentBillingCycleAmount: billingCycleAmount,
        renewalDate: subscription.renewalDate,
        nextInvoiceDate,
        daysUntilRenewal: Math.max(0, daysUntilRenewal),
        status: subscription.status
      };
    } catch (error) {
      console.error('Error getting subscription costs:', error);
      throw error;
    }
  }

  /**
   * Private helper: Get pricing for billing cycle
   */
  private getPricingForCycle(plan: IPlan, billingCycle: string): number {
    switch (billingCycle) {
      case 'monthly':
        return plan.pricing.monthlyUsd;
      case 'quarterly':
        return plan.pricing.quarterlyUsd || plan.pricing.monthlyUsd * 3 * 0.9;
      case 'halfYearly':
        return plan.pricing.halfYearlyUsd || plan.pricing.monthlyUsd * 6 * 0.85;
      case 'annual':
        return plan.pricing.annualUsd || plan.pricing.monthlyUsd * 12 * 0.8;
      default:
        return plan.pricing.monthlyUsd;
    }
  }

  /**
   * Private helper: Get days in billing cycle
   */
  private getDaysInBillingCycle(billingCycle: string): number {
    switch (billingCycle) {
      case 'monthly':
        return 30;
      case 'quarterly':
        return 90;
      case 'halfYearly':
        return 180;
      case 'annual':
        return 365;
      default:
        return 30;
    }
  }
}

export default new BillingService();

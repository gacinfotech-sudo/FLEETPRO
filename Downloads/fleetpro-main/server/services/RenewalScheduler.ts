import cron from 'node-cron';
import { Subscription, Plan, SaaSInvoice } from '../models';
import { InvoicingService } from './InvoicingService';
import { SubscriptionsService } from './SubscriptionsService';

/**
 * Renewal Scheduler
 * Handles automatic subscription renewals and invoice generation
 */
export class RenewalScheduler {
  private invoicingService = new InvoicingService();
  private subscriptionsService = new SubscriptionsService();
  private isRunning = false;

  /**
   * Initialize and schedule renewal cron jobs
   */
  initialize(): void {
    if (this.isRunning) {
      return;
    }

    // Run every day at 00:00 UTC
    cron.schedule('0 0 * * *', async () => {
      await this.processRenewals();
    });

    // Run every hour to check for overdue payments
    cron.schedule('0 * * * *', async () => {
      await this.checkOverduePayments();
    });

    this.isRunning = true;
  }

  /**
   * Process subscriptions due for renewal
   */
  async processRenewals(): Promise<{ processed: number; errors: number }> {
    try {
      const today = new Date();
      const subscriptions = await Subscription.find({
        renewalDate: { $lte: today },
        status: { $in: ['ACTIVE', 'TRIAL'] }
      }).populate('planId');

      let processed = 0;
      let errors = 0;

      for (const sub of subscriptions) {
        try {
          const plan = sub.planId as any;

          // Generate invoice
          await this.invoicingService.generateInvoice({
            tenantId: sub.tenantId,
            subscriptionId: (sub._id as any),
            planId: ((plan._id || sub.planId) as any),
            amount: plan.pricing.monthlyUsd,
            billingCycle: sub.billingCycle,
            invoiceDate: today
          });

          // Update renewal date
          const newRenewalDate = this.calculateNextRenewal(today, sub.billingCycle);
          await this.subscriptionsService.updateRenewalDate(sub.tenantId, newRenewalDate);

          processed++;
        } catch (error) {
          errors++;
          console.error(`Error renewing subscription for tenant ${sub.tenantId}:`, error);
        }
      }

      return { processed, errors };
    } catch (error) {
      console.error('Error in renewal processing:', error);
      return { processed: 0, errors: 1 };
    }
  }

  /**
   * Check for overdue payments and take action
   */
  private async checkOverduePayments(): Promise<void> {
    try {
      const invoices = await SaaSInvoice.find({
        dueDate: { $lt: new Date() },
        status: { $nin: ['PAID', 'CANCELLED'] }
      });

      for (const invoice of invoices) {
        // If more than 7 days overdue, suspend subscription
        const daysOverdue = Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOverdue > 7) {
          await this.subscriptionsService.suspendSubscription(
            invoice.tenantId,
            'Payment overdue for more than 7 days'
          );
        }
      }
    } catch (error) {
      console.error('Error checking overdue payments:', error);
    }
  }

  /**
   * Calculate next renewal date
   */
  private calculateNextRenewal(currentDate: Date, billingCycle: string): Date {
    const renewal = new Date(currentDate);

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
   * Get scheduler status
   */
  getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }
}

export default new RenewalScheduler();

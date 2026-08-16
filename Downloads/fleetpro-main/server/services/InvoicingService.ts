import mongoose from 'mongoose';
import { SaaSInvoice, Subscription, Plan, ISaaSInvoice, IPlan } from '../models';

/**
 * Invoicing Service
 * Generates and manages billing invoices for subscriptions
 */
export class InvoicingService {
  /**
   * Generate invoice for subscription renewal
   */
  async generateInvoice(data: {
    tenantId: string | mongoose.Types.ObjectId;
    subscriptionId: string | mongoose.Types.ObjectId;
    planId: string | mongoose.Types.ObjectId;
    amount: number;
    billingCycle: string;
    invoiceDate?: Date;
    dueDate?: Date;
  }): Promise<ISaaSInvoice> {
    try {
      const plan = await Plan.findById(data.planId) as IPlan;
      if (!plan) throw new Error('Plan not found');

      const now = data.invoiceDate || new Date();
      const due = data.dueDate || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Calculate period
      const periodStart = new Date(now);
      const periodEnd = new Date(now);

      switch (data.billingCycle) {
        case 'monthly':
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          break;
        case 'quarterly':
          periodEnd.setMonth(periodEnd.getMonth() + 3);
          break;
        case 'halfYearly':
          periodEnd.setMonth(periodEnd.getMonth() + 6);
          break;
        case 'annual':
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          break;
      }

      // Calculate tax (18% GST for India)
      const tax = data.amount * 0.18;
      const total = data.amount + tax;

      const invoice = new SaaSInvoice({
        invoiceNumber: this.generateInvoiceNumber(),
        tenantId: data.tenantId,
        subscriptionId: data.subscriptionId,
        planId: data.planId,
        billingCycle: data.billingCycle,
        period: {
          start: periodStart,
          end: periodEnd
        },
        amount: data.amount,
        tax: tax,
        total: total,
        paid: 0,
        outstanding: total,
        dueDate: due,
        status: 'ISSUED',
        createdAt: now,
        updatedAt: now
      });

      const saved = await invoice.save();
      console.log(`Invoice generated: ${saved.invoiceNumber} for tenant ${data.tenantId}`);
      return saved;
    } catch (error) {
      console.error('Error generating invoice:', error);
      throw error;
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string | mongoose.Types.ObjectId): Promise<ISaaSInvoice | null> {
    try {
      const invoice = await SaaSInvoice.findById(invoiceId).populate('planId');
      return invoice || null;
    } catch (error) {
      console.error('Error fetching invoice:', error);
      throw error;
    }
  }

  /**
   * Get invoice by number
   */
  async getInvoiceByNumber(invoiceNumber: string): Promise<ISaaSInvoice | null> {
    try {
      const invoice = await SaaSInvoice.findOne({ invoiceNumber }).populate('planId');
      return invoice || null;
    } catch (error) {
      console.error('Error fetching invoice by number:', error);
      throw error;
    }
  }

  /**
   * List invoices for tenant
   */
  async getInvoicesByTenant(
    tenantId: string | mongoose.Types.ObjectId,
    options?: { status?: string; limit?: number; skip?: number }
  ): Promise<{ invoices: ISaaSInvoice[]; total: number }> {
    try {
      const query: any = { tenantId };
      if (options?.status) query.status = options.status;

      const total = await SaaSInvoice.countDocuments(query);
      const invoices = await SaaSInvoice.find(query)
        .populate('planId')
        .sort({ createdAt: -1 })
        .limit(options?.limit || 50)
        .skip(options?.skip || 0);

      return { invoices, total };
    } catch (error) {
      console.error('Error fetching invoices:', error);
      throw error;
    }
  }

  /**
   * List overdue invoices
   */
  async getOverdueInvoices(): Promise<ISaaSInvoice[]> {
    try {
      const now = new Date();
      const invoices = await SaaSInvoice.find({
        dueDate: { $lt: now },
        status: { $nin: ['PAID', 'CANCELLED'] }
      })
        .populate('planId')
        .populate('tenantId')
        .sort({ dueDate: 1 });

      return invoices;
    } catch (error) {
      console.error('Error fetching overdue invoices:', error);
      throw error;
    }
  }

  /**
   * Mark invoice as paid (partially or fully)
   */
  async markInvoicePaid(
    invoiceId: string | mongoose.Types.ObjectId,
    paidAmount: number
  ): Promise<ISaaSInvoice> {
    try {
      const invoice = await SaaSInvoice.findById(invoiceId);
      if (!invoice) throw new Error('Invoice not found');

      invoice.paid = (invoice.paid || 0) + paidAmount;
      invoice.outstanding = Math.max(0, invoice.total - invoice.paid);

      // Update status based on payment
      if (invoice.outstanding === 0) {
        invoice.status = 'PAID';
      } else if (invoice.paid > 0) {
        invoice.status = 'PARTIAL';
      }

      invoice.updatedAt = new Date();
      const updated = await invoice.save();

      console.log(`Invoice ${invoiceId} marked paid: ${paidAmount}. Outstanding: ${invoice.outstanding}`);
      return updated;
    } catch (error) {
      console.error('Error marking invoice paid:', error);
      throw error;
    }
  }

  /**
   * Cancel invoice
   */
  async cancelInvoice(invoiceId: string | mongoose.Types.ObjectId, reason?: string): Promise<ISaaSInvoice> {
    try {
      const invoice = await SaaSInvoice.findByIdAndUpdate(
        invoiceId,
        {
          status: 'CANCELLED',
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!invoice) throw new Error('Invoice not found');

      console.log(`Invoice ${invoiceId} cancelled. Reason: ${reason || 'Not specified'}`);
      return invoice;
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      throw error;
    }
  }

  /**
   * Generate invoices for all active subscriptions due for renewal
   * Called by renewal scheduler
   */
  async generateMonthlyInvoices(): Promise<ISaaSInvoice[]> {
    try {
      const now = new Date();
      const subscriptions = await Subscription.find({
        status: { $in: ['ACTIVE', 'TRIAL'] },
        renewalDate: { $lte: now }
      }).populate('planId');

      const invoices: ISaaSInvoice[] = [];

      for (const sub of subscriptions) {
        const plan = (sub.planId as any) as IPlan;
        const amount = plan.pricing.monthlyUsd; // Default to monthly pricing

        const invoice = await this.generateInvoice({
          tenantId: sub.tenantId,
          subscriptionId: (sub._id as any),
          planId: ((sub.planId as any)._id || sub.planId) as any,
          amount: amount,
          billingCycle: sub.billingCycle
        });

        invoices.push(invoice);
      }

      console.log(`Generated ${invoices.length} invoices for renewal`);
      return invoices;
    } catch (error) {
      console.error('Error generating monthly invoices:', error);
      throw error;
    }
  }

  /**
   * Get invoice summary for tenant
   */
  async getInvoiceSummary(tenantId: string | mongoose.Types.ObjectId): Promise<{
    totalIssued: number;
    totalPaid: number;
    totalOutstanding: number;
    invoiceCount: number;
    overdueInvoices: number;
  }> {
    try {
      const objId = new mongoose.Types.ObjectId(tenantId.toString());
      const invoices = await SaaSInvoice.find({ tenantId: objId });

      const summary = {
        totalIssued: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        invoiceCount: invoices.length,
        overdueInvoices: 0
      };

      const now = new Date();

      for (const invoice of invoices) {
        summary.totalIssued += invoice.total;
        summary.totalPaid += invoice.paid || 0;
        summary.totalOutstanding += invoice.outstanding;

        if (invoice.dueDate < now && invoice.status !== 'PAID' && invoice.status !== 'CANCELLED') {
          summary.overdueInvoices++;
        }
      }

      return summary;
    } catch (error) {
      console.error('Error getting invoice summary:', error);
      throw error;
    }
  }

  /**
   * Generate invoice number
   */
  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(5, '0');
    return `INV-${year}${month}-${random}`;
  }
}

export default new InvoicingService();

import mongoose from 'mongoose';
import { Invoice, Subscription, Tenant } from '../models/index';

class InvoiceService {
  async getInvoices(tenantId: string, filter: any = {}): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const query: any = { tenantId: tenantObjectId };

      if (filter.status) query.status = filter.status;

      const invoices = await Invoice.find(query)
        .sort({ invoiceDate: -1 })
        .limit(filter.limit || 100)
        .lean();

      return invoices;
    } catch (error) {
      console.error('Failed to get invoices:', error);
      throw error;
    }
  }

  async getInvoiceById(invoiceId: string): Promise<any> {
    try {
      const objectId = new mongoose.Types.ObjectId(invoiceId);
      const invoice = await Invoice.findById(objectId).populate('tenantId');
      if (!invoice) throw new Error('Invoice not found');
      return invoice;
    } catch (error) {
      console.error('Failed to get invoice:', error);
      throw error;
    }
  }

  async generateInvoice(subscriptionId: string): Promise<any> {
    try {
      const subObjectId = new mongoose.Types.ObjectId(subscriptionId);
      const subscription = await Subscription.findById(subObjectId).populate('planId');
      if (!subscription) throw new Error('Subscription not found');

      const plan = subscription.planId as any;
      const now = new Date();
      const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      let amount = 0;
      if (subscription.billingCycle === 'monthly') {
        amount = plan.monthlyPrice || 0;
      } else if (subscription.billingCycle === 'quarterly') {
        amount = plan.quarterlyPrice || 0;
      } else if (subscription.billingCycle === 'halfYearly') {
        amount = plan.halfYearlyPrice || 0;
      } else if (subscription.billingCycle === 'annual') {
        amount = plan.annualPrice || 0;
      }

      const tax = Math.round(amount * (plan.taxPercentage || 18) / 100);
      const setup = plan.setupFee || 0;
      const total = amount + tax + setup;

      const invoice = new Invoice({
        tenantId: subscription.tenantId,
        subscriptionId: subObjectId,
        invoiceNumber: `INV-${Date.now()}`,
        billingPeriodStart: new Date(now.getFullYear(), now.getMonth(), 1),
        billingPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        invoiceDate: now,
        dueDate,
        subtotalAmount: amount,
        taxAmount: tax,
        discountAmount: 0,
        creditAmount: 0,
        totalAmount: total,
        amountPaid: 0,
        status: 'ISSUED',
      });

      await invoice.save();
      return invoice;
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      throw error;
    }
  }

  async recordPayment(invoiceId: string, amountPaid: number): Promise<any> {
    try {
      const invoiceObjectId = new mongoose.Types.ObjectId(invoiceId);
      const invoice = await Invoice.findById(invoiceObjectId);
      if (!invoice) throw new Error('Invoice not found');

      invoice.amountPaid = (invoice.amountPaid || 0) + amountPaid;

      if (invoice.amountPaid >= invoice.totalAmount) {
        invoice.status = 'PAID';
      } else if (invoice.amountPaid > 0) {
        invoice.status = 'PARTIAL';
      }

      invoice.updatedAt = new Date();
      await invoice.save();

      return invoice;
    } catch (error) {
      console.error('Failed to record payment:', error);
      throw error;
    }
  }

  async addCredit(invoiceId: string, amount: number): Promise<any> {
    try {
      const invoiceObjectId = new mongoose.Types.ObjectId(invoiceId);
      const invoice = await Invoice.findById(invoiceObjectId);
      if (!invoice) throw new Error('Invoice not found');

      invoice.creditAmount = (invoice.creditAmount || 0) + amount;
      invoice.updatedAt = new Date();
      await invoice.save();

      return invoice;
    } catch (error) {
      console.error('Failed to add credit:', error);
      throw error;
    }
  }

  async voidInvoice(invoiceId: string): Promise<any> {
    try {
      const invoiceObjectId = new mongoose.Types.ObjectId(invoiceId);
      const invoice = await Invoice.findById(invoiceObjectId);
      if (!invoice) throw new Error('Invoice not found');

      invoice.status = 'VOID';
      invoice.updatedAt = new Date();
      await invoice.save();

      return invoice;
    } catch (error) {
      console.error('Failed to void invoice:', error);
      throw error;
    }
  }

  async sumOutstanding(tenantId: string): Promise<number> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const result = await Invoice.aggregate([
        {
          $match: {
            tenantId: tenantObjectId,
            status: { $in: ['ISSUED', 'PARTIAL'] },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: { $subtract: ['$totalAmount', '$amountPaid'] },
            },
          },
        },
      ]);

      return result[0]?.total || 0;
    } catch (error) {
      console.error('Failed to sum outstanding:', error);
      throw error;
    }
  }

  async sumOverdue(tenantId: string): Promise<number> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const now = new Date();
      const result = await Invoice.aggregate([
        {
          $match: {
            tenantId: tenantObjectId,
            dueDate: { $lt: now },
            status: { $ne: 'PAID' },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: { $subtract: ['$totalAmount', '$amountPaid'] },
            },
          },
        },
      ]);

      return result[0]?.total || 0;
    } catch (error) {
      console.error('Failed to sum overdue:', error);
      throw error;
    }
  }
}

export const invoiceService = new InvoiceService();

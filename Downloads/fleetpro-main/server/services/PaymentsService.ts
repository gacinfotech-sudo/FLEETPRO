import mongoose from 'mongoose';
import { SaaSPayment, SaaSInvoice, ISaaSPayment } from '../models';
import { InvoicingService } from './InvoicingService';

/**
 * Payments Service
 * Manages payment transactions and reconciliation
 */
export class PaymentsService {
  private invoicingService = new InvoicingService();

  /**
   * Record payment against invoice
   */
  async recordPayment(data: {
    invoiceId: string | mongoose.Types.ObjectId;
    tenantId: string | mongoose.Types.ObjectId;
    amount: number;
    paymentDate?: Date;
    paymentMode: 'bank_transfer' | 'card' | 'check' | 'upi' | 'other';
    transactionReference: string;
  }): Promise<ISaaSPayment> {
    try {
      const invoice = await SaaSInvoice.findById(data.invoiceId);
      if (!invoice) throw new Error('Invoice not found');

      const payment = new SaaSPayment({
        invoiceId: data.invoiceId,
        tenantId: data.tenantId,
        amount: data.amount,
        paymentDate: data.paymentDate || new Date(),
        paymentMode: data.paymentMode,
        transactionReference: data.transactionReference,
        status: 'received',
        createdAt: new Date()
      });

      const saved = await payment.save();

      // Update invoice
      await this.invoicingService.markInvoicePaid(data.invoiceId, data.amount);


      return saved;
    } catch (error) {
      console.error('Error recording payment:', error);
      throw error;
    }
  }

  /**
   * Get payments for tenant
   */
  async getPaymentsByTenant(
    tenantId: string | mongoose.Types.ObjectId,
    options?: { limit?: number; skip?: number }
  ): Promise<{ payments: ISaaSPayment[]; total: number }> {
    try {
      const total = await SaaSPayment.countDocuments({ tenantId });
      const payments = await SaaSPayment.find({ tenantId })
        .populate('invoiceId')
        .sort({ paymentDate: -1 })
        .limit(options?.limit || 50)
        .skip(options?.skip || 0);

      return { payments, total };
    } catch (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
  }

  /**
   * Get payment by transaction reference
   */
  async getPaymentByReference(transactionReference: string): Promise<ISaaSPayment | null> {
    try {
      const payment = await SaaSPayment.findOne({ transactionReference }).populate('invoiceId');
      return payment || null;
    } catch (error) {
      console.error('Error fetching payment:', error);
      throw error;
    }
  }

  /**
   * Get outstanding amount for tenant
   */
  async getOutstanding(tenantId: string | mongoose.Types.ObjectId): Promise<number> {
    try {
      const invoices = await SaaSInvoice.find({ tenantId });
      return invoices.reduce((sum, inv) => sum + inv.outstanding, 0);
    } catch (error) {
      console.error('Error calculating outstanding:', error);
      throw error;
    }
  }

  /**
   * Get payment statistics for tenant
   */
  async getPaymentStats(tenantId: string | mongoose.Types.ObjectId): Promise<{
    totalPaid: number;
    totalOutstanding: number;
    averagePaymentAmount: number;
    lastPaymentDate: Date | null;
    paymentMethods: Record<string, number>;
  }> {
    try {
      const payments = await SaaSPayment.find({ tenantId });
      const invoices = await SaaSInvoice.find({ tenantId });

      const stats = {
        totalPaid: payments.reduce((sum, p) => sum + p.amount, 0),
        totalOutstanding: invoices.reduce((sum, inv) => sum + inv.outstanding, 0),
        averagePaymentAmount: payments.length > 0 ? payments.reduce((sum, p) => sum + p.amount, 0) / payments.length : 0,
        lastPaymentDate: payments.length > 0 ? new Date(Math.max(...payments.map(p => p.paymentDate.getTime()))) : null,
        paymentMethods: this.groupByPaymentMode(payments)
      };

      return stats;
    } catch (error) {
      console.error('Error calculating payment stats:', error);
      throw error;
    }
  }

  /**
   * Get payments by date range
   */
  async getPaymentsByDateRange(
    tenantId: string | mongoose.Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<ISaaSPayment[]> {
    try {
      const payments = await SaaSPayment.find({
        tenantId,
        paymentDate: { $gte: startDate, $lte: endDate }
      })
        .populate('invoiceId')
        .sort({ paymentDate: -1 });

      return payments;
    } catch (error) {
      console.error('Error fetching payments by date range:', error);
      throw error;
    }
  }

  /**
   * Group payments by payment mode
   */
  private groupByPaymentMode(payments: ISaaSPayment[]): Record<string, number> {
    const grouped: Record<string, number> = {};

    for (const payment of payments) {
      if (!grouped[payment.paymentMode]) {
        grouped[payment.paymentMode] = 0;
      }
      grouped[payment.paymentMode]++;
    }

    return grouped;
  }
}

export default new PaymentsService();

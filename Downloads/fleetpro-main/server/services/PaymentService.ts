import mongoose from 'mongoose';
import { Payment, Invoice } from '../models/index';

class PaymentService {
  async recordPayment(invoiceId: string, data: any): Promise<any> {
    try {
      const invoiceObjectId = new mongoose.Types.ObjectId(invoiceId);
      const invoice = await Invoice.findById(invoiceObjectId);
      if (!invoice) throw new Error('Invoice not found');

      const payment = new Payment({
        tenantId: invoice.tenantId,
        invoiceId: invoiceObjectId,
        amountPaid: data.amountPaid,
        paymentDate: new Date(),
        paymentMethod: data.paymentMethod || 'CASH',
        referenceId: data.referenceId,
        notes: data.notes,
        verifiedBy: data.verifiedBy,
        status: 'PAID',
      });

      await payment.save();
      return payment;
    } catch (error) {
      console.error('Failed to record payment:', error);
      throw error;
    }
  }

  async getPaymentHistory(tenantId: string): Promise<any[]> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const payments = await Payment.find({ tenantId: tenantObjectId })
        .sort({ paymentDate: -1 })
        .lean();

      return payments;
    } catch (error) {
      console.error('Failed to get payment history:', error);
      throw error;
    }
  }

  async verifyPayment(paymentId: string): Promise<any> {
    try {
      const paymentObjectId = new mongoose.Types.ObjectId(paymentId);
      const payment = await Payment.findByIdAndUpdate(
        paymentObjectId,
        { status: 'PAID', verifiedBy: 'admin' },
        { new: true }
      );

      return payment;
    } catch (error) {
      console.error('Failed to verify payment:', error);
      throw error;
    }
  }

  async refundPayment(paymentId: string, amount: number): Promise<any> {
    try {
      const paymentObjectId = new mongoose.Types.ObjectId(paymentId);
      const payment = await Payment.findById(paymentObjectId);
      if (!payment) throw new Error('Payment not found');

      const refund = new Payment({
        tenantId: payment.tenantId,
        invoiceId: payment.invoiceId,
        amountPaid: -amount,
        paymentDate: new Date(),
        paymentMethod: payment.paymentMethod,
        notes: `Refund for original payment: ${paymentId}`,
        status: 'REFUNDED',
      });

      await refund.save();
      return refund;
    } catch (error) {
      console.error('Failed to process refund:', error);
      throw error;
    }
  }

  async sumPaymentsByMethod(tenantId: string): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const result = await Payment.aggregate([
        {
          $match: {
            tenantId: tenantObjectId,
            status: 'PAID',
          },
        },
        {
          $group: {
            _id: '$paymentMethod',
            total: { $sum: '$amountPaid' },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { total: -1 },
        },
      ]);

      return result;
    } catch (error) {
      console.error('Failed to sum payments by method:', error);
      throw error;
    }
  }
}

export const paymentService = new PaymentService();

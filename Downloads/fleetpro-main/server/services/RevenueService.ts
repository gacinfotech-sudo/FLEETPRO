import mongoose from 'mongoose';
import { Subscription, Plan, Invoice } from '../models/index';

class RevenueService {
  async calculateMRR(): Promise<number> {
    try {
      const result = await Subscription.aggregate([
        {
          $match: { status: 'ACTIVE' },
        },
        {
          $lookup: {
            from: 'plans',
            localField: 'planId',
            foreignField: '_id',
            as: 'plan',
          },
        },
        {
          $unwind: '$plan',
        },
        {
          $group: {
            _id: null,
            totalMRR: {
              $sum: {
                $cond: [
                  { $eq: ['$billingCycle', 'monthly'] },
                  '$plan.monthlyPrice',
                  {
                    $cond: [
                      { $eq: ['$billingCycle', 'quarterly'] },
                      { $divide: ['$plan.quarterlyPrice', 3] },
                      {
                        $cond: [
                          { $eq: ['$billingCycle', 'halfYearly'] },
                          { $divide: ['$plan.halfYearlyPrice', 6] },
                          { $divide: ['$plan.annualPrice', 12] },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      ]);

      return Math.round(result[0]?.totalMRR || 0);
    } catch (error) {
      console.error('Failed to calculate MRR:', error);
      throw error;
    }
  }

  async calculateARR(): Promise<number> {
    try {
      const mrr = await this.calculateMRR();
      return mrr * 12;
    } catch (error) {
      console.error('Failed to calculate ARR:', error);
      throw error;
    }
  }

  async getRevenueThisMonth(): Promise<number> {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const result = await Invoice.aggregate([
        {
          $match: {
            invoiceDate: { $gte: monthStart },
            status: { $ne: 'VOID' },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' },
          },
        },
      ]);

      return Math.round(result[0]?.total || 0);
    } catch (error) {
      console.error('Failed to get revenue this month:', error);
      throw error;
    }
  }

  async getRevenueByPlan(): Promise<any[]> {
    try {
      const result = await Subscription.aggregate([
        {
          $match: { status: 'ACTIVE' },
        },
        {
          $lookup: {
            from: 'plans',
            localField: 'planId',
            foreignField: '_id',
            as: 'plan',
          },
        },
        {
          $unwind: '$plan',
        },
        {
          $group: {
            _id: '$plan.name',
            count: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [
                  { $eq: ['$billingCycle', 'monthly'] },
                  '$plan.monthlyPrice',
                  {
                    $cond: [
                      { $eq: ['$billingCycle', 'quarterly'] },
                      '$plan.quarterlyPrice',
                      {
                        $cond: [
                          { $eq: ['$billingCycle', 'halfYearly'] },
                          '$plan.halfYearlyPrice',
                          '$plan.annualPrice',
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
        {
          $sort: { revenue: -1 },
        },
      ]);

      return result;
    } catch (error) {
      console.error('Failed to get revenue by plan:', error);
      throw error;
    }
  }

  async getRevenueByBillingCycle(): Promise<any[]> {
    try {
      const result = await Subscription.aggregate([
        {
          $match: { status: 'ACTIVE' },
        },
        {
          $lookup: {
            from: 'plans',
            localField: 'planId',
            foreignField: '_id',
            as: 'plan',
          },
        },
        {
          $unwind: '$plan',
        },
        {
          $group: {
            _id: '$billingCycle',
            count: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [
                  { $eq: ['$billingCycle', 'monthly'] },
                  '$plan.monthlyPrice',
                  {
                    $cond: [
                      { $eq: ['$billingCycle', 'quarterly'] },
                      '$plan.quarterlyPrice',
                      {
                        $cond: [
                          { $eq: ['$billingCycle', 'halfYearly'] },
                          '$plan.halfYearlyPrice',
                          '$plan.annualPrice',
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      ]);

      return result;
    } catch (error) {
      console.error('Failed to get revenue by billing cycle:', error);
      throw error;
    }
  }

  async getCollectionRate(): Promise<number> {
    try {
      const invoiceResult = await Invoice.aggregate([
        {
          $match: { status: { $ne: 'VOID' } },
        },
        {
          $group: {
            _id: null,
            totalInvoiced: { $sum: '$totalAmount' },
            totalCollected: { $sum: '$amountPaid' },
          },
        },
      ]);

      if (!invoiceResult[0]) return 0;

      const { totalInvoiced, totalCollected } = invoiceResult[0];
      return Math.round((totalCollected / totalInvoiced) * 100);
    } catch (error) {
      console.error('Failed to get collection rate:', error);
      throw error;
    }
  }
}

export const revenueService = new RevenueService();

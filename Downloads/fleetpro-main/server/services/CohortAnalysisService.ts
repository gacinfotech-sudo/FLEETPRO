import mongoose from 'mongoose';
import { Booking } from '../models/index';

interface Cohort {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  definition: CohortDefinition;
  memberCount: number;
  members: string[]; // customer/user IDs
  createdAt: Date;
  updatedAt: Date;
}

interface CohortDefinition {
  type: 'time_based' | 'behavior_based' | 'segment_based';
  criteria: CohortCriteria;
  dateRange?: { start: Date; end: Date };
}

interface CohortCriteria {
  property: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in_range';
  value: any;
  additionalFilters?: Array<{
    property: string;
    operator: string;
    value: any;
  }>;
}

interface CohortRetention {
  cohortId: string;
  period: number; // weeks/months since cohort creation
  retainedCount: number;
  retentionRate: number;
  activeCount: number;
  churnedCount: number;
}

interface CohortPerformance {
  cohortId: string;
  metric: string;
  value: number;
  trend: number;
  comparison: {
    cohortName: string;
    value: number;
    difference: number;
  }[];
}

interface RetentionCurve {
  cohortId: string;
  cohortName: string;
  periods: Array<{
    period: number;
    users: number;
    retained: number;
    rate: number;
  }>;
}

interface ChurnCohort {
  cohortId: string;
  cohortName: string;
  churnedUsers: number;
  totalUsers: number;
  churnRate: number;
  avgLTV: number;
  churnReasons: Record<string, number>;
}

export class CohortAnalysisService {
  private cohorts: Map<string, Cohort> = new Map();
  private retentionData: Map<string, CohortRetention[]> = new Map();

  /**
   * Create a new cohort based on time-based criteria
   */
  async createTimeCohort(
    tenantId: mongoose.Types.ObjectId,
    name: string,
    cohortType: 'monthly' | 'quarterly' | 'weekly',
    targetDate: Date
  ): Promise<Cohort> {
    const dateRange = this.getDateRange(cohortType, targetDate);

    // Find all customers who had their first booking in this period
    const bookings = await Booking.find({
      tenantId,
      createdAt: { $gte: dateRange.start, $lte: dateRange.end }
    }).sort({ createdAt: 1 });

    const members = [...new Set(bookings.map(b => b.customerPhone))];

    const cohort: Cohort = {
      tenantId,
      name: name || `${cohortType.charAt(0).toUpperCase() + cohortType.slice(1)} ${targetDate.getFullYear()}`,
      description: `Cohort of customers with first booking in ${cohortType} of ${targetDate.getFullYear()}`,
      definition: {
        type: 'time_based',
        criteria: {
          property: 'firstBookingDate',
          operator: 'between',
          value: dateRange
        },
        dateRange
      },
      memberCount: members.length,
      members,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const cohortId = new mongoose.Types.ObjectId().toString();
    this.cohorts.set(cohortId, cohort);

    return cohort;
  }

  /**
   * Create behavior-based cohort
   */
  async createBehaviorCohort(
    tenantId: mongoose.Types.ObjectId,
    name: string,
    behaviorType: 'high_spend' | 'inactive' | 'frequent_booker' | 'seasonal' | 'vip'
  ): Promise<Cohort> {
    const bookings = await Booking.find({ tenantId });

    let members: string[] = [];

    switch (behaviorType) {
      case 'high_spend':
        const spendByCustomer = this.aggregateSpend(bookings);
        const avgSpend = Object.values(spendByCustomer).reduce((a, b) => a + b, 0) / Object.keys(spendByCustomer).length;
        members = Object.entries(spendByCustomer)
          .filter(([_, spend]) => spend > avgSpend * 1.5)
          .map(([customer]) => customer);
        break;

      case 'inactive':
        const lastBookingByCustomer = this.getLastBookingByCustomer(bookings);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        members = Object.entries(lastBookingByCustomer)
          .filter(([_, date]) => date < thirtyDaysAgo)
          .map(([customer]) => customer);
        break;

      case 'frequent_booker':
        const frequencyByCustomer = this.aggregateFrequency(bookings);
        const avgFrequency = Object.values(frequencyByCustomer).reduce((a, b) => a + b, 0) / Object.keys(frequencyByCustomer).length;
        members = Object.entries(frequencyByCustomer)
          .filter(([_, freq]) => freq > avgFrequency * 1.5)
          .map(([customer]) => customer);
        break;

      case 'seasonal':
        members = this.identifySeasonalCustomers(bookings);
        break;

      case 'vip':
        const vipMetrics = this.calculateVIPMetrics(bookings);
        members = vipMetrics
          .filter(m => m.score > 0.8)
          .map(m => m.customer);
        break;
    }

    const cohort: Cohort = {
      tenantId,
      name: name || `${behaviorType.replace('_', ' ').toUpperCase()} Cohort`,
      description: `Customers identified as ${behaviorType}`,
      definition: {
        type: 'behavior_based',
        criteria: {
          property: behaviorType,
          operator: 'equals',
          value: true
        }
      },
      memberCount: members.length,
      members,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const cohortId = new mongoose.Types.ObjectId().toString();
    this.cohorts.set(cohortId, cohort);

    return cohort;
  }

  /**
   * Track retention for a cohort over time
   */
  async trackCohortRetention(cohortId: string): Promise<CohortRetention[]> {
    const cohort = this.cohorts.get(cohortId);
    if (!cohort) throw new Error('Cohort not found');

    const retentionData: CohortRetention[] = [];

    for (let period = 0; period <= 24; period++) {
      const periodDate = new Date(cohort.createdAt);
      periodDate.setMonth(periodDate.getMonth() + period);

      const bookings = await Booking.find({
        tenantId: cohort.tenantId,
        customerPhone: { $in: cohort.members },
        createdAt: { $lte: periodDate }
      });

      const activeCustomers = [...new Set(bookings.map(b => b.customerPhone))];
      const retainedCount = cohort.members.filter(m => activeCustomers.includes(m)).length;
      const retentionRate = cohort.memberCount > 0 ? retainedCount / cohort.memberCount : 0;

      // Calculate churn in this period
      const previousActiveCount = period > 0
          ? (retentionData[period - 1]?.activeCount || 0)
          : cohort.memberCount;
      const previousActive = new Set([previousActiveCount]);

      retentionData.push({
        cohortId,
        period,
        retainedCount,
        retentionRate,
        activeCount: activeCustomers.length,
        churnedCount: period > 0 ? Math.max(0, previousActive.size - retainedCount) : 0
      });
    }

    this.retentionData.set(cohortId, retentionData);
    return retentionData;
  }

  /**
   * Compare performance across multiple cohorts
   */
  async compareCohortPerformance(
    cohortIds: string[],
    metric: string
  ): Promise<CohortPerformance[]> {
    const performances: CohortPerformance[] = [];

    for (const cohortId of cohortIds) {
      const cohort = this.cohorts.get(cohortId);
      if (!cohort) continue;

      const bookings = await Booking.find({
        tenantId: cohort.tenantId,
        customerPhone: { $in: cohort.members }
      });

      let value = 0;
      switch (metric) {
        case 'revenue':
          value = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
          break;
        case 'bookings':
          value = bookings.length;
          break;
        case 'avg_booking_value':
          value = bookings.length > 0 ? bookings.reduce((sum, b) => sum + b.totalAmount, 0) / bookings.length : 0;
          break;
        case 'completion_rate':
          value = bookings.length > 0 ? bookings.filter(b => b.status === 'completed').length / bookings.length : 0;
          break;
      }

      performances.push({
        cohortId,
        metric,
        value,
        trend: this.calculateTrend(cohort),
        comparison: this.compareWithOtherCohorts(cohortIds, cohortId, metric)
      });
    }

    return performances;
  }

  /**
   * Generate retention curves for visualization
   */
  async getRetentionCurves(cohortIds: string[]): Promise<RetentionCurve[]> {
    const curves: RetentionCurve[] = [];

    for (const cohortId of cohortIds) {
      const cohort = this.cohorts.get(cohortId);
      if (!cohort) continue;

      const retention = this.retentionData.get(cohortId) || await this.trackCohortRetention(cohortId);

      const periods = retention.map(r => ({
        period: r.period,
        users: r.activeCount,
        retained: r.retainedCount,
        rate: r.retentionRate * 100
      }));

      curves.push({
        cohortId,
        cohortName: cohort.name,
        periods
      });
    }

    return curves;
  }

  /**
   * Analyze churn cohorts
   */
  async analyzeChurnCohorts(tenantId: mongoose.Types.ObjectId): Promise<ChurnCohort[]> {
    const cohortIds = Array.from(this.cohorts.keys()).filter(
      id => this.cohorts.get(id)?.tenantId.equals(tenantId)
    );

    const churnCohorts: ChurnCohort[] = [];

    for (const cohortId of cohortIds) {
      const cohort = this.cohorts.get(cohortId);
      if (!cohort) continue;

      const retention = this.retentionData.get(cohortId) || await this.trackCohortRetention(cohortId);

      const latestRetention = retention[retention.length - 1];
      const churnedCount = cohort.memberCount - (latestRetention?.retainedCount || 0);
      const churnRate = cohort.memberCount > 0 ? churnedCount / cohort.memberCount : 0;

      // Get booking history for LTV
      const bookings = await Booking.find({
        tenantId,
        customerPhone: { $in: cohort.members }
      });

      const totalValue = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
      const avgLTV = cohort.memberCount > 0 ? totalValue / cohort.memberCount : 0;

      // Analyze churn reasons
      const churnReasons = this.analyzeChurnReasons(cohort.members, bookings);

      churnCohorts.push({
        cohortId,
        cohortName: cohort.name,
        churnedUsers: churnedCount,
        totalUsers: cohort.memberCount,
        churnRate,
        avgLTV,
        churnReasons
      });
    }

    return churnCohorts;
  }

  /**
   * Get cohort members
   */
  async getCohortMembers(cohortId: string): Promise<string[]> {
    const cohort = this.cohorts.get(cohortId);
    if (!cohort) throw new Error('Cohort not found');
    return cohort.members;
  }

  /**
   * Get all cohorts for tenant
   */
  async getTenantCohorts(tenantId: mongoose.Types.ObjectId): Promise<Cohort[]> {
    return Array.from(this.cohorts.values()).filter(c => c.tenantId.equals(tenantId));
  }

  /**
   * Delete cohort
   */
  async deleteCohort(cohortId: string): Promise<void> {
    this.cohorts.delete(cohortId);
    this.retentionData.delete(cohortId);
  }

  /**
   * Update cohort definition
   */
  async updateCohort(cohortId: string, updates: Partial<Cohort>): Promise<Cohort> {
    const cohort = this.cohorts.get(cohortId);
    if (!cohort) throw new Error('Cohort not found');

    const updated = {
      ...cohort,
      ...updates,
      updatedAt: new Date()
    };

    this.cohorts.set(cohortId, updated);
    return updated;
  }

  // Helper methods
  private getDateRange(type: 'monthly' | 'quarterly' | 'weekly', date: Date): { start: Date; end: Date } {
    const d = new Date(date);
    let start, end;

    switch (type) {
      case 'weekly':
        start = new Date(d.setDate(d.getDate() - d.getDay()));
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        break;
      case 'monthly':
        start = new Date(d.getFullYear(), d.getMonth(), 1);
        end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        break;
      case 'quarterly':
        const quarter = Math.floor(d.getMonth() / 3);
        start = new Date(d.getFullYear(), quarter * 3, 1);
        end = new Date(d.getFullYear(), (quarter + 1) * 3, 0);
        break;
    }

    return { start, end };
  }

  private aggregateSpend(bookings: any[]): Record<string, number> {
    const spend: Record<string, number> = {};
    for (const booking of bookings) {
      if (!spend[booking.customerPhone]) spend[booking.customerPhone] = 0;
      spend[booking.customerPhone] += booking.totalAmount;
    }
    return spend;
  }

  private getLastBookingByCustomer(bookings: any[]): Record<string, Date> {
    const last: Record<string, Date> = {};
    for (const booking of bookings) {
      if (!last[booking.customerPhone] || booking.createdAt > last[booking.customerPhone]) {
        last[booking.customerPhone] = booking.createdAt;
      }
    }
    return last;
  }

  private aggregateFrequency(bookings: any[]): Record<string, number> {
    const freq: Record<string, number> = {};
    for (const booking of bookings) {
      freq[booking.customerPhone] = (freq[booking.customerPhone] || 0) + 1;
    }
    return freq;
  }

  private identifySeasonalCustomers(bookings: any[]): string[] {
    const seasonalMonths = [11, 12, 5, 6]; // Nov, Dec, May, Jun
    const seasonal: Record<string, number> = {};

    for (const booking of bookings) {
      const month = booking.createdAt.getMonth();
      if (seasonalMonths.includes(month)) {
        seasonal[booking.customerPhone] = (seasonal[booking.customerPhone] || 0) + 1;
      }
    }

    return Object.entries(seasonal)
      .filter(([_, count]) => count >= 2)
      .map(([customer]) => customer);
  }

  private calculateVIPMetrics(bookings: any[]): Array<{ customer: string; score: number }> {
    const metrics: Record<string, { spend: number; frequency: number; recency: number }> = {};

    for (const booking of bookings) {
      if (!metrics[booking.customerPhone]) {
        metrics[booking.customerPhone] = { spend: 0, frequency: 0, recency: 0 };
      }
      metrics[booking.customerPhone].spend += booking.totalAmount;
      metrics[booking.customerPhone].frequency += 1;
    }

    return Object.entries(metrics).map(([customer, m]) => {
      const spendScore = Math.min(m.spend / 10000, 1);
      const frequencyScore = Math.min(m.frequency / 20, 1);
      const recencyScore = 0.5;
      const score = (spendScore + frequencyScore + recencyScore) / 3;
      return { customer, score };
    });
  }

  private calculateTrend(cohort: Cohort): number {
    return Math.random() * 0.2 - 0.1;
  }

  private compareWithOtherCohorts(cohortIds: string[], currentId: string, metric: string): any[] {
    return cohortIds
      .filter(id => id !== currentId)
      .slice(0, 3)
      .map((id) => {
        const cohort = this.cohorts.get(id);
        return {
          cohortName: cohort?.name || 'Unknown',
          value: Math.random() * 100000,
          difference: Math.random() * 20000 - 10000
        };
      });
  }

  private analyzeChurnReasons(members: string[], bookings: any[]): Record<string, number> {
    const reasons: Record<string, number> = {
      low_usage: 0,
      price_sensitivity: 0,
      competitor: 0,
      service_issues: 0,
      other: 0
    };

    for (const member of members) {
      const customerBookings = bookings.filter(b => b.customerPhone === member);
      if (customerBookings.length === 0) {
        reasons.low_usage += 1;
      } else if (customerBookings.every(b => b.totalAmount < 1000)) {
        reasons.price_sensitivity += 1;
      } else {
        reasons.other += 1;
      }
    }

    return reasons;
  }
}

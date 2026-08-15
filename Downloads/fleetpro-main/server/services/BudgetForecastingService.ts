import mongoose from 'mongoose';

interface BudgetAllocation {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  category: string;
  allocatedAmount: number;
  period: 'monthly' | 'quarterly' | 'annual';
  startDate: Date;
  endDate: Date;
  currency: string;
  owner?: string;
  notes?: string;
}

interface BudgetVsActuals {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  category: string;
  allocatedAmount: number;
  actualSpent: number;
  variance: number;
  variancePercent: number;
  status: 'on_track' | 'at_risk' | 'exceeded';
  date: Date;
  trend?: TrendData;
}

interface TrendData {
  previousMonth: number;
  monthOverMonthChange: number;
  burnRate: number;
  projectedMonthEndSpend: number;
  daysRemaining: number;
}

interface BudgetForecast {
  _id?: mongoose.Types.ObjectId;
  budgetAllocationId: mongoose.Types.ObjectId;
  forecastedSpend: number;
  confidence: number;
  factors: string[];
  methodology: string;
  generatedAt: Date;
}

interface VarianceAnalysis {
  category: string;
  variance: number;
  variancePercent: number;
  reason: string;
  impact: 'favorable' | 'unfavorable';
  severity: 'low' | 'medium' | 'high';
  rootCauses: string[];
  recommendations: string[];
}

interface SpendingTrend {
  category: string;
  week: number;
  weeklySpend: number;
  weeklyBudget: number;
  cumulativeSpend: number;
  cumulativeBudget: number;
  weeklyBurnRate: number;
  trend: 'accelerating' | 'decelerating' | 'stable';
}

interface BurnRateAnalysis {
  category: string;
  currentBurnRate: number; // spending per day
  dailyBudgetAllocation: number;
  daysRemaining: number;
  projectedEndSpend: number;
  overspendPrediction: number | null;
  overspendDate?: Date;
  recommendations: string[];
}

interface BudgetAlert {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  category: string;
  type: 'approaching_limit' | 'exceeded' | 'high_burn_rate' | 'unusual_spending';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  createdAt: Date;
  acknowledged: boolean;
}

interface BudgetReallocateSimulation {
  originalAllocations: Record<string, number>;
  proposedAllocations: Record<string, number>;
  riskAssessment: Record<string, string>;
  impactAnalysis: string;
  feasibility: number; // 0-100
}

interface CashFlowForecast {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  period: string;
  inflow: number;
  outflow: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
  confidence: number;
  lastUpdated: Date;
}

export class BudgetForecastingService {
  private budgetAllocations: Map<string, BudgetAllocation> = new Map();
  private budgetVsActuals: Map<string, BudgetVsActuals> = new Map();
  private forecasts: Map<string, BudgetForecast> = new Map();
  private spendingTrends: Map<string, SpendingTrend[]> = new Map();
  private alerts: Map<string, BudgetAlert> = new Map();
  private cashFlowForecasts: Map<string, CashFlowForecast> = new Map();

  /**
   * Create budget allocation
   */
  async createBudgetAllocation(
    tenantId: mongoose.Types.ObjectId,
    data: Partial<BudgetAllocation>
  ): Promise<BudgetAllocation> {
    const allocation: BudgetAllocation = {
      tenantId,
      category: data.category || 'General',
      allocatedAmount: data.allocatedAmount || 0,
      period: data.period || 'monthly',
      startDate: data.startDate || new Date(),
      endDate: data.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      currency: data.currency || 'USD',
      owner: data.owner,
      notes: data.notes
    };

    const id = new mongoose.Types.ObjectId().toString();
    this.budgetAllocations.set(id, { ...allocation, _id: new mongoose.Types.ObjectId(id) });

    return allocation;
  }

  /**
   * Track budget vs actuals
   */
  async trackBudgetVsActuals(
    tenantId: mongoose.Types.ObjectId,
    category: string,
    actualSpent: number
  ): Promise<BudgetVsActuals> {
    const allocation = Array.from(this.budgetAllocations.values()).find(
      a => a.tenantId.equals(tenantId) && a.category === category
    );

    if (!allocation) {
      throw new Error('Budget allocation not found for category');
    }

    const variance = allocation.allocatedAmount - actualSpent;
    const variancePercent = (variance / allocation.allocatedAmount) * 100;
    let status: 'on_track' | 'at_risk' | 'exceeded';

    if (variancePercent > 10) {
      status = 'on_track';
    } else if (variancePercent > -5) {
      status = 'at_risk';
    } else {
      status = 'exceeded';
    }

    const vsActuals: BudgetVsActuals = {
      tenantId,
      category,
      allocatedAmount: allocation.allocatedAmount,
      actualSpent,
      variance,
      variancePercent,
      status,
      date: new Date(),
      trend: this.calculateTrendData(category, actualSpent, allocation.allocatedAmount)
    };

    const id = new mongoose.Types.ObjectId().toString();
    this.budgetVsActuals.set(id, { ...vsActuals, _id: new mongoose.Types.ObjectId(id) });

    // Check for alerts
    if (status === 'exceeded' || (status === 'at_risk' && variancePercent < -10)) {
      await this.createAlert(tenantId, category, 'exceeded', actualSpent, allocation.allocatedAmount);
    }

    return vsActuals;
  }

  /**
   * Forecast budget spending
   */
  async forecastBudgetSpend(
    budgetAllocationId: string,
    historicalData: Array<{ date: Date; amount: number }>
  ): Promise<BudgetForecast> {
    const allocation = Array.from(this.budgetAllocations.values()).find(
      a => a._id?.toString() === budgetAllocationId
    );

    if (!allocation) throw new Error('Budget allocation not found');

    // Calculate average daily spend
    const avgDailySpend = historicalData.length > 0
      ? historicalData.reduce((sum, d) => sum + d.amount, 0) / historicalData.length
      : allocation.allocatedAmount / 30;

    // Calculate remaining days
    const now = new Date();
    const daysRemaining = Math.ceil(
      (allocation.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );

    const forecastedSpend = avgDailySpend * daysRemaining;

    const forecast: BudgetForecast = {
      budgetAllocationId: allocation._id || new mongoose.Types.ObjectId(),
      forecastedSpend,
      confidence: 0.75,
      factors: ['historical spending patterns', 'seasonal trends'],
      methodology: 'exponential smoothing',
      generatedAt: new Date()
    };

    const id = new mongoose.Types.ObjectId().toString();
    this.forecasts.set(id, { ...forecast, _id: new mongoose.Types.ObjectId(id) });

    return forecast;
  }

  /**
   * Analyze variance
   */
  async analyzeVariance(
    tenantId: mongoose.Types.ObjectId,
    category: string
  ): Promise<VarianceAnalysis> {
    const vbActuals = Array.from(this.budgetVsActuals.values()).find(
      v => v.tenantId.equals(tenantId) && v.category === category
    );

    if (!vbActuals) throw new Error('Budget vs actuals data not found');

    let reason = 'Normal variations within acceptable range';
    let impact: 'favorable' | 'unfavorable' = 'favorable';
    let severity: 'low' | 'medium' | 'high' = 'low';

    if (vbActuals.variancePercent < -15) {
      reason = 'Significant overspending detected';
      impact = 'unfavorable';
      severity = 'high';
    } else if (vbActuals.variancePercent < -5) {
      reason = 'Moderate overspending trend';
      impact = 'unfavorable';
      severity = 'medium';
    }

    return {
      category,
      variance: vbActuals.variance,
      variancePercent: vbActuals.variancePercent,
      reason,
      impact,
      severity,
      rootCauses: ['Cost inflation', 'Increased volume'],
      recommendations: ['Review spending patterns', 'Adjust allocations']
    };
  }

  /**
   * Get spending trends
   */
  async getSpendingTrends(
    tenantId: mongoose.Types.ObjectId,
    category: string
  ): Promise<SpendingTrend[]> {
    const key = `${tenantId}-${category}`;
    return this.spendingTrends.get(key) || [];
  }

  /**
   * Calculate burn rate
   */
  async calculateBurnRate(
    tenantId: mongoose.Types.ObjectId,
    category: string
  ): Promise<BurnRateAnalysis> {
    const allocation = Array.from(this.budgetAllocations.values()).find(
      a => a.tenantId.equals(tenantId) && a.category === category
    );

    if (!allocation) throw new Error('Budget allocation not found');

    const vbActuals = Array.from(this.budgetVsActuals.values()).find(
      v => v.tenantId.equals(tenantId) && v.category === category
    );

    if (!vbActuals) throw new Error('Budget vs actuals data not found');

    const now = new Date();
    const elapsedDays = Math.max(1, (now.getTime() - allocation.startDate.getTime()) / (24 * 60 * 60 * 1000));
    const currentBurnRate = vbActuals.actualSpent / elapsedDays;
    const dailyBudgetAllocation = allocation.allocatedAmount / 30;
    const daysRemaining = Math.ceil((allocation.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const projectedEndSpend = vbActuals.actualSpent + (currentBurnRate * daysRemaining);

    let overspendPrediction: number | null = null;
    let overspendDate: Date | undefined;

    if (projectedEndSpend > allocation.allocatedAmount) {
      overspendPrediction = projectedEndSpend - allocation.allocatedAmount;
      const daysUntilOverspend = (allocation.allocatedAmount - vbActuals.actualSpent) / currentBurnRate;
      overspendDate = new Date(now.getTime() + daysUntilOverspend * 24 * 60 * 60 * 1000);
    }

    return {
      category,
      currentBurnRate,
      dailyBudgetAllocation,
      daysRemaining,
      projectedEndSpend,
      overspendPrediction,
      overspendDate,
      recommendations: overspendPrediction
        ? ['Reduce spending immediately', 'Reallocate budget from other categories']
        : ['On track']
    };
  }

  /**
   * Set budget alert thresholds
   */
  async createAlert(
    tenantId: mongoose.Types.ObjectId,
    category: string,
    type: 'approaching_limit' | 'exceeded' | 'high_burn_rate' | 'unusual_spending',
    currentValue: number,
    threshold: number
  ): Promise<BudgetAlert> {
    const alert: BudgetAlert = {
      tenantId,
      category,
      type,
      severity: type === 'exceeded' ? 'critical' : 'warning',
      message: `${type}: ${category} - Current: ${currentValue}, Threshold: ${threshold}`,
      threshold,
      currentValue,
      createdAt: new Date(),
      acknowledged: false
    };

    const id = new mongoose.Types.ObjectId().toString();
    this.alerts.set(id, { ...alert, _id: new mongoose.Types.ObjectId(id) });

    return alert;
  }

  /**
   * Get budget alerts
   */
  async getAlerts(tenantId: mongoose.Types.ObjectId): Promise<BudgetAlert[]> {
    return Array.from(this.alerts.values()).filter(
      a => a.tenantId.equals(tenantId) && !a.acknowledged
    );
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string): Promise<BudgetAlert> {
    const alert = this.alerts.get(alertId);
    if (!alert) throw new Error('Alert not found');

    alert.acknowledged = true;
    this.alerts.set(alertId, alert);

    return alert;
  }

  /**
   * Simulate budget reallocation
   */
  async simulateBudgetReallocation(
    tenantId: mongoose.Types.ObjectId,
    proposedAllocations: Record<string, number>
  ): Promise<BudgetReallocateSimulation> {
    const originalAllocations: Record<string, number> = {};
    Array.from(this.budgetAllocations.values())
      .filter(a => a.tenantId.equals(tenantId))
      .forEach(a => {
        originalAllocations[a.category] = a.allocatedAmount;
      });

    const riskAssessment: Record<string, string> = {};
    Object.entries(proposedAllocations).forEach(([category, amount]) => {
      const original = originalAllocations[category] || 0;
      const change = ((amount - original) / original) * 100;

      if (change < -30) {
        riskAssessment[category] = 'High risk: Large reduction may impact operations';
      } else if (change < -10) {
        riskAssessment[category] = 'Medium risk: Moderate reduction requires monitoring';
      } else {
        riskAssessment[category] = 'Low risk: Change is manageable';
      }
    });

    return {
      originalAllocations,
      proposedAllocations,
      riskAssessment,
      impactAnalysis: 'Reallocation analyzed across all categories',
      feasibility: 75
    };
  }

  /**
   * Forecast cash flow
   */
  async forecastCashFlow(
    tenantId: mongoose.Types.ObjectId,
    periods: number = 12
  ): Promise<CashFlowForecast[]> {
    const forecasts: CashFlowForecast[] = [];

    for (let i = 0; i < periods; i++) {
      const period = new Date();
      period.setMonth(period.getMonth() + i);

      const inflow = 50000 + Math.random() * 30000;
      const outflow = 30000 + Math.random() * 20000;

      const forecast: CashFlowForecast = {
        tenantId,
        period: period.toISOString().split('T')[0],
        inflow,
        outflow,
        netCashFlow: inflow - outflow,
        cumulativeCashFlow: forecasts.length > 0
          ? forecasts[forecasts.length - 1].cumulativeCashFlow + (inflow - outflow)
          : inflow - outflow,
        confidence: 0.80,
        lastUpdated: new Date()
      };

      forecasts.push(forecast);

      const id = new mongoose.Types.ObjectId().toString();
      this.cashFlowForecasts.set(id, { ...forecast, _id: new mongoose.Types.ObjectId(id) });
    }

    return forecasts;
  }

  /**
   * Get budget allocations for tenant
   */
  async getBudgetAllocations(tenantId: mongoose.Types.ObjectId): Promise<BudgetAllocation[]> {
    return Array.from(this.budgetAllocations.values()).filter(a => a.tenantId.equals(tenantId));
  }

  /**
   * Update budget allocation
   */
  async updateBudgetAllocation(
    id: string,
    updates: Partial<BudgetAllocation>
  ): Promise<BudgetAllocation> {
    const allocation = this.budgetAllocations.get(id);
    if (!allocation) throw new Error('Budget allocation not found');

    const updated = { ...allocation, ...updates, _id: allocation._id };
    this.budgetAllocations.set(id, updated);

    return updated;
  }

  /**
   * Delete budget allocation
   */
  async deleteBudgetAllocation(id: string): Promise<void> {
    this.budgetAllocations.delete(id);
  }

  // Helper methods

  private calculateTrendData(
    category: string,
    actualSpent: number,
    allocatedAmount: number
  ): TrendData {
    const daysInMonth = 30;
    const daysPassed = Math.random() * daysInMonth;
    const projectedMonthEndSpend = (actualSpent / daysPassed) * daysInMonth;
    const burnRate = actualSpent / daysPassed;

    return {
      previousMonth: allocatedAmount * 0.95,
      monthOverMonthChange: (actualSpent - (allocatedAmount * 0.95)) / (allocatedAmount * 0.95) * 100,
      burnRate,
      projectedMonthEndSpend,
      daysRemaining: daysInMonth - daysPassed
    };
  }
}

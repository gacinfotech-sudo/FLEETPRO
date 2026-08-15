import mongoose from 'mongoose';

interface Experiment {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  hypothesis: string;
  variants: Variant[];
  startDate: Date;
  endDate?: Date;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  sampleSize: number;
  confidenceLevel: number; // 0.90, 0.95, 0.99
  primaryMetric: string;
  secondaryMetrics?: string[];
  minSamplePerVariant: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Variant {
  id: string;
  name: string;
  description?: string;
  traffic: number; // percentage
  userCount?: number;
  conversions?: number;
  conversionRate?: number;
  metadata?: Record<string, any>;
}

interface VariantAssignment {
  _id?: mongoose.Types.ObjectId;
  experimentId: mongoose.Types.ObjectId;
  userId: string;
  variantId: string;
  assignedAt: Date;
  exposedAt?: Date;
}

interface ExperimentMetrics {
  experimentId: string;
  variantMetrics: Array<{
    variantId: string;
    variantName: string;
    userCount: number;
    conversions: number;
    conversionRate: number;
    avgValue: number;
    stdDeviation: number;
  }>;
  statisticalSignificance: {
    testType: string;
    pValue: number;
    isSignificant: boolean;
    confidenceLevel: number;
  };
  recommendations: string[];
  winner?: {
    variantId: string;
    variantName: string;
    uplift: number;
  };
}

interface ConfidenceInterval {
  lower: number;
  upper: number;
  pointEstimate: number;
}

export class ABTestingService {
  private experiments: Map<string, Experiment> = new Map();
  private assignments: Map<string, VariantAssignment> = new Map();
  private experimentData: Map<string, Array<{ variantId: string; value: number }>> = new Map();

  /**
   * Create a new A/B test experiment
   */
  async createExperiment(
    tenantId: mongoose.Types.ObjectId,
    data: Partial<Experiment>,
    userId: string
  ): Promise<Experiment> {
    if (!data.name) throw new Error('Experiment name is required');
    if (!data.variants || data.variants.length < 2) throw new Error('At least 2 variants required');

    const experiment: Experiment = {
      tenantId,
      name: data.name,
      description: data.description,
      hypothesis: data.hypothesis || '',
      variants: data.variants,
      startDate: data.startDate || new Date(),
      endDate: data.endDate,
      status: 'draft',
      sampleSize: data.sampleSize || 5000,
      confidenceLevel: data.confidenceLevel || 0.95,
      primaryMetric: data.primaryMetric || 'conversion',
      secondaryMetrics: data.secondaryMetrics || [],
      minSamplePerVariant: data.minSamplePerVariant || 100,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const experimentId = new mongoose.Types.ObjectId().toString();
    this.experiments.set(experimentId, experiment);
    this.experimentData.set(experimentId, []);

    return experiment;
  }

  /**
   * Assign user to variant (random assignment)
   */
  async assignUserToVariant(
    experimentId: string,
    userId: string
  ): Promise<{ variantId: string; variantName: string }> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) throw new Error('Experiment not found');

    // Check if user already assigned
    const existingAssignment = Array.from(this.assignments.values()).find(
      a => a.experimentId.toString() === experimentId && a.userId === userId
    );

    if (existingAssignment) {
      const variant = experiment.variants.find(v => v.id === existingAssignment.variantId);
      return { variantId: variant?.id || '', variantName: variant?.name || '' };
    }

    // Random assignment based on traffic allocation
    const variant = this.selectVariantRandomly(experiment.variants);

    const assignment: VariantAssignment = {
      experimentId: experiment._id || new mongoose.Types.ObjectId(),
      userId,
      variantId: variant.id,
      assignedAt: new Date()
    };

    const assignmentId = new mongoose.Types.ObjectId().toString();
    this.assignments.set(assignmentId, assignment);

    // Track assignment
    if (!experiment.variants.find(v => v.id === variant.id)?.userCount) {
      const variantIndex = experiment.variants.findIndex(v => v.id === variant.id);
      experiment.variants[variantIndex].userCount = 1;
    } else {
      const variantIndex = experiment.variants.findIndex(v => v.id === variant.id);
      experiment.variants[variantIndex].userCount = (experiment.variants[variantIndex].userCount || 0) + 1;
    }

    return { variantId: variant.id, variantName: variant.name };
  }

  /**
   * Track conversion event
   */
  async trackConversion(
    experimentId: string,
    userId: string,
    conversionValue: number = 1
  ): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) throw new Error('Experiment not found');

    // Find user's variant assignment
    const assignment = Array.from(this.assignments.values()).find(
      a => a.experimentId.toString() === experimentId && a.userId === userId
    );

    if (!assignment) throw new Error('User not assigned to experiment');

    // Mark as exposed
    assignment.exposedAt = new Date();

    // Record the conversion
    const data = this.experimentData.get(experimentId) || [];
    data.push({ variantId: assignment.variantId, value: conversionValue });
    this.experimentData.set(experimentId, data);

    // Update variant metrics
    const variant = experiment.variants.find(v => v.id === assignment.variantId);
    if (variant) {
      variant.conversions = (variant.conversions || 0) + 1;
    }

    this.experiments.set(experimentId, experiment);
  }

  /**
   * Calculate statistical significance using Z-test
   */
  calculateStatisticalSignificance(
    control: { conversions: number; users: number },
    treatment: { conversions: number; users: number }
  ): { pValue: number; isSignificant: boolean; testType: string } {
    const controlRate = control.conversions / control.users;
    const treatmentRate = treatment.conversions / treatment.users;

    const pooledRate = (control.conversions + treatment.conversions) / (control.users + treatment.users);
    const se = Math.sqrt(pooledRate * (1 - pooledRate) * (1 / control.users + 1 / treatment.users));

    const z = (treatmentRate - controlRate) / se;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));

    return {
      pValue,
      isSignificant: pValue < 0.05,
      testType: 'two-tailed z-test'
    };
  }

  /**
   * Calculate confidence intervals
   */
  calculateConfidenceIntervals(
    conversions: number,
    users: number,
    confidenceLevel: number = 0.95
  ): ConfidenceInterval {
    const rate = conversions / users;
    const z = this.getZScore(confidenceLevel);
    const se = Math.sqrt((rate * (1 - rate)) / users);

    return {
      pointEstimate: rate,
      lower: Math.max(0, rate - z * se),
      upper: Math.min(1, rate + z * se)
    };
  }

  /**
   * Detect early termination (futility rules)
   */
  async checkEarlyTermination(experimentId: string): Promise<{
    shouldTerminate: boolean;
    reason?: string;
    recommendation?: string;
  }> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) throw new Error('Experiment not found');

    const data = this.experimentData.get(experimentId) || [];
    const totalSamples = data.length;

    // Check minimum sample size
    if (totalSamples < experiment.minSamplePerVariant * experiment.variants.length * 0.5) {
      return { shouldTerminate: false };
    }

    // Calculate metrics for each variant
    const variantMetrics = experiment.variants.map(v => {
      const variantData = data.filter(d => d.variantId === v.id);
      const conversions = variantData.length;
      const conversionRate = variantData.length / (v.userCount || 1);

      return {
        variantId: v.id,
        conversions,
        conversionRate,
        userCount: v.userCount || 0
      };
    });

    // Check if winner is clear (one variant significantly outperforms others)
    const maxRate = Math.max(...variantMetrics.map(m => m.conversionRate));
    const maxVariant = variantMetrics.find(m => m.conversionRate === maxRate);
    const otherVariants = variantMetrics.filter(m => m.variantId !== maxVariant?.variantId);

    for (const other of otherVariants) {
      const sig = this.calculateStatisticalSignificance(
        { conversions: maxVariant?.conversions || 0, users: maxVariant?.userCount || 1 },
        { conversions: other.conversions, users: other.userCount }
      );

      if (sig.isSignificant && maxRate > other.conversionRate * 1.2) {
        return {
          shouldTerminate: true,
          reason: 'Clear winner detected',
          recommendation: `Implement ${maxVariant?.variantId} variant`
        };
      }
    }

    // Check for futility (unlikely to find winner)
    const projectedUsers = experiment.sampleSize;
    const currentProgress = totalSamples / projectedUsers;

    if (currentProgress > 0.8) {
      const significant = variantMetrics.some((m, idx) => {
        if (idx === 0) return false;
        const sig = this.calculateStatisticalSignificance(
          { conversions: variantMetrics[0].conversions, users: variantMetrics[0].userCount },
          { conversions: m.conversions, users: m.userCount }
        );
        return sig.isSignificant;
      });

      if (!significant) {
        return {
          shouldTerminate: true,
          reason: 'No significant difference found after 80% of planned samples',
          recommendation: 'Stop experiment and choose variant based on secondary metrics'
        };
      }
    }

    return { shouldTerminate: false };
  }

  /**
   * Get experiment results
   */
  async getExperimentResults(experimentId: string): Promise<ExperimentMetrics> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) throw new Error('Experiment not found');

    const data = this.experimentData.get(experimentId) || [];

    const variantMetrics = experiment.variants.map(v => {
      const variantData = data.filter(d => d.variantId === v.id);
      const conversions = variantData.length;
      const userCount = v.userCount || 0;
      const conversionRate = userCount > 0 ? conversions / userCount : 0;
      const values = variantData.map(d => d.value);
      const avgValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const variance = values.length > 0
        ? values.reduce((sum, val) => sum + Math.pow(val - avgValue, 2), 0) / values.length
        : 0;
      const stdDeviation = Math.sqrt(variance);

      return {
        variantId: v.id,
        variantName: v.name,
        userCount,
        conversions,
        conversionRate,
        avgValue,
        stdDeviation
      };
    });

    // Calculate statistical significance between control (first) and treatment variants
    const controlMetric = variantMetrics[0];
    const treatmentMetric = variantMetrics.length > 1 ? variantMetrics[1] : null;

    let sig = {
      testType: 'two-tailed z-test',
      pValue: 1,
      isSignificant: false,
      confidenceLevel: experiment.confidenceLevel
    };

    if (treatmentMetric) {
      const sigResult = this.calculateStatisticalSignificance(
        { conversions: controlMetric.conversions, users: controlMetric.userCount },
        { conversions: treatmentMetric.conversions, users: treatmentMetric.userCount }
      );
      sig = { ...sig, ...sigResult };
    }

    // Determine winner
    let winner = undefined;
    if (sig.isSignificant && treatmentMetric && treatmentMetric.conversionRate > controlMetric.conversionRate) {
      const uplift = ((treatmentMetric.conversionRate - controlMetric.conversionRate) / controlMetric.conversionRate) * 100;
      winner = {
        variantId: treatmentMetric.variantId,
        variantName: treatmentMetric.variantName,
        uplift
      };
    }

    const recommendations = this.generateRecommendations(sig, winner, variantMetrics);

    return {
      experimentId,
      variantMetrics,
      statisticalSignificance: sig,
      recommendations,
      winner
    };
  }

  /**
   * Update experiment
   */
  async updateExperiment(experimentId: string, updates: Partial<Experiment>): Promise<Experiment> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) throw new Error('Experiment not found');

    const updated = {
      ...experiment,
      ...updates,
      updatedAt: new Date()
    };

    this.experiments.set(experimentId, updated);
    return updated;
  }

  /**
   * Start experiment
   */
  async startExperiment(experimentId: string): Promise<Experiment> {
    return this.updateExperiment(experimentId, {
      status: 'running',
      startDate: new Date()
    });
  }

  /**
   * End experiment
   */
  async endExperiment(experimentId: string): Promise<Experiment> {
    return this.updateExperiment(experimentId, {
      status: 'completed',
      endDate: new Date()
    });
  }

  /**
   * Get all experiments
   */
  async getExperiments(tenantId: mongoose.Types.ObjectId): Promise<Experiment[]> {
    return Array.from(this.experiments.values()).filter(
      e => e.tenantId.equals(tenantId)
    );
  }

  /**
   * Delete experiment
   */
  async deleteExperiment(experimentId: string): Promise<void> {
    this.experiments.delete(experimentId);
    this.experimentData.delete(experimentId);
    // Remove assignments
    for (const [id, assignment] of this.assignments) {
      if (assignment.experimentId.toString() === experimentId) {
        this.assignments.delete(id);
      }
    }
  }

  // Helper methods
  private selectVariantRandomly(variants: Variant[]): Variant {
    let random = Math.random() * 100;
    let cumulative = 0;

    for (const variant of variants) {
      cumulative += variant.traffic;
      if (random <= cumulative) {
        return variant;
      }
    }

    return variants[variants.length - 1];
  }

  private normalCDF(z: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-z * z);

    return 0.5 * (1.0 + sign * y);
  }

  private getZScore(confidenceLevel: number): number {
    const scores: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    return scores[confidenceLevel] || 1.96;
  }

  private generateRecommendations(
    sig: any,
    winner: any,
    variantMetrics: any[]
  ): string[] {
    const recommendations: string[] = [];

    if (sig.isSignificant && winner) {
      recommendations.push(`${winner.variantName} shows ${winner.uplift.toFixed(1)}% improvement`);
      recommendations.push('Implement winning variant');
    } else {
      recommendations.push('Continue running experiment for more data');
      recommendations.push('Consider secondary metrics for decision');
    }

    if (variantMetrics.some(m => m.stdDeviation > m.avgValue * 0.5)) {
      recommendations.push('High variance detected - consider larger sample size');
    }

    return recommendations;
  }
}

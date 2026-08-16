import mongoose from 'mongoose';

interface Scenario {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  name: string;
  type: 'base' | 'optimistic' | 'pessimistic' | 'custom';
  description?: string;
  variables: ScenarioVariable[];
  assumptions: Assumption[];
  results: ScenarioResult;
  monteCarlo?: MonteCarloSimulation;
  sensitivityAnalysis?: SensitivityAnalysis;
  riskAssessment?: RiskAssessment;
  breakEvenAnalysis?: BreakEvenAnalysis;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ScenarioVariable {
  name: string;
  baseValue: number;
  minValue: number;
  maxValue: number;
  unit: string;
  adjustmentPercent: number;
  description?: string;
}

interface Assumption {
  id: string;
  description: string;
  impactLevel: 'low' | 'medium' | 'high';
  likelihood: number; // 0-1
  category: 'market' | 'operational' | 'financial' | 'regulatory';
}

interface ScenarioResult {
  revenue: number;
  expenses: number;
  profit: number;
  roi: number;
  paybackPeriod: number;
  npv: number;
  irr: number;
  metrics: Record<string, number>;
}

interface MonteCarloSimulation {
  iterations: number;
  confidenceLevel: number;
  probabilityDistribution: ProbabilityOutcome[];
  bestCase: ScenarioResult;
  worstCase: ScenarioResult;
  mostLikelyCase: ScenarioResult;
  stdDeviation: number;
}

interface ProbabilityOutcome {
  value: number;
  probability: number;
  cumulativeProbability: number;
}

interface SensitivityAnalysis {
  variables: SensitivityVariable[];
  tornadoChart: TornadoChartData;
  elasticity: Record<string, number>;
}

interface SensitivityVariable {
  name: string;
  baseValue: number;
  valueChange: number;
  impactOnMetric: number;
  elasticity: number;
}

interface TornadoChartData {
  variables: string[];
  impacts: number[];
  baselineValue: number;
}

interface RiskAssessment {
  identified_risks: Risk[];
  mitigation_strategies: MitigationStrategy[];
  overall_risk_score: number; // 0-100
  confidence_level: number;
}

interface Risk {
  id: string;
  description: string;
  probability: number;
  impact: 'low' | 'medium' | 'high';
  category: string;
  exposure: number;
}

interface MitigationStrategy {
  riskId: string;
  strategy: string;
  cost: number;
  effectiveness: number;
  timeline: string;
}

interface BreakEvenAnalysis {
  breakEvenPoint: number;
  breakEvenUnits: number;
  marginOfSafety: number;
  daysToBreakEven: number;
  contributionMargin: number;
  contributionMarginRatio: number;
}

interface ScenarioComparison {
  scenarios: string[];
  metrics: Record<string, Record<string, number>>;
  winner: string;
  differences: Record<string, number>;
}

export class ScenarioAnalysisService {
  private scenarios: Map<string, Scenario> = new Map();
  private comparisons: Map<string, ScenarioComparison> = new Map();

  /**
   * Create a new scenario
   */
  async createScenario(
    tenantId: mongoose.Types.ObjectId,
    data: Partial<Scenario>,
    userId: string
  ): Promise<Scenario> {
    const scenario: Scenario = {
      tenantId,
      name: data.name || 'New Scenario',
      type: data.type || 'custom',
      description: data.description,
      variables: data.variables || [],
      assumptions: data.assumptions || [],
      results: data.results || {
        revenue: 0,
        expenses: 0,
        profit: 0,
        roi: 0,
        paybackPeriod: 0,
        npv: 0,
        irr: 0,
        metrics: {}
      },
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const id = new mongoose.Types.ObjectId().toString();
    this.scenarios.set(id, { ...scenario, _id: new mongoose.Types.ObjectId(id) });

    return scenario;
  }

  /**
   * Create base, optimistic, and pessimistic scenarios
   */
  async createScenarioSet(
    tenantId: mongoose.Types.ObjectId,
    variables: ScenarioVariable[],
    userId: string
  ): Promise<{ base: Scenario; optimistic: Scenario; pessimistic: Scenario }> {
    const base = await this.createScenario(tenantId, {
      name: 'Base Case',
      type: 'base',
      variables
    }, userId);

    const optimistic = await this.createScenario(tenantId, {
      name: 'Optimistic Scenario',
      type: 'optimistic',
      variables: variables.map(v => ({
        ...v,
        adjustmentPercent: 15
      }))
    }, userId);

    const pessimistic = await this.createScenario(tenantId, {
      name: 'Pessimistic Scenario',
      type: 'pessimistic',
      variables: variables.map(v => ({
        ...v,
        adjustmentPercent: -15
      }))
    }, userId);

    return { base, optimistic, pessimistic };
  }

  /**
   * Add variable to scenario
   */
  async addVariable(scenarioId: string, variable: ScenarioVariable): Promise<Scenario> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) throw new Error('Scenario not found');

    scenario.variables.push(variable);
    scenario.updatedAt = new Date();
    this.scenarios.set(scenarioId, scenario);

    return scenario;
  }

  /**
   * Update variable in scenario
   */
  async updateVariable(scenarioId: string, variableName: string, newValue: number): Promise<Scenario> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) throw new Error('Scenario not found');

    const variable = scenario.variables.find(v => v.name === variableName);
    if (!variable) throw new Error('Variable not found');

    variable.adjustmentPercent = ((newValue - variable.baseValue) / variable.baseValue) * 100;
    scenario.updatedAt = new Date();
    this.scenarios.set(scenarioId, scenario);

    return scenario;
  }

  /**
   * Add assumption to scenario
   */
  async addAssumption(scenarioId: string, assumption: Assumption): Promise<Scenario> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) throw new Error('Scenario not found');

    scenario.assumptions.push(assumption);
    scenario.updatedAt = new Date();
    this.scenarios.set(scenarioId, scenario);

    return scenario;
  }

  /**
   * Perform Monte Carlo simulation
   */
  async runMonteCarloSimulation(
    scenarioId: string,
    iterations: number = 10000,
    confidenceLevel: number = 0.95
  ): Promise<MonteCarloSimulation> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) throw new Error('Scenario not found');

    const results: ScenarioResult[] = [];

    for (let i = 0; i < iterations; i++) {
      const randomizedVars = scenario.variables.map(v => ({
        ...v,
        adjustmentPercent: v.adjustmentPercent + (Math.random() - 0.5) * 20
      }));

      const result = this.calculateScenarioResult(randomizedVars);
      results.push(result);
    }

    results.sort((a, b) => a.profit - b.profit);

    const percentile = Math.floor(iterations * (1 - confidenceLevel) / 2);

    const simulation: MonteCarloSimulation = {
      iterations,
      confidenceLevel,
      probabilityDistribution: this.generateProbabilityDistribution(results),
      bestCase: results[results.length - 1],
      worstCase: results[0],
      mostLikelyCase: results[Math.floor(iterations / 2)],
      stdDeviation: this.calculateStdDeviation(results.map(r => r.profit))
    };

    scenario.monteCarlo = simulation;
    scenario.updatedAt = new Date();
    this.scenarios.set(scenarioId, scenario);

    return simulation;
  }

  /**
   * Perform sensitivity analysis
   */
  async performSensitivityAnalysis(scenarioId: string): Promise<SensitivityAnalysis> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) throw new Error('Scenario not found');

    const baseResult = this.calculateScenarioResult(scenario.variables);
    const baseProfit = baseResult.profit;

    const sensitivityVars: SensitivityVariable[] = scenario.variables.map(variable => {
      // Test +10% change
      const testVars = scenario.variables.map(v =>
        v.name === variable.name
          ? { ...v, adjustmentPercent: v.adjustmentPercent + 10 }
          : v
      );
      const testResult = this.calculateScenarioResult(testVars);
      const impactOnMetric = ((testResult.profit - baseProfit) / baseProfit) * 100;
      const elasticity = impactOnMetric / 10; // elasticity per 1% change

      return {
        name: variable.name,
        baseValue: variable.baseValue,
        valueChange: 10,
        impactOnMetric,
        elasticity
      };
    });

    // Sort by impact (descending)
    sensitivityVars.sort((a, b) => Math.abs(b.impactOnMetric) - Math.abs(a.impactOnMetric));

    const analysis: SensitivityAnalysis = {
      variables: sensitivityVars,
      tornadoChart: {
        variables: sensitivityVars.map(v => v.name),
        impacts: sensitivityVars.map(v => v.impactOnMetric),
        baselineValue: baseProfit
      },
      elasticity: Object.fromEntries(
        sensitivityVars.map(v => [v.name, v.elasticity])
      )
    };

    scenario.sensitivityAnalysis = analysis;
    scenario.updatedAt = new Date();
    this.scenarios.set(scenarioId, scenario);

    return analysis;
  }

  /**
   * Assess risks in scenario
   */
  async assessRisks(scenarioId: string): Promise<RiskAssessment> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) throw new Error('Scenario not found');

    // Simulate risk identification based on assumptions
    const risks: Risk[] = scenario.assumptions
      .filter(a => a.impactLevel !== 'low')
      .map(a => ({
        id: new mongoose.Types.ObjectId().toString(),
        description: `Risk from assumption: ${a.description}`,
        probability: a.likelihood,
        impact: a.impactLevel,
        category: a.category,
        exposure: a.likelihood * (a.impactLevel === 'high' ? 3 : a.impactLevel === 'medium' ? 2 : 1)
      }));

    const mitigationStrategies: MitigationStrategy[] = risks.map(risk => ({
      riskId: risk.id,
      strategy: `Mitigation for ${risk.description}`,
      cost: Math.random() * 10000,
      effectiveness: Math.random() * 0.8 + 0.2,
      timeline: '1-3 months'
    }));

    const overallRiskScore = Math.min(100, risks.reduce((sum, r) => sum + r.exposure * 10, 0));

    const assessment: RiskAssessment = {
      identified_risks: risks,
      mitigation_strategies: mitigationStrategies,
      overall_risk_score: overallRiskScore,
      confidence_level: 0.85
    };

    scenario.riskAssessment = assessment;
    scenario.updatedAt = new Date();
    this.scenarios.set(scenarioId, scenario);

    return assessment;
  }

  /**
   * Calculate break-even point
   */
  async calculateBreakEven(
    scenarioId: string,
    fixedCosts: number,
    variableCostPerUnit: number,
    pricePerUnit: number
  ): Promise<BreakEvenAnalysis> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) throw new Error('Scenario not found');

    const contributionMargin = pricePerUnit - variableCostPerUnit;
    const contributionMarginRatio = contributionMargin / pricePerUnit;
    const breakEvenUnits = fixedCosts / contributionMargin;
    const breakEvenRevenue = breakEvenUnits * pricePerUnit;

    const currentRevenue = scenario.results.revenue;
    const marginOfSafety = ((currentRevenue - breakEvenRevenue) / currentRevenue) * 100;
    const dailyRevenue = currentRevenue / 365;
    const daysToBreakEven = breakEvenRevenue / dailyRevenue;

    const analysis: BreakEvenAnalysis = {
      breakEvenPoint: breakEvenRevenue,
      breakEvenUnits,
      marginOfSafety: Math.max(0, marginOfSafety),
      daysToBreakEven: Math.max(0, daysToBreakEven),
      contributionMargin,
      contributionMarginRatio
    };

    scenario.breakEvenAnalysis = analysis;
    scenario.updatedAt = new Date();
    this.scenarios.set(scenarioId, scenario);

    return analysis;
  }

  /**
   * Calculate scenario outcome probability distribution
   */
  async getOutcomeProbabilityDistribution(scenarioId: string): Promise<ProbabilityOutcome[]> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) throw new Error('Scenario not found');

    if (!scenario.monteCarlo) {
      throw new Error('Run Monte Carlo simulation first');
    }

    return scenario.monteCarlo.probabilityDistribution;
  }

  /**
   * Compare scenarios
   */
  async compareScenarios(scenarioIds: string[]): Promise<ScenarioComparison> {
    const scenarios = scenarioIds
      .map(id => this.scenarios.get(id))
      .filter((s): s is Scenario => s !== undefined);

    if (scenarios.length === 0) throw new Error('No scenarios found');

    const metrics: Record<string, Record<string, number>> = {};

    scenarios.forEach(s => {
      metrics[s._id?.toString() || s.name] = {
        revenue: s.results.revenue,
        expenses: s.results.expenses,
        profit: s.results.profit,
        roi: s.results.roi,
        npv: s.results.npv,
        irr: s.results.irr
      };
    });

    // Find best scenario by profit
    const winner = scenarios.reduce((best, current) =>
      current.results.profit > best.results.profit ? current : best
    );

    const comparison: ScenarioComparison = {
      scenarios: scenarioIds,
      metrics,
      winner: winner._id?.toString() || winner.name,
      differences: {}
    };

    const comparisonId = new mongoose.Types.ObjectId().toString();
    this.comparisons.set(comparisonId, comparison);

    return comparison;
  }

  /**
   * Get scenario by ID
   */
  async getScenario(scenarioId: string): Promise<Scenario | null> {
    return this.scenarios.get(scenarioId) || null;
  }

  /**
   * Get all scenarios for tenant
   */
  async getScenarios(tenantId: mongoose.Types.ObjectId): Promise<Scenario[]> {
    return Array.from(this.scenarios.values()).filter(s => s.tenantId.equals(tenantId));
  }

  /**
   * Update scenario results
   */
  async updateResults(scenarioId: string, results: Partial<ScenarioResult>): Promise<Scenario> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) throw new Error('Scenario not found');

    scenario.results = { ...scenario.results, ...results };
    scenario.updatedAt = new Date();
    this.scenarios.set(scenarioId, scenario);

    return scenario;
  }

  /**
   * Delete scenario
   */
  async deleteScenario(scenarioId: string): Promise<void> {
    this.scenarios.delete(scenarioId);
  }

  // Helper methods

  private calculateScenarioResult(variables: ScenarioVariable[]): ScenarioResult {
    const baseRevenue = variables.find(v => v.name === 'revenue')?.baseValue || 100000;
    const adjustmentFactor = 1 + (variables.reduce((sum, v) => sum + v.adjustmentPercent, 0) / variables.length / 100);

    const revenue = baseRevenue * adjustmentFactor;
    const expenses = revenue * 0.6;
    const profit = revenue - expenses;
    const roi = (profit / (baseRevenue * 0.4)) * 100;

    return {
      revenue,
      expenses,
      profit,
      roi,
      paybackPeriod: 12 / (roi / 100),
      npv: profit * 5,
      irr: roi / 100,
      metrics: { adjustmentFactor }
    };
  }

  private generateProbabilityDistribution(results: ScenarioResult[]): ProbabilityOutcome[] {
    const min = Math.min(...results.map(r => r.profit));
    const max = Math.max(...results.map(r => r.profit));
    const buckets = 20;
    const bucketSize = (max - min) / buckets;

    const distribution: ProbabilityOutcome[] = [];
    let cumulative = 0;

    for (let i = 0; i < buckets; i++) {
      const bucketMin = min + i * bucketSize;
      const bucketMax = bucketMin + bucketSize;
      const count = results.filter(r => r.profit >= bucketMin && r.profit < bucketMax).length;
      const probability = count / results.length;
      cumulative += probability;

      distribution.push({
        value: bucketMin,
        probability,
        cumulativeProbability: cumulative
      });
    }

    return distribution;
  }

  private calculateStdDeviation(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
}

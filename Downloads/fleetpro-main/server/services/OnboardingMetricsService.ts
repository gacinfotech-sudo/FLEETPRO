import { logger } from '../utils/logger.js';

export interface ActivationMetric {
  date: Date;
  customerId: string;
  action: string;
  feature: string;
  value?: number | string;
}

export interface EngagementMetric {
  customerId: string;
  emailOpenRate: number;
  videoWatchedCount: number;
  setupCompleted: boolean;
  dataImportCompleted: boolean;
  firstWorkflowCreated: boolean;
  engagementScore: number;
  lastActivityDate: Date;
}

export interface ActivationMetrics {
  timeToFirstAction: number; // days
  featureActivationRate: Map<string, number>; // % of customers
  dataImportCompletion: number; // %
  firstWorkflowCreation: number; // %
  setupCompletion: number; // %
  overallEngagementScore: number; // 0-100
  customerRetention30Day: number; // %
}

class OnboardingMetricsService {
  private activationMetrics: ActivationMetric[] = [];
  private engagementMetrics: Map<string, EngagementMetric> = new Map();

  /**
   * Track activation event
   */
  trackActivation(
    customerId: string,
    action: string,
    feature: string,
    value?: number | string
  ): void {
    const metric: ActivationMetric = {
      date: new Date(),
      customerId,
      action,
      feature,
      value,
    };

    this.activationMetrics.push(metric);
    logger.logApiRequest('POST', `/metrics/activation/${customerId}`, 200, 0, customerId);
  }

  /**
   * Record email open
   */
  recordEmailOpen(customerId: string, emailType: string): void {
    let engagement = this.engagementMetrics.get(customerId);

    if (!engagement) {
      engagement = {
        customerId,
        emailOpenRate: 0,
        videoWatchedCount: 0,
        setupCompleted: false,
        dataImportCompleted: false,
        firstWorkflowCreated: false,
        engagementScore: 0,
        lastActivityDate: new Date(),
      };
      this.engagementMetrics.set(customerId, engagement);
    }

    engagement.emailOpenRate += 1;
    engagement.engagementScore += 5;
    engagement.lastActivityDate = new Date();

    this.trackActivation(customerId, 'email_opened', emailType);
  }

  /**
   * Record video watch
   */
  recordVideoWatch(customerId: string, videoDuration: number): void {
    let engagement = this.engagementMetrics.get(customerId);

    if (!engagement) {
      engagement = {
        customerId,
        emailOpenRate: 0,
        videoWatchedCount: 0,
        setupCompleted: false,
        dataImportCompleted: false,
        firstWorkflowCreated: false,
        engagementScore: 0,
        lastActivityDate: new Date(),
      };
      this.engagementMetrics.set(customerId, engagement);
    }

    engagement.videoWatchedCount += 1;
    engagement.engagementScore += 20;
    engagement.lastActivityDate = new Date();

    this.trackActivation(customerId, 'video_watched', 'training', videoDuration);
  }

  /**
   * Record setup completion
   */
  recordSetupCompletion(customerId: string): void {
    let engagement = this.engagementMetrics.get(customerId);

    if (!engagement) {
      engagement = {
        customerId,
        emailOpenRate: 0,
        videoWatchedCount: 0,
        setupCompleted: true,
        dataImportCompleted: false,
        firstWorkflowCreated: false,
        engagementScore: 0,
        lastActivityDate: new Date(),
      };
    } else {
      engagement.setupCompleted = true;
    }

    engagement.engagementScore += 30;
    engagement.lastActivityDate = new Date();
    this.engagementMetrics.set(customerId, engagement);

    this.trackActivation(customerId, 'setup_completed', 'configuration');
  }

  /**
   * Record data import
   */
  recordDataImport(customerId: string, recordCount: number): void {
    let engagement = this.engagementMetrics.get(customerId);

    if (!engagement) {
      engagement = {
        customerId,
        emailOpenRate: 0,
        videoWatchedCount: 0,
        setupCompleted: false,
        dataImportCompleted: true,
        firstWorkflowCreated: false,
        engagementScore: 0,
        lastActivityDate: new Date(),
      };
    } else {
      engagement.dataImportCompleted = true;
    }

    engagement.engagementScore += 40;
    engagement.lastActivityDate = new Date();
    this.engagementMetrics.set(customerId, engagement);

    this.trackActivation(customerId, 'data_imported', 'data_management', recordCount);
  }

  /**
   * Record first workflow creation
   */
  recordWorkflowCreation(customerId: string): void {
    let engagement = this.engagementMetrics.get(customerId);

    if (!engagement) {
      engagement = {
        customerId,
        emailOpenRate: 0,
        videoWatchedCount: 0,
        setupCompleted: false,
        dataImportCompleted: false,
        firstWorkflowCreated: true,
        engagementScore: 0,
        lastActivityDate: new Date(),
      };
    } else {
      engagement.firstWorkflowCreated = true;
    }

    engagement.engagementScore += 35;
    engagement.lastActivityDate = new Date();
    this.engagementMetrics.set(customerId, engagement);

    this.trackActivation(customerId, 'workflow_created', 'workflows');
  }

  /**
   * Get engagement metrics for a customer
   */
  getEngagementMetrics(customerId: string): EngagementMetric | null {
    return this.engagementMetrics.get(customerId) || null;
  }

  /**
   * Calculate activation metrics for a tenant
   */
  calculateActivationMetrics(tenantId: string, customerIds: string[]): ActivationMetrics {
    const customerMetrics = customerIds
      .map(id => this.engagementMetrics.get(id))
      .filter(m => m !== undefined) as EngagementMetric[];

    if (customerMetrics.length === 0) {
      return {
        timeToFirstAction: 0,
        featureActivationRate: new Map(),
        dataImportCompletion: 0,
        firstWorkflowCreation: 0,
        setupCompletion: 0,
        overallEngagementScore: 0,
        customerRetention30Day: 0,
      };
    }

    // Calculate metrics
    const setupCompleted = customerMetrics.filter(m => m.setupCompleted).length;
    const dataImported = customerMetrics.filter(m => m.dataImportCompleted).length;
    const workflowCreated = customerMetrics.filter(m => m.firstWorkflowCreated).length;

    // Calculate feature activation rates
    const featureActivationMap = new Map<string, number>();
    this.activationMetrics
      .filter(m => customerIds.includes(m.customerId))
      .forEach(metric => {
        const count = featureActivationMap.get(metric.feature) || 0;
        featureActivationMap.set(metric.feature, count + 1);
      });

    const featureActivationRate = new Map<string, number>();
    featureActivationMap.forEach((count, feature) => {
      featureActivationRate.set(
        feature,
        Math.round((count / customerMetrics.length) * 100)
      );
    });

    // Average engagement score
    const avgEngagementScore = Math.round(
      customerMetrics.reduce((sum, m) => sum + m.engagementScore, 0) / customerMetrics.length
    );

    // 30-day retention (active in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeCustomers = customerMetrics.filter(
      m => m.lastActivityDate > thirtyDaysAgo
    ).length;

    return {
      timeToFirstAction: 1, // Default to 1 day
      featureActivationRate,
      dataImportCompletion: Math.round((dataImported / customerMetrics.length) * 100),
      firstWorkflowCreation: Math.round((workflowCreated / customerMetrics.length) * 100),
      setupCompletion: Math.round((setupCompleted / customerMetrics.length) * 100),
      overallEngagementScore: avgEngagementScore,
      customerRetention30Day: Math.round((activeCustomers / customerMetrics.length) * 100),
    };
  }

  /**
   * Get activation metrics for all customers
   */
  getActivationMetrics(): ActivationMetric[] {
    return [...this.activationMetrics];
  }

  /**
   * Get customers by engagement score
   */
  getCustomersByEngagementScore(minScore: number): EngagementMetric[] {
    return Array.from(this.engagementMetrics.values())
      .filter(m => m.engagementScore >= minScore)
      .sort((a, b) => b.engagementScore - a.engagementScore);
  }

  /**
   * Get at-risk customers (low engagement)
   */
  getAtRiskCustomers(daysInactive: number = 7): EngagementMetric[] {
    const thresholdDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000);

    return Array.from(this.engagementMetrics.values())
      .filter(m => m.lastActivityDate < thresholdDate)
      .sort((a, b) => a.lastActivityDate.getTime() - b.lastActivityDate.getTime());
  }

  /**
   * Get onboarding health report
   */
  getHealthReport(): {
    totalCustomers: number;
    avgEngagementScore: number;
    activeCustomers: number;
    atRiskCount: number;
    completionMetrics: {
      setupComplete: number;
      dataImported: number;
      workflowCreated: number;
    };
  } {
    const allMetrics = Array.from(this.engagementMetrics.values());
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    return {
      totalCustomers: allMetrics.length,
      avgEngagementScore: Math.round(
        allMetrics.length > 0
          ? allMetrics.reduce((sum, m) => sum + m.engagementScore, 0) / allMetrics.length
          : 0
      ),
      activeCustomers: allMetrics.filter(m => m.lastActivityDate > thirtyDaysAgo).length,
      atRiskCount: this.getAtRiskCustomers().length,
      completionMetrics: {
        setupComplete: allMetrics.filter(m => m.setupCompleted).length,
        dataImported: allMetrics.filter(m => m.dataImportCompleted).length,
        workflowCreated: allMetrics.filter(m => m.firstWorkflowCreated).length,
      },
    };
  }
}

export default new OnboardingMetricsService();

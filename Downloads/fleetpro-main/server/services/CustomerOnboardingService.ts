import { logger } from '../utils/logger.js';

export interface OnboardingStep {
  day: number;
  title: string;
  description: string;
  type: 'email' | 'task' | 'training' | 'checkin' | 'review';
  status: 'pending' | 'in_progress' | 'completed';
  completedAt?: Date;
  materials: string[];
  requiredActions?: string[];
}

export interface OnboardingJourney {
  tenantId: string;
  customerId: string;
  signupDate: Date;
  steps: OnboardingStep[];
  currentStep: number;
  overallProgress: number;
  status: 'not_started' | 'in_progress' | 'completed';
  engagementScore: number;
  firstActionDate?: Date;
  featureActivations: Map<string, Date>;
  dataImportCompleted?: Date;
  completedAt?: Date;
}

export interface OnboardingMetrics {
  totalCustomers: number;
  completedOnboardings: number;
  completionRate: number;
  avgTimeToCompletion: number;
  avgDaysToFirstAction: number;
  featureAdoptionRate: Map<string, number>;
  dropoffRate: number;
  engagementScore: number;
}

class CustomerOnboardingService {
  private onboardingJourneys = new Map<string, OnboardingJourney>();

  /**
   * Initialize onboarding journey for a new customer
   */
  async initializeOnboarding(tenantId: string, customerId: string, signupDate: Date): Promise<OnboardingJourney> {
    const journey: OnboardingJourney = {
      tenantId,
      customerId,
      signupDate,
      steps: this.getDefaultOnboardingSteps(),
      currentStep: 0,
      overallProgress: 0,
      status: 'not_started',
      engagementScore: 0,
      featureActivations: new Map(),
    };

    this.onboardingJourneys.set(`${tenantId}-${customerId}`, journey);
    logger.logApiRequest('POST', `/onboarding/${customerId}/initialize`, 200, 0, tenantId);

    return journey;
  }

  /**
   * Get default onboarding workflow (7-30 days)
   */
  private getDefaultOnboardingSteps(): OnboardingStep[] {
    return [
      {
        day: 0,
        title: 'Welcome Email',
        description: 'Send welcome email with platform overview and first steps',
        type: 'email',
        status: 'pending',
        materials: ['welcome-email', 'getting-started-guide', 'faq-guide'],
        requiredActions: ['email_opened', 'dashboard_login'],
      },
      {
        day: 1,
        title: 'Product Walkthrough',
        description: 'Interactive video walkthrough of core features',
        type: 'training',
        status: 'pending',
        materials: ['video-walkthrough', 'feature-overview-pdf', 'keyboard-shortcuts'],
        requiredActions: ['video_watched', 'dashboard_explored'],
      },
      {
        day: 2,
        title: 'Setup & Configuration',
        description: 'Guide for initial setup including integrations and team members',
        type: 'task',
        status: 'pending',
        materials: ['setup-checklist', 'integration-guide', 'team-setup-guide'],
        requiredActions: ['team_members_added', 'integrations_configured'],
      },
      {
        day: 3,
        title: 'First Data Import',
        description: 'Assist with importing initial data and validating quality',
        type: 'task',
        status: 'pending',
        materials: ['data-import-guide', 'data-templates', 'troubleshooting-guide'],
        requiredActions: ['data_imported', 'data_validated'],
      },
      {
        day: 5,
        title: 'Best Practices Training',
        description: 'Interactive training on platform best practices and workflows',
        type: 'training',
        status: 'pending',
        materials: ['best-practices-video', 'workflow-templates', 'success-stories'],
        requiredActions: ['training_completed', 'workflow_created'],
      },
      {
        day: 7,
        title: 'Check-in Call',
        description: 'Live call with onboarding specialist to review progress',
        type: 'checkin',
        status: 'pending',
        materials: ['call-agenda', 'progress-report', 'action-items'],
        requiredActions: ['call_scheduled', 'call_attended'],
      },
      {
        day: 30,
        title: 'Business Review',
        description: 'Monthly business review and optimization recommendations',
        type: 'review',
        status: 'pending',
        materials: ['business-review-report', 'roi-analysis', 'optimization-recommendations'],
        requiredActions: ['review_completed', 'next_steps_agreed'],
      },
    ];
  }

  /**
   * Mark step as completed
   */
  async completeStep(tenantId: string, customerId: string, stepIndex: number): Promise<OnboardingJourney | null> {
    const key = `${tenantId}-${customerId}`;
    const journey = this.onboardingJourneys.get(key);

    if (!journey) {
      logger.logApiRequest('PUT', `/onboarding/${customerId}/step/${stepIndex}`, 404, 0, tenantId);
      return null;
    }

    if (stepIndex >= 0 && stepIndex < journey.steps.length) {
      journey.steps[stepIndex].status = 'completed';
      journey.steps[stepIndex].completedAt = new Date();
      journey.currentStep = Math.max(journey.currentStep, stepIndex + 1);
      journey.overallProgress = Math.round(((stepIndex + 1) / journey.steps.length) * 100);

      // Update engagement score
      journey.engagementScore += 15;

      if (stepIndex === journey.steps.length - 1) {
        journey.status = 'completed';
        journey.completedAt = new Date();
        journey.engagementScore = 100;
      } else {
        journey.status = 'in_progress';
      }
    }

    logger.logApiRequest('PUT', `/onboarding/${customerId}/step/${stepIndex}`, 200, 0, tenantId);
    return journey;
  }

  /**
   * Track feature activation
   */
  async trackFeatureActivation(tenantId: string, customerId: string, featureName: string): Promise<OnboardingJourney | null> {
    const key = `${tenantId}-${customerId}`;
    const journey = this.onboardingJourneys.get(key);

    if (!journey) {
      return null;
    }

    // Track first action
    if (!journey.firstActionDate && journey.featureActivations.size === 0) {
      journey.firstActionDate = new Date();
    }

    journey.featureActivations.set(featureName, new Date());
    journey.engagementScore = Math.min(100, journey.engagementScore + 5);

    return journey;
  }

  /**
   * Record data import completion
   */
  async recordDataImport(tenantId: string, customerId: string, recordCount: number): Promise<OnboardingJourney | null> {
    const key = `${tenantId}-${customerId}`;
    const journey = this.onboardingJourneys.get(key);

    if (!journey) {
      return null;
    }

    journey.dataImportCompleted = new Date();
    journey.engagementScore = Math.min(100, journey.engagementScore + 20);

    // Mark data import step as in progress
    const importStep = journey.steps.find(s => s.day === 3);
    if (importStep) {
      importStep.status = 'in_progress';
    }

    logger.logApiRequest('POST', `/onboarding/${customerId}/data-import`, 200, 0, tenantId);
    return journey;
  }

  /**
   * Get customer onboarding journey
   */
  getOnboardingJourney(tenantId: string, customerId: string): OnboardingJourney | null {
    return this.onboardingJourneys.get(`${tenantId}-${customerId}`) || null;
  }

  /**
   * Calculate activation metrics
   */
  calculateActivationMetrics(tenantId: string): OnboardingMetrics {
    const journeys = Array.from(this.onboardingJourneys.values()).filter(
      j => j.tenantId === tenantId
    );

    const completedJourneys = journeys.filter(j => j.status === 'completed');
    const featureActivationMap = new Map<string, number>();

    journeys.forEach(journey => {
      journey.featureActivations.forEach((date, feature) => {
        const count = featureActivationMap.get(feature) || 0;
        featureActivationMap.set(feature, count + 1);
      });
    });

    const avgTimeToCompletion = completedJourneys.length > 0
      ? completedJourneys.reduce((sum, j) => {
          const days = (j.completedAt!.getTime() - j.signupDate.getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / completedJourneys.length
      : 0;

    const avgDaysToFirstAction = journeys.filter(j => j.firstActionDate).length > 0
      ? journeys
          .filter(j => j.firstActionDate)
          .reduce((sum, j) => {
            const days = (j.firstActionDate!.getTime() - j.signupDate.getTime()) / (1000 * 60 * 60 * 24);
            return sum + days;
          }, 0) / journeys.filter(j => j.firstActionDate).length
      : 0;

    const featureAdoptionRate = new Map<string, number>();
    featureActivationMap.forEach((count, feature) => {
      featureAdoptionRate.set(feature, Math.round((count / journeys.length) * 100));
    });

    return {
      totalCustomers: journeys.length,
      completedOnboardings: completedJourneys.length,
      completionRate: journeys.length > 0 ? Math.round((completedJourneys.length / journeys.length) * 100) : 0,
      avgTimeToCompletion: Math.round(avgTimeToCompletion),
      avgDaysToFirstAction: Math.round(avgDaysToFirstAction),
      featureAdoptionRate,
      dropoffRate: journeys.length > 0 ? Math.round(((journeys.length - completedJourneys.length) / journeys.length) * 100) : 0,
      engagementScore: Math.round(journeys.reduce((sum, j) => sum + j.engagementScore, 0) / journeys.length),
    };
  }

  /**
   * Get customers needing check-in
   */
  getCustomersNeedingCheckIn(tenantId: string, daysIntoOnboarding: number): string[] {
    return Array.from(this.onboardingJourneys.values())
      .filter(j => {
        if (j.tenantId !== tenantId || j.status === 'completed') return false;

        const daysSinceSignup = (new Date().getTime() - j.signupDate.getTime()) / (1000 * 60 * 60 * 24);
        return Math.round(daysSinceSignup) === daysIntoOnboarding;
      })
      .map(j => j.customerId);
  }

  /**
   * Send onboarding email
   */
  async sendOnboardingEmail(
    customerId: string,
    email: string,
    stepDay: number,
    materials: string[]
  ): Promise<boolean> {
    const templates: { [key: number]: string } = {
      0: 'Welcome to FleetPro!',
      1: 'Your Product Walkthrough is Ready',
      2: 'Let\'s Get You Set Up',
      3: 'Time to Import Your Data',
      5: 'Best Practices Training',
      7: 'Your Check-in Call',
      30: 'Monthly Business Review',
    };

    const subject = templates[stepDay] || 'FleetPro Onboarding Update';

    logger.logApiRequest(
      'POST',
      `/onboarding/email/${customerId}`,
      200,
      0,
      customerId
    );

    // Simulate email sending

    return true;
  }
}

export default new CustomerOnboardingService();

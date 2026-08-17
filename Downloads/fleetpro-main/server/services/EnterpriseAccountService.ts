import mongoose from 'mongoose';

interface AccountManager {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'primary' | 'technical' | 'financial';
  responsibilityAreas: string[];
}

interface QuarterlyBusinessReview {
  id: string;
  enterpriseId: string;
  quarter: string;
  year: number;
  scheduledDate: Date;
  topics: string[];
  metrics: {
    utilizationRate: number;
    userAdoption: number;
    supportTickets: number;
    slaCompliance: number;
    nps: number;
  };
  achievements: string[];
  challenges: string[];
  recommendations: string[];
  nextQuarterPlan: string[];
  attendees: Array<{ name: string; company: string; role: string }>;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

interface TrainingProgram {
  id: string;
  enterpriseId: string;
  name: string;
  description: string;
  topics: string[];
  duration: string;
  format: 'online' | 'in-person' | 'hybrid';
  schedule: Array<{
    date: Date;
    time: string;
    duration: string;
    topic: string;
    trainer: string;
  }>;
  materials: string[];
  certification: boolean;
  status: 'planned' | 'in-progress' | 'completed';
  attendees: Array<{
    email: string;
    name: string;
    status: 'pending' | 'registered' | 'completed';
  }>;
  createdAt: Date;
  updatedAt: Date;
}

interface PrioritySupportQueue {
  id: string;
  enterpriseId: string;
  tenantId: mongoose.Types.ObjectId;
  ticketId: string;
  priority: 'critical' | 'high' | 'medium';
  description: string;
  status: 'pending' | 'in-progress' | 'resolved';
  assignedTo: string;
  slaResponseTime: number; // in minutes
  slaResolutionTime: number; // in minutes
  responseTime?: number;
  resolutionTime?: number;
  createdAt: Date;
  resolvedAt?: Date;
  updatedAt: Date;
}

interface AccountRelationship {
  enterpriseId: string;
  tenantId: mongoose.Types.ObjectId;
  accountName: string;
  accountStatus: 'prospect' | 'active' | 'at-risk' | 'churned';
  industry: string;
  employees: number;
  annualRevenue: number;
  contractValue: number;
  contractStartDate: Date;
  contractEndDate: Date;
  primaryAccountManager: AccountManager;
  secondaryAccountManagers: AccountManager[];
  executiveSteering: {
    enabled: boolean;
    frequency: 'monthly' | 'quarterly' | 'semi-annual';
    sponsor: string;
  };
  healthScore: number; // 0-100
  churnRisk: 'low' | 'medium' | 'high';
  expansionOpportunities: string[];
  lastReviewDate: Date;
  nextReviewDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class EnterpriseAccountService {
  /**
   * Create or get account manager assignment
   */
  async assignAccountManager(
    enterpriseId: string,
    tenantId: mongoose.Types.ObjectId,
    managerInfo: Omit<AccountManager, 'id'>
  ): Promise<AccountManager> {
    const manager: AccountManager = {
      id: `mgr_${Date.now()}`,
      ...managerInfo
    };

    return manager;
  }

  /**
   * Schedule quarterly business review
   */
  async scheduleQBR(
    enterpriseId: string,
    quarterInfo: {
      quarter: string;
      year: number;
      scheduledDate: Date;
    }
  ): Promise<QuarterlyBusinessReview> {
    const qbr: QuarterlyBusinessReview = {
      id: `qbr_${Date.now()}`,
      enterpriseId,
      quarter: quarterInfo.quarter,
      year: quarterInfo.year,
      scheduledDate: quarterInfo.scheduledDate,
      topics: this.getDefaultQBRTopics(),
      metrics: {
        utilizationRate: 0,
        userAdoption: 0,
        supportTickets: 0,
        slaCompliance: 0,
        nps: 0
      },
      achievements: [],
      challenges: [],
      recommendations: [],
      nextQuarterPlan: [],
      attendees: [],
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return qbr;
  }

  /**
   * Update QBR with metrics and outcomes
   */
  async updateQBR(
    qbrId: string,
    updates: Partial<QuarterlyBusinessReview>
  ): Promise<QuarterlyBusinessReview> {
    // In a real implementation, this would update the database
    const qbr: QuarterlyBusinessReview = {
      id: qbrId,
      enterpriseId: updates.enterpriseId || '',
      quarter: updates.quarter || '',
      year: updates.year || 0,
      scheduledDate: updates.scheduledDate || new Date(),
      topics: updates.topics || [],
      metrics: updates.metrics || { utilizationRate: 0, userAdoption: 0, supportTickets: 0, slaCompliance: 0, nps: 0 },
      achievements: updates.achievements || [],
      challenges: updates.challenges || [],
      recommendations: updates.recommendations || [],
      nextQuarterPlan: updates.nextQuarterPlan || [],
      attendees: updates.attendees || [],
      status: updates.status || 'completed',
      createdAt: updates.createdAt || new Date(),
      updatedAt: new Date()
    };

    return qbr;
  }

  /**
   * Setup executive steering committee
   */
  getExecutiveSteering() {
    return {
      frequency: 'quarterly',
      structure: {
        customer: ['Executive Sponsor', 'Finance Lead', 'Operations Lead'],
        provider: ['Account Executive', 'Solutions Architect', 'Product Manager']
      },
      agenda: [
        'Business alignment review',
        'Strategic initiatives progress',
        'Financial performance',
        'Product roadmap priorities',
        'Risk management',
        'Executive action items'
      ],
      documentation: [
        'Meeting minutes',
        'Action item tracking',
        'Performance dashboards',
        'Strategic roadmap alignment',
        'Risk register'
      ],
      governance: {
        meetingCadence: 'Quarterly',
        attendanceExpectation: '80% minimum',
        escalationProcess: 'Direct to executive sponsors',
        decisionAuthority: 'Joint decision making'
      }
    };
  }

  /**
   * Create custom training program
   */
  async createTrainingProgram(
    enterpriseId: string,
    programInfo: {
      name: string;
      description: string;
      topics: string[];
      duration: string;
      format: 'online' | 'in-person' | 'hybrid';
      attendeeEmails: string[];
    }
  ): Promise<TrainingProgram> {
    const program: TrainingProgram = {
      id: `train_${Date.now()}`,
      enterpriseId,
      name: programInfo.name,
      description: programInfo.description,
      topics: programInfo.topics,
      duration: programInfo.duration,
      format: programInfo.format,
      schedule: this.generateTrainingSchedule(programInfo.topics, programInfo.duration),
      materials: this.generateTrainingMaterials(programInfo.topics),
      certification: true,
      status: 'planned',
      attendees: programInfo.attendeeEmails.map(email => ({
        email,
        name: email.split('@')[0],
        status: 'pending'
      })),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return program;
  }

  /**
   * Get priority support queue configuration
   */
  getPrioritySupportQueueConfig() {
    return {
      tiers: {
        critical: {
          responseTime: 15, // minutes
          resolutionTime: 4 * 60, // 4 hours
          assignmentRules: 'Immediate senior engineer assignment',
          escalationPath: 'Engineering Manager → VP Engineering → CTO'
        },
        high: {
          responseTime: 30, // minutes
          resolutionTime: 8 * 60, // 8 hours
          assignmentRules: 'Senior engineer assignment',
          escalationPath: 'Engineering Manager → VP Engineering'
        },
        medium: {
          responseTime: 60, // minutes
          resolutionTime: 24 * 60, // 24 hours
          assignmentRules: 'Engineer assignment by availability',
          escalationPath: 'Engineering Manager → VP Engineering'
        }
      },
      features: [
        'Dedicated support queue',
        'Priority ticket routing',
        'SLA tracking and alerting',
        'Regular status updates',
        'Executive escalation path',
        'Post-resolution review'
      ],
      monitoring: {
        slaCompliance: true,
        responseTimeTracking: true,
        resolutionTimeTracking: true,
        customerSatisfactionScoring: true,
        weeklyPerformanceReports: true
      }
    };
  }

  /**
   * Create account relationship record
   */
  async createAccountRelationship(
    enterpriseId: string,
    tenantId: mongoose.Types.ObjectId,
    accountInfo: {
      accountName: string;
      industry: string;
      employees: number;
      annualRevenue: number;
      contractValue: number;
      contractStartDate: Date;
      contractEndDate: Date;
    },
    manager: AccountManager
  ): Promise<AccountRelationship> {
    const now = new Date();
    const nextReview = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days

    const relationship: AccountRelationship = {
      enterpriseId,
      tenantId,
      accountName: accountInfo.accountName,
      accountStatus: 'active',
      industry: accountInfo.industry,
      employees: accountInfo.employees,
      annualRevenue: accountInfo.annualRevenue,
      contractValue: accountInfo.contractValue,
      contractStartDate: accountInfo.contractStartDate,
      contractEndDate: accountInfo.contractEndDate,
      primaryAccountManager: manager,
      secondaryAccountManagers: [],
      executiveSteering: {
        enabled: true,
        frequency: 'quarterly',
        sponsor: manager.name
      },
      healthScore: this.calculateInitialHealthScore(accountInfo),
      churnRisk: 'low',
      expansionOpportunities: this.identifyExpansionOpportunities(accountInfo),
      lastReviewDate: now,
      nextReviewDate: nextReview,
      createdAt: now,
      updatedAt: now
    };

    return relationship;
  }

  /**
   * Calculate account health score
   */
  async calculateAccountHealthScore(
    accountId: string,
    metrics: {
      utilizationRate: number;
      supportTickets: number;
      nps: number;
      adoptionRate: number;
      slaCompliance: number;
    }
  ): Promise<number> {
    const weights = {
      utilizationRate: 0.25,
      supportTickets: 0.15,
      nps: 0.3,
      adoptionRate: 0.2,
      slaCompliance: 0.1
    };

    const score =
      metrics.utilizationRate * weights.utilizationRate +
      (100 - Math.min(metrics.supportTickets / 10, 100)) * weights.supportTickets +
      Math.max(0, metrics.nps + 100) / 2 * weights.nps +
      metrics.adoptionRate * weights.adoptionRate +
      metrics.slaCompliance * weights.slaCompliance;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Generate account risk assessment
   */
  async assessChurnRisk(
    accountId: string,
    metrics: {
      utilizationRate: number;
      nps: number;
      supportTickets: number;
      contractDaysRemaining: number;
      lastEngagementDaysAgo: number;
    }
  ): Promise<{ risk: 'low' | 'medium' | 'high'; indicators: string[] }> {
    const indicators: string[] = [];
    let riskScore = 0;

    if (metrics.utilizationRate < 30) {
      indicators.push('Low platform utilization');
      riskScore += 25;
    }

    if (metrics.nps < 0) {
      indicators.push('Negative Net Promoter Score');
      riskScore += 30;
    }

    if (metrics.supportTickets > 20) {
      indicators.push('High support ticket volume');
      riskScore += 20;
    }

    if (metrics.lastEngagementDaysAgo > 60) {
      indicators.push('Lack of engagement');
      riskScore += 20;
    }

    if (metrics.contractDaysRemaining < 90) {
      indicators.push('Contract renewal approaching');
      riskScore += 15;
    }

    let risk: 'low' | 'medium' | 'high' = 'low';
    if (riskScore >= 60) risk = 'high';
    else if (riskScore >= 35) risk = 'medium';

    return { risk, indicators };
  }

  // Helper methods
  private getDefaultQBRTopics(): string[] {
    return [
      'Business alignment and strategic progress',
      'Platform utilization and adoption metrics',
      'ROI realization and benefits achieved',
      'Technical performance and incidents',
      'Product roadmap and feature requests',
      'Support and service quality review',
      'Budget and contract renewal planning',
      'Upcoming initiatives and opportunities'
    ];
  }

  private generateTrainingSchedule(
    topics: string[],
    duration: string
  ): TrainingProgram['schedule'] {
    const schedules: TrainingProgram['schedule'] = [];
    const baseDate = new Date();

    topics.forEach((topic, index) => {
      schedules.push({
        date: new Date(baseDate.getTime() + index * 7 * 24 * 60 * 60 * 1000),
        time: '10:00 AM',
        duration: '2 hours',
        topic,
        trainer: 'Certified Training Specialist'
      });
    });

    return schedules;
  }

  private generateTrainingMaterials(topics: string[]): string[] {
    return topics.flatMap(topic => [
      `${topic} - Slide Deck`,
      `${topic} - Hands-on Lab`,
      `${topic} - Reference Guide`,
      `${topic} - Video Tutorial`
    ]);
  }

  private calculateInitialHealthScore(accountInfo: {
    employees: number;
    annualRevenue: number;
  }): number {
    let score = 70; // Starting baseline

    if (accountInfo.employees > 1000) score += 10;
    if (accountInfo.annualRevenue > 100000000) score += 10;

    return Math.min(100, score);
  }

  private identifyExpansionOpportunities(accountInfo: {
    industry: string;
    employees: number;
  }): string[] {
    const opportunities: string[] = [];

    if (accountInfo.employees > 500) {
      opportunities.push('Advanced analytics module');
      opportunities.push('Custom integrations');
    }

    if (accountInfo.employees > 1000) {
      opportunities.push('Multi-region deployment');
      opportunities.push('White-label solutions');
    }

    opportunities.push('Premium support tier');
    opportunities.push('Training and certification program');

    return opportunities;
  }
}

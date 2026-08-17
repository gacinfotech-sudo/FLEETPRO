import mongoose, { Document, Schema } from 'mongoose';

interface DiscoveryQuestion {
  id: string;
  question: string;
  category: 'business' | 'technical' | 'financial' | 'operational';
  priority: 'high' | 'medium' | 'low';
  followUp?: string[];
}

interface NeedsAssessment {
  id: string;
  enterpriseId: string;
  tenantId: mongoose.Types.ObjectId;
  questions: Array<{
    questionId: string;
    question: string;
    response: string;
    category: string;
  }>;
  summary: string;
  identifiedNeeds: string[];
  painPoints: string[];
  recommendedSolution: string;
  estimatedValue: number;
  createdAt: Date;
  updatedAt: Date;
}

interface EnterpriseProposal {
  id: string;
  enterpriseId: string;
  tenantId: mongoose.Types.ObjectId;
  accountName: string;
  contactPerson: string;
  email: string;
  phone: string;
  proposalDate: Date;
  validUntilDate: Date;
  executiveSummary: string;
  problemStatement: string;
  proposedSolution: string;
  implementation: {
    timeline: string;
    phases: Array<{
      name: string;
      duration: string;
      deliverables: string[];
    }>;
    resources: string[];
  };
  pricing: {
    basePrice: number;
    customizations: Array<{
      name: string;
      cost: number;
    }>;
    totalPrice: number;
    paymentTerms: string;
  };
  roi: {
    estimatedAnnualSavings: number;
    estimatedROIPercentage: number;
    paybackPeriod: string;
    metrics: string[];
  };
  nextSteps: string[];
  status: 'draft' | 'sent' | 'under_review' | 'accepted' | 'rejected';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class EnterpriseSalesService {
  private discoveryQuestions: DiscoveryQuestion[] = [
    {
      id: 'biz_001',
      question: 'What are your primary business objectives for the next 12 months?',
      category: 'business',
      priority: 'high',
      followUp: ['How do these align with revenue goals?', 'What metrics will you use to measure success?']
    },
    {
      id: 'biz_002',
      question: 'What are your current operational challenges?',
      category: 'business',
      priority: 'high'
    },
    {
      id: 'biz_003',
      question: 'Who are your key stakeholders in this decision?',
      category: 'business',
      priority: 'high'
    },
    {
      id: 'tech_001',
      question: 'What is your current technology stack?',
      category: 'technical',
      priority: 'high'
    },
    {
      id: 'tech_002',
      question: 'Do you require integrations with existing systems?',
      category: 'technical',
      priority: 'high',
      followUp: ['Which systems specifically?', 'How critical is real-time integration?']
    },
    {
      id: 'tech_003',
      question: 'What are your security and compliance requirements?',
      category: 'technical',
      priority: 'high'
    },
    {
      id: 'fin_001',
      question: 'What is your total addressable budget for this solution?',
      category: 'financial',
      priority: 'high'
    },
    {
      id: 'fin_002',
      question: 'What is your preferred pricing model (perpetual, subscription, usage-based)?',
      category: 'financial',
      priority: 'medium'
    },
    {
      id: 'op_001',
      question: 'How many users/locations need to be supported?',
      category: 'operational',
      priority: 'high'
    },
    {
      id: 'op_002',
      question: 'What is your implementation timeline?',
      category: 'operational',
      priority: 'high'
    }
  ];

  /**
   * Get discovery questions framework
   */
  getDiscoveryQuestions(filter?: { category?: string; priority?: string }): DiscoveryQuestion[] {
    let questions = this.discoveryQuestions;

    if (filter?.category) {
      questions = questions.filter(q => q.category === filter.category);
    }

    if (filter?.priority) {
      questions = questions.filter(q => q.priority === filter.priority);
    }

    return questions;
  }

  /**
   * Create needs assessment from discovery responses
   */
  async createNeedsAssessment(
    enterpriseId: string,
    tenantId: mongoose.Types.ObjectId,
    responses: Array<{ questionId: string; response: string }>
  ): Promise<NeedsAssessment> {
    const assessment: NeedsAssessment = {
      id: `assess_${Date.now()}`,
      enterpriseId,
      tenantId,
      questions: responses.map(r => {
        const question = this.discoveryQuestions.find(q => q.id === r.questionId);
        return {
          questionId: r.questionId,
          question: question?.question || '',
          response: r.response,
          category: question?.category || 'general'
        };
      }),
      summary: '',
      identifiedNeeds: [],
      painPoints: [],
      recommendedSolution: '',
      estimatedValue: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Analyze responses to identify needs
    assessment.identifiedNeeds = this.analyzeNeeds(responses);
    assessment.painPoints = this.extractPainPoints(responses);
    assessment.summary = this.generateSummary(responses);
    assessment.estimatedValue = this.estimateValue(responses);

    return assessment;
  }

  /**
   * Generate enterprise proposal
   */
  async generateProposal(
    enterpriseId: string,
    tenantId: mongoose.Types.ObjectId,
    accountInfo: {
      accountName: string;
      contactPerson: string;
      email: string;
      phone: string;
    },
    assessment: NeedsAssessment,
    pricing: {
      basePrice: number;
      customizations: Array<{ name: string; cost: number }>;
      paymentTerms: string;
    }
  ): Promise<EnterpriseProposal> {
    const customizationTotal = pricing.customizations.reduce((sum, c) => sum + c.cost, 0);
    const totalPrice = pricing.basePrice + customizationTotal;

    const proposal: EnterpriseProposal = {
      id: `prop_${Date.now()}`,
      enterpriseId,
      tenantId,
      accountName: accountInfo.accountName,
      contactPerson: accountInfo.contactPerson,
      email: accountInfo.email,
      phone: accountInfo.phone,
      proposalDate: new Date(),
      validUntilDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      executiveSummary: `Customized solution for ${accountInfo.accountName} addressing identified needs and driving measurable ROI`,
      problemStatement: this.generateProblemStatement(assessment),
      proposedSolution: this.generateSolution(assessment),
      implementation: this.generateImplementationPlan(assessment),
      pricing: {
        basePrice: pricing.basePrice,
        customizations: pricing.customizations,
        totalPrice,
        paymentTerms: pricing.paymentTerms
      },
      roi: this.calculateROI(totalPrice, assessment),
      nextSteps: this.generateNextSteps(),
      status: 'draft',
      createdBy: 'enterprise-sales-service',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return proposal;
  }

  /**
   * Contract negotiation guidelines
   */
  getContractNegotiationGuidelines() {
    return {
      keyTerms: [
        'Service Level Agreement (SLA)',
        'Term Duration (typically 1-3 years)',
        'Auto-renewal conditions',
        'Early termination clauses',
        'Renewal pricing',
        'Performance guarantees'
      ],
      pricingConsiderations: [
        'Volume discounts (10-25% for large deployments)',
        'Multi-year commitments (5-15% discount)',
        'Payment terms (net 30/60)',
        'Annual escalation (typically 3-5%)',
        'Reserved capacity pricing'
      ],
      supportTerms: [
        '24/7 support availability',
        'Maximum response time',
        'Dedicated account manager',
        'Quarterly business reviews',
        'Custom training programs',
        'Priority bug fixes'
      ],
      customizations: [
        'Custom integrations',
        'API enhancements',
        'Security features',
        'Compliance certifications',
        'White-label options',
        'Custom workflows'
      ],
      negotiationStrategy: {
        phase1: 'Establish mutual objectives',
        phase2: 'Identify critical issues',
        phase3: 'Explore alternatives',
        phase4: 'Reach agreement',
        phase5: 'Document and execute'
      }
    };
  }

  /**
   * Legal review checklist
   */
  getLegalReviewChecklist() {
    return {
      contractReview: [
        'Liability limitations',
        'Indemnification clauses',
        'IP ownership and protection',
        'Confidentiality agreements',
        'Data protection compliance',
        'Termination conditions'
      ],
      complianceItems: [
        'GDPR compliance',
        'HIPAA (if healthcare)',
        'SOC 2 Type II certification',
        'ISO 27001 certification',
        'Local data residency requirements',
        'Audit rights and access'
      ],
      riskManagement: [
        'Insurance requirements',
        'Warranty disclaimers',
        'Performance guarantees',
        'Penalty clauses',
        'Dispute resolution',
        'Governing law'
      ]
    };
  }

  // Helper methods
  private analyzeNeeds(responses: Array<{ questionId: string; response: string }>): string[] {
    const needs: Set<string> = new Set();

    responses.forEach(r => {
      const response = r.response.toLowerCase();

      if (response.includes('integration') || response.includes('system')) {
        needs.add('System Integration');
      }
      if (response.includes('security') || response.includes('compliance')) {
        needs.add('Enhanced Security');
      }
      if (response.includes('scale') || response.includes('growth')) {
        needs.add('Scalability');
      }
      if (response.includes('automation')) {
        needs.add('Process Automation');
      }
      if (response.includes('reporting') || response.includes('analytics')) {
        needs.add('Advanced Analytics');
      }
    });

    return Array.from(needs);
  }

  private extractPainPoints(responses: Array<{ questionId: string; response: string }>): string[] {
    const painPoints: Set<string> = new Set();

    responses.forEach(r => {
      const response = r.response;
      if (response.length > 20) {
        painPoints.add(response.substring(0, 100));
      }
    });

    return Array.from(painPoints);
  }

  private generateSummary(responses: Array<{ questionId: string; response: string }>): string {
    const needsCount = this.analyzeNeeds(responses).length;
    return `Assessment of enterprise identified ${needsCount} key requirements across business, technical, and operational domains.`;
  }

  private estimateValue(responses: Array<{ questionId: string; response: string }>): number {
    // Base value estimation
    let value = 50000;

    // Increase based on complexity
    const responseLength = responses.reduce((sum, r) => sum + r.response.length, 0);
    value += Math.min(responseLength * 10, 100000);

    return value;
  }

  private generateProblemStatement(assessment: NeedsAssessment): string {
    return `Your organization faces challenges in ${assessment.painPoints.slice(0, 2).join(' and ')}. These issues impact operational efficiency and growth potential.`;
  }

  private generateSolution(assessment: NeedsAssessment): string {
    const needs = assessment.identifiedNeeds.slice(0, 3);
    return `Our solution directly addresses ${needs.join(', ')} through integrated modules and custom configurations.`;
  }

  private generateImplementationPlan(assessment: NeedsAssessment) {
    return {
      timeline: '3-6 months',
      phases: [
        {
          name: 'Discovery & Planning',
          duration: '2 weeks',
          deliverables: ['Detailed requirements document', 'Implementation roadmap', 'Resource allocation plan']
        },
        {
          name: 'Configuration & Development',
          duration: '8-10 weeks',
          deliverables: ['System setup', 'Custom integrations', 'Data migration plan']
        },
        {
          name: 'Testing & Training',
          duration: '4 weeks',
          deliverables: ['UAT completion', 'User training', 'Documentation']
        },
        {
          name: 'Go-Live & Support',
          duration: '2 weeks',
          deliverables: ['Production deployment', 'Support handoff', 'Post-launch review']
        }
      ],
      resources: ['Dedicated implementation manager', 'Technical architect', 'Integration specialist', 'Training specialist']
    };
  }

  private calculateROI(totalPrice: number, assessment: NeedsAssessment) {
    const estimatedAnnualSavings = Math.max(
      assessment.estimatedValue * 0.25,
      totalPrice * 0.5
    );

    return {
      estimatedAnnualSavings,
      estimatedROIPercentage: (estimatedAnnualSavings / totalPrice) * 100,
      paybackPeriod: `${Math.ceil(totalPrice / (estimatedAnnualSavings / 12))} months`,
      metrics: [
        'Operational efficiency improvement',
        'Cost reduction',
        'Revenue increase',
        'Process automation benefits',
        'Improved customer satisfaction'
      ]
    };
  }

  private generateNextSteps(): string[] {
    return [
      'Schedule executive presentation',
      'Arrange technical deep-dive meeting',
      'Complete reference customer calls',
      'Finalize contract terms',
      'Initiate implementation planning'
    ];
  }
}

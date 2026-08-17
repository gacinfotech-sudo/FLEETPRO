import mongoose from 'mongoose';

interface PartnerTier {
  id: string;
  name: string;
  description: string;
  requirements: {
    minAnnualRevenue: number;
    minImplementations: number;
    certifications: string[];
    supportLevel: string;
  };
  benefits: {
    revenueSharePercentage: number;
    marketingFunds: number;
    dedicatedSupport: boolean;
    trainingBudget: number;
    coSellOpportunities: boolean;
  };
}

interface Partner {
  id: string;
  companyName: string;
  email: string;
  contact: string;
  phone: string;
  website: string;
  country: string;
  tier: string;
  partnerType: 'reseller' | 'integrator' | 'technology' | 'consulting';
  status: 'prospect' | 'active' | 'inactive';
  revenueGenerated: number;
  implementationsCompleted: number;
  certifications: string[];
  joinDate: Date;
  nextReviewDate: Date;
  metrics: {
    monthlySales: number;
    quarterlyGrowth: number;
    customerSatisfaction: number;
    supportTicketsHandled: number;
  };
}

interface CoSellAgreement {
  id: string;
  partnerId: string;
  customerId: string;
  dealValue: number;
  dealDate: Date;
  partnerCommission: number;
  ourRevenue: number;
  status: 'prospect' | 'in-progress' | 'won' | 'lost';
  jointGoTo: string[];
  marketing: string[];
  sales: string[];
  implementation: string[];
}

interface RevenueSharingModel {
  id: string;
  name: string;
  description: string;
  structure: 'percentage' | 'tiered' | 'annual';
  terms: {
    commission: number | Array<{ minRevenue: number; percentage: number }>;
    paymentTerms: string;
    minimumMonthly: number;
    maximumCapture: number;
    returnPolicy: string;
  };
  benefits: {
    monthlyPayouts: boolean;
    dedupPeriod: number; // days
    partnerTraining: boolean;
    salesKits: boolean;
    coMarketingFunds: boolean;
  };
}

export class EnterprisePartnerService {
  /**
   * Get partner tiers
   */
  getPartnerTiers(): PartnerTier[] {
    return [
      {
        id: 'pt_select',
        name: 'Select Partner',
        description: 'Emerging partnerships with growth potential',
        requirements: {
          minAnnualRevenue: 0,
          minImplementations: 0,
          certifications: [],
          supportLevel: 'Standard'
        },
        benefits: {
          revenueSharePercentage: 15,
          marketingFunds: 5000,
          dedicatedSupport: false,
          trainingBudget: 5000,
          coSellOpportunities: true
        }
      },
      {
        id: 'pt_preferred',
        name: 'Preferred Partner',
        description: 'Established partnerships with strong performance',
        requirements: {
          minAnnualRevenue: 500000,
          minImplementations: 5,
          certifications: ['Advanced Implementation'],
          supportLevel: 'Premium'
        },
        benefits: {
          revenueSharePercentage: 20,
          marketingFunds: 25000,
          dedicatedSupport: true,
          trainingBudget: 25000,
          coSellOpportunities: true
        }
      },
      {
        id: 'pt_elite',
        name: 'Elite Partner',
        description: 'Premier partnerships with strategic alignment',
        requirements: {
          minAnnualRevenue: 2000000,
          minImplementations: 20,
          certifications: ['Advanced Implementation', 'Advanced Consulting', 'Executive Leadership'],
          supportLevel: 'Enterprise'
        },
        benefits: {
          revenueSharePercentage: 25,
          marketingFunds: 100000,
          dedicatedSupport: true,
          trainingBudget: 100000,
          coSellOpportunities: true
        }
      }
    ];
  }

  /**
   * Create partner relationship
   */
  async createPartner(
    companyInfo: {
      companyName: string;
      email: string;
      contact: string;
      phone: string;
      website: string;
      country: string;
      partnerType: 'reseller' | 'integrator' | 'technology' | 'consulting';
    },
    tier: string = 'pt_select'
  ): Promise<Partner> {
    const nextReview = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const partner: Partner = {
      id: `partner_${Date.now()}`,
      companyName: companyInfo.companyName,
      email: companyInfo.email,
      contact: companyInfo.contact,
      phone: companyInfo.phone,
      website: companyInfo.website,
      country: companyInfo.country,
      tier,
      partnerType: companyInfo.partnerType,
      status: 'prospect',
      revenueGenerated: 0,
      implementationsCompleted: 0,
      certifications: [],
      joinDate: new Date(),
      nextReviewDate: nextReview,
      metrics: {
        monthlySales: 0,
        quarterlyGrowth: 0,
        customerSatisfaction: 0,
        supportTicketsHandled: 0
      }
    };

    return partner;
  }

  /**
   * Get revenue sharing models
   */
  getRevenueSharingModels(): RevenueSharingModel[] {
    return [
      {
        id: 'rsm_percentage',
        name: 'Percentage-Based Revenue Share',
        description: 'Earn a percentage of all revenue generated through partnerships',
        structure: 'percentage',
        terms: {
          commission: 20, // 20% base commission
          paymentTerms: 'Monthly net 30',
          minimumMonthly: 1000,
          maximumCapture: 100000,
          returnPolicy: '30-day period for contract returns'
        },
        benefits: {
          monthlyPayouts: true,
          dedupPeriod: 30,
          partnerTraining: true,
          salesKits: true,
          coMarketingFunds: true
        }
      },
      {
        id: 'rsm_tiered',
        name: 'Tiered Revenue Share',
        description: 'Earn increasing percentages as you grow',
        structure: 'tiered',
        terms: {
          commission: [
            { minRevenue: 0, percentage: 15 },
            { minRevenue: 500000, percentage: 20 },
            { minRevenue: 2000000, percentage: 25 },
            { minRevenue: 5000000, percentage: 30 }
          ],
          paymentTerms: 'Monthly net 30',
          minimumMonthly: 2000,
          maximumCapture: 250000,
          returnPolicy: '30-day period for contract returns'
        },
        benefits: {
          monthlyPayouts: true,
          dedupPeriod: 30,
          partnerTraining: true,
          salesKits: true,
          coMarketingFunds: true
        }
      },
      {
        id: 'rsm_annual',
        name: 'Annual Revenue Share',
        description: 'Earn based on annual performance targets',
        structure: 'annual',
        terms: {
          commission: 22, // Average of tiered model
          paymentTerms: 'Annual settlement + monthly advances',
          minimumMonthly: 5000,
          maximumCapture: 500000,
          returnPolicy: '60-day period for contract returns'
        },
        benefits: {
          monthlyPayouts: true,
          dedupPeriod: 45,
          partnerTraining: true,
          salesKits: true,
          coMarketingFunds: true
        }
      }
    ];
  }

  /**
   * Calculate revenue share payment
   */
  calculateRevenueShare(
    dealValue: number,
    revenueSharePercentage: number,
    annualRevenue?: number
  ): {
    grossCommission: number;
    netCommission: number;
    deductions: Array<{ name: string; amount: number }>;
    paymentAmount: number;
    nextPaymentDate: Date;
  } {
    const deductions: Array<{ name: string; amount: number }> = [];
    let grossCommission = (dealValue * revenueSharePercentage) / 100;

    // Apply tiered adjustments if annual revenue provided
    if (annualRevenue) {
      if (annualRevenue > 5000000) {
        grossCommission *= 1.3; // 30% bonus for top performers
      } else if (annualRevenue > 2000000) {
        grossCommission *= 1.2; // 20% bonus
      } else if (annualRevenue > 500000) {
        grossCommission *= 1.1; // 10% bonus
      }
    }

    // Processing fees (1%)
    const processingFee = (grossCommission * 1) / 100;
    deductions.push({ name: 'Processing Fee (1%)', amount: processingFee });

    // Chargeback reserve (2%)
    const chargebackReserve = (grossCommission * 2) / 100;
    deductions.push({ name: 'Chargeback Reserve (2%)', amount: chargebackReserve });

    const netCommission = grossCommission - processingFee - chargebackReserve;
    const nextPaymentDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    return {
      grossCommission,
      netCommission,
      deductions,
      paymentAmount: netCommission,
      nextPaymentDate
    };
  }

  /**
   * Create co-sell agreement
   */
  async createCoSellAgreement(
    partnerId: string,
    customerId: string,
    dealInfo: {
      dealValue: number;
      dealDate: Date;
      partnerRole: string[];
      ourRole: string[];
    }
  ): Promise<CoSellAgreement> {
    const partnerCommission = (dealInfo.dealValue * 20) / 100; // 20% default
    const ourRevenue = dealInfo.dealValue - partnerCommission;

    const agreement: CoSellAgreement = {
      id: `cosell_${Date.now()}`,
      partnerId,
      customerId,
      dealValue: dealInfo.dealValue,
      dealDate: dealInfo.dealDate,
      partnerCommission,
      ourRevenue,
      status: 'prospect',
      jointGoTo: this.getJointGoToMarketStrategies(),
      marketing: this.getMarketingActivities(),
      sales: this.getSalesActivities(),
      implementation: this.getImplementationActivities()
    };

    return agreement;
  }

  /**
   * Get go-to-market partnership strategies
   */
  getGoToMarketStrategies() {
    return {
      jointMarketing: {
        description: 'Collaborative marketing initiatives',
        activities: [
          'Co-branded marketing materials',
          'Joint webinars and events',
          'Industry analyst briefings',
          'Press releases',
          'Case studies',
          'Solution brief development'
        ],
        timeline: 'Ongoing',
        budget: 'Shared 50/50',
        owners: ['Your Marketing Team', 'Partner Marketing Team']
      },
      jointSales: {
        description: 'Coordinated sales efforts',
        activities: [
          'Joint customer meetings',
          'Solution presentations',
          'RFP responses',
          'Contract negotiation support',
          'Lead sharing agreements',
          'Sales enablement training'
        ],
        timeline: 'Deal dependent',
        budget: 'Variable',
        owners: ['Enterprise Account Executives', 'Partner Sales']
      },
      channelDevelopment: {
        description: 'Building sustainable channel partnerships',
        activities: [
          'Partner training programs',
          'Certification programs',
          'Sales kit development',
          'Marketing development funds',
          'Co-op advertising',
          'Partner portal access'
        ],
        timeline: '12-24 months',
        budget: 'Tiered per partner level',
        owners: ['Partner Enablement', 'Partner Operations']
      }
    };
  }

  /**
   * Partner enablement program
   */
  getPartnerEnablementProgram() {
    return {
      trainingPrograms: [
        {
          name: 'Platform Fundamentals',
          duration: '2 days',
          format: 'online',
          topics: ['Platform overview', 'Core features', 'Architecture basics'],
          certification: 'Foundation Certified'
        },
        {
          name: 'Advanced Implementation',
          duration: '5 days',
          format: 'in-person',
          topics: ['Deployment', 'Configuration', 'Customization', 'Integration'],
          certification: 'Advanced Implementation Certified'
        },
        {
          name: 'Consulting & Professional Services',
          duration: '3 days',
          format: 'in-person',
          topics: ['Discovery methodology', 'Solution design', 'Business case development'],
          certification: 'Consulting Certified'
        }
      ],
      resources: [
        'Partner portal access',
        'Sales enablement materials',
        'Technical documentation',
        'API documentation',
        'Integration guides',
        'Case studies and references',
        'Marketing templates',
        'Proposal templates'
      ],
      support: {
        dedicatedPartnerManager: true,
        technicalSupport: '24/5',
        salesSupport: true,
        marketingSupport: true,
        trainingSupport: true
      }
    };
  }

  // Helper methods
  private getJointGoToMarketStrategies(): string[] {
    return [
      'Co-branded solution positioning',
      'Joint customer success program',
      'Integrated support model',
      'Cross-training initiatives',
      'Revenue sharing framework'
    ];
  }

  private getMarketingActivities(): string[] {
    return [
      'Co-branded collateral',
      'Joint webinars',
      'Case study development',
      'Solution brief',
      'Press release',
      'Social media campaign',
      'Event sponsorship',
      'Trade show presence'
    ];
  }

  private getSalesActivities(): string[] {
    return [
      'Lead qualification framework',
      'Joint sales calls',
      'RFP collaboration',
      'Proposal development',
      'Contract terms alignment',
      'Customer introduction protocol',
      'Escalation path definition'
    ];
  }

  private getImplementationActivities(): string[] {
    return [
      'Resource allocation',
      'Timeline definition',
      'Quality standards',
      'Support model',
      'Success metrics',
      'Knowledge transfer',
      'Post-implementation review'
    ];
  }
}

import mongoose from 'mongoose';

interface PricingModel {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  currency: string;
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  minimumContractTerm: number; // months
}

interface VolumeDiscount {
  id: string;
  model: 'percentage' | 'tiered' | 'absolute';
  tiers: Array<{
    minUnits: number;
    maxUnits?: number;
    discount: number; // percentage or absolute value
    description: string;
  }>;
  applicableToFeatures: string[];
  minimumOrder: number;
}

interface ContractTerm {
  id: string;
  duration: number; // months
  commitment: string;
  renewalOptions: string[];
  earlyTerminationFee: number | null; // percentage or null if not allowed
  autoRenewal: boolean;
  renewalPriceAdjustment: number; // percentage increase allowed
}

interface SupportPackage {
  id: string;
  name: string;
  tier: 'standard' | 'premium' | 'enterprise';
  includesFeatures: {
    responseTime: number; // minutes
    resolutionTime: number; // minutes
    dedicatedAccountManager: boolean;
    quarterlyBusinessReviews: boolean;
    priorityQueue: boolean;
    customTraining: boolean;
    priorityBugFixes: boolean;
    slaGuarantee: number; // percentage
  };
  annualCost: number;
}

interface MaintenancePackage {
  id: string;
  name: string;
  coverage: string;
  includesFeatures: {
    bugFixes: boolean;
    securityUpdates: boolean;
    performanceOptimization: boolean;
    dataBackups: boolean;
    disasterRecovery: boolean;
    upgradesCost: number; // percentage of license cost
  };
  annualCost: number;
  percentage: number; // percentage of license cost
}

export class EnterprisePricingService {
  /**
   * Get available pricing models
   */
  getPricingModels(): PricingModel[] {
    return [
      {
        id: 'pm_standard',
        name: 'Standard',
        description: 'For growing businesses with core requirements',
        basePrice: 50000,
        currency: 'USD',
        billingCycle: 'annual',
        minimumContractTerm: 12
      },
      {
        id: 'pm_professional',
        name: 'Professional',
        description: 'For established enterprises with custom needs',
        basePrice: 150000,
        currency: 'USD',
        billingCycle: 'annual',
        minimumContractTerm: 12
      },
      {
        id: 'pm_enterprise',
        name: 'Enterprise',
        description: 'Custom pricing for large organizations',
        basePrice: 500000,
        currency: 'USD',
        billingCycle: 'annual',
        minimumContractTerm: 24
      }
    ];
  }

  /**
   * Calculate volume discount
   */
  calculateVolumeDiscount(
    units: number,
    basePrice: number,
    discountConfig?: VolumeDiscount
  ): { discountedPrice: number; discountPercentage: number; savings: number } {
    const defaultDiscount: VolumeDiscount = {
      id: 'default_discount',
      model: 'tiered',
      tiers: [
        { minUnits: 1, maxUnits: 10, discount: 0, description: 'No discount' },
        { minUnits: 11, maxUnits: 50, discount: 10, description: '10% discount' },
        { minUnits: 51, maxUnits: 100, discount: 15, description: '15% discount' },
        { minUnits: 101, maxUnits: 250, discount: 20, description: '20% discount' },
        { minUnits: 251, discount: 25, description: '25% discount' }
      ],
      applicableToFeatures: ['all'],
      minimumOrder: 1
    };

    const config = discountConfig || defaultDiscount;
    let discountPercentage = 0;

    for (const tier of config.tiers) {
      if (
        units >= tier.minUnits &&
        (!tier.maxUnits || units <= tier.maxUnits)
      ) {
        discountPercentage = tier.discount;
        break;
      }
    }

    const discountAmount = basePrice * (discountPercentage / 100);
    const discountedPrice = basePrice - discountAmount;

    return {
      discountedPrice,
      discountPercentage,
      savings: discountAmount
    };
  }

  /**
   * Calculate multi-year contract discount
   */
  calculateMultiYearDiscount(
    basePrice: number,
    years: number
  ): {
    annualPrice: number;
    totalPrice: number;
    discountPercentage: number;
    yearlyBreakdown: Array<{ year: number; price: number }>;
  } {
    // Discount increases with longer commitment
    const discountMap: { [key: number]: number } = {
      1: 0,
      2: 5,
      3: 10,
      4: 12,
      5: 15
    };

    const discountPercentage = discountMap[years] || 15;
    const discountAmount = basePrice * (discountPercentage / 100);
    const discountedAnnualPrice = basePrice - discountAmount;
    const totalPrice = discountedAnnualPrice * years;

    // Generate yearly breakdown with standard 3% annual escalation
    const yearlyBreakdown = [];
    for (let year = 1; year <= years; year++) {
      const escalation = Math.pow(1.03, year - 1);
      yearlyBreakdown.push({
        year,
        price: discountedAnnualPrice * escalation
      });
    }

    return {
      annualPrice: discountedAnnualPrice,
      totalPrice,
      discountPercentage,
      yearlyBreakdown
    };
  }

  /**
   * Get contract terms options
   */
  getContractTerms(): ContractTerm[] {
    return [
      {
        id: 'ct_12m',
        duration: 12,
        commitment: '1-Year Commitment',
        renewalOptions: ['Auto-renew at prevailing rates', 'Manual renewal'],
        earlyTerminationFee: 50, // 50% of remaining contract value
        autoRenewal: true,
        renewalPriceAdjustment: 5
      },
      {
        id: 'ct_24m',
        duration: 24,
        commitment: '2-Year Commitment',
        renewalOptions: ['Auto-renew at prevailing rates', 'Manual renewal'],
        earlyTerminationFee: 25, // 25% of remaining contract value
        autoRenewal: true,
        renewalPriceAdjustment: 5
      },
      {
        id: 'ct_36m',
        duration: 36,
        commitment: '3-Year Commitment',
        renewalOptions: ['Auto-renew at prevailing rates', 'Manual renewal'],
        earlyTerminationFee: null, // No early termination penalty at year 2+
        autoRenewal: true,
        renewalPriceAdjustment: 3
      }
    ];
  }

  /**
   * Get support packages
   */
  getSupportPackages(): SupportPackage[] {
    return [
      {
        id: 'sp_standard',
        name: 'Standard Support',
        tier: 'standard',
        includesFeatures: {
          responseTime: 480, // 8 hours
          resolutionTime: 1440, // 24 hours
          dedicatedAccountManager: false,
          quarterlyBusinessReviews: false,
          priorityQueue: false,
          customTraining: false,
          priorityBugFixes: false,
          slaGuarantee: 95
        },
        annualCost: 0 // Included in base license
      },
      {
        id: 'sp_premium',
        name: 'Premium Support',
        tier: 'premium',
        includesFeatures: {
          responseTime: 120, // 2 hours
          resolutionTime: 480, // 8 hours
          dedicatedAccountManager: true,
          quarterlyBusinessReviews: true,
          priorityQueue: true,
          customTraining: false,
          priorityBugFixes: true,
          slaGuarantee: 99
        },
        annualCost: 25000
      },
      {
        id: 'sp_enterprise',
        name: 'Enterprise Support',
        tier: 'enterprise',
        includesFeatures: {
          responseTime: 15, // 15 minutes
          resolutionTime: 240, // 4 hours
          dedicatedAccountManager: true,
          quarterlyBusinessReviews: true,
          priorityQueue: true,
          customTraining: true,
          priorityBugFixes: true,
          slaGuarantee: 99.9
        },
        annualCost: 75000
      }
    ];
  }

  /**
   * Get maintenance and support pricing
   */
  getMaintenancePackages(): MaintenancePackage[] {
    return [
      {
        id: 'mp_standard',
        name: 'Standard Maintenance',
        coverage: 'Regular bug fixes and security updates',
        includesFeatures: {
          bugFixes: true,
          securityUpdates: true,
          performanceOptimization: false,
          dataBackups: false,
          disasterRecovery: false,
          upgradesCost: 0
        },
        annualCost: 0, // Included in base license
        percentage: 0
      },
      {
        id: 'mp_comprehensive',
        name: 'Comprehensive Maintenance',
        coverage: 'All standard plus performance and backup',
        includesFeatures: {
          bugFixes: true,
          securityUpdates: true,
          performanceOptimization: true,
          dataBackups: true,
          disasterRecovery: false,
          upgradesCost: 10 // 10% of license cost
        },
        annualCost: 0,
        percentage: 15 // 15% of annual license cost
      },
      {
        id: 'mp_premium',
        name: 'Premium Maintenance',
        coverage: 'Comprehensive plus disaster recovery',
        includesFeatures: {
          bugFixes: true,
          securityUpdates: true,
          performanceOptimization: true,
          dataBackups: true,
          disasterRecovery: true,
          upgradesCost: 15 // 15% of license cost
        },
        annualCost: 0,
        percentage: 25 // 25% of annual license cost
      }
    ];
  }

  /**
   * Generate custom pricing quote
   */
  generateCustomQuote(
    basePrice: number,
    options: {
      volumeUnits?: number;
      contractYears?: number;
      supportTier?: 'standard' | 'premium' | 'enterprise';
      maintenanceTier?: 'standard' | 'comprehensive' | 'premium';
      customizations?: Array<{ name: string; cost: number }>;
    }
  ): {
    basePrice: number;
    volumeDiscount: number;
    contractDiscount: number;
    supportCost: number;
    maintenanceCost: number;
    customizationsCost: number;
    totalAnnualCost: number;
    totalCommitmentCost: number;
    breakdown: string[];
  } {
    let workingPrice = basePrice;
    let volumeDiscount = 0;
    let contractDiscount = 0;
    let supportCost = 0;
    let maintenanceCost = 0;
    let customizationsCost = 0;

    // Volume discount
    if (options.volumeUnits && options.volumeUnits > 1) {
      const volumeCalc = this.calculateVolumeDiscount(
        options.volumeUnits,
        basePrice
      );
      volumeDiscount = volumeCalc.savings;
      workingPrice = volumeCalc.discountedPrice;
    }

    // Contract discount
    if (options.contractYears && options.contractYears > 1) {
      const contractCalc = this.calculateMultiYearDiscount(
        workingPrice,
        options.contractYears
      );
      contractDiscount =
        workingPrice * options.contractYears - contractCalc.totalPrice;
      workingPrice = contractCalc.annualPrice;
    }

    // Support cost
    const supportPackages = this.getSupportPackages();
    const supportPkg = supportPackages.find(p =>
      p.tier === (options.supportTier || 'standard')
    );
    supportCost = supportPkg?.annualCost || 0;

    // Maintenance cost
    const maintenancePackages = this.getMaintenancePackages();
    const maintenancePkg = maintenancePackages.find(p =>
      p.id === `mp_${options.maintenanceTier || 'standard'}`
    );
    maintenanceCost = (workingPrice * (maintenancePkg?.percentage || 0)) / 100;

    // Customizations
    customizationsCost = (options.customizations || []).reduce(
      (sum, c) => sum + c.cost,
      0
    );

    const totalAnnualCost =
      workingPrice + supportCost + maintenanceCost + customizationsCost;
    const totalCommitmentCost =
      totalAnnualCost * (options.contractYears || 1);

    const breakdown = [
      `Base License: $${basePrice.toLocaleString()}`,
      volumeDiscount > 0
        ? `Volume Discount: -$${volumeDiscount.toLocaleString()}`
        : null,
      contractDiscount > 0
        ? `Contract Discount: -$${contractDiscount.toLocaleString()}`
        : null,
      supportCost > 0 ? `Support (${options.supportTier}): $${supportCost.toLocaleString()}` : null,
      maintenanceCost > 0
        ? `Maintenance: $${maintenanceCost.toLocaleString()}`
        : null,
      customizationsCost > 0
        ? `Customizations: $${customizationsCost.toLocaleString()}`
        : null
    ].filter((item): item is string => item !== null);

    return {
      basePrice,
      volumeDiscount,
      contractDiscount,
      supportCost,
      maintenanceCost,
      customizationsCost,
      totalAnnualCost,
      totalCommitmentCost,
      breakdown
    };
  }

  /**
   * Payment terms options
   */
  getPaymentTerms() {
    return {
      standard: {
        net30: 'Net 30 - Payment due within 30 days',
        net60: 'Net 60 - Payment due within 60 days',
        net90: 'Net 90 - Payment due within 90 days'
      },
      specialized: {
        upfront: 'Full upfront payment - 2% discount',
        installment: 'Monthly installments - Available for contracts > 1 year',
        quarterly: 'Quarterly billing - Available for all contracts',
        arrears: 'Arrears (payment at end of period) - Available for qualified accounts'
      },
      requirements: {
        creditCard: 'Credit card on file required',
        bankTransfer: 'Bank transfer for amounts > $50,000',
        purchaseOrder: 'Purchase order required for corporate accounts',
        autoPayment: 'Auto-payment setup required'
      }
    };
  }

  /**
   * Estimate annual ROI
   */
  estimateROI(
    investmentAmount: number,
    estimatedAnnualBenefit: number,
    implementationCost: number
  ): {
    totalInvestment: number;
    annualBenefit: number;
    paybackMonths: number;
    threeYearROI: number;
    roiPercentage: number;
  } {
    const totalInvestment = investmentAmount + implementationCost;
    const annualBenefit = estimatedAnnualBenefit;
    const paybackMonths = (totalInvestment / annualBenefit) * 12;
    const threeYearBenefit = annualBenefit * 3;
    const threeYearROI = ((threeYearBenefit - totalInvestment) / totalInvestment) * 100;

    return {
      totalInvestment,
      annualBenefit,
      paybackMonths: Math.ceil(paybackMonths),
      threeYearROI: Math.round(threeYearROI),
      roiPercentage: Math.round((annualBenefit / totalInvestment) * 100)
    };
  }
}

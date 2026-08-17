import { Router, Request, Response } from 'express';
import { EnterprisePartnerService } from '../services/EnterprisePartnerService';
import { authenticateUser, requireAdmin } from '../middleware/auth';

const router = Router();
const partnerService = new EnterprisePartnerService();

/**
 * @route GET /api/enterprise-partners/tiers
 * @desc Get partner tiers
 * @access Public
 */
router.get('/tiers', (req: Request, res: Response) => {
  try {
    const tiers = partnerService.getPartnerTiers();

    res.json({
      success: true,
      data: { tiers }
    });
  } catch (error) {
    console.error('Error fetching partner tiers:', error);
    res.status(500).json({
      error: 'Failed to fetch partner tiers',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/enterprise-partners/create
 * @desc Create new partner relationship
 * @access Private/Admin
 */
router.post(
  '/create',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { companyInfo, tier } = req.body;

      if (!companyInfo) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'companyInfo is required'
        });
      }

      const partner = await partnerService.createPartner(
        companyInfo,
        tier || 'pt_select'
      );

      res.status(201).json({
        success: true,
        data: { partner }
      });
    } catch (error) {
      console.error('Error creating partner:', error);
      res.status(500).json({
        error: 'Failed to create partner',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/enterprise-partners/revenue-sharing-models
 * @desc Get revenue sharing models
 * @access Public
 */
router.get('/revenue-sharing-models', (req: Request, res: Response) => {
  try {
    const models = partnerService.getRevenueSharingModels();

    res.json({
      success: true,
      data: { models }
    });
  } catch (error) {
    console.error('Error fetching revenue sharing models:', error);
    res.status(500).json({
      error: 'Failed to fetch revenue sharing models',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/enterprise-partners/calculate-revenue-share
 * @desc Calculate revenue share payment
 * @access Private
 */
router.post(
  '/calculate-revenue-share',
  authenticateUser,
  (req: Request, res: Response) => {
    try {
      const { dealValue, revenueSharePercentage, annualRevenue } = req.body;

      if (!dealValue || !revenueSharePercentage) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'dealValue and revenueSharePercentage are required'
        });
      }

      const calculation = partnerService.calculateRevenueShare(
        dealValue,
        revenueSharePercentage,
        annualRevenue
      );

      res.json({
        success: true,
        data: { calculation }
      });
    } catch (error) {
      console.error('Error calculating revenue share:', error);
      res.status(500).json({
        error: 'Failed to calculate revenue share',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/enterprise-partners/cosell-agreement
 * @desc Create co-sell agreement
 * @access Private
 */
router.post(
  '/cosell-agreement',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const { partnerId, customerId, dealInfo } = req.body;

      if (!partnerId || !customerId || !dealInfo) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'partnerId, customerId, and dealInfo are required'
        });
      }

      const agreement = await partnerService.createCoSellAgreement(
        partnerId,
        customerId,
        dealInfo
      );

      res.status(201).json({
        success: true,
        data: { agreement }
      });
    } catch (error) {
      console.error('Error creating co-sell agreement:', error);
      res.status(500).json({
        error: 'Failed to create co-sell agreement',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/enterprise-partners/go-to-market
 * @desc Get go-to-market strategies
 * @access Public
 */
router.get('/go-to-market', (req: Request, res: Response) => {
  try {
    const strategies = partnerService.getGoToMarketStrategies();

    res.json({
      success: true,
      data: { strategies }
    });
  } catch (error) {
    console.error('Error fetching go-to-market strategies:', error);
    res.status(500).json({
      error: 'Failed to fetch go-to-market strategies',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/enterprise-partners/enablement-program
 * @desc Get partner enablement program
 * @access Public
 */
router.get('/enablement-program', (req: Request, res: Response) => {
  try {
    const program = partnerService.getPartnerEnablementProgram();

    res.json({
      success: true,
      data: { program }
    });
  } catch (error) {
    console.error('Error fetching enablement program:', error);
    res.status(500).json({
      error: 'Failed to fetch enablement program',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/enterprise-partners/program-summary
 * @desc Get complete enterprise partner program summary
 * @access Public
 */
router.get('/program-summary', (req: Request, res: Response) => {
  try {
    const summary = {
      name: 'Enterprise Partner Program',
      description: 'Strategic partnership opportunities for resellers, integrators, technology partners, and consultants',
      tiers: partnerService.getPartnerTiers(),
      revenueSharingModels: partnerService.getRevenueSharingModels(),
      goToMarketStrategies: partnerService.getGoToMarketStrategies(),
      enablementProgram: partnerService.getPartnerEnablementProgram(),
      applicationProcess: {
        step1: 'Company qualification review',
        step2: 'Partner proposal discussion',
        step3: 'Due diligence',
        step4: 'Contract execution',
        step5: 'Onboarding and enablement',
        step6: 'Ongoing partner management'
      },
      successMetrics: {
        revenue: 'Annual sales target',
        customers: 'Customer acquisitions',
        satisfaction: 'Net Promoter Score',
        growth: 'Year-over-year growth rate',
        execution: 'Implementation success rate'
      }
    };

    res.json({
      success: true,
      data: { summary }
    });
  } catch (error) {
    console.error('Error fetching program summary:', error);
    res.status(500).json({
      error: 'Failed to fetch program summary',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;

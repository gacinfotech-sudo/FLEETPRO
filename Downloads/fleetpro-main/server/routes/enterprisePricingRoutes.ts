import { Router, Request, Response } from 'express';
import { EnterprisePricingService } from '../services/EnterprisePricingService';
import { authenticateUser, requireAdmin } from '../middleware/auth';

const router = Router();
const pricingService = new EnterprisePricingService();

/**
 * @route GET /api/enterprise-pricing/models
 * @desc Get available pricing models
 * @access Public
 */
router.get('/models', (req: Request, res: Response) => {
  try {
    const models = pricingService.getPricingModels();

    res.json({
      success: true,
      data: { models }
    });
  } catch (error) {
    console.error('Error fetching pricing models:', error);
    res.status(500).json({
      error: 'Failed to fetch pricing models',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/enterprise-pricing/volume-discount
 * @desc Calculate volume discount
 * @access Public
 */
router.post('/volume-discount', (req: Request, res: Response) => {
  try {
    const { units, basePrice } = req.body;

    if (!units || !basePrice) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'units and basePrice are required'
      });
    }

    const discount = pricingService.calculateVolumeDiscount(units, basePrice);

    res.json({
      success: true,
      data: { discount }
    });
  } catch (error) {
    console.error('Error calculating volume discount:', error);
    res.status(500).json({
      error: 'Failed to calculate volume discount',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/enterprise-pricing/multi-year-discount
 * @desc Calculate multi-year contract discount
 * @access Public
 */
router.post('/multi-year-discount', (req: Request, res: Response) => {
  try {
    const { basePrice, years } = req.body;

    if (!basePrice || !years) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'basePrice and years are required'
      });
    }

    const discount = pricingService.calculateMultiYearDiscount(basePrice, years);

    res.json({
      success: true,
      data: { discount }
    });
  } catch (error) {
    console.error('Error calculating multi-year discount:', error);
    res.status(500).json({
      error: 'Failed to calculate multi-year discount',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/enterprise-pricing/contract-terms
 * @desc Get contract terms options
 * @access Public
 */
router.get('/contract-terms', (req: Request, res: Response) => {
  try {
    const terms = pricingService.getContractTerms();

    res.json({
      success: true,
      data: { terms }
    });
  } catch (error) {
    console.error('Error fetching contract terms:', error);
    res.status(500).json({
      error: 'Failed to fetch contract terms',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/enterprise-pricing/support-packages
 * @desc Get support packages
 * @access Public
 */
router.get('/support-packages', (req: Request, res: Response) => {
  try {
    const packages = pricingService.getSupportPackages();

    res.json({
      success: true,
      data: { packages }
    });
  } catch (error) {
    console.error('Error fetching support packages:', error);
    res.status(500).json({
      error: 'Failed to fetch support packages',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/enterprise-pricing/maintenance-packages
 * @desc Get maintenance and support pricing
 * @access Public
 */
router.get('/maintenance-packages', (req: Request, res: Response) => {
  try {
    const packages = pricingService.getMaintenancePackages();

    res.json({
      success: true,
      data: { packages }
    });
  } catch (error) {
    console.error('Error fetching maintenance packages:', error);
    res.status(500).json({
      error: 'Failed to fetch maintenance packages',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/enterprise-pricing/custom-quote
 * @desc Generate custom pricing quote
 * @access Private
 */
router.post(
  '/custom-quote',
  authenticateUser,
  (req: Request, res: Response) => {
    try {
      const { basePrice, options } = req.body;

      if (!basePrice) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'basePrice is required'
        });
      }

      const quote = pricingService.generateCustomQuote(basePrice, options || {});

      res.json({
        success: true,
        data: { quote }
      });
    } catch (error) {
      console.error('Error generating custom quote:', error);
      res.status(500).json({
        error: 'Failed to generate custom quote',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/enterprise-pricing/payment-terms
 * @desc Get payment terms options
 * @access Public
 */
router.get('/payment-terms', (req: Request, res: Response) => {
  try {
    const terms = pricingService.getPaymentTerms();

    res.json({
      success: true,
      data: { terms }
    });
  } catch (error) {
    console.error('Error fetching payment terms:', error);
    res.status(500).json({
      error: 'Failed to fetch payment terms',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/enterprise-pricing/roi-estimate
 * @desc Estimate annual ROI
 * @access Public
 */
router.post('/roi-estimate', (req: Request, res: Response) => {
  try {
    const { investmentAmount, estimatedAnnualBenefit, implementationCost } =
      req.body;

    if (
      investmentAmount === undefined ||
      estimatedAnnualBenefit === undefined ||
      implementationCost === undefined
    ) {
      return res.status(400).json({
        error: 'Invalid request',
        message:
          'investmentAmount, estimatedAnnualBenefit, and implementationCost are required'
      });
    }

    const roi = pricingService.estimateROI(
      investmentAmount,
      estimatedAnnualBenefit,
      implementationCost
    );

    res.json({
      success: true,
      data: { roi }
    });
  } catch (error) {
    console.error('Error estimating ROI:', error);
    res.status(500).json({
      error: 'Failed to estimate ROI',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/enterprise-pricing/summary
 * @desc Get enterprise pricing summary
 * @access Public
 */
router.get('/summary', (req: Request, res: Response) => {
  try {
    const summary = {
      models: pricingService.getPricingModels(),
      supportPackages: pricingService.getSupportPackages(),
      maintenancePackages: pricingService.getMaintenancePackages(),
      contractTerms: pricingService.getContractTerms(),
      paymentTerms: pricingService.getPaymentTerms(),
      volumeDiscounts: {
        description: '10-25% discount for multi-unit deployments',
        tiers: [
          { units: '1-10', discount: 'No discount' },
          { units: '11-50', discount: '10%' },
          { units: '51-100', discount: '15%' },
          { units: '101-250', discount: '20%' },
          { units: '250+', discount: '25%' }
        ]
      },
      multiYearDiscounts: {
        description: '5-15% discount for longer commitments',
        tiers: [
          { years: 1, discount: 'No discount' },
          { years: 2, discount: '5%' },
          { years: 3, discount: '10%' },
          { years: 5, discount: '15%' }
        ]
      }
    };

    res.json({
      success: true,
      data: { summary }
    });
  } catch (error) {
    console.error('Error fetching pricing summary:', error);
    res.status(500).json({
      error: 'Failed to fetch pricing summary',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;

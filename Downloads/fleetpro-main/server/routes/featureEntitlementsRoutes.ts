import { Router, Request, Response } from 'express';
import { FeatureEntitlementsService } from '../services/FeatureEntitlementsService';
import { authenticateUser } from '../middleware/auth';

const router = Router();
const entitlementsService = new FeatureEntitlementsService();

/**
 * @route GET /api/features/available
 * @desc Get all available features for authenticated tenant
 * @access Private
 */
router.get('/features/available', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found' });
    }

    const features = await entitlementsService.getAvailableFeatures(tenantId);

    res.json({
      success: true,
      data: { features }
    });
  } catch (error) {
    console.error('Error fetching available features:', error);
    res.status(500).json({
      error: 'Failed to fetch features',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/features/check/:feature
 * @desc Check if tenant has access to a specific feature
 * @access Private
 */
router.get('/features/check/:feature', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const feature = req.params.feature;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found' });
    }

    const result = await entitlementsService.hasFeatureAccess(tenantId, feature);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error checking feature access:', error);
    res.status(500).json({
      error: 'Failed to check feature access',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/features/api-limits
 * @desc Get API rate limits for authenticated tenant's plan
 * @access Private
 */
router.get('/features/api-limits', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found' });
    }

    const features = await entitlementsService.getAvailableFeatures(tenantId);

    res.json({
      success: true,
      data: {
        planCode: features.planCode,
        planName: features.planName,
        apiLimits: features.apiLimit
      }
    });
  } catch (error) {
    console.error('Error fetching API limits:', error);
    res.status(500).json({
      error: 'Failed to fetch API limits',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/features/support-level
 * @desc Get support level for authenticated tenant's plan
 * @access Private
 */
router.get('/features/support-level', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found' });
    }

    const features = await entitlementsService.getAvailableFeatures(tenantId);

    res.json({
      success: true,
      data: {
        planCode: features.planCode,
        planName: features.planName,
        supportLevel: features.supportLevel
      }
    });
  } catch (error) {
    console.error('Error fetching support level:', error);
    res.status(500).json({
      error: 'Failed to fetch support level',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/features/can-perform
 * @desc Check if tenant can perform a specific action
 * @access Private
 */
router.post('/features/can-perform', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { action, params } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found' });
    }

    if (!action) {
      return res.status(400).json({ error: 'action is required' });
    }

    const result = await entitlementsService.canPerformAction(tenantId, action, params);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error checking action permission:', error);
    res.status(500).json({
      error: 'Failed to check action permission',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/features/upgrade-recommendation
 * @desc Get upgrade recommendation for authenticated tenant
 * @access Private
 */
router.get('/features/upgrade-recommendation', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found' });
    }

    const recommendation = await entitlementsService.getUpgradeRecommendation(tenantId);

    res.json({
      success: true,
      data: { recommendation }
    });
  } catch (error) {
    console.error('Error fetching upgrade recommendation:', error);
    res.status(500).json({
      error: 'Failed to fetch upgrade recommendation',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/plans/compare
 * @desc Compare all available plans (public endpoint)
 * @access Public
 */
router.get('/plans/compare', async (req: Request, res: Response) => {
  try {
    const comparison = await entitlementsService.comparePlans();

    res.json({
      success: true,
      data: { plans: comparison }
    });
  } catch (error) {
    console.error('Error comparing plans:', error);
    res.status(500).json({
      error: 'Failed to compare plans',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;

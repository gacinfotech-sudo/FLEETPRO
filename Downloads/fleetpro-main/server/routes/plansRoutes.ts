import { Router, Request, Response } from 'express';
import { PlansService } from '../services/PlansService';
import { authenticateUser } from '../middleware/auth';

const router = Router();
const plansService = new PlansService();

// Middleware to check if user is admin
const requireAdmin = (req: Request, res: Response, next: Function) => {
  const user = (req as any).user;
  if (user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * @route GET /api/plans
 * @desc Get all active plans (public endpoint)
 * @access Public
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = await plansService.getAllPlans();
    res.json({
      success: true,
      data: { plans }
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({
      error: 'Failed to fetch plans',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/plans/:planId
 * @desc Get plan by ID
 * @access Public
 */
router.get('/plans/:planId', async (req: Request, res: Response) => {
  try {
    const plan = await plansService.getPlanById(req.params.planId);

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({
      success: true,
      data: { plan }
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({
      error: 'Failed to fetch plan',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/plans/code/:code
 * @desc Get plan by code
 * @access Public
 */
router.get('/plans/code/:code', async (req: Request, res: Response) => {
  try {
    const plan = await plansService.getPlanByCode(req.params.code);

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({
      success: true,
      data: { plan }
    });
  } catch (error) {
    console.error('Error fetching plan by code:', error);
    res.status(500).json({
      error: 'Failed to fetch plan',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/admin/plans
 * @desc Create new plan (admin only)
 * @access Private/Admin
 */
router.post('/admin/plans', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, code, description, pricing, limits, features, trial } = req.body;

    // Validate required fields
    if (!name || !code || !pricing || !limits) {
      return res.status(400).json({
        error: 'Missing required fields: name, code, pricing, limits'
      });
    }

    if (!pricing.monthlyUsd || !limits.maxVehicles || !limits.maxDrivers || !limits.maxUsers) {
      return res.status(400).json({
        error: 'Invalid pricing or limits structure'
      });
    }

    const plan = await plansService.createPlan({
      name,
      code,
      description,
      pricing,
      limits,
      features,
      trial
    });

    res.status(201).json({
      success: true,
      data: { plan },
      message: 'Plan created successfully'
    });
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({
      error: 'Failed to create plan',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route PUT /api/admin/plans/:planId
 * @desc Update plan (admin only)
 * @access Private/Admin
 */
router.put('/admin/plans/:planId', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const plan = await plansService.updatePlan(req.params.planId, req.body);

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({
      success: true,
      data: { plan },
      message: 'Plan updated successfully'
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({
      error: 'Failed to update plan',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route DELETE /api/admin/plans/:planId
 * @desc Deactivate plan (soft delete, admin only)
 * @access Private/Admin
 */
router.delete('/admin/plans/:planId', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const plan = await plansService.deactivatePlan(req.params.planId);

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({
      success: true,
      data: { plan },
      message: 'Plan deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating plan:', error);
    res.status(500).json({
      error: 'Failed to deactivate plan',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/admin/plans/:planId/reactivate
 * @desc Reactivate plan (admin only)
 * @access Private/Admin
 */
router.post('/admin/plans/:planId/reactivate', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const plan = await plansService.reactivatePlan(req.params.planId);

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({
      success: true,
      data: { plan },
      message: 'Plan reactivated successfully'
    });
  } catch (error) {
    console.error('Error reactivating plan:', error);
    res.status(500).json({
      error: 'Failed to reactivate plan',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/admin/plans/:planId/archive
 * @desc Archive plan (admin only)
 * @access Private/Admin
 */
router.post('/admin/plans/:planId/archive', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const plan = await plansService.archivePlan(req.params.planId);

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({
      success: true,
      data: { plan },
      message: 'Plan archived successfully'
    });
  } catch (error) {
    console.error('Error archiving plan:', error);
    res.status(500).json({
      error: 'Failed to archive plan',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/admin/plans
 * @desc Get all plans including inactive (admin only)
 * @access Private/Admin
 */
router.get('/admin/plans', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const plans = await plansService.getAllPlansAdmin();
    res.json({
      success: true,
      data: { plans }
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({
      error: 'Failed to fetch plans',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;

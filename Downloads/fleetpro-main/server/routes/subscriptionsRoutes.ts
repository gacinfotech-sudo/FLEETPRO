import { Router, Request, Response } from 'express';
import { SubscriptionsService } from '../services/SubscriptionsService';
import { authenticateUser } from '../middleware/auth';

const router = Router();
const subscriptionsService = new SubscriptionsService();

// Middleware to check if user is admin
const requireAdmin = (req: Request, res: Response, next: Function) => {
  const user = (req as any).user;
  if (user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * @route GET /api/subscriptions/current
 * @desc Get current subscription for authenticated tenant
 * @access Private
 */
router.get('/subscriptions/current', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in session' });
    }

    const subscription = await subscriptionsService.getSubscriptionByTenantId(tenantId);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({
      success: true,
      data: { subscription }
    });
  } catch (error) {
    console.error('Error fetching current subscription:', error);
    res.status(500).json({
      error: 'Failed to fetch subscription',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/subscriptions/:subscriptionId
 * @desc Get subscription by ID (admin)
 * @access Private/Admin
 */
router.get('/subscriptions/:subscriptionId', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const subscription = await subscriptionsService.getSubscriptionById(req.params.subscriptionId);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({
      success: true,
      data: { subscription }
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({
      error: 'Failed to fetch subscription',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/subscriptions/status/:status
 * @desc Get subscriptions by status (admin)
 * @access Private/Admin
 */
router.get('/subscriptions/status/:status', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const subscriptions = await subscriptionsService.getSubscriptionsByStatus(req.params.status);

    res.json({
      success: true,
      data: { subscriptions, count: subscriptions.length }
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({
      error: 'Failed to fetch subscriptions',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/subscriptions/renewal/due
 * @desc Get subscriptions due for renewal (admin)
 * @access Private/Admin
 */
router.get('/subscriptions/renewal/due', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const daysFromNow = req.query.days ? parseInt(req.query.days as string) : 7;
    const subscriptions = await subscriptionsService.getSubscriptionsDueForRenewal(daysFromNow);

    res.json({
      success: true,
      data: { subscriptions, count: subscriptions.length }
    });
  } catch (error) {
    console.error('Error fetching renewals:', error);
    res.status(500).json({
      error: 'Failed to fetch renewals',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/subscriptions/change-plan
 * @desc Change subscription plan (upgrade/downgrade)
 * @access Private
 */
router.post('/subscriptions/change-plan', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { newPlanId } = req.body;

    if (!newPlanId) {
      return res.status(400).json({ error: 'newPlanId is required' });
    }

    const result = await subscriptionsService.changeSubscription(tenantId, newPlanId);

    res.json({
      success: result.success,
      data: { subscription: result.subscription },
      message: result.message
    });
  } catch (error) {
    console.error('Error changing subscription:', error);
    res.status(500).json({
      error: 'Failed to change subscription',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/subscriptions/usage
 * @desc Get usage statistics for current tenant
 * @access Private
 */
router.get('/subscriptions/usage', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const usage = await subscriptionsService.getUsageStats(tenantId);

    // Get current subscription to get limits
    const subscription = await subscriptionsService.getSubscriptionByTenantId(tenantId);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const plan = (subscription.planId as any);

    res.json({
      success: true,
      data: {
        usage: {
          vehicles: {
            current: usage.vehicles,
            limit: plan.limits.maxVehicles,
            percentageUsed: Math.round((usage.vehicles / plan.limits.maxVehicles) * 100)
          },
          drivers: {
            current: usage.drivers,
            limit: plan.limits.maxDrivers,
            percentageUsed: Math.round((usage.drivers / plan.limits.maxDrivers) * 100)
          },
          users: {
            current: usage.users,
            limit: plan.limits.maxUsers,
            percentageUsed: Math.round((usage.users / plan.limits.maxUsers) * 100)
          }
        }
      }
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({
      error: 'Failed to fetch usage',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/admin/subscriptions/:tenantId/suspend
 * @desc Suspend subscription (admin)
 * @access Private/Admin
 */
router.post('/admin/subscriptions/:tenantId/suspend', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const subscription = await subscriptionsService.suspendSubscription(req.params.tenantId, reason);

    res.json({
      success: true,
      data: { subscription },
      message: 'Subscription suspended'
    });
  } catch (error) {
    console.error('Error suspending subscription:', error);
    res.status(500).json({
      error: 'Failed to suspend subscription',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/admin/subscriptions/:tenantId/lock
 * @desc Lock tenant (admin)
 * @access Private/Admin
 */
router.post('/admin/subscriptions/:tenantId/lock', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const subscription = await subscriptionsService.lockTenant(req.params.tenantId, reason);

    res.json({
      success: true,
      data: { subscription },
      message: 'Tenant locked'
    });
  } catch (error) {
    console.error('Error locking tenant:', error);
    res.status(500).json({
      error: 'Failed to lock tenant',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/admin/subscriptions/:tenantId/unlock
 * @desc Unlock tenant (admin)
 * @access Private/Admin
 */
router.post('/admin/subscriptions/:tenantId/unlock', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const subscription = await subscriptionsService.unlockTenant(req.params.tenantId);

    res.json({
      success: true,
      data: { subscription },
      message: 'Tenant unlocked'
    });
  } catch (error) {
    console.error('Error unlocking tenant:', error);
    res.status(500).json({
      error: 'Failed to unlock tenant',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/admin/subscriptions/:tenantId/cancel
 * @desc Cancel subscription (admin)
 * @access Private/Admin
 */
router.post('/admin/subscriptions/:tenantId/cancel', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const subscription = await subscriptionsService.cancelSubscription(req.params.tenantId, reason);

    res.json({
      success: true,
      data: { subscription },
      message: 'Subscription cancelled'
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      error: 'Failed to cancel subscription',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;

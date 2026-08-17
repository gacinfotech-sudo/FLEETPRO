import { Router, Request, Response } from 'express';
import { TrialManagementService } from '../services/TrialManagementService';
import { authenticateUser } from '../middleware/auth';

const router = Router();
const trialService = new TrialManagementService();

// Middleware to check if user is admin
const requireAdmin = (req: Request, res: Response, next: Function) => {
  const user = (req as any).user;
  if (user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * @route GET /api/trials/status
 * @desc Get trial status for authenticated tenant
 * @access Private
 */
router.get('/trials/status', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found' });
    }

    const trialStatus = await trialService.getTrialStatus(tenantId);

    res.json({
      success: true,
      data: { trialStatus }
    });
  } catch (error) {
    console.error('Error fetching trial status:', error);
    res.status(500).json({
      error: 'Failed to fetch trial status',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/trials/convert-to-paid
 * @desc Convert trial to paid subscription
 * @access Private
 */
router.post('/trials/convert-to-paid', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { paymentMethodId, autoRenew } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found' });
    }

    const result = await trialService.convertTrialToPaid(tenantId, {
      paymentMethodId,
      autoRenew: autoRenew !== false // Default to true
    });

    res.json({
      success: result.success,
      data: { subscription: result.subscription },
      message: result.message
    });
  } catch (error) {
    console.error('Error converting trial to paid:', error);
    res.status(500).json({
      error: 'Failed to convert trial',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/admin/trials/expiring
 * @desc Get all trials expiring soon (admin only)
 * @access Private/Admin
 */
router.get('/admin/trials/expiring', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const daysFromNow = req.query.days ? parseInt(req.query.days as string) : 7;
    const trials = await trialService.getExpiringTrials(daysFromNow);

    res.json({
      success: true,
      data: {
        trials,
        count: trials.length,
        expiringWithin: `${daysFromNow} days`
      }
    });
  } catch (error) {
    console.error('Error fetching expiring trials:', error);
    res.status(500).json({
      error: 'Failed to fetch expiring trials',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/admin/trials/expired
 * @desc Get all expired trials (admin only)
 * @access Private/Admin
 */
router.get('/admin/trials/expired', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const trials = await trialService.getExpiredTrials();

    res.json({
      success: true,
      data: {
        trials,
        count: trials.length
      }
    });
  } catch (error) {
    console.error('Error fetching expired trials:', error);
    res.status(500).json({
      error: 'Failed to fetch expired trials',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/admin/trials/:tenantId/extend
 * @desc Extend trial period (admin only)
 * @access Private/Admin
 */
router.post('/admin/trials/:tenantId/extend', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { additionalDays, reason } = req.body;

    if (!additionalDays || additionalDays < 1) {
      return res.status(400).json({ error: 'additionalDays must be at least 1' });
    }

    const subscription = await trialService.extendTrial(
      req.params.tenantId,
      additionalDays,
      reason || 'Manual extension by admin'
    );

    res.json({
      success: true,
      data: { subscription },
      message: `Trial extended by ${additionalDays} days`
    });
  } catch (error) {
    console.error('Error extending trial:', error);
    res.status(500).json({
      error: 'Failed to extend trial',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/admin/trials/analytics
 * @desc Get trial analytics and conversion metrics (admin only)
 * @access Private/Admin
 */
router.get('/admin/trials/analytics', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const analytics = await trialService.getTrialAnalytics();

    res.json({
      success: true,
      data: { analytics }
    });
  } catch (error) {
    console.error('Error fetching trial analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch trial analytics',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/admin/trials/send-reminders
 * @desc Send trial expiration reminders (admin/scheduler only)
 * @access Private/Admin
 */
router.post('/admin/trials/send-reminders', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await trialService.sendTrialReminders();

    res.json({
      success: true,
      data: result,
      message: `Reminders sent: ${result.sent}, Failed: ${result.failed}`
    });
  } catch (error) {
    console.error('Error sending reminders:', error);
    res.status(500).json({
      error: 'Failed to send reminders',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/admin/trials/suspend-expired
 * @desc Suspend all expired trials (cleanup job, admin only)
 * @access Private/Admin
 */
router.post('/admin/trials/suspend-expired', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await trialService.suspendExpiredTrials();

    res.json({
      success: true,
      data: result,
      message: `Expired trials suspended: ${result.suspended}`
    });
  } catch (error) {
    console.error('Error suspending expired trials:', error);
    res.status(500).json({
      error: 'Failed to suspend expired trials',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { BillingService } from '../services/BillingService';
import { SubscriptionsService } from '../services/SubscriptionsService';
import { authenticateUser } from '../middleware/auth';

const router = Router();
const billingService = new BillingService();
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
 * @route GET /api/billing/current
 * @desc Get current billing information for authenticated tenant
 * @access Private
 */
router.get('/billing/current', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found' });
    }

    const subscription = await subscriptionsService.getSubscriptionByTenantId(tenantId);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const costs = await billingService.getSubscriptionCosts(subscription._id);

    res.json({
      success: true,
      data: { costs }
    });
  } catch (error) {
    console.error('Error fetching billing info:', error);
    res.status(500).json({
      error: 'Failed to fetch billing information',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/billing/history
 * @desc Get billing history for authenticated tenant
 * @access Private
 */
router.get('/billing/history', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 12;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found' });
    }

    const history = await billingService.getBillingHistory(tenantId, limit);

    res.json({
      success: true,
      data: { history, count: history.length }
    });
  } catch (error) {
    console.error('Error fetching billing history:', error);
    res.status(500).json({
      error: 'Failed to fetch billing history',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/billing/process-payment
 * @desc Process payment for subscription
 * @access Private
 */
router.post('/billing/process-payment', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { amount, paymentMethod, transactionId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found' });
    }

    if (!amount || !paymentMethod || !transactionId) {
      return res.status(400).json({
        error: 'Missing required fields: amount, paymentMethod, transactionId'
      });
    }

    const subscription = await subscriptionsService.getSubscriptionByTenantId(tenantId);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const result = await billingService.processPayment(subscription._id, {
      amount,
      paymentMethod: paymentMethod as 'card' | 'bank_transfer' | 'upi' | 'wallet',
      transactionId,
      status: 'success'
    });

    res.json({
      success: result.success,
      data: { subscription: result.subscription },
      message: result.message
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      error: 'Failed to process payment',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/billing/invoice/:subscriptionId
 * @desc Generate invoice for subscription (admin only)
 * @access Private/Admin
 */
router.get('/billing/invoice/:subscriptionId', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const invoice = await billingService.generateInvoice(req.params.subscriptionId);

    res.json({
      success: true,
      data: { invoice }
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({
      error: 'Failed to generate invoice',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/billing/plan-change/calculate
 * @desc Calculate pro-rata credit for plan downgrade
 * @access Private
 */
router.post('/billing/plan-change/calculate', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { newPlanId } = req.body;

    if (!tenantId || !newPlanId) {
      return res.status(400).json({ error: 'tenantId and newPlanId are required' });
    }

    const subscription = await subscriptionsService.getSubscriptionByTenantId(tenantId);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const { Plan } = require('../models');
    const newPlan = await Plan.findById(newPlanId);
    if (!newPlan) {
      return res.status(404).json({ error: 'New plan not found' });
    }

    const currentPlan = subscription.planId as any;
    const proration = billingService.calculateProRataCredit(
      currentPlan,
      newPlan,
      subscription.billingCycle,
      subscription.renewalDate
    );

    res.json({
      success: true,
      data: {
        currentPlan: currentPlan.name,
        newPlan: newPlan.name,
        proration
      }
    });
  } catch (error) {
    console.error('Error calculating proration:', error);
    res.status(500).json({
      error: 'Failed to calculate proration',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/billing/failed-payment/initiate-recovery
 * @desc Initiate dunning process for failed payment (admin only)
 * @access Private/Admin
 */
router.post('/billing/failed-payment/initiate-recovery', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { subscriptionId, retryAttempt } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'subscriptionId is required' });
    }

    const result = await billingService.initiateDunning(subscriptionId, retryAttempt || 1);

    res.json({
      success: result.success,
      data: {
        nextRetryDate: result.nextRetryDate,
        shouldSuspend: result.shouldSuspend
      },
      message: result.message
    });
  } catch (error) {
    console.error('Error initiating dunning:', error);
    res.status(500).json({
      error: 'Failed to initiate payment recovery',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/admin/billing/subscriptions-due-renewal
 * @desc Get subscriptions due for renewal (admin only)
 * @access Private/Admin
 */
router.get('/admin/billing/subscriptions-due-renewal', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const daysFromNow = req.query.days ? parseInt(req.query.days as string) : 7;
    const subscriptions = await subscriptionsService.getSubscriptionsDueForRenewal(daysFromNow);

    res.json({
      success: true,
      data: {
        subscriptions,
        count: subscriptions.length,
        renewingWithin: `${daysFromNow} days`
      }
    });
  } catch (error) {
    console.error('Error fetching subscriptions due for renewal:', error);
    res.status(500).json({
      error: 'Failed to fetch subscriptions',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;

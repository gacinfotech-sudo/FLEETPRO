import { Router, Request, Response } from 'express';
import { PaymentsService } from '../services/PaymentsService';
import { authenticateUser } from '../middleware/auth';

const router = Router();
const paymentsService = new PaymentsService();

/**
 * @route GET /api/payments
 * @desc Get payments for current tenant
 * @access Private
 */
router.get('/payments', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;

    const result = await paymentsService.getPaymentsByTenant(tenantId, { limit, skip });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      error: 'Failed to fetch payments',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/payments/outstanding
 * @desc Get outstanding amount
 * @access Private
 */
router.get('/payments/outstanding', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const outstanding = await paymentsService.getOutstanding(tenantId);

    res.json({
      success: true,
      data: { outstanding }
    });
  } catch (error) {
    console.error('Error fetching outstanding:', error);
    res.status(500).json({
      error: 'Failed to fetch outstanding',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/payments/stats
 * @desc Get payment statistics
 * @access Private
 */
router.get('/payments/stats', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const stats = await paymentsService.getPaymentStats(tenantId);

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({
      error: 'Failed to fetch stats',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/payments/record
 * @desc Record payment against invoice
 * @access Private
 */
router.post('/payments/record', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { invoiceId, amount, paymentMode, transactionReference } = req.body;
    const tenantId = (req as any).tenantId;

    if (!invoiceId || !amount || !paymentMode || !transactionReference) {
      return res.status(400).json({
        error: 'Missing required fields: invoiceId, amount, paymentMode, transactionReference'
      });
    }

    const payment = await paymentsService.recordPayment({
      invoiceId,
      tenantId,
      amount,
      paymentMode,
      transactionReference
    });

    res.json({
      success: true,
      data: { payment },
      message: 'Payment recorded successfully'
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({
      error: 'Failed to record payment',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;

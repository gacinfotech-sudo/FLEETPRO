import { Router, Request, Response } from 'express';
import { InvoicingService } from '../services/InvoicingService';
import { authenticateUser } from '../middleware/auth';

const router = Router();
const invoicingService = new InvoicingService();

const requireAdmin = (req: Request, res: Response, next: Function) => {
  const user = (req as any).user;
  if (user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * @route GET /api/invoices
 * @desc Get invoices for current tenant
 * @access Private
 */
router.get('/invoices', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const status = req.query.status as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;

    const result = await invoicingService.getInvoicesByTenant(tenantId, { status, limit, skip });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      error: 'Failed to fetch invoices',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/invoices/:invoiceId
 * @desc Get invoice by ID
 * @access Private
 */
router.get('/invoices/:invoiceId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const invoice = await invoicingService.getInvoice(req.params.invoiceId);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({
      success: true,
      data: { invoice }
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      error: 'Failed to fetch invoice',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/invoices/number/:invoiceNumber
 * @desc Get invoice by number
 * @access Private
 */
router.get('/invoices/number/:invoiceNumber', authenticateUser, async (req: Request, res: Response) => {
  try {
    const invoice = await invoicingService.getInvoiceByNumber(req.params.invoiceNumber);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({
      success: true,
      data: { invoice }
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      error: 'Failed to fetch invoice',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/invoices/summary
 * @desc Get invoice summary for tenant
 * @access Private
 */
router.get('/invoices/summary', authenticateUser, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const summary = await invoicingService.getInvoiceSummary(tenantId);

    res.json({
      success: true,
      data: { summary }
    });
  } catch (error) {
    console.error('Error fetching invoice summary:', error);
    res.status(500).json({
      error: 'Failed to fetch summary',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/invoices/:invoiceId/pay
 * @desc Record payment for invoice
 * @access Private
 */
router.post('/invoices/:invoiceId/pay', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount required' });
    }

    const invoice = await invoicingService.markInvoicePaid(req.params.invoiceId, amount);

    res.json({
      success: true,
      data: { invoice },
      message: 'Payment recorded'
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({
      error: 'Failed to record payment',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route DELETE /api/invoices/:invoiceId
 * @desc Cancel invoice
 * @access Private
 */
router.delete('/invoices/:invoiceId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const invoice = await invoicingService.cancelInvoice(req.params.invoiceId, reason);

    res.json({
      success: true,
      data: { invoice },
      message: 'Invoice cancelled'
    });
  } catch (error) {
    console.error('Error cancelling invoice:', error);
    res.status(500).json({
      error: 'Failed to cancel invoice',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/admin/invoices/overdue
 * @desc Get all overdue invoices (admin)
 * @access Private/Admin
 */
router.get('/admin/invoices/overdue', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const invoices = await invoicingService.getOverdueInvoices();

    res.json({
      success: true,
      data: { invoices, count: invoices.length }
    });
  } catch (error) {
    console.error('Error fetching overdue invoices:', error);
    res.status(500).json({
      error: 'Failed to fetch invoices',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;

import express, { Router, Request, Response } from 'express';
import CustomerOnboardingService from '../services/CustomerOnboardingService';
import OnboardingMaterialsService from '../services/OnboardingMaterialsService';
import OnboardingMetricsService from '../services/OnboardingMetricsService';
import { AuthRequest, authenticateUser, requireTenant } from '../middleware/auth';

const router = Router();

/**
 * @route POST /api/onboarding/initialize
 * @desc Initialize onboarding for a new customer
 * @access Private
 */
router.post('/initialize', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.body;
    const tenantId = req.tenantId;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const journey = await CustomerOnboardingService.initializeOnboarding(
      tenantId!,
      customerId,
      new Date()
    );

    // Send welcome email
    await CustomerOnboardingService.sendOnboardingEmail(
      customerId,
      req.body.email || `${customerId}@example.com`,
      0,
      ['welcome-email', 'getting-started-guide', 'faq-guide']
    );

    res.status(201).json({
      success: true,
      message: 'Onboarding initialized',
      journey,
    });
  } catch (error) {
    console.error('Error initializing onboarding:', error);
    res.status(500).json({ error: 'Failed to initialize onboarding' });
  }
});

/**
 * @route GET /api/onboarding/:customerId
 * @desc Get onboarding journey for a customer
 * @access Private
 */
router.get('/:customerId', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params;
    const tenantId = req.tenantId;

    const journey = CustomerOnboardingService.getOnboardingJourney(tenantId!, customerId);

    if (!journey) {
      return res.status(404).json({ error: 'Onboarding journey not found' });
    }

    res.json(journey);
  } catch (error) {
    console.error('Error fetching onboarding journey:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding journey' });
  }
});

/**
 * @route PUT /api/onboarding/:customerId/step/:stepIndex
 * @desc Mark a step as completed
 * @access Private
 */
router.put('/:customerId/step/:stepIndex', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, stepIndex } = req.params;
    const tenantId = req.tenantId;

    const stepNum = parseInt(stepIndex);
    if (isNaN(stepNum)) {
      return res.status(400).json({ error: 'Invalid step index' });
    }

    const journey = await CustomerOnboardingService.completeStep(
      tenantId!,
      customerId,
      stepNum
    );

    if (!journey) {
      return res.status(404).json({ error: 'Onboarding journey not found' });
    }

    res.json({
      success: true,
      message: 'Step marked as completed',
      journey,
    });
  } catch (error) {
    console.error('Error completing step:', error);
    res.status(500).json({ error: 'Failed to complete step' });
  }
});

/**
 * @route POST /api/onboarding/:customerId/feature-activation
 * @desc Track feature activation
 * @access Private
 */
router.post('/:customerId/feature-activation', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params;
    const { featureName } = req.body;
    const tenantId = req.tenantId;

    if (!featureName) {
      return res.status(400).json({ error: 'featureName is required' });
    }

    const journey = await CustomerOnboardingService.trackFeatureActivation(
      tenantId!,
      customerId,
      featureName
    );

    if (!journey) {
      return res.status(404).json({ error: 'Onboarding journey not found' });
    }

    // Record metric
    OnboardingMetricsService.trackActivation(customerId, 'feature_activated', featureName);

    res.json({
      success: true,
      message: 'Feature activation tracked',
      journey,
    });
  } catch (error) {
    console.error('Error tracking feature activation:', error);
    res.status(500).json({ error: 'Failed to track feature activation' });
  }
});

/**
 * @route POST /api/onboarding/:customerId/data-import
 * @desc Record data import completion
 * @access Private
 */
router.post('/:customerId/data-import', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params;
    const { recordCount = 0 } = req.body;
    const tenantId = req.tenantId;

    const journey = await CustomerOnboardingService.recordDataImport(
      tenantId!,
      customerId,
      recordCount
    );

    if (!journey) {
      return res.status(404).json({ error: 'Onboarding journey not found' });
    }

    // Record metric
    OnboardingMetricsService.recordDataImport(customerId, recordCount);

    res.json({
      success: true,
      message: 'Data import recorded',
      journey,
    });
  } catch (error) {
    console.error('Error recording data import:', error);
    res.status(500).json({ error: 'Failed to record data import' });
  }
});

/**
 * @route GET /api/onboarding/materials/day/:day
 * @desc Get materials for a specific day
 * @access Private
 */
router.get('/materials/day/:day', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { day } = req.params;
    const dayNum = parseInt(day);

    if (isNaN(dayNum)) {
      return res.status(400).json({ error: 'Invalid day number' });
    }

    const materials = OnboardingMaterialsService.getMaterialsForDay(dayNum);

    res.json({
      day: dayNum,
      materials,
      count: materials.length,
    });
  } catch (error) {
    console.error('Error fetching materials:', error);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

/**
 * @route GET /api/onboarding/materials
 * @desc Get all onboarding materials
 * @access Private
 */
router.get('/materials', authenticateUser, async (req: Request, res: Response) => {
  try {
    const materials = OnboardingMaterialsService.getAllMaterials();
    const templates = OnboardingMaterialsService.getAllEmailTemplates();

    res.json({
      materials,
      emailTemplates: templates,
      totalMaterials: materials.length,
      totalTemplates: templates.length,
    });
  } catch (error) {
    console.error('Error fetching materials:', error);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

/**
 * @route GET /api/onboarding/metrics/:customerId
 * @desc Get engagement metrics for a customer
 * @access Private
 */
router.get('/metrics/:customerId', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params;

    const metrics = OnboardingMetricsService.getEngagementMetrics(customerId);

    if (!metrics) {
      return res.status(404).json({ error: 'Metrics not found' });
    }

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

/**
 * @route GET /api/onboarding/metrics/tenant/dashboard
 * @desc Get tenant-wide onboarding metrics
 * @access Private
 */
router.get('/metrics/tenant/dashboard', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;

    const healthReport = OnboardingMetricsService.getHealthReport();
    const atRiskCustomers = OnboardingMetricsService.getAtRiskCustomers(7);

    res.json({
      healthReport,
      atRiskCustomersCount: atRiskCustomers.length,
      atRiskCustomers: atRiskCustomers.slice(0, 10),
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

/**
 * @route POST /api/onboarding/metrics/activation
 * @desc Track activation event
 * @access Private
 */
router.post('/metrics/activation', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, action, feature, value } = req.body;

    if (!customerId || !action || !feature) {
      return res.status(400).json({
        error: 'customerId, action, and feature are required',
      });
    }

    OnboardingMetricsService.trackActivation(customerId, action, feature, value);

    res.json({
      success: true,
      message: 'Activation event tracked',
    });
  } catch (error) {
    console.error('Error tracking activation:', error);
    res.status(500).json({ error: 'Failed to track activation' });
  }
});

/**
 * @route POST /api/onboarding/metrics/engagement
 * @desc Record engagement event
 * @access Private
 */
router.post('/metrics/engagement', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, eventType, metadata } = req.body;

    if (!customerId || !eventType) {
      return res.status(400).json({
        error: 'customerId and eventType are required',
      });
    }

    // Handle different event types
    switch (eventType) {
      case 'email_opened':
        OnboardingMetricsService.recordEmailOpen(customerId, metadata?.emailType || 'unknown');
        break;
      case 'video_watched':
        OnboardingMetricsService.recordVideoWatch(customerId, metadata?.duration || 0);
        break;
      case 'setup_completed':
        OnboardingMetricsService.recordSetupCompletion(customerId);
        break;
      case 'workflow_created':
        OnboardingMetricsService.recordWorkflowCreation(customerId);
        break;
      default:
        return res.status(400).json({ error: 'Unknown event type' });
    }

    res.json({
      success: true,
      message: 'Engagement event recorded',
    });
  } catch (error) {
    console.error('Error recording engagement:', error);
    res.status(500).json({ error: 'Failed to record engagement' });
  }
});

/**
 * @route GET /api/onboarding/customers/check-in/:day
 * @desc Get customers who need check-in
 * @access Private
 */
router.get('/customers/check-in/:day', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const { day } = req.params;
    const tenantId = req.tenantId;
    const dayNum = parseInt(day);

    if (isNaN(dayNum)) {
      return res.status(400).json({ error: 'Invalid day number' });
    }

    const customers = CustomerOnboardingService.getCustomersNeedingCheckIn(tenantId!, dayNum);

    res.json({
      day: dayNum,
      customersNeedingCheckIn: customers,
      count: customers.length,
    });
  } catch (error) {
    console.error('Error fetching customers for check-in:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

/**
 * @route GET /api/onboarding/high-performers
 * @desc Get high-engagement customers
 * @access Private
 */
router.get('/high-performers', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const { minScore = 70 } = req.query;
    const minScoreNum = parseInt(minScore as string) || 70;

    const customers = OnboardingMetricsService.getCustomersByEngagementScore(minScoreNum);

    res.json({
      minScore: minScoreNum,
      highPerformers: customers,
      count: customers.length,
    });
  } catch (error) {
    console.error('Error fetching high performers:', error);
    res.status(500).json({ error: 'Failed to fetch high performers' });
  }
});

/**
 * @route GET /api/onboarding/at-risk
 * @desc Get at-risk customers
 * @access Private
 */
router.get('/at-risk', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const { daysInactive = 7 } = req.query;
    const daysNum = parseInt(daysInactive as string) || 7;

    const customers = OnboardingMetricsService.getAtRiskCustomers(daysNum);

    res.json({
      daysInactive: daysNum,
      atRiskCustomers: customers,
      count: customers.length,
    });
  } catch (error) {
    console.error('Error fetching at-risk customers:', error);
    res.status(500).json({ error: 'Failed to fetch at-risk customers' });
  }
});

export default router;

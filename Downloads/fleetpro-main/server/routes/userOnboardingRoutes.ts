import express, { Router, Request, Response } from 'express';
import { AuthRequest, authenticateUser, requireTenant } from '../middleware/auth';
import { UserOnboardingService } from '../services/UserOnboardingService';
import { OnboardingTask, UserOnboarding } from '../models/index';
import mongoose from 'mongoose';

const router = Router();

/**
 * @route POST /api/onboarding/initialize
 * @desc Initialize onboarding for a new user
 * @access Private
 */
router.post('/initialize', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const userId = req.userId as string;

    const onboarding = await UserOnboardingService.initializeUserOnboarding(tenantId, userId);

    res.status(201).json({
      success: true,
      message: 'Onboarding initialized successfully',
      onboarding,
    });
  } catch (error: any) {
    console.error('Error initializing onboarding:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to initialize onboarding',
    });
  }
});

/**
 * @route GET /api/onboarding/progress
 * @desc Get user's onboarding progress
 * @access Private
 */
router.get('/progress', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const userId = req.userId as string;

    const progress = await UserOnboardingService.getOnboardingProgress(tenantId, userId);

    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Onboarding not found',
      });
    }

    res.json({
      success: true,
      progress,
    });
  } catch (error: any) {
    console.error('Error fetching onboarding progress:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch progress',
    });
  }
});

/**
 * @route GET /api/onboarding/tasks
 * @desc Get all onboarding tasks for user
 * @access Private
 */
router.get('/tasks', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const userId = req.userId as string;

    const onboarding = await UserOnboarding.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: new mongoose.Types.ObjectId(userId),
    }).populate('tasks');

    if (!onboarding) {
      return res.status(404).json({
        success: false,
        error: 'Onboarding not found',
      });
    }

    res.json({
      success: true,
      tasks: onboarding.tasks,
    });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch tasks',
    });
  }
});

/**
 * @route PUT /api/onboarding/tasks/:taskId/complete
 * @desc Mark a task as completed
 * @access Private
 */
router.put('/tasks/:taskId/complete', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.userId as string;
    const userName = req.body.userName || 'System';

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid task ID',
      });
    }

    const task = await UserOnboardingService.completeTask(taskId, userId, userName);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    res.json({
      success: true,
      message: 'Task completed successfully',
      task,
    });
  } catch (error: any) {
    console.error('Error completing task:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to complete task',
    });
  }
});

/**
 * @route POST /api/onboarding/send-welcome-emails
 * @desc Send welcome email sequence
 * @access Private
 */
router.post('/send-welcome-emails', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const userId = req.userId as string;
    const { userEmail, userName } = req.body;

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        error: 'User email is required',
      });
    }

    const emails = await UserOnboardingService.sendWelcomeEmailSequence(
      tenantId,
      userId,
      userEmail,
      userName || 'User'
    );

    res.status(201).json({
      success: true,
      message: 'Welcome email sequence sent successfully',
      emails: emails.length,
    });
  } catch (error: any) {
    console.error('Error sending welcome emails:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send welcome emails',
    });
  }
});

/**
 * @route POST /api/onboarding/create-demo-tenant
 * @desc Create a demo/trial tenant with sample data
 * @access Private (Admin only)
 */
router.post('/create-demo-tenant', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantName, businessEmail } = req.body;
    const userId = req.userId as string;

    if (!tenantName || !businessEmail) {
      return res.status(400).json({
        success: false,
        error: 'Tenant name and business email are required',
      });
    }

    const { tenant, demoRecord } = await UserOnboardingService.createDemoTenant(
      tenantName,
      businessEmail,
      userId
    );

    res.status(201).json({
      success: true,
      message: 'Demo tenant created successfully',
      tenant,
      demoRecord,
    });
  } catch (error: any) {
    console.error('Error creating demo tenant:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create demo tenant',
    });
  }
});

/**
 * @route PUT /api/onboarding/product-tour/:step
 * @desc Update product tour progress
 * @access Private
 */
router.put('/product-tour/:step', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const userId = req.userId as string;
    const { step } = req.params;

    if (!['started', 'completed'].includes(step)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid step. Must be "started" or "completed"',
      });
    }

    const onboarding = await UserOnboardingService.updateProductTourProgress(
      tenantId,
      userId,
      step as 'started' | 'completed'
    );

    if (!onboarding) {
      return res.status(404).json({
        success: false,
        error: 'Onboarding not found',
      });
    }

    res.json({
      success: true,
      message: `Product tour ${step} successfully`,
      onboarding,
    });
  } catch (error: any) {
    console.error('Error updating product tour:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update product tour',
    });
  }
});

/**
 * @route GET /api/onboarding/status
 * @desc Get overall onboarding status
 * @access Private
 */
router.get('/status', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const userId = req.userId as string;

    const onboarding = await UserOnboarding.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!onboarding) {
      return res.status(404).json({
        success: false,
        error: 'Onboarding not found',
      });
    }

    res.json({
      success: true,
      status: onboarding.status,
      completionPercentage: onboarding.completionPercentage,
      isCompleted: onboarding.status === 'completed',
    });
  } catch (error: any) {
    console.error('Error fetching onboarding status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch status',
    });
  }
});

export default router;

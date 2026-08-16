import express, { Router, Request, Response } from 'express';
import { OnboardingChecklist, Driver } from '../models/index.js';
import { AuthRequest, authenticateUser, requireTenant } from '../middleware/auth.js';
import mongoose from 'mongoose';

const router = Router();

/**
 * @route GET /api/driver-onboarding/:driverId
 * @desc Get onboarding checklist for a driver
 */
router.get('/:driverId', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const { driverId } = req.params;
    const tenantId = req.tenantId;

    // Validate driverId format
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({ error: 'Invalid driver ID' });
    }

    // Check if driver exists
    const driver = await Driver.findOne({
      _id: driverId,
      tenantId
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Get or create onboarding checklist
    let checklist = await OnboardingChecklist.findOne({
      driverId: new mongoose.Types.ObjectId(driverId),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    });

    if (!checklist) {
      // Initialize 15 steps
      const steps = [
        {
          stepNumber: 1,
          name: 'Personal Information',
          description: 'Enter name, email, and phone number',
          documentType: 'none',
          status: 'pending'
        },
        {
          stepNumber: 2,
          name: 'Address Details',
          description: 'Provide permanent and current address',
          documentType: 'none',
          status: 'pending'
        },
        {
          stepNumber: 3,
          name: 'Government IDs',
          description: 'Upload Aadhar and PAN documents',
          documentType: 'certificate',
          status: 'pending',
          required: true
        },
        {
          stepNumber: 4,
          name: 'Driver License',
          description: 'Provide license number, expiry, and upload',
          documentType: 'license',
          status: 'pending',
          required: true
        },
        {
          stepNumber: 5,
          name: 'Vehicle Assignment',
          description: 'Select vehicle from available pool',
          documentType: 'none',
          status: 'pending',
          required: true
        },
        {
          stepNumber: 6,
          name: 'Bank Details',
          description: 'Enter account number, IFSC, and branch',
          documentType: 'none',
          status: 'pending',
          required: true
        },
        {
          stepNumber: 7,
          name: 'Emergency Contact',
          description: 'Provide emergency contact name, phone, and relation',
          documentType: 'none',
          status: 'pending'
        },
        {
          stepNumber: 8,
          name: 'Background Check',
          description: 'Verify background check status',
          documentType: 'none',
          status: 'pending',
          required: true
        },
        {
          stepNumber: 9,
          name: 'Medical Fitness',
          description: 'Upload medical fitness certificate',
          documentType: 'medical',
          status: 'pending',
          required: true
        },
        {
          stepNumber: 10,
          name: 'Training Completion',
          description: 'Complete training and mark as done',
          documentType: 'certificate',
          status: 'pending',
          required: true
        },
        {
          stepNumber: 11,
          name: 'Policy Acknowledgment',
          description: 'E-sign terms and policy documents',
          documentType: 'none',
          status: 'pending',
          required: true
        },
        {
          stepNumber: 12,
          name: 'First Ride',
          description: 'Complete one booking/ride',
          documentType: 'none',
          status: 'pending'
        },
        {
          stepNumber: 13,
          name: 'Quality Check',
          description: 'Achieve minimum rating threshold (4.0+)',
          documentType: 'none',
          status: 'pending'
        },
        {
          stepNumber: 14,
          name: 'Salary Setup',
          description: 'Configure base salary and allowances',
          documentType: 'none',
          status: 'pending',
          required: true
        },
        {
          stepNumber: 15,
          name: 'Manager Approval',
          description: 'Manager final sign-off and approval',
          documentType: 'none',
          status: 'pending',
          required: true
        }
      ];

      checklist = new OnboardingChecklist({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        driverId: new mongoose.Types.ObjectId(driverId),
        steps,
        status: 'in_progress',
        overallProgress: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await checklist.save();
    }

    res.json(checklist);
  } catch (error) {
    console.error('Error fetching onboarding checklist:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding checklist' });
  }
});

/**
 * @route PUT /api/driver-onboarding/:driverId/step/:stepId
 * @desc Mark a step as complete or update its status
 */
router.put('/:driverId/step/:stepId', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const { driverId, stepId } = req.params;
    const { status, notes, attachmentUrl } = req.body;
    const tenantId = req.tenantId;
    const userId = req.userId;

    // Validate input
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({ error: 'Invalid driver ID' });
    }

    if (!['pending', 'in_progress', 'completed', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Find and update the checklist
    const checklist = await OnboardingChecklist.findOne({
      driverId: new mongoose.Types.ObjectId(driverId),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    });

    if (!checklist) {
      return res.status(404).json({ error: 'Onboarding checklist not found' });
    }

    // Find the step by stepId (index)
    const stepIndex = parseInt(stepId);
    if (isNaN(stepIndex) || stepIndex < 0 || stepIndex >= checklist.steps.length) {
      return res.status(400).json({ error: 'Invalid step ID' });
    }

    const step = checklist.steps[stepIndex];

    // Update step
    step.status = status;
    if (notes) step.notes = notes;
    if (attachmentUrl) step.attachmentUrl = attachmentUrl;

    if (status === 'completed') {
      step.completedAt = new Date();
      step.completedBy = {
        userId: userId || 'system',
        userName: (req.user?.name as string) || 'System'
      };
    }

    // Calculate progress
    const completedSteps = checklist.steps.filter(s => s.status === 'completed').length;
    checklist.overallProgress = Math.round((completedSteps / checklist.steps.length) * 100);

    // Update status based on all steps
    const allCompleted = checklist.steps.every(s => s.status === 'completed');
    if (allCompleted) {
      checklist.status = 'completed';
      checklist.completedAt = new Date();
      checklist.completedBy = {
        userId: userId || 'system',
        userName: (req.user?.name as string) || 'System',
        role: (req.user?.role as string) || 'manager'
      };
    }

    checklist.updatedAt = new Date();
    await checklist.save();

    res.json(checklist);
  } catch (error) {
    console.error('Error updating onboarding step:', error);
    res.status(500).json({ error: 'Failed to update onboarding step' });
  }
});

/**
 * @route POST /api/driver-onboarding/:driverId/complete
 * @desc Mark the entire onboarding as completed
 */
router.post('/:driverId/complete', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const { driverId } = req.params;
    const { approvalNotes } = req.body;
    const tenantId = req.tenantId;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({ error: 'Invalid driver ID' });
    }

    const checklist = await OnboardingChecklist.findOne({
      driverId: new mongoose.Types.ObjectId(driverId),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    });

    if (!checklist) {
      return res.status(404).json({ error: 'Onboarding checklist not found' });
    }

    // Check all required steps are completed
    const incompleteRequired = checklist.steps.filter(
      s => s.required && s.status !== 'completed'
    );

    if (incompleteRequired.length > 0) {
      return res.status(400).json({
        error: 'Cannot complete onboarding - incomplete required steps',
        incompleteSteps: incompleteRequired.map(s => s.name)
      });
    }

    // Mark as completed
    checklist.status = 'completed';
    checklist.completedAt = new Date();
    checklist.completedBy = {
      userId: userId || 'system',
      userName: (req.user?.name as string) || 'System',
      role: (req.user?.role as string) || 'manager'
    };
    checklist.overallProgress = 100;
    if (approvalNotes) checklist.notes = approvalNotes;
    checklist.updatedAt = new Date();

    await checklist.save();

    // Update driver status if needed
    const driver = await Driver.findById(driverId);
    if (driver && driver.status === 'off_duty') {
      driver.status = 'available';
      await driver.save();
    }

    res.json({
      success: true,
      message: 'Onboarding completed successfully',
      checklist
    });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

/**
 * @route GET /api/driver-onboarding/pending
 * @desc Get all drivers with incomplete onboarding (manager view)
 */
router.get('/', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { status, sortBy = 'createdAt', page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter: any = {
      tenantId: new mongoose.Types.ObjectId(tenantId)
    };

    if (status) {
      filter.status = status;
    } else {
      filter.status = { $ne: 'completed' }; // Default: show incomplete
    }

    // Get checklists
    const checklists = await OnboardingChecklist.find(filter)
      .populate('driverId', 'name email phone status rating')
      .sort({ [sortBy as string]: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const total = await OnboardingChecklist.countDocuments(filter);

    res.json({
      data: checklists,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching pending onboardings:', error);
    res.status(500).json({ error: 'Failed to fetch pending onboardings' });
  }
});

/**
 * @route GET /api/driver-onboarding/stats
 * @desc Get onboarding statistics for the tenant
 */
router.get('/stats', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;

    const [total, completed, inProgress, paused] = await Promise.all([
      OnboardingChecklist.countDocuments({ tenantId: new mongoose.Types.ObjectId(tenantId) }),
      OnboardingChecklist.countDocuments({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        status: 'completed'
      }),
      OnboardingChecklist.countDocuments({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        status: 'in_progress'
      }),
      OnboardingChecklist.countDocuments({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        status: 'paused'
      })
    ]);

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      total,
      completed,
      inProgress,
      paused,
      completionRate,
      avgProgress: 0
    });
  } catch (error) {
    console.error('Error fetching onboarding stats:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding stats' });
  }
});

export default router;

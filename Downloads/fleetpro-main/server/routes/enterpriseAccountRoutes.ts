import { Router, Request, Response } from 'express';
import { EnterpriseAccountService } from '../services/EnterpriseAccountService';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import mongoose from 'mongoose';

const router = Router();
const accountService = new EnterpriseAccountService();

/**
 * @route POST /api/enterprise-accounts/manager
 * @desc Assign dedicated account manager
 * @access Private
 */
router.post(
  '/manager',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { enterpriseId, managerInfo } = req.body;

      if (!enterpriseId || !managerInfo) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'enterpriseId and managerInfo are required'
        });
      }

      const user = (req as any).user;
      const tenantId = new mongoose.Types.ObjectId(user?.tenantId?.toString() || '');

      const manager = await accountService.assignAccountManager(
        enterpriseId,
        tenantId,
        managerInfo
      );

      res.status(201).json({
        success: true,
        data: { manager }
      });
    } catch (error) {
      console.error('Error assigning account manager:', error);
      res.status(500).json({
        error: 'Failed to assign account manager',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/enterprise-accounts/qbr/schedule
 * @desc Schedule quarterly business review
 * @access Private
 */
router.post(
  '/qbr/schedule',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const { enterpriseId, quarter, year, scheduledDate } = req.body;

      if (!enterpriseId || !quarter || !year || !scheduledDate) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'enterpriseId, quarter, year, and scheduledDate are required'
        });
      }

      const qbr = await accountService.scheduleQBR(enterpriseId, {
        quarter,
        year,
        scheduledDate: new Date(scheduledDate)
      });

      res.status(201).json({
        success: true,
        data: { qbr }
      });
    } catch (error) {
      console.error('Error scheduling QBR:', error);
      res.status(500).json({
        error: 'Failed to schedule QBR',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route PUT /api/enterprise-accounts/qbr/:qbrId
 * @desc Update QBR with metrics and outcomes
 * @access Private
 */
router.put(
  '/qbr/:qbrId',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const { qbrId } = req.params;
      const updates = req.body;

      if (!qbrId) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'qbrId is required'
        });
      }

      const qbr = await accountService.updateQBR(qbrId, updates);

      res.json({
        success: true,
        data: { qbr }
      });
    } catch (error) {
      console.error('Error updating QBR:', error);
      res.status(500).json({
        error: 'Failed to update QBR',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/enterprise-accounts/executive-steering
 * @desc Get executive steering committee setup
 * @access Private/Admin
 */
router.get(
  '/executive-steering',
  authenticateUser,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const steering = accountService.getExecutiveSteering();

      res.json({
        success: true,
        data: { steering }
      });
    } catch (error) {
      console.error('Error fetching executive steering:', error);
      res.status(500).json({
        error: 'Failed to fetch executive steering',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/enterprise-accounts/training-program
 * @desc Create custom training program
 * @access Private
 */
router.post(
  '/training-program',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const { enterpriseId, programInfo } = req.body;

      if (!enterpriseId || !programInfo) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'enterpriseId and programInfo are required'
        });
      }

      const program = await accountService.createTrainingProgram(
        enterpriseId,
        programInfo
      );

      res.status(201).json({
        success: true,
        data: { program }
      });
    } catch (error) {
      console.error('Error creating training program:', error);
      res.status(500).json({
        error: 'Failed to create training program',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/enterprise-accounts/priority-support/config
 * @desc Get priority support queue configuration
 * @access Private/Admin
 */
router.get(
  '/priority-support/config',
  authenticateUser,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const config = accountService.getPrioritySupportQueueConfig();

      res.json({
        success: true,
        data: { config }
      });
    } catch (error) {
      console.error('Error fetching priority support config:', error);
      res.status(500).json({
        error: 'Failed to fetch priority support config',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/enterprise-accounts/create
 * @desc Create enterprise account relationship
 * @access Private
 */
router.post(
  '/create',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const { enterpriseId, accountInfo, manager } = req.body;

      if (!enterpriseId || !accountInfo || !manager) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'enterpriseId, accountInfo, and manager are required'
        });
      }

      const user = (req as any).user;
      const tenantId = new mongoose.Types.ObjectId(user?.tenantId?.toString() || '');

      const relationship = await accountService.createAccountRelationship(
        enterpriseId,
        tenantId,
        accountInfo,
        manager
      );

      res.status(201).json({
        success: true,
        data: { relationship }
      });
    } catch (error) {
      console.error('Error creating account relationship:', error);
      res.status(500).json({
        error: 'Failed to create account relationship',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/enterprise-accounts/health-score
 * @desc Calculate account health score
 * @access Private
 */
router.post(
  '/health-score',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const { accountId, metrics } = req.body;

      if (!accountId || !metrics) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'accountId and metrics are required'
        });
      }

      const healthScore = await accountService.calculateAccountHealthScore(
        accountId,
        metrics
      );

      res.json({
        success: true,
        data: { healthScore }
      });
    } catch (error) {
      console.error('Error calculating health score:', error);
      res.status(500).json({
        error: 'Failed to calculate health score',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/enterprise-accounts/churn-risk
 * @desc Assess churn risk
 * @access Private
 */
router.post(
  '/churn-risk',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const { accountId, metrics } = req.body;

      if (!accountId || !metrics) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'accountId and metrics are required'
        });
      }

      const riskAssessment = await accountService.assessChurnRisk(
        accountId,
        metrics
      );

      res.json({
        success: true,
        data: { riskAssessment }
      });
    } catch (error) {
      console.error('Error assessing churn risk:', error);
      res.status(500).json({
        error: 'Failed to assess churn risk',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

export default router;

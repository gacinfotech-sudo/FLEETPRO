import { Router, Request, Response } from 'express';
import { EnterpriseSalesService } from '../services/EnterpriseSalesService';
import { authenticateUser, requireAdmin } from '../middleware/auth';

const router = Router();
const salesService = new EnterpriseSalesService();

/**
 * @route GET /api/enterprise/discovery-framework
 * @desc Get discovery questions framework
 * @access Private/Admin
 */
router.get(
  '/discovery-framework',
  authenticateUser,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const { category, priority } = req.query;

      const questions = salesService.getDiscoveryQuestions({
        category: category as string,
        priority: priority as string
      });

      res.json({
        success: true,
        data: {
          totalQuestions: questions.length,
          questions,
          categories: ['business', 'technical', 'financial', 'operational']
        }
      });
    } catch (error) {
      console.error('Error fetching discovery framework:', error);
      res.status(500).json({
        error: 'Failed to fetch discovery framework',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/enterprise/needs-assessment
 * @desc Create needs assessment from discovery responses
 * @access Private
 */
router.post(
  '/needs-assessment',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const { enterpriseId, responses } = req.body;
      const user = (req as any).user;
      const tenantId = user?.tenantId;

      if (!enterpriseId || !responses || !Array.isArray(responses)) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'enterpriseId and responses array are required'
        });
      }

      const assessment = await salesService.createNeedsAssessment(
        enterpriseId,
        tenantId,
        responses
      );

      res.status(201).json({
        success: true,
        data: { assessment }
      });
    } catch (error) {
      console.error('Error creating needs assessment:', error);
      res.status(500).json({
        error: 'Failed to create needs assessment',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/enterprise/proposal/generate
 * @desc Generate enterprise proposal
 * @access Private
 */
router.post(
  '/proposal/generate',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const { enterpriseId, accountInfo, assessment, pricing } = req.body;
      const user = (req as any).user;
      const tenantId = user?.tenantId;

      if (!enterpriseId || !accountInfo || !assessment || !pricing) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'enterpriseId, accountInfo, assessment, and pricing are required'
        });
      }

      const proposal = await salesService.generateProposal(
        enterpriseId,
        tenantId,
        accountInfo,
        assessment,
        pricing
      );

      res.status(201).json({
        success: true,
        data: { proposal }
      });
    } catch (error) {
      console.error('Error generating proposal:', error);
      res.status(500).json({
        error: 'Failed to generate proposal',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/enterprise/contract-negotiation-guidelines
 * @desc Get contract negotiation guidelines
 * @access Private/Admin
 */
router.get(
  '/contract-negotiation-guidelines',
  authenticateUser,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const guidelines = salesService.getContractNegotiationGuidelines();

      res.json({
        success: true,
        data: { guidelines }
      });
    } catch (error) {
      console.error('Error fetching negotiation guidelines:', error);
      res.status(500).json({
        error: 'Failed to fetch negotiation guidelines',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/enterprise/legal-review-checklist
 * @desc Get legal review checklist
 * @access Private/Admin
 */
router.get(
  '/legal-review-checklist',
  authenticateUser,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const checklist = salesService.getLegalReviewChecklist();

      res.json({
        success: true,
        data: { checklist }
      });
    } catch (error) {
      console.error('Error fetching legal checklist:', error);
      res.status(500).json({
        error: 'Failed to fetch legal checklist',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/enterprise/sales-playbook
 * @desc Get enterprise sales playbook
 * @access Private/Admin
 */
router.get(
  '/sales-playbook',
  authenticateUser,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const playbook = {
        name: 'Enterprise Sales Playbook',
        version: '1.0',
        stages: [
          {
            stage: 'Prospecting',
            duration: '1-2 weeks',
            activities: [
              'Company research and qualification',
              'Identify key stakeholders',
              'Initial outreach and credibility',
              'Schedule discovery meeting'
            ]
          },
          {
            stage: 'Discovery',
            duration: '2-3 weeks',
            activities: [
              'Conduct discovery call(s)',
              'Ask framework questions',
              'Document pain points',
              'Establish champion'
            ]
          },
          {
            stage: 'Needs Assessment',
            duration: '1-2 weeks',
            activities: [
              'Analyze discovery responses',
              'Create needs assessment report',
              'Identify solution fit',
              'Present findings to customer'
            ]
          },
          {
            stage: 'Proposal',
            duration: '1-2 weeks',
            activities: [
              'Develop customized proposal',
              'Include ROI analysis',
              'Present to stakeholders',
              'Address questions'
            ]
          },
          {
            stage: 'Negotiation',
            duration: '2-4 weeks',
            activities: [
              'Contract review',
              'Terms negotiation',
              'Legal approval',
              'Executive sign-off'
            ]
          },
          {
            stage: 'Close & Onboard',
            duration: '1 week',
            activities: [
              'Execute contract',
              'Setup account',
              'Begin implementation',
              'Schedule kickoff'
            ]
          }
        ],
        keyMetrics: {
          dealSize: 'Minimum $50k annual contract value',
          salesCycle: '8-12 weeks on average',
          winRate: 'Target 25-30% on qualified deals',
          avgOpportunityCost: '$100-500k+',
          implementations: 'Typical 3-6 month deployment'
        }
      };

      res.json({
        success: true,
        data: { playbook }
      });
    } catch (error) {
      console.error('Error fetching sales playbook:', error);
      res.status(500).json({
        error: 'Failed to fetch sales playbook',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

export default router;

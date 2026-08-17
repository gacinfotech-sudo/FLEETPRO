import express, { Router, Request, Response } from 'express';
import { Tenant, User, Subscription, Plan, UserOnboarding } from '../models/index';
import { UserOnboardingService } from '../services/UserOnboardingService';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const router = Router();

interface SignupRequest {
  companyName: string;
  businessEmail: string;
  companyPhone?: string;
  companyAddress?: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  password: string;
  confirmPassword: string;
  planType?: 'starter' | 'pro' | 'custom';
  acceptTerms: boolean;
}

/**
 * @route POST /api/signup/register-company
 * @desc Register a new company and create admin account
 * @access Public
 */
router.post('/register-company', async (req: Request, res: Response) => {
  try {
    const {
      companyName,
      businessEmail,
      companyPhone,
      companyAddress,
      ownerName,
      ownerEmail,
      ownerPhone,
      password,
      confirmPassword,
      planType = 'starter',
      acceptTerms,
    }: SignupRequest = req.body;

    // Validation
    if (!companyName || !businessEmail || !ownerName || !ownerEmail || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      });
    }

    if (!acceptTerms) {
      return res.status(400).json({
        success: false,
        error: 'You must accept the terms and conditions',
      });
    }

    // Check if business email already exists
    const existingTenant = await Tenant.findOne({ email: businessEmail });
    if (existingTenant) {
      return res.status(409).json({
        success: false,
        error: 'This email is already registered',
      });
    }

    // Check if user email already exists
    const existingUser = await User.findOne({ userId: ownerEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'This email is already registered as a user',
      });
    }

    // Create tenant
    const tenant = new Tenant({
      name: companyName,
      businessName: companyName,
      email: businessEmail,
      phone: companyPhone,
      address: companyAddress,
      isActive: true,
      subscriptionPlan: planType,
      maxManagers: planType === 'starter' ? 5 : planType === 'pro' ? 10 : 20,
      limits: getPlanLimits(planType),
    });

    await tenant.save();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const user = new User({
      userId: ownerEmail,
      password: hashedPassword,
      role: 'client',
      tenantId: tenant._id,
      isActive: true,
      mustResetPassword: false,
      hasCompletedOnboarding: false,
      permissions: ['read_all', 'write_all', 'admin_panel'],
      businessDetails: {
        businessName: companyName,
        ownerName,
        businessAddress: companyAddress || '',
        businessEmail: businessEmail,
        businessPhone: companyPhone || ownerPhone || '',
      },
    });

    await user.save();

    // Get or create default plan
    let plan = await Plan.findOne({ code: planType });
    if (!plan) {
      plan = await createDefaultPlan(planType);
    }

    // Create subscription
    const startDate = new Date();
    const renewalDate = new Date(startDate);
    renewalDate.setDate(renewalDate.getDate() + 30); // 30-day trial

    const subscription = new Subscription({
      tenantId: tenant._id,
      planId: plan._id,
      billingCycle: 'monthly',
      status: 'TRIAL',
      isTrial: true,
      trialEndsAt: renewalDate,
      startDate,
      renewalDate,
    });

    await subscription.save();

    // Initialize user onboarding
    await UserOnboardingService.initializeUserOnboarding(tenant._id.toString(), user._id.toString());

    // Send welcome email sequence (in a real app, this would be async)
    await UserOnboardingService.sendWelcomeEmailSequence(
      tenant._id.toString(),
      user._id.toString(),
      ownerEmail,
      ownerName
    );

    res.status(201).json({
      success: true,
      message: 'Company and account created successfully',
      tenant: {
        id: tenant._id,
        name: tenant.name,
        email: tenant.email,
      },
      user: {
        id: user._id,
        userId: user.userId,
        role: user.role,
      },
      subscription: {
        status: subscription.status,
        trialEndsAt: subscription.trialEndsAt,
      },
    });
  } catch (error: any) {
    console.error('Error during signup:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to complete signup',
    });
  }
});

/**
 * @route POST /api/signup/verify-email
 * @desc Verify email address
 * @access Public
 */
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: 'Email and verification code are required',
      });
    }

    // In a real implementation, you would:
    // 1. Look up the verification code in the database
    // 2. Check if it matches and hasn't expired
    // 3. Mark the email as verified
    // 4. Delete the verification code

    // For now, we'll just return success
    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error: any) {
    console.error('Error verifying email:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify email',
    });
  }
});

/**
 * @route POST /api/signup/setup-payment
 * @desc Setup payment method for subscription
 * @access Public
 */
router.post('/setup-payment', async (req: Request, res: Response) => {
  try {
    const { tenantId, paymentToken } = req.body;

    if (!tenantId || !paymentToken) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID and payment token are required',
      });
    }

    // In a real implementation, you would:
    // 1. Verify the payment token with your payment provider
    // 2. Store the payment method securely
    // 3. Mark the payment method as set up
    // 4. Enable automatic billing for the subscription

    // For now, we'll just return success
    res.json({
      success: true,
      message: 'Payment method set up successfully',
    });
  } catch (error: any) {
    console.error('Error setting up payment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to set up payment',
    });
  }
});

/**
 * @route GET /api/signup/check-email
 * @desc Check if email is available
 * @access Public
 */
router.get('/check-email/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    // Check tenant emails
    const tenantExists = await Tenant.findOne({ email });
    if (tenantExists) {
      return res.json({
        success: true,
        available: false,
        message: 'Email already registered as tenant',
      });
    }

    // Check user emails
    const userExists = await User.findOne({ userId: email });
    if (userExists) {
      return res.json({
        success: true,
        available: false,
        message: 'Email already registered as user',
      });
    }

    res.json({
      success: true,
      available: true,
      message: 'Email is available',
    });
  } catch (error: any) {
    console.error('Error checking email:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check email',
    });
  }
});

/**
 * @route GET /api/signup/plans
 * @desc Get available subscription plans
 * @access Public
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = await Plan.find({ status: 'active' });

    res.json({
      success: true,
      plans: plans.map((p) => ({
        id: p._id,
        name: p.name,
        code: p.code,
        description: p.description,
        pricing: p.pricing,
        limits: p.limits,
        features: p.features,
        trial: p.trial,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching plans:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch plans',
    });
  }
});

/**
 * Helper function: Get plan limits
 */
function getPlanLimits(planType: string) {
  const limits: any = {
    starter: {
      vehicles: 10,
      drivers: 5,
      managers: 2,
    },
    pro: {
      vehicles: 50,
      drivers: 20,
      managers: 5,
    },
    custom: {
      vehicles: 1000,
      drivers: 500,
      managers: 50,
    },
  };

  return limits[planType] || limits.starter;
}

/**
 * Helper function: Create default plan
 */
async function createDefaultPlan(planType: string) {
  const planData: any = {
    starter: {
      name: 'Starter Plan',
      code: 'starter',
      description: 'Perfect for small teams',
      pricing: {
        monthlyUsd: 99,
        quarterlyUsd: 249,
        halfYearlyUsd: 499,
        annualUsd: 999,
      },
      limits: {
        maxVehicles: 10,
        maxDrivers: 5,
        maxUsers: 3,
      },
      features: [
        'Basic fleet management',
        'Up to 5 drivers',
        'Up to 10 vehicles',
        'Email support',
      ],
      trial: {
        daysCount: 30,
        enabled: true,
      },
      status: 'active',
    },
    pro: {
      name: 'Pro Plan',
      code: 'pro',
      description: 'For growing businesses',
      pricing: {
        monthlyUsd: 299,
        quarterlyUsd: 799,
        halfYearlyUsd: 1499,
        annualUsd: 2999,
      },
      limits: {
        maxVehicles: 50,
        maxDrivers: 20,
        maxUsers: 10,
      },
      features: [
        'Advanced fleet management',
        'Up to 20 drivers',
        'Up to 50 vehicles',
        'Priority email & chat support',
        'Analytics & reporting',
        'API access',
      ],
      trial: {
        daysCount: 30,
        enabled: true,
      },
      status: 'active',
    },
    custom: {
      name: 'Custom Plan',
      code: 'custom',
      description: 'For enterprises',
      pricing: {
        monthlyUsd: 999,
      },
      limits: {
        maxVehicles: 1000,
        maxDrivers: 500,
        maxUsers: 100,
      },
      features: [
        'Full fleet management suite',
        'Unlimited drivers & vehicles',
        'Dedicated support',
        'Custom integrations',
        'Advanced analytics',
        'API access',
        'SLA guarantee',
      ],
      trial: {
        daysCount: 14,
        enabled: true,
      },
      status: 'active',
    },
  };

  const data = planData[planType] || planData.starter;
  const plan = new Plan(data);
  await plan.save();
  return plan;
}

export default router;

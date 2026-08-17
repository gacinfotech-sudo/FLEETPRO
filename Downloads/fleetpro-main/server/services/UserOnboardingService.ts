import {
  UserOnboarding,
  OnboardingTask,
  OnboardingEmail,
  DemoTenant,
  Tenant,
  User,
  Vehicle,
  Driver,
  Booking,
  IUserOnboarding,
  IOnboardingTask,
  IOnboardingEmail,
  IDemoTenant,
} from '../models/index';
import mongoose from 'mongoose';

export class UserOnboardingService {
  /**
   * Initialize onboarding for a new user
   */
  static async initializeUserOnboarding(
    tenantId: string,
    userId: string
  ): Promise<IUserOnboarding> {
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Check if onboarding already exists
    let onboarding = await UserOnboarding.findOne({
      tenantId: tenantObjectId,
      userId: userObjectId,
    });

    if (onboarding) {
      return onboarding;
    }

    // Create new onboarding record
    onboarding = new UserOnboarding({
      tenantId: tenantObjectId,
      userId: userObjectId,
      status: 'in_progress',
      completionPercentage: 0,
    });

    await onboarding.save();

    // Create onboarding tasks
    await this.createDefaultTasks(tenantObjectId, onboarding._id);

    return onboarding;
  }

  /**
   * Create default onboarding tasks
   */
  static async createDefaultTasks(
    tenantId: mongoose.Types.ObjectId,
    onboardingId: mongoose.Types.ObjectId
  ): Promise<IOnboardingTask[]> {
    const tasks = [
      {
        title: 'Complete Your Profile',
        description: 'Add company details, logo, and business information',
        taskType: 'profile' as const,
        category: 'essential' as const,
        priority: 'high' as const,
        instructions: 'Navigate to Settings > Company Profile to complete your business information',
        actionUrl: '/dashboard/settings/profile',
        estimatedTime: 10,
      },
      {
        title: 'Configure Basic Settings',
        description: 'Set up time zones, currency, and notification preferences',
        taskType: 'configuration' as const,
        category: 'essential' as const,
        priority: 'high' as const,
        instructions: 'Go to Settings > General Configuration to set your preferences',
        actionUrl: '/dashboard/settings/general',
        estimatedTime: 15,
      },
      {
        title: 'Invite Team Members',
        description: 'Add your team members and assign roles',
        taskType: 'team' as const,
        category: 'essential' as const,
        priority: 'high' as const,
        instructions: 'Go to Team Management and click "Invite Member" to add your team',
        actionUrl: '/dashboard/team',
        estimatedTime: 20,
      },
      {
        title: 'Import First Dataset',
        description: 'Import vehicles, drivers, or customers data',
        taskType: 'data_import' as const,
        category: 'essential' as const,
        priority: 'high' as const,
        instructions: 'Use Data > Import to upload your CSV or Excel file',
        actionUrl: '/dashboard/data/import',
        estimatedTime: 25,
      },
      {
        title: 'Create First Workflow',
        description: 'Set up your first business workflow or automation',
        taskType: 'workflow' as const,
        category: 'recommended' as const,
        priority: 'medium' as const,
        instructions: 'Go to Workflows to create your first automation',
        actionUrl: '/dashboard/workflows',
        estimatedTime: 30,
      },
      {
        title: 'Setup Payment Methods',
        description: 'Add payment method for subscription and transactions',
        taskType: 'payment' as const,
        category: 'essential' as const,
        priority: 'high' as const,
        instructions: 'Go to Billing > Payment Methods to add your payment details',
        actionUrl: '/dashboard/billing/payment',
        estimatedTime: 10,
      },
    ];

    const createdTasks: IOnboardingTask[] = [];

    for (const taskData of tasks) {
      const task = new OnboardingTask({
        tenantId,
        onboardingId,
        ...taskData,
        status: 'pending',
      });
      await task.save();
      createdTasks.push(task);
    }

    // Update onboarding with task references
    await UserOnboarding.findByIdAndUpdate(onboardingId, {
      tasks: createdTasks.map((t) => t._id),
    });

    return createdTasks;
  }

  /**
   * Mark a task as completed
   */
  static async completeTask(
    taskId: string,
    userId: string,
    userName: string
  ): Promise<IOnboardingTask | null> {
    const task = await OnboardingTask.findByIdAndUpdate(
      taskId,
      {
        status: 'completed',
        completedAt: new Date(),
        completedBy: { userId, userName },
      },
      { new: true }
    );

    if (task) {
      // Update onboarding completion percentage
      await this.updateCompletionPercentage(task.onboardingId.toString());
    }

    return task;
  }

  /**
   * Update onboarding completion percentage
   */
  static async updateCompletionPercentage(onboardingId: string): Promise<void> {
    const onboarding = await UserOnboarding.findById(onboardingId).populate('tasks');

    if (!onboarding) return;

    const tasks = onboarding.tasks as any[];
    if (tasks.length === 0) return;

    const completedCount = tasks.filter((t) => t.status === 'completed').length;
    const percentage = Math.round((completedCount / tasks.length) * 100);

    let status: 'not_started' | 'in_progress' | 'completed' | 'paused' = 'not_started';
    if (percentage === 100) {
      status = 'completed';
    } else if (percentage > 0) {
      status = 'in_progress';
    }

    await UserOnboarding.findByIdAndUpdate(onboardingId, {
      completionPercentage: percentage,
      status,
      completedAt: status === 'completed' ? new Date() : undefined,
    });
  }

  /**
   * Send welcome email sequence
   */
  static async sendWelcomeEmailSequence(
    tenantId: string,
    userId: string,
    userEmail: string,
    userName: string
  ): Promise<IOnboardingEmail[]> {
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Get or create onboarding
    let onboarding = await UserOnboarding.findOne({
      tenantId: tenantObjectId,
      userId: userObjectId,
    });

    if (!onboarding) {
      onboarding = await this.initializeUserOnboarding(tenantId, userId);
    }

    const emails = [
      {
        emailNumber: 1,
        subject: 'Welcome to GSC Infotech FleetPro!',
        body: this.getWelcomeEmail1(userName),
      },
      {
        emailNumber: 2,
        subject: 'Your Getting Started Guide - Complete in 5 Steps',
        body: this.getWelcomeEmail2(userName),
      },
      {
        emailNumber: 3,
        subject: 'Exclusive Offer: Extended Trial + Free Setup Assistance',
        body: this.getWelcomeEmail3(userName),
      },
    ];

    const sentEmails: IOnboardingEmail[] = [];

    for (const emailData of emails) {
      const email = new OnboardingEmail({
        tenantId: tenantObjectId,
        userId: userObjectId,
        onboardingId: onboarding._id,
        emailType: emailData.emailNumber === 1 ? 'welcome' : 'progress_reminder',
        subject: emailData.subject,
        body: emailData.body,
        recipientEmail: userEmail,
        status: 'sent',
        sentAt: new Date(),
      });

      await email.save();
      sentEmails.push(email);

      // Add email reference to onboarding
      await UserOnboarding.findByIdAndUpdate(onboarding._id, {
        $push: { emails: email._id },
      });

      // Delay between emails (in a real system, this would be scheduled)
      // Email 1: immediately
      // Email 2: after 3 days
      // Email 3: after 7 days
    }

    return sentEmails;
  }

  /**
   * Create demo/trial tenant with sample data
   */
  static async createDemoTenant(
    tenantName: string,
    businessEmail: string,
    userId: string
  ): Promise<{ tenant: any; demoRecord: IDemoTenant }> {
    // Create tenant
    const tenant = new Tenant({
      name: `${tenantName} - Trial`,
      businessName: tenantName,
      email: businessEmail,
      isActive: true,
      maxManagers: 5,
      subscriptionPlan: 'starter',
      limits: {
        vehicles: 10,
        drivers: 5,
        managers: 2,
      },
    });

    await tenant.save();

    // Create demo record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30-day trial

    const demoRecord = new DemoTenant({
      tenantId: tenant._id,
      demoName: `${tenantName} Demo`,
      description: `Trial account for ${tenantName}`,
      sampleVehicles: 5,
      sampleDrivers: 3,
      sampleBookings: 10,
      trialDays: 30,
      autoUpgradeEnabled: true,
      expiresAt,
    });

    await demoRecord.save();

    // Add sample data
    await this.addSampleData(tenant._id.toString());

    return { tenant: tenant.toObject(), demoRecord };
  }

  /**
   * Add sample data to demo tenant
   */
  static async addSampleData(tenantId: string): Promise<void> {
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

    // Sample vehicles
    const sampleVehicles = [
      {
        tenantId: tenantObjectId,
        make: 'Toyota',
        vehicleModel: 'Innova',
        year: 2023,
        licensePlate: 'KA01AB1234',
        capacity: 8,
        type: 'suv' as const,
        status: 'available' as const,
        features: ['AC', 'Power Steering', 'ABS'],
        pricePerDay: 2500,
        pricePerHour: 250,
        pricePerKm: 25,
        color: 'White',
        fuelType: 'Diesel',
        transmission: 'Manual',
      },
      {
        tenantId: tenantObjectId,
        make: 'Maruti',
        vehicleModel: 'Swift',
        year: 2022,
        licensePlate: 'KA01AB5678',
        capacity: 5,
        type: 'hatchback' as const,
        status: 'available' as const,
        features: ['AC', 'Power Windows'],
        pricePerDay: 1500,
        pricePerHour: 150,
        pricePerKm: 15,
        color: 'Blue',
        fuelType: 'Petrol',
        transmission: 'Automatic',
      },
      {
        tenantId: tenantObjectId,
        make: 'Hyundai',
        vehicleModel: 'Creta',
        year: 2023,
        licensePlate: 'KA01AB9101',
        capacity: 5,
        type: 'sedan' as const,
        status: 'available' as const,
        features: ['AC', 'Power Steering', 'Alloy Wheels'],
        pricePerDay: 2000,
        pricePerHour: 200,
        pricePerKm: 20,
        color: 'Silver',
        fuelType: 'Petrol',
        transmission: 'Automatic',
      },
    ];

    for (const vehicleData of sampleVehicles) {
      const vehicle = new Vehicle(vehicleData);
      await vehicle.save();
    }

    // Sample drivers
    const sampleDrivers = [
      {
        tenantId: tenantObjectId,
        name: 'Raj Kumar',
        phone: '9876543210',
        email: 'raj@example.com',
        licenseNumber: 'DL123456',
        experience: 5,
        status: 'available' as const,
        languages: ['Hindi', 'English'],
        aadharNumber: '1234 5678 9012',
        panNumber: 'ABCDE1234F',
        dateOfJoining: new Date('2022-01-15'),
      },
      {
        tenantId: tenantObjectId,
        name: 'Ramesh Singh',
        phone: '9876543211',
        email: 'ramesh@example.com',
        licenseNumber: 'DL789012',
        experience: 3,
        status: 'available' as const,
        languages: ['Hindi', 'English', 'Kannada'],
        aadharNumber: '1234 5678 9013',
        panNumber: 'ABCDE1234G',
        dateOfJoining: new Date('2023-03-10'),
      },
      {
        tenantId: tenantObjectId,
        name: 'Pradeep Nair',
        phone: '9876543212',
        email: 'pradeep@example.com',
        licenseNumber: 'DL345678',
        experience: 7,
        status: 'available' as const,
        languages: ['Hindi', 'English', 'Malayalam'],
        aadharNumber: '1234 5678 9014',
        panNumber: 'ABCDE1234H',
        dateOfJoining: new Date('2020-06-20'),
      },
    ];

    for (const driverData of sampleDrivers) {
      const driver = new Driver(driverData);
      await driver.save();
    }
  }

  /**
   * Get onboarding progress
   */
  static async getOnboardingProgress(
    tenantId: string,
    userId: string
  ): Promise<any> {
    const onboarding = await UserOnboarding.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: new mongoose.Types.ObjectId(userId),
    }).populate('tasks');

    if (!onboarding) {
      return null;
    }

    const tasks = onboarding.tasks as any[];
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const pendingTasks = tasks.filter((t) => t.status === 'pending').length;

    return {
      status: onboarding.status,
      completionPercentage: onboarding.completionPercentage,
      totalTasks: tasks.length,
      completedTasks,
      pendingTasks,
      tasks: tasks.map((t) => ({
        id: t._id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        estimatedTime: t.estimatedTime,
      })),
      productTourStarted: onboarding.productTourStarted,
      productTourCompleted: onboarding.productTourCompleted,
      gettingStartedViewed: onboarding.gettingStartedViewed,
    };
  }

  /**
   * Track product tour progress
   */
  static async updateProductTourProgress(
    tenantId: string,
    userId: string,
    tourStep: 'started' | 'completed'
  ): Promise<IUserOnboarding | null> {
    const updateData =
      tourStep === 'started'
        ? { productTourStarted: true }
        : { productTourCompleted: true };

    return await UserOnboarding.findOneAndUpdate(
      {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        userId: new mongoose.Types.ObjectId(userId),
      },
      updateData,
      { new: true }
    );
  }

  /**
   * Email templates
   */
  private static getWelcomeEmail1(userName: string): string {
    return `
      <h2>Welcome to GSC Infotech FleetPro, ${userName}!</h2>

      <p>We're thrilled to have you on board! FleetPro is designed to help you manage your fleet operations with ease and efficiency.</p>

      <h3>What You Can Do:</h3>
      <ul>
        <li>Manage your vehicles and drivers in one place</li>
        <li>Track bookings and revenue in real-time</li>
        <li>Get detailed analytics and reports</li>
        <li>Automate your workflows</li>
        <li>Collaborate with your team</li>
      </ul>

      <h3>Next Steps:</h3>
      <ol>
        <li>Complete your profile with company details</li>
        <li>Add your first vehicle and driver</li>
        <li>Create your first booking</li>
        <li>Explore our analytics dashboard</li>
      </ol>

      <p><strong>Pro Tip:</strong> Start with our interactive product tour to familiarize yourself with the platform.</p>

      <p>If you have any questions, check our <a href="https://help.gscfleetpro.com">Help Center</a> or contact our support team.</p>

      <p>Happy Fleetin'!<br/>
      The FleetPro Team</p>
    `;
  }

  private static getWelcomeEmail2(userName: string): string {
    return `
      <h2>Getting Started with FleetPro - 5 Essential Steps</h2>

      <p>Hi ${userName},</p>

      <p>Here's a quick guide to get you up and running:</p>

      <h3>Step 1: Complete Your Profile (10 min)</h3>
      <p>Add your company details, logo, and business information. <a href="#">Start here</a></p>

      <h3>Step 2: Configure Settings (15 min)</h3>
      <p>Set your timezone, currency, and notification preferences. <a href="#">Configure now</a></p>

      <h3>Step 3: Add Your Team (20 min)</h3>
      <p>Invite team members and assign roles. <a href="#">Add team members</a></p>

      <h3>Step 4: Import Your Data (25 min)</h3>
      <p>Upload your vehicles, drivers, or customers. <a href="#">Import data</a></p>

      <h3>Step 5: Create Your First Workflow (30 min)</h3>
      <p>Set up automation for your business processes. <a href="#">Create workflow</a></p>

      <p>Total time to get started: ~100 minutes</p>

      <p>We're here to help! Contact support if you need any assistance.</p>
    `;
  }

  private static getWelcomeEmail3(userName: string): string {
    return `
      <h2>Special Offer: Extended Trial + Free Setup Assistance</h2>

      <p>Hi ${userName},</p>

      <p>We want to make sure you get the most out of FleetPro!</p>

      <h3>Your Special Offer:</h3>
      <ul>
        <li>Extended 60-day trial (instead of 30)</li>
        <li>Free setup assistance from our experts</li>
        <li>Priority support during your trial</li>
        <li>20% discount on your first year when you upgrade</li>
      </ul>

      <h3>Next Step:</h3>
      <p>Schedule a free 30-minute onboarding call with our team. <a href="#">Book your call</a></p>

      <p>During the call, we'll help you:</p>
      <ul>
        <li>Set up your account optimally</li>
        <li>Import your existing data</li>
        <li>Configure workflows for your business</li>
        <li>Answer all your questions</li>
      </ul>

      <p>Looking forward to helping you succeed!</p>
      <p>The FleetPro Team</p>
    `;
  }
}

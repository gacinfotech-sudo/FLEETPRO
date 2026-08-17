import { logger } from '../utils/logger.js';

export interface OnboardingMaterial {
  id: string;
  type: 'email' | 'video' | 'guide' | 'checklist' | 'faq' | 'template';
  title: string;
  description: string;
  day: number;
  content: string;
  url?: string;
  duration?: number; // in minutes
}

export interface EmailTemplate {
  id: string;
  subject: string;
  body: string;
  day: number;
  cta: string;
  materialsIncluded: string[];
}

class OnboardingMaterialsService {
  private materials: Map<string, OnboardingMaterial> = new Map();
  private emailTemplates: Map<string, EmailTemplate> = new Map();

  constructor() {
    this.initializeDefaultMaterials();
    this.initializeEmailTemplates();
  }

  private initializeDefaultMaterials(): void {
    // Day 0 - Welcome Materials
    this.materials.set('welcome-email', {
      id: 'welcome-email',
      type: 'email',
      title: 'Welcome Email',
      description: 'Initial welcome message to new customers',
      day: 0,
      content: 'Welcome to FleetPro!',
      url: 'https://fleetpro.com/materials/welcome-email',
    });

    this.materials.set('getting-started-guide', {
      id: 'getting-started-guide',
      type: 'guide',
      title: 'Getting Started Guide',
      description: 'Quick reference for first-time users',
      day: 0,
      content: 'Getting Started with FleetPro',
      url: 'https://fleetpro.com/materials/getting-started-guide.pdf',
    });

    this.materials.set('faq-guide', {
      id: 'faq-guide',
      type: 'faq',
      title: 'Frequently Asked Questions',
      description: 'Common questions and answers',
      day: 0,
      content: 'FAQ Guide',
      url: 'https://fleetpro.com/materials/faq.pdf',
    });

    // Day 1 - Training Materials
    this.materials.set('video-walkthrough', {
      id: 'video-walkthrough',
      type: 'video',
      title: 'Product Walkthrough Video',
      description: 'Interactive tour of core features (15 min)',
      day: 1,
      content: 'Product Walkthrough',
      url: 'https://fleetpro.com/videos/walkthrough',
      duration: 15,
    });

    this.materials.set('feature-overview-pdf', {
      id: 'feature-overview-pdf',
      type: 'guide',
      title: 'Feature Overview',
      description: 'Detailed explanation of key features',
      day: 1,
      content: 'Feature Overview',
      url: 'https://fleetpro.com/materials/feature-overview.pdf',
    });

    this.materials.set('keyboard-shortcuts', {
      id: 'keyboard-shortcuts',
      type: 'guide',
      title: 'Keyboard Shortcuts',
      description: 'Quick reference for keyboard shortcuts',
      day: 1,
      content: 'Keyboard Shortcuts Guide',
      url: 'https://fleetpro.com/materials/shortcuts.pdf',
    });

    // Day 2 - Setup Materials
    this.materials.set('setup-checklist', {
      id: 'setup-checklist',
      type: 'checklist',
      title: 'Setup Checklist',
      description: 'Step-by-step setup checklist',
      day: 2,
      content: '- Configure organization settings\n- Set up team members\n- Configure integrations',
      url: 'https://fleetpro.com/materials/setup-checklist',
    });

    this.materials.set('integration-guide', {
      id: 'integration-guide',
      type: 'guide',
      title: 'Integration Setup Guide',
      description: 'Guide for setting up integrations',
      day: 2,
      content: 'Integration Setup Guide',
      url: 'https://fleetpro.com/materials/integration-guide.pdf',
    });

    this.materials.set('team-setup-guide', {
      id: 'team-setup-guide',
      type: 'guide',
      title: 'Team Member Setup',
      description: 'How to invite and manage team members',
      day: 2,
      content: 'Team Setup Guide',
      url: 'https://fleetpro.com/materials/team-setup.pdf',
    });

    // Day 3 - Data Import Materials
    this.materials.set('data-import-guide', {
      id: 'data-import-guide',
      type: 'guide',
      title: 'Data Import Guide',
      description: 'Step-by-step data import instructions',
      day: 3,
      content: 'Data Import Guide',
      url: 'https://fleetpro.com/materials/data-import-guide.pdf',
    });

    this.materials.set('data-templates', {
      id: 'data-templates',
      type: 'template',
      title: 'Data Import Templates',
      description: 'Excel templates for data import',
      day: 3,
      content: 'Data Templates',
      url: 'https://fleetpro.com/materials/data-templates.xlsx',
    });

    this.materials.set('troubleshooting-guide', {
      id: 'troubleshooting-guide',
      type: 'guide',
      title: 'Troubleshooting Guide',
      description: 'Solutions for common issues',
      day: 3,
      content: 'Troubleshooting Guide',
      url: 'https://fleetpro.com/materials/troubleshooting.pdf',
    });

    // Day 5 - Best Practices
    this.materials.set('best-practices-video', {
      id: 'best-practices-video',
      type: 'video',
      title: 'Best Practices Video',
      description: 'Expert tips and best practices (20 min)',
      day: 5,
      content: 'Best Practices Training',
      url: 'https://fleetpro.com/videos/best-practices',
      duration: 20,
    });

    this.materials.set('workflow-templates', {
      id: 'workflow-templates',
      type: 'template',
      title: 'Workflow Templates',
      description: 'Pre-built workflow templates',
      day: 5,
      content: 'Workflow Templates',
      url: 'https://fleetpro.com/materials/workflows.json',
    });

    this.materials.set('success-stories', {
      id: 'success-stories',
      type: 'guide',
      title: 'Customer Success Stories',
      description: 'Real-world examples of successful implementations',
      day: 5,
      content: 'Success Stories',
      url: 'https://fleetpro.com/materials/success-stories.pdf',
    });

    // Day 7 - Check-in
    this.materials.set('call-agenda', {
      id: 'call-agenda',
      type: 'guide',
      title: 'Call Agenda',
      description: 'Agenda for week 1 check-in call',
      day: 7,
      content: 'Check-in Call Agenda',
      url: 'https://fleetpro.com/materials/call-agenda.pdf',
    });

    this.materials.set('progress-report', {
      id: 'progress-report',
      type: 'guide',
      title: 'Progress Report',
      description: 'Summary of onboarding progress',
      day: 7,
      content: 'Progress Report',
      url: 'https://fleetpro.com/materials/progress-report.pdf',
    });

    // Day 30 - Business Review
    this.materials.set('business-review-report', {
      id: 'business-review-report',
      type: 'guide',
      title: 'Business Review Report',
      description: 'Monthly business review report',
      day: 30,
      content: 'Business Review Report',
      url: 'https://fleetpro.com/materials/business-review.pdf',
    });

    this.materials.set('roi-analysis', {
      id: 'roi-analysis',
      type: 'guide',
      title: 'ROI Analysis',
      description: 'Analysis of return on investment',
      day: 30,
      content: 'ROI Analysis',
      url: 'https://fleetpro.com/materials/roi-analysis.pdf',
    });

    this.materials.set('optimization-recommendations', {
      id: 'optimization-recommendations',
      type: 'guide',
      title: 'Optimization Recommendations',
      description: 'Recommended optimizations for next month',
      day: 30,
      content: 'Optimization Recommendations',
      url: 'https://fleetpro.com/materials/recommendations.pdf',
    });
  }

  private initializeEmailTemplates(): void {
    this.emailTemplates.set('day-0-welcome', {
      id: 'day-0-welcome',
      subject: 'Welcome to FleetPro!',
      body: 'Welcome aboard! We\'re excited to have you on FleetPro. Get started with our getting started guide.',
      day: 0,
      cta: 'Get Started',
      materialsIncluded: ['getting-started-guide', 'faq-guide'],
    });

    this.emailTemplates.set('day-1-walkthrough', {
      id: 'day-1-walkthrough',
      subject: 'Your Product Walkthrough is Ready',
      body: 'Check out our interactive product walkthrough to learn about FleetPro\'s core features.',
      day: 1,
      cta: 'Watch Video',
      materialsIncluded: ['video-walkthrough', 'feature-overview-pdf'],
    });

    this.emailTemplates.set('day-2-setup', {
      id: 'day-2-setup',
      subject: 'Let\'s Get You Set Up',
      body: 'Follow our setup checklist to configure your FleetPro account and add your team members.',
      day: 2,
      cta: 'Start Setup',
      materialsIncluded: ['setup-checklist', 'team-setup-guide'],
    });

    this.emailTemplates.set('day-3-data-import', {
      id: 'day-3-data-import',
      subject: 'Time to Import Your Data',
      body: 'Ready to bring your data into FleetPro? Use our data import guide and templates.',
      day: 3,
      cta: 'Import Data',
      materialsIncluded: ['data-import-guide', 'data-templates'],
    });

    this.emailTemplates.set('day-5-training', {
      id: 'day-5-training',
      subject: 'Best Practices Training',
      body: 'Learn best practices from our experts to maximize the value of FleetPro.',
      day: 5,
      cta: 'Watch Training',
      materialsIncluded: ['best-practices-video', 'workflow-templates'],
    });

    this.emailTemplates.set('day-7-checkin', {
      id: 'day-7-checkin',
      subject: 'Your Week 1 Check-in Call',
      body: 'You\'re doing great! Let\'s schedule a quick check-in to see how things are going.',
      day: 7,
      cta: 'Schedule Call',
      materialsIncluded: ['call-agenda', 'progress-report'],
    });

    this.emailTemplates.set('day-30-review', {
      id: 'day-30-review',
      subject: 'Your Monthly Business Review',
      body: 'Let\'s review your progress and discuss optimization opportunities for next month.',
      day: 30,
      cta: 'View Report',
      materialsIncluded: ['business-review-report', 'roi-analysis', 'optimization-recommendations'],
    });
  }

  /**
   * Get all materials for a specific day
   */
  getMaterialsForDay(day: number): OnboardingMaterial[] {
    return Array.from(this.materials.values()).filter(m => m.day === day);
  }

  /**
   * Get a specific material
   */
  getMaterial(materialId: string): OnboardingMaterial | null {
    return this.materials.get(materialId) || null;
  }

  /**
   * Get email template for a specific day
   */
  getEmailTemplate(day: number): EmailTemplate | null {
    const entries = Array.from(this.emailTemplates.values()).filter(t => t.day === day);
    return entries.length > 0 ? entries[0] : null;
  }

  /**
   * Get all materials
   */
  getAllMaterials(): OnboardingMaterial[] {
    return Array.from(this.materials.values());
  }

  /**
   * Get all email templates
   */
  getAllEmailTemplates(): EmailTemplate[] {
    return Array.from(this.emailTemplates.values());
  }

  /**
   * Register custom material
   */
  registerMaterial(material: OnboardingMaterial): void {
    this.materials.set(material.id, material);
  }

  /**
   * Register custom email template
   */
  registerEmailTemplate(template: EmailTemplate): void {
    this.emailTemplates.set(template.id, template);
  }
}

export default new OnboardingMaterialsService();

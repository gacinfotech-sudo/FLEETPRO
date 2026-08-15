import mongoose from 'mongoose';
import DOMPurify from 'isomorphic-dompurify';

interface WidgetPlacement {
  widgetId: string;
  type: string;
  position: { x: number; y: number; width: number; height: number };
  visible: boolean;
  config?: Record<string, any>;
}

interface PageLayout {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  pageId: string;
  pageName: string;
  description?: string;
  layoutType: 'grid' | 'flex' | 'custom';
  gridConfig?: {
    columns: number;
    gaps: { x: number; y: number };
  };
  widgets: WidgetPlacement[];
  customCSS?: string; // Sandboxed CSS
  isPublished: boolean;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface OnboardingFlow {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  steps: Array<{
    stepId: string;
    title: string;
    description: string;
    action: string;
    targetElement?: string;
    skipAllowed: boolean;
    order: number;
  }>;
  enabledForNewUsers: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface FeatureToggle {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  featureKey: string;
  featureName: string;
  enabled: boolean;
  description?: string;
  rolloutPercentage?: number;
  userGroups?: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface LandingPage {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  title: string;
  subtitle?: string;
  heroImage?: string;
  heroText?: string;
  sections: Array<{
    id: string;
    type: 'hero' | 'features' | 'testimonials' | 'pricing' | 'cta' | 'custom';
    title?: string;
    content?: string;
    html?: string;
  }>;
  customDomain?: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PageCustomizationService {
  private pageLayouts: Map<string, PageLayout[]> = new Map();
  private onboardingFlows: Map<string, OnboardingFlow> = new Map();
  private featureToggles: Map<string, FeatureToggle[]> = new Map();
  private landingPages: Map<string, LandingPage> = new Map();

  /**
   * Create page layout
   */
  async createPageLayout(
    tenantId: mongoose.Types.ObjectId,
    layout: Omit<PageLayout, '_id' | 'createdAt' | 'updatedAt' | 'pageId'>
  ): Promise<PageLayout> {
    const pageId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tenantIdStr = tenantId.toString();

    // Sanitize custom CSS
    const sanitizedCSS = this.sanitizeCSS(layout.customCSS);

    const pageLayout: PageLayout = {
      ...layout,
      pageId,
      tenantId,
      customCSS: sanitizedCSS,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!this.pageLayouts.has(tenantIdStr)) {
      this.pageLayouts.set(tenantIdStr, []);
    }

    this.pageLayouts.get(tenantIdStr)!.push(pageLayout);
    return pageLayout;
  }

  /**
   * Update page layout
   */
  async updatePageLayout(
    tenantId: mongoose.Types.ObjectId,
    pageId: string,
    updates: Partial<PageLayout>
  ): Promise<PageLayout> {
    const tenantIdStr = tenantId.toString();
    const layouts = this.pageLayouts.get(tenantIdStr);

    if (!layouts) {
      throw new Error('Page layouts not found');
    }

    const layout = layouts.find(l => l.pageId === pageId);
    if (!layout) {
      throw new Error('Page layout not found');
    }

    if (updates.customCSS) {
      updates.customCSS = this.sanitizeCSS(updates.customCSS);
    }

    Object.assign(layout, updates);
    layout.updatedAt = new Date();

    return layout;
  }

  /**
   * Add widget to page
   */
  async addWidget(
    tenantId: mongoose.Types.ObjectId,
    pageId: string,
    widget: WidgetPlacement
  ): Promise<PageLayout> {
    const layout = await this.getPageLayout(tenantId, pageId);

    layout.widgets.push(widget);
    layout.updatedAt = new Date();

    return layout;
  }

  /**
   * Remove widget from page
   */
  async removeWidget(
    tenantId: mongoose.Types.ObjectId,
    pageId: string,
    widgetId: string
  ): Promise<PageLayout> {
    const layout = await this.getPageLayout(tenantId, pageId);

    layout.widgets = layout.widgets.filter(w => w.widgetId !== widgetId);
    layout.updatedAt = new Date();

    return layout;
  }

  /**
   * Update widget placement
   */
  async updateWidgetPlacement(
    tenantId: mongoose.Types.ObjectId,
    pageId: string,
    widgetId: string,
    placement: Partial<WidgetPlacement>
  ): Promise<WidgetPlacement> {
    const layout = await this.getPageLayout(tenantId, pageId);
    const widget = layout.widgets.find(w => w.widgetId === widgetId);

    if (!widget) {
      throw new Error('Widget not found');
    }

    Object.assign(widget, placement);
    layout.updatedAt = new Date();

    return widget;
  }

  /**
   * Toggle widget visibility
   */
  async toggleWidgetVisibility(
    tenantId: mongoose.Types.ObjectId,
    pageId: string,
    widgetId: string,
    visible: boolean
  ): Promise<void> {
    const layout = await this.getPageLayout(tenantId, pageId);
    const widget = layout.widgets.find(w => w.widgetId === widgetId);

    if (!widget) {
      throw new Error('Widget not found');
    }

    widget.visible = visible;
    layout.updatedAt = new Date();
  }

  /**
   * Get page layout
   */
  async getPageLayout(tenantId: mongoose.Types.ObjectId, pageId: string): Promise<PageLayout> {
    const layouts = this.pageLayouts.get(tenantId.toString());

    if (!layouts) {
      throw new Error('Page layouts not found');
    }

    const layout = layouts.find(l => l.pageId === pageId);
    if (!layout) {
      throw new Error('Page layout not found');
    }

    return layout;
  }

  /**
   * Get all page layouts
   */
  async getPageLayouts(tenantId: mongoose.Types.ObjectId): Promise<PageLayout[]> {
    return this.pageLayouts.get(tenantId.toString()) || [];
  }

  /**
   * Create onboarding flow
   */
  async createOnboardingFlow(
    tenantId: mongoose.Types.ObjectId,
    flow: Omit<OnboardingFlow, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<OnboardingFlow> {
    const tenantIdStr = tenantId.toString();

    const onboarding: OnboardingFlow = {
      ...flow,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.onboardingFlows.set(tenantIdStr, onboarding);
    return onboarding;
  }

  /**
   * Get onboarding flow
   */
  async getOnboardingFlow(tenantId: mongoose.Types.ObjectId): Promise<OnboardingFlow | null> {
    return this.onboardingFlows.get(tenantId.toString()) || null;
  }

  /**
   * Update onboarding flow
   */
  async updateOnboardingFlow(
    tenantId: mongoose.Types.ObjectId,
    updates: Partial<OnboardingFlow>
  ): Promise<OnboardingFlow> {
    const tenantIdStr = tenantId.toString();
    const flow = this.onboardingFlows.get(tenantIdStr);

    if (!flow) {
      throw new Error('Onboarding flow not found');
    }

    Object.assign(flow, updates);
    flow.updatedAt = new Date();

    return flow;
  }

  /**
   * Create feature toggle
   */
  async createFeatureToggle(
    tenantId: mongoose.Types.ObjectId,
    toggle: Omit<FeatureToggle, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<FeatureToggle> {
    const tenantIdStr = tenantId.toString();

    const feature: FeatureToggle = {
      ...toggle,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!this.featureToggles.has(tenantIdStr)) {
      this.featureToggles.set(tenantIdStr, []);
    }

    this.featureToggles.get(tenantIdStr)!.push(feature);
    return feature;
  }

  /**
   * Toggle feature on/off
   */
  async toggleFeature(
    tenantId: mongoose.Types.ObjectId,
    featureKey: string,
    enabled: boolean
  ): Promise<FeatureToggle> {
    const toggles = this.featureToggles.get(tenantId.toString());

    if (!toggles) {
      throw new Error('Feature toggles not found');
    }

    const toggle = toggles.find(t => t.featureKey === featureKey);
    if (!toggle) {
      throw new Error('Feature toggle not found');
    }

    toggle.enabled = enabled;
    toggle.updatedAt = new Date();

    return toggle;
  }

  /**
   * Check if feature is enabled for tenant
   */
  async isFeatureEnabled(
    tenantId: mongoose.Types.ObjectId,
    featureKey: string
  ): Promise<boolean> {
    const toggles = this.featureToggles.get(tenantId.toString());

    if (!toggles) {
      return false;
    }

    const toggle = toggles.find(t => t.featureKey === featureKey);
    return toggle?.enabled || false;
  }

  /**
   * Get all feature toggles
   */
  async getFeatureToggles(tenantId: mongoose.Types.ObjectId): Promise<FeatureToggle[]> {
    return this.featureToggles.get(tenantId.toString()) || [];
  }

  /**
   * Create landing page
   */
  async createLandingPage(
    tenantId: mongoose.Types.ObjectId,
    page: Omit<LandingPage, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<LandingPage> {
    const tenantIdStr = tenantId.toString();

    // Sanitize HTML content
    const sections = page.sections.map(s => ({
      ...s,
      html: s.html ? this.sanitizeHTML(s.html) : undefined
    }));

    const landingPage: LandingPage = {
      ...page,
      sections,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.landingPages.set(tenantIdStr, landingPage);
    return landingPage;
  }

  /**
   * Get landing page
   */
  async getLandingPage(tenantId: mongoose.Types.ObjectId): Promise<LandingPage | null> {
    return this.landingPages.get(tenantId.toString()) || null;
  }

  /**
   * Update landing page
   */
  async updateLandingPage(
    tenantId: mongoose.Types.ObjectId,
    updates: Partial<LandingPage>
  ): Promise<LandingPage> {
    const tenantIdStr = tenantId.toString();
    const page = this.landingPages.get(tenantIdStr);

    if (!page) {
      throw new Error('Landing page not found');
    }

    if (updates.sections) {
      updates.sections = updates.sections.map(s => ({
        ...s,
        html: s.html ? this.sanitizeHTML(s.html) : undefined
      }));
    }

    Object.assign(page, updates);
    page.updatedAt = new Date();

    return page;
  }

  /**
   * Sanitize CSS to prevent XSS
   */
  private sanitizeCSS(css?: string): string | undefined {
    if (!css) return undefined;

    // Remove dangerous properties
    const dangerous = [
      'behavior',
      'binding',
      '-moz-binding',
      'script:',
      'expression(',
      'javascript:',
      'import',
      '@import'
    ];

    let sanitized = css;
    dangerous.forEach(pattern => {
      const regex = new RegExp(pattern, 'gi');
      sanitized = sanitized.replace(regex, '');
    });

    return sanitized;
  }

  /**
   * Sanitize HTML to prevent XSS
   */
  private sanitizeHTML(html: string): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'strong',
        'em',
        'u',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'ul',
        'ol',
        'li',
        'a',
        'img',
        'div',
        'span'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
      ALLOW_DATA_ATTR: false
    });
  }

  /**
   * Reorder widgets on page
   */
  async reorderWidgets(
    tenantId: mongoose.Types.ObjectId,
    pageId: string,
    widgetIds: string[]
  ): Promise<void> {
    const layout = await this.getPageLayout(tenantId, pageId);

    const orderedWidgets: WidgetPlacement[] = [];
    widgetIds.forEach(widgetId => {
      const widget = layout.widgets.find(w => w.widgetId === widgetId);
      if (widget) {
        orderedWidgets.push(widget);
      }
    });

    layout.widgets = orderedWidgets;
    layout.updatedAt = new Date();
  }
}

import mongoose from 'mongoose';

interface TenantBrandingConfig {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  logo?: string; // Base64 or URL
  favicon?: string; // Base64 or URL
  brandColors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    border: string;
  };
  fonts: {
    heading: string;
    body: string;
    fallbacks: string[];
  };
  emailTemplate?: {
    headerColor: string;
    footerColor: string;
    logoPosition: 'left' | 'center' | 'right';
    companyName: string;
    supportEmail: string;
    supportPhone?: string;
  };
  dashboardTheme: {
    mode: 'light' | 'dark' | 'auto';
    accentColor: string;
    cardStyle: 'flat' | 'elevated' | 'outlined';
    borderRadius: 'none' | 'sm' | 'md' | 'lg';
  };
  mobileAppConfig?: {
    appName: string;
    appIcon: string; // Base64 or URL
    splashScreen?: string;
    statusBarColor: string;
    primaryColor: string;
  };
  customDomain?: string;
  appIcons?: Record<string, string>; // size -> base64
  colorSchemes?: Record<string, any>; // custom schemes
  darkModeEnabled: boolean;
  lightModeEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface BrandAsset {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  assetType: 'logo' | 'icon' | 'image' | 'font' | 'banner';
  fileName: string;
  fileSize: number;
  mimeType: string;
  base64Data: string;
  url?: string;
  tags: string[];
  createdAt: Date;
}

export class TenantBrandingService {
  private brandingConfigs: Map<string, TenantBrandingConfig> = new Map();
  private brandAssets: Map<string, BrandAsset[]> = new Map();

  /**
   * Initialize default branding for new tenant
   */
  async initializeDefaultBranding(tenantId: mongoose.Types.ObjectId): Promise<TenantBrandingConfig> {
    const branding: TenantBrandingConfig = {
      tenantId,
      brandColors: {
        primary: '#3B82F6',
        secondary: '#10B981',
        accent: '#F59E0B',
        background: '#FFFFFF',
        text: '#1F2937',
        border: '#E5E7EB'
      },
      fonts: {
        heading: 'Inter',
        body: 'Inter',
        fallbacks: ['Segoe UI', 'Roboto', 'sans-serif']
      },
      dashboardTheme: {
        mode: 'auto',
        accentColor: '#3B82F6',
        cardStyle: 'flat',
        borderRadius: 'md'
      },
      darkModeEnabled: true,
      lightModeEnabled: true,
      favicon: '📊',
      appIcons: {},
      colorSchemes: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const id = tenantId.toString();
    this.brandingConfigs.set(id, branding);
    this.brandAssets.set(id, []);

    return branding;
  }

  /**
   * Update tenant branding configuration
   */
  async updateBranding(
    tenantId: mongoose.Types.ObjectId,
    updates: Partial<TenantBrandingConfig>
  ): Promise<TenantBrandingConfig> {
    const id = tenantId.toString();
    const current = this.brandingConfigs.get(id);

    if (!current) {
      return this.initializeDefaultBranding(tenantId);
    }

    const updated: TenantBrandingConfig = {
      ...current,
      ...updates,
      tenantId,
      updatedAt: new Date()
    };

    this.brandingConfigs.set(id, updated);
    return updated;
  }

  /**
   * Update brand colors with validation
   */
  async updateColors(
    tenantId: mongoose.Types.ObjectId,
    colors: Partial<TenantBrandingConfig['brandColors']>
  ): Promise<TenantBrandingConfig['brandColors']> {
    const id = tenantId.toString();
    const config = this.brandingConfigs.get(id);

    if (!config) {
      throw new Error('Branding config not found');
    }

    // Validate hex colors
    Object.values(colors).forEach(color => {
      if (!this.isValidHexColor(color as string)) {
        throw new Error(`Invalid hex color: ${color}`);
      }
    });

    const updated = {
      ...config.brandColors,
      ...colors
    };

    config.brandColors = updated;
    this.brandingConfigs.set(id, config);

    return updated;
  }

  /**
   * Update dashboard theme
   */
  async updateDashboardTheme(
    tenantId: mongoose.Types.ObjectId,
    theme: Partial<TenantBrandingConfig['dashboardTheme']>
  ): Promise<TenantBrandingConfig['dashboardTheme']> {
    const id = tenantId.toString();
    const config = this.brandingConfigs.get(id);

    if (!config) {
      throw new Error('Branding config not found');
    }

    const updated = {
      ...config.dashboardTheme,
      ...theme
    };

    config.dashboardTheme = updated;
    this.brandingConfigs.set(id, config);

    return updated;
  }

  /**
   * Upload brand asset
   */
  async uploadAsset(
    tenantId: mongoose.Types.ObjectId,
    asset: Omit<BrandAsset, '_id' | 'createdAt'>
  ): Promise<BrandAsset> {
    const id = tenantId.toString();
    const brandAsset: BrandAsset = {
      ...asset,
      tenantId,
      createdAt: new Date()
    };

    if (!this.brandAssets.has(id)) {
      this.brandAssets.set(id, []);
    }

    const assets = this.brandAssets.get(id)!;
    assets.push(brandAsset);

    return brandAsset;
  }

  /**
   * Get all brand assets for tenant
   */
  async getAssets(tenantId: mongoose.Types.ObjectId): Promise<BrandAsset[]> {
    return this.brandAssets.get(tenantId.toString()) || [];
  }

  /**
   * Delete brand asset
   */
  async deleteAsset(
    tenantId: mongoose.Types.ObjectId,
    assetId: string
  ): Promise<boolean> {
    const id = tenantId.toString();
    const assets = this.brandAssets.get(id);

    if (!assets) return false;

    const initialLength = assets.length;
    const filtered = assets.filter(a => a._id?.toString() !== assetId);
    this.brandAssets.set(id, filtered);

    return filtered.length < initialLength;
  }

  /**
   * Configure email template
   */
  async configureEmailTemplate(
    tenantId: mongoose.Types.ObjectId,
    template: Partial<TenantBrandingConfig['emailTemplate']> = {}
  ): Promise<TenantBrandingConfig['emailTemplate']> {
    const id = tenantId.toString();
    const config = this.brandingConfigs.get(id);

    if (!config) {
      throw new Error('Branding config not found');
    }

    const updated = {
      headerColor: (template?.headerColor || config.emailTemplate?.headerColor || '#FFFFFF') as string,
      footerColor: (template?.footerColor || config.emailTemplate?.footerColor || '#F3F4F6') as string,
      logoPosition: (template?.logoPosition || config.emailTemplate?.logoPosition || 'center') as string,
      companyName: (template?.companyName || config.emailTemplate?.companyName || '') as string,
      supportEmail: (template?.supportEmail || config.emailTemplate?.supportEmail || '') as string,
      supportPhone: (template?.supportPhone || config.emailTemplate?.supportPhone || '') as string | undefined
    };

    config.emailTemplate = updated;
    this.brandingConfigs.set(id, config);

    return updated;
  }

  /**
   * Configure mobile app branding
   */
  async configureMobileApp(
    tenantId: mongoose.Types.ObjectId,
    config: Partial<TenantBrandingConfig['mobileAppConfig']> = {}
  ): Promise<TenantBrandingConfig['mobileAppConfig']> {
    const id = tenantId.toString();
    const branding = this.brandingConfigs.get(id);

    if (!branding) {
      throw new Error('Branding config not found');
    }

    const updated = {
      appName: (config?.appName || branding.mobileAppConfig?.appName || '') as string,
      appIcon: (config?.appIcon || branding.mobileAppConfig?.appIcon || '') as string,
      splashScreen: (config?.splashScreen || branding.mobileAppConfig?.splashScreen) as string | undefined,
      statusBarColor: (config?.statusBarColor || branding.mobileAppConfig?.statusBarColor || '#3B82F6') as string,
      primaryColor: (config?.primaryColor || branding.mobileAppConfig?.primaryColor || '#3B82F6') as string
    };

    branding.mobileAppConfig = updated;
    this.brandingConfigs.set(id, branding);

    return updated;
  }

  /**
   * Get branding configuration
   */
  async getBranding(tenantId: mongoose.Types.ObjectId): Promise<TenantBrandingConfig> {
    const id = tenantId.toString();
    const config = this.brandingConfigs.get(id);

    if (!config) {
      return this.initializeDefaultBranding(tenantId);
    }

    return config;
  }

  /**
   * Get CSS theme from branding config
   */
  async generateThemeCSS(tenantId: mongoose.Types.ObjectId): Promise<string> {
    const config = await this.getBranding(tenantId);
    const colors = config.brandColors;

    return `
      :root {
        --primary: ${colors.primary};
        --secondary: ${colors.secondary};
        --accent: ${colors.accent};
        --background: ${colors.background};
        --text: ${colors.text};
        --border: ${colors.border};
        --font-heading: '${config.fonts.heading}', ${config.fonts.fallbacks.join(', ')};
        --font-body: '${config.fonts.body}', ${config.fonts.fallbacks.join(', ')};
        --card-style: ${config.dashboardTheme.cardStyle};
        --border-radius: ${this.getBorderRadiusValue(config.dashboardTheme.borderRadius)};
      }
    `;
  }

  /**
   * Validate hex color
   */
  private isValidHexColor(color: string): boolean {
    return /^#[0-9A-F]{6}$/i.test(color);
  }

  /**
   * Get border radius CSS value
   */
  private getBorderRadiusValue(radius: string): string {
    const map: Record<string, string> = {
      none: '0',
      sm: '0.25rem',
      md: '0.5rem',
      lg: '1rem'
    };
    return map[radius] || '0.5rem';
  }

  /**
   * Duplicate branding from template tenant
   */
  async cloneBranding(
    sourceTenantId: mongoose.Types.ObjectId,
    targetTenantId: mongoose.Types.ObjectId
  ): Promise<TenantBrandingConfig> {
    const source = await this.getBranding(sourceTenantId);
    const cloned = { ...source, tenantId: targetTenantId, createdAt: new Date(), updatedAt: new Date() };

    this.brandingConfigs.set(targetTenantId.toString(), cloned);

    // Clone assets
    const sourceAssets = this.brandAssets.get(sourceTenantId.toString()) || [];
    const clonedAssets = sourceAssets.map(asset => ({
      ...asset,
      tenantId: targetTenantId,
      createdAt: new Date()
    }));

    this.brandAssets.set(targetTenantId.toString(), clonedAssets);

    return cloned;
  }
}

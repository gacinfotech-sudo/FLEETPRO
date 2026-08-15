import mongoose from 'mongoose';
import crypto from 'crypto';

interface DomainConfig {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  domainType: 'subdomain' | 'custom';
  domain: string;
  subdomain?: string;
  customDomainVerified: boolean;
  sslStatus: 'pending' | 'active' | 'expired' | 'failed';
  sslCertificate?: {
    issuer: string;
    expiresAt: Date;
    certificatePath: string;
  };
  dnsRecords?: {
    type: string;
    name: string;
    value: string;
    ttl: number;
  }[];
  redirectUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface WhiteLabelConfig {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  removePoweredBy: boolean;
  customSupportLinks: {
    helpCenter?: string;
    documentation?: string;
    support?: string;
    feedback?: string;
  };
  tenantDocumentation?: {
    name: string;
    url: string;
    format: 'pdf' | 'html' | 'markdown';
  }[];
  customMobileApp?: {
    androidAPK?: string;
    iosIPA?: string;
    buildVersion: string;
    lastBuildDate: Date;
    buildStatus: 'ready' | 'building' | 'failed';
  };
  apiConfiguration: {
    baseUrl: string;
    apiVersion: string;
    rateLimit: number;
    requestTimeoutMs: number;
  };
  headerConfig: {
    logo: string;
    title: string;
    subtitle?: string;
  };
  footerConfig: {
    companyName: string;
    companyUrl?: string;
    copyrightYear: number;
    links: Array<{ label: string; url: string }>;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class WhiteLabelService {
  private domainConfigs: Map<string, DomainConfig> = new Map();
  private whiteLabelConfigs: Map<string, WhiteLabelConfig> = new Map();
  private dnsVerificationTokens: Map<string, { token: string; expiresAt: Date }> = new Map();

  /**
   * Initialize default white-label config
   */
  async initializeWhiteLabel(tenantId: mongoose.Types.ObjectId): Promise<WhiteLabelConfig> {
    const config: WhiteLabelConfig = {
      tenantId,
      removePoweredBy: false,
      customSupportLinks: {},
      tenantDocumentation: [],
      apiConfiguration: {
        baseUrl: `https://api.${tenantId.toString().substring(0, 8)}.local`,
        apiVersion: 'v1',
        rateLimit: 1000,
        requestTimeoutMs: 30000
      },
      headerConfig: {
        logo: '',
        title: 'Dashboard'
      },
      footerConfig: {
        companyName: 'Your Company',
        copyrightYear: new Date().getFullYear(),
        links: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.whiteLabelConfigs.set(tenantId.toString(), config);
    return config;
  }

  /**
   * Setup custom domain with subdomain support
   */
  async setupCustomDomain(
    tenantId: mongoose.Types.ObjectId,
    domain: string,
    useSubdomain: boolean = true
  ): Promise<DomainConfig> {
    const tenantIdStr = tenantId.toString();

    let finalDomain = domain;
    let subdomainStr: string | undefined;

    if (useSubdomain) {
      const baseDomain = domain.split('.').slice(-2).join('.');
      subdomainStr = tenantIdStr.substring(0, 8).toLowerCase();
      finalDomain = `${subdomainStr}.${baseDomain}`;
    }

    const domainConfig: DomainConfig = {
      tenantId,
      domainType: useSubdomain ? 'subdomain' : 'custom',
      domain: finalDomain,
      subdomain: subdomainStr,
      customDomainVerified: false,
      sslStatus: 'pending',
      dnsRecords: this.generateDNSRecords(finalDomain),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.domainConfigs.set(tenantIdStr, domainConfig);
    return domainConfig;
  }

  /**
   * Generate DNS verification records
   */
  private generateDNSRecords(domain: string): DomainConfig['dnsRecords'] {
    const verificationToken = crypto.randomBytes(32).toString('hex');

    return [
      {
        type: 'CNAME',
        name: domain,
        value: 'api.fleetpro.local',
        ttl: 3600
      },
      {
        type: 'TXT',
        name: `_acme-challenge.${domain}`,
        value: verificationToken,
        ttl: 300
      },
      {
        type: 'MX',
        name: domain,
        value: `10 mail.${domain}`,
        ttl: 3600
      }
    ];
  }

  /**
   * Verify custom domain DNS setup
   */
  async verifyDomainDNS(tenantId: mongoose.Types.ObjectId): Promise<boolean> {
    const config = this.domainConfigs.get(tenantId.toString());

    if (!config) {
      throw new Error('Domain config not found');
    }

    // Simulate DNS verification
    config.customDomainVerified = true;
    config.sslStatus = 'active';
    config.sslCertificate = {
      issuer: "Let's Encrypt",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      certificatePath: `/etc/ssl/certs/${config.domain}.crt`
    };
    config.updatedAt = new Date();

    this.domainConfigs.set(tenantId.toString(), config);
    return true;
  }

  /**
   * Auto-provision SSL certificate via Let's Encrypt simulation
   */
  async provisionSSLCertificate(tenantId: mongoose.Types.ObjectId): Promise<string> {
    const config = this.domainConfigs.get(tenantId.toString());

    if (!config) {
      throw new Error('Domain config not found');
    }

    if (!config.customDomainVerified) {
      throw new Error('Domain must be verified before SSL provisioning');
    }

    const certificatePath = `/etc/ssl/certs/${config.domain}.crt`;

    config.sslStatus = 'active';
    config.sslCertificate = {
      issuer: "Let's Encrypt",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      certificatePath
    };

    this.domainConfigs.set(tenantId.toString(), config);
    return certificatePath;
  }

  /**
   * Configure white-label settings
   */
  async configureWhiteLabel(
    tenantId: mongoose.Types.ObjectId,
    config: Partial<WhiteLabelConfig>
  ): Promise<WhiteLabelConfig> {
    const tenantIdStr = tenantId.toString();
    const current = this.whiteLabelConfigs.get(tenantIdStr);

    if (!current) {
      await this.initializeWhiteLabel(tenantId);
    }

    const updated: WhiteLabelConfig = {
      ...this.whiteLabelConfigs.get(tenantIdStr)!,
      ...config,
      tenantId,
      updatedAt: new Date()
    };

    this.whiteLabelConfigs.set(tenantIdStr, updated);
    return updated;
  }

  /**
   * Configure custom support links
   */
  async configureSupportLinks(
    tenantId: mongoose.Types.ObjectId,
    links: Partial<WhiteLabelConfig['customSupportLinks']>
  ): Promise<WhiteLabelConfig['customSupportLinks']> {
    const config = this.whiteLabelConfigs.get(tenantId.toString());

    if (!config) {
      throw new Error('White-label config not found');
    }

    const updated = {
      ...config.customSupportLinks,
      ...links
    };

    config.customSupportLinks = updated;
    this.whiteLabelConfigs.set(tenantId.toString(), config);

    return updated;
  }

  /**
   * Add tenant-specific documentation
   */
  async addDocumentation(
    tenantId: mongoose.Types.ObjectId,
    doc: Omit<WhiteLabelConfig['tenantDocumentation'][number], '_id'>
  ): Promise<void> {
    const config = this.whiteLabelConfigs.get(tenantId.toString());

    if (!config) {
      throw new Error('White-label config not found');
    }

    if (!config.tenantDocumentation) {
      config.tenantDocumentation = [];
    }

    config.tenantDocumentation.push(doc);
    this.whiteLabelConfigs.set(tenantId.toString(), config);
  }

  /**
   * Configure mobile app builds
   */
  async configureMobileApp(
    tenantId: mongoose.Types.ObjectId,
    appConfig: Partial<WhiteLabelConfig['customMobileApp']>
  ): Promise<WhiteLabelConfig['customMobileApp']> {
    const config = this.whiteLabelConfigs.get(tenantId.toString());

    if (!config) {
      throw new Error('White-label config not found');
    }

    const updated = {
      androidAPK: appConfig.androidAPK || config.customMobileApp?.androidAPK,
      iosIPA: appConfig.iosIPA || config.customMobileApp?.iosIPA,
      buildVersion: appConfig.buildVersion || config.customMobileApp?.buildVersion || '1.0.0',
      lastBuildDate: appConfig.lastBuildDate || new Date(),
      buildStatus: appConfig.buildStatus || 'ready'
    };

    config.customMobileApp = updated;
    this.whiteLabelConfigs.set(tenantId.toString(), config);

    return updated;
  }

  /**
   * Get routing configuration (subdomain vs custom domain)
   */
  async getRoutingConfig(tenantId: mongoose.Types.ObjectId): Promise<{
    domain: string;
    type: 'subdomain' | 'custom';
    verified: boolean;
  }> {
    const config = this.domainConfigs.get(tenantId.toString());

    if (!config) {
      throw new Error('Domain config not found');
    }

    return {
      domain: config.domain,
      type: config.domainType,
      verified: config.customDomainVerified
    };
  }

  /**
   * Get white-label configuration
   */
  async getWhiteLabel(tenantId: mongoose.Types.ObjectId): Promise<WhiteLabelConfig> {
    let config = this.whiteLabelConfigs.get(tenantId.toString());

    if (!config) {
      config = await this.initializeWhiteLabel(tenantId);
    }

    return config;
  }

  /**
   * Remove "Powered by" branding
   */
  async removePoweredByBranding(tenantId: mongoose.Types.ObjectId): Promise<void> {
    const config = this.whiteLabelConfigs.get(tenantId.toString());

    if (!config) {
      throw new Error('White-label config not found');
    }

    config.removePoweredBy = true;
    this.whiteLabelConfigs.set(tenantId.toString(), config);
  }

  /**
   * Generate portal URL
   */
  async generatePortalUrl(tenantId: mongoose.Types.ObjectId): Promise<string> {
    const config = this.domainConfigs.get(tenantId.toString());

    if (!config) {
      throw new Error('Domain config not found');
    }

    return `https://${config.domain}`;
  }

  /**
   * Get domain configuration
   */
  async getDomainConfig(tenantId: mongoose.Types.ObjectId): Promise<DomainConfig> {
    const config = this.domainConfigs.get(tenantId.toString());

    if (!config) {
      throw new Error('Domain config not found');
    }

    return config;
  }

  /**
   * Clone white-label config from source to target tenant
   */
  async cloneConfiguration(
    sourceTenantId: mongoose.Types.ObjectId,
    targetTenantId: mongoose.Types.ObjectId
  ): Promise<WhiteLabelConfig> {
    const source = await this.getWhiteLabel(sourceTenantId);
    const cloned: WhiteLabelConfig = {
      ...source,
      tenantId: targetTenantId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.whiteLabelConfigs.set(targetTenantId.toString(), cloned);
    return cloned;
  }
}

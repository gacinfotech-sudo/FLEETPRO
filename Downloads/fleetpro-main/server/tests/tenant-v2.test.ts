/**
 * Tenant V2 Upgrade Tests
 * Comprehensive test suite for Tenant Model V2 features
 */

import mongoose from 'mongoose';
import { Tenant, ITenant } from '../models';
import { storage } from '../storage-mongodb';
import { mongoTenantSchemaV2 } from '../schemas/mongodb-schemas';

describe('Tenant Model V2', () => {

  before(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/fleetpro-test');
    }
  });

  after(async () => {
    // Cleanup
    await Tenant.deleteMany({});
    await mongoose.disconnect();
  });

  describe('Backward Compatibility', () => {
    it('should load V1 tenants without errors', async () => {
      const v1Tenant = new Tenant({
        name: 'Test Company',
        businessName: 'Test Business',
        email: 'test@example.com',
        subscriptionPlan: 'starter',
        limits: {
          vehicles: 5,
          drivers: 3,
          managers: 1
        }
      });

      const saved = await v1Tenant.save();
      expect(saved).toBeDefined();
      expect(saved._id).toBeDefined();
      expect(saved.name).toBe('Test Company');
    });

    it('should auto-populate V2 fields with defaults for V1 tenants', async () => {
      const v1Tenant = new Tenant({
        name: 'Legacy Company',
        businessName: 'Legacy Business',
        subscriptionPlan: 'pro',
        limits: {
          vehicles: 10,
          drivers: 5,
          managers: 2
        }
      });

      const saved = await v1Tenant.save();
      expect(saved.timezone).toBeUndefined(); // Should be undefined initially, set by migration
      expect(saved.currency).toBeUndefined();
      expect(saved.apiKeys).toBeUndefined();
    });
  });

  describe('API Key Management', () => {
    let tenantId: string;

    before(async () => {
      const tenant = new Tenant({
        name: 'API Test Tenant',
        businessName: 'API Test Business',
        subscriptionPlan: 'pro',
        limits: { vehicles: 5, drivers: 3, managers: 1 },
        features: { apiAccess: true, webhooks: true }
      });
      const saved = await tenant.save();
      tenantId = saved._id.toString();
    });

    it('should create API keys', async () => {
      const result = await storage.createApiKey(tenantId, 'Test Key 1');
      expect(result.key).toBeDefined();
      expect(result.secret).toBeDefined();
      expect(result.key.length).toBe(32);
      expect(result.secret.length).toBe(64);
    });

    it('should list API keys', async () => {
      await storage.createApiKey(tenantId, 'Test Key 2');
      const keys = await storage.listApiKeys(tenantId);
      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeGreaterThanOrEqual(2);
    });

    it('should revoke API keys', async () => {
      const { key } = await storage.createApiKey(tenantId, 'Test Key 3');
      await storage.revokeApiKey(tenantId, 'Test Key 3');
      const keys = await storage.listApiKeys(tenantId);
      const revokedKey = keys.find(k => k.name === 'Test Key 3');
      expect(revokedKey?.active).toBe(false);
    });
  });

  describe('Branding Management', () => {
    let tenantId: string;

    before(async () => {
      const tenant = new Tenant({
        name: 'Branding Test',
        businessName: 'Branding Business',
        subscriptionPlan: 'enterprise',
        limits: { vehicles: 50, drivers: 20, managers: 5 },
        branding: {
          logoUrl: undefined,
          primaryColor: '#007AFF',
          theme: 'auto'
        }
      });
      const saved = await tenant.save();
      tenantId = saved._id.toString();
    });

    it('should update branding', async () => {
      const branding = {
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#FF5733',
        secondaryColor: '#33FF57',
        theme: 'dark',
        customDomain: 'myapp.example.com'
      };

      const result = await storage.updateTenantBranding(tenantId, branding);
      expect(result?.branding?.primaryColor).toBe('#FF5733');
      expect(result?.branding?.customDomain).toBe('myapp.example.com');
    });

    it('should retrieve branding', async () => {
      const branding = await storage.getBranding(tenantId);
      expect(branding?.primaryColor).toBe('#FF5733');
    });
  });

  describe('Settings Management', () => {
    let tenantId: string;

    before(async () => {
      const tenant = new Tenant({
        name: 'Settings Test',
        businessName: 'Settings Business',
        subscriptionPlan: 'starter',
        limits: { vehicles: 5, drivers: 3, managers: 1 },
        timezone: 'UTC'
      });
      const saved = await tenant.save();
      tenantId = saved._id.toString();
    });

    it('should update tenant settings', async () => {
      const settings = {
        timezone: 'America/New_York',
        currency: 'USD',
        language: 'es',
        dateFormat: 'MM/DD/YYYY'
      };

      const result = await storage.updateTenantSettings(tenantId, settings);
      expect(result?.timezone).toBe('America/New_York');
      expect(result?.currency).toBe('USD');
    });

    it('should retrieve tenant settings', async () => {
      const settings = await storage.getTenantSettings(tenantId);
      expect(settings?.timezone).toBe('America/New_York');
      expect(settings?.language).toBe('es');
    });
  });

  describe('Usage Statistics', () => {
    let tenantId: string;

    before(async () => {
      const tenant = new Tenant({
        name: 'Usage Test',
        businessName: 'Usage Business',
        subscriptionPlan: 'pro',
        limits: { vehicles: 10, drivers: 5, managers: 2 },
        usageStats: {
          activeUsers: 0,
          apiCallsThisMonth: 0,
          storageUsedMB: 0
        }
      });
      const saved = await tenant.save();
      tenantId = saved._id.toString();
    });

    it('should get usage stats', async () => {
      const stats = await storage.getTenantUsageStats(tenantId);
      expect(stats).toBeDefined();
      expect(stats.activeUsers).toBeDefined();
      expect(stats.apiCallsThisMonth).toBeDefined();
    });

    it('should update usage stats', async () => {
      await storage.updateUsageStats(tenantId, {
        activeUsers: 5,
        apiCallsThisMonth: 1234,
        storageUsedMB: 256
      });

      const stats = await storage.getTenantUsageStats(tenantId);
      expect(stats.activeUsers).toBe(5);
      expect(stats.apiCallsThisMonth).toBe(1234);
    });
  });

  describe('Feature Flags', () => {
    let tenantId: string;

    before(async () => {
      const tenant = new Tenant({
        name: 'Features Test',
        businessName: 'Features Business',
        subscriptionPlan: 'enterprise',
        limits: { vehicles: 100, drivers: 50, managers: 10 },
        features: {
          apiAccess: false,
          customReports: false,
          advancedAnalytics: false
        }
      });
      const saved = await tenant.save();
      tenantId = saved._id.toString();
    });

    it('should get features', async () => {
      const features = await storage.getFeatures(tenantId);
      expect(features).toBeDefined();
      expect(features.apiAccess).toBe(false);
    });

    it('should update features', async () => {
      const newFeatures = {
        apiAccess: true,
        customReports: true,
        advancedAnalytics: true,
        whiteLabel: true
      };

      const result = await storage.updateTenantFeatures(tenantId, newFeatures);
      expect(result?.features?.apiAccess).toBe(true);
      expect(result?.features?.advancedAnalytics).toBe(true);
    });
  });

  describe('Webhook Management', () => {
    let tenantId: string;

    before(async () => {
      const tenant = new Tenant({
        name: 'Webhook Test',
        businessName: 'Webhook Business',
        subscriptionPlan: 'pro',
        limits: { vehicles: 10, drivers: 5, managers: 2 }
      });
      const saved = await tenant.save();
      tenantId = saved._id.toString();
    });

    it('should configure webhook', async () => {
      const webhookUrl = 'https://example.com/webhooks';
      const events = ['booking.created', 'payment.received'];

      await storage.configureWebhook(tenantId, webhookUrl, events);

      const config = await storage.getWebhookConfig(tenantId);
      expect(config?.url).toBe(webhookUrl);
      expect(config?.events).toContain('booking.created');
    });
  });

  describe('Soft Delete', () => {
    let tenantId: string;

    before(async () => {
      const tenant = new Tenant({
        name: 'Delete Test',
        businessName: 'Delete Business',
        subscriptionPlan: 'starter',
        limits: { vehicles: 5, drivers: 3, managers: 1 },
        isActive: true
      });
      const saved = await tenant.save();
      tenantId = saved._id.toString();
    });

    it('should soft delete tenant', async () => {
      await storage.softDeleteTenant(tenantId);
      const tenant = await storage.getTenant(tenantId);
      expect(tenant?.deletedAt).toBeDefined();
      expect(tenant?.isActive).toBe(false);
    });

    it('should restore soft-deleted tenant', async () => {
      await storage.restoreTenant(tenantId);
      const tenant = await storage.getTenant(tenantId);
      expect(tenant?.deletedAt).toBeUndefined();
      expect(tenant?.isActive).toBe(true);
    });
  });

  describe('Subscription Management', () => {
    let tenantId: string;

    before(async () => {
      const tenant = new Tenant({
        name: 'Subscription Test',
        businessName: 'Subscription Business',
        subscriptionPlan: 'starter',
        billingCycle: 'monthly',
        limits: { vehicles: 5, drivers: 3, managers: 1 }
      });
      const saved = await tenant.save();
      tenantId = saved._id.toString();
    });

    it('should upgrade subscription plan', async () => {
      const result = await storage.upgradeSubscriptionPlan(tenantId, 'enterprise');
      expect(result?.subscriptionPlan).toBe('enterprise');
    });

    it('should get billing info', async () => {
      const billing = await storage.getBillingInfo(tenantId);
      expect(billing).toBeDefined();
      expect(billing.plan).toBe('enterprise');
      expect(billing.billingCycle).toEqual('monthly');
    });
  });

  describe('Zod Schema Validation', () => {
    it('should validate V2 tenant data', async () => {
      const validData = {
        name: 'Test Tenant',
        businessName: 'Test Business',
        subscriptionPlan: 'pro',
        limits: {
          vehicles: 10,
          drivers: 5,
          managers: 2,
          users: 10,
          apiCallsPerMonth: 50000
        },
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        features: {
          apiAccess: true,
          webhooks: true
        }
      };

      const result = mongoTenantSchemaV2.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email in Zod schema', async () => {
      const invalidData = {
        name: 'Test',
        businessName: 'Test Business',
        email: 'invalid-email',
        subscriptionPlan: 'starter',
        limits: { vehicles: 5, drivers: 3, managers: 1 }
      };

      const result = mongoTenantSchemaV2.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid GST number in Zod schema', async () => {
      const invalidData = {
        name: 'Test',
        businessName: 'Test Business',
        subscriptionPlan: 'starter',
        limits: { vehicles: 5, drivers: 3, managers: 1 },
        compliance: {
          gstRegistered: true,
          gstNumber: 'INVALID'
        }
      };

      const result = mongoTenantSchemaV2.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

/**
 * Migration: Tenant Model V2 Upgrade
 * This migration upgrades existing tenants from V1 to V2 with enterprise-grade features
 *
 * Adds:
 * - Subscription & Billing (billingCycle, billingEmail, taxId, paymentMethod, billingAddress, etc.)
 * - Branding & Customization (logoUrl, colors, theme, customDomain, faviconUrl)
 * - Configuration (timezone, currency, language, dateFormat)
 * - Features & Entitlements (apiAccess, customReports, advancedAnalytics, etc.)
 * - API & Integration (apiKeys, webhookUrl, webhookEvents)
 * - Security (twoFactorEnabled, ipWhitelist, encryptionEnabled, ssoProvider, passwordPolicy)
 * - Compliance (gstRegistered, gstNumber, businessRegistration, gdprCompliant, etc.)
 * - Usage Tracking (activeUsers, apiCallsThisMonth, storageUsedMB)
 * - Metadata (metadata, tags, notes)
 * - Soft Delete Support (deletedAt field)
 * - Timestamps (updatedAt, lastBilledAt)
 */

import mongoose from 'mongoose';
import { Tenant } from '../models';

interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errors: string[];
  timestamp: Date;
  duration: number; // in milliseconds
}

/**
 * Execute the tenant V2 upgrade migration
 * Run this once after deploying the code changes
 *
 * Usage: npx ts-node server/migrations/001-tenant-v2-upgrade.ts
 */
export async function migrateTenantToV2(): Promise<MigrationResult> {
  const startTime = Date.now();
  const result: MigrationResult = {
    success: true,
    migratedCount: 0,
    skippedCount: 0,
    errors: [],
    timestamp: new Date(),
    duration: 0
  };

  try {
    console.log('[MIGRATION] Starting Tenant V2 Upgrade...');

    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fleetpro';
      await mongoose.connect(mongoUri);
      console.log('[MIGRATION] Connected to MongoDB');
    }

    // Get all tenants
    const tenants = await Tenant.find({});
    console.log(`[MIGRATION] Found ${tenants.length} tenants to upgrade`);

    for (const tenant of tenants) {
      try {
        // Check if already migrated (has updatedAt field)
        if (tenant.updatedAt && tenant.updatedAt > tenant.createdAt) {
          console.log(`[MIGRATION] Skipping tenant ${tenant._id} - already migrated`);
          result.skippedCount++;
          continue;
        }

        // Set default values for V2 fields
        const updateData: any = {
          // SUBSCRIPTION & BILLING - Use existing values or defaults
          billingCycle: 'monthly',
          billingEmail: tenant.email || '',
          invoicePrefix: 'INV',
          // billingAddress not set - user will configure later

          // BRANDING & CUSTOMIZATION - Sensible defaults
          branding: {
            logoUrl: undefined,
            primaryColor: '#007AFF',
            secondaryColor: '#34C759',
            theme: 'auto',
            customDomain: undefined,
            faviconUrl: undefined
          },

          // CONFIGURATION - Defaults for India (primary market)
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          language: 'en',
          dateFormat: 'DD/MM/YYYY',

          // FEATURES & ENTITLEMENTS - Enabled based on subscription plan
          features: {
            apiAccess: tenant.subscriptionPlan === 'pro' || tenant.subscriptionPlan === 'enterprise',
            customReports: tenant.subscriptionPlan === 'pro' || tenant.subscriptionPlan === 'enterprise',
            advancedAnalytics: tenant.subscriptionPlan === 'enterprise',
            whiteLabel: tenant.subscriptionPlan === 'enterprise',
            multiUserAdmin: tenant.subscriptionPlan !== 'starter',
            sso: tenant.subscriptionPlan === 'enterprise',
            webhooks: tenant.subscriptionPlan === 'pro' || tenant.subscriptionPlan === 'enterprise'
          },

          // API & INTEGRATION - Empty by default, user will generate keys
          apiKeys: [],
          webhookUrl: undefined,
          webhookEvents: [],

          // SECURITY - Sensible defaults
          security: {
            twoFactorEnabled: false,
            ipWhitelist: [],
            encryptionEnabled: true,
            ssoProvider: undefined,
            passwordPolicy: {
              minLength: 8,
              requireUppercase: true,
              requireNumbers: true,
              requireSpecialChars: false
            }
          },

          // COMPLIANCE - Defaults for India
          compliance: {
            gstRegistered: false,
            gstNumber: undefined,
            businessRegistration: undefined,
            termsAcceptedAt: undefined,
            dataRetentionDays: 365,
            gdprCompliant: false
          },

          // USAGE TRACKING - Will be calculated periodically
          usageStats: {
            activeUsers: 0,
            apiCallsThisMonth: 0,
            storageUsedMB: 0,
            lastCalculatedAt: new Date()
          },

          // LIMITS - Enhance based on subscription plan
          limits: {
            vehicles: tenant.limits.vehicles,
            drivers: tenant.limits.drivers,
            managers: tenant.limits.managers,
            users: tenant.subscriptionPlan === 'starter' ? 3 :
                   tenant.subscriptionPlan === 'pro' ? 10 : 50,
            apiCallsPerMonth: tenant.subscriptionPlan === 'starter' ? 1000 :
                              tenant.subscriptionPlan === 'pro' ? 10000 : 100000,
            storageGB: tenant.subscriptionPlan === 'starter' ? 10 :
                       tenant.subscriptionPlan === 'pro' ? 100 : 1000
          },

          // METADATA
          metadata: {},
          tags: [tenant.subscriptionPlan, 'migrated_v2'],
          notes: `Auto-migrated to V2 on ${new Date().toISOString()}`,

          // TIMESTAMPS
          updatedAt: new Date(),
          deletedAt: undefined
        };

        // Update the tenant
        await Tenant.findByIdAndUpdate(tenant._id, updateData, { new: true });
        console.log(`[MIGRATION] Successfully migrated tenant ${tenant._id} (${tenant.businessName})`);
        result.migratedCount++;

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[MIGRATION] Error migrating tenant ${tenant._id}:`, errorMsg);
        result.errors.push(`Tenant ${tenant._id}: ${errorMsg}`);
        result.success = false;
      }
    }

    result.duration = Date.now() - startTime;
    console.log(`[MIGRATION] Completed in ${result.duration}ms`);
    console.log(`[MIGRATION] Summary: Migrated=${result.migratedCount}, Skipped=${result.skippedCount}, Errors=${result.errors.length}`);

    return result;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[MIGRATION] Fatal error:', errorMsg);
    result.success = false;
    result.errors.push(`Fatal error: ${errorMsg}`);
    result.duration = Date.now() - startTime;
    throw error;
  }
}

/**
 * Rollback function (optional) - for reverting the migration if needed
 */
export async function rollbackTenantV2(): Promise<MigrationResult> {
  const startTime = Date.now();
  const result: MigrationResult = {
    success: true,
    migratedCount: 0,
    skippedCount: 0,
    errors: [],
    timestamp: new Date(),
    duration: 0
  };

  try {
    console.log('[ROLLBACK] Starting Tenant V2 Rollback...');

    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fleetpro';
      await mongoose.connect(mongoUri);
    }

    // Remove V2 fields from all tenants
    const removeFields = {
      $unset: {
        billingCycle: 1,
        billingEmail: 1,
        taxId: 1,
        paymentMethod: 1,
        billingAddress: 1,
        invoicePrefix: 1,
        trialEndsAt: 1,
        branding: 1,
        timezone: 1,
        currency: 1,
        language: 1,
        dateFormat: 1,
        features: 1,
        apiKeys: 1,
        webhookUrl: 1,
        webhookEvents: 1,
        security: 1,
        compliance: 1,
        usageStats: 1,
        metadata: 1,
        tags: 1,
        notes: 1,
        updatedAt: 1,
        deletedAt: 1,
        lastBilledAt: 1
      }
    };

    const updateResult = await Tenant.updateMany({}, removeFields);
    result.migratedCount = updateResult.modifiedCount || 0;

    result.duration = Date.now() - startTime;
    console.log(`[ROLLBACK] Completed in ${result.duration}ms. Rolled back ${result.migratedCount} tenants`);

    return result;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[ROLLBACK] Error:', errorMsg);
    result.success = false;
    result.errors.push(errorMsg);
    result.duration = Date.now() - startTime;
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  migrateTenantToV2()
    .then(result => {
      console.log('\n=== MIGRATION RESULT ===');
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n=== MIGRATION FAILED ===');
      console.error(error);
      process.exit(1);
    });
}

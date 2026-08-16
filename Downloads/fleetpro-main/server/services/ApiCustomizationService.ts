import mongoose from 'mongoose';
import crypto from 'crypto';

interface ApiKey {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  keyId: string;
  keyName: string;
  key: string; // Hashed
  keyPreview: string; // First 8 chars only
  scopes: string[];
  rateLimit: number;
  requestTimeoutMs: number;
  isActive: boolean;
  lastUsedAt?: Date;
  createdBy: string;
  createdAt: Date;
  expiresAt?: Date;
}

interface WebhookConfig {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  webhookId: string;
  eventTypes: string[];
  targetUrl: string;
  secretKey: string;
  isActive: boolean;
  retryPolicy: {
    maxAttempts: number;
    backoffMs: number;
  };
  headers?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

interface ApiUsage {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  apiKeyId: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  totalResponseTimeMs: number;
  date: Date;
  endpoint?: string;
}

interface ApiDocumentation {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  endpoints: Array<{
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    description: string;
    parameters?: Record<string, any>;
    responseSchema?: Record<string, any>;
    examples?: Array<{ request: any; response: any }>;
  }>;
  baseUrl: string;
  version: string;
  generatedAt: Date;
}

const DEFAULT_SCOPES = [
  'read:vehicles',
  'write:vehicles',
  'read:drivers',
  'write:drivers',
  'read:bookings',
  'write:bookings',
  'read:analytics',
  'read:users',
  'write:users'
];

export class ApiCustomizationService {
  private apiKeys: Map<string, ApiKey[]> = new Map();
  private webhooks: Map<string, WebhookConfig[]> = new Map();
  private apiUsage: Map<string, ApiUsage[]> = new Map();
  private keyHashMap: Map<string, string> = new Map(); // hash -> keyId

  /**
   * Generate API key for tenant
   */
  async generateApiKey(
    tenantId: mongoose.Types.ObjectId,
    keyName: string,
    scopes: string[] = DEFAULT_SCOPES,
    expiresInDays?: number
  ): Promise<{ apiKey: ApiKey; secretKey: string }> {
    const keyId = `api_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const secretKey = crypto.randomBytes(32).toString('hex');
    const hashedKey = crypto.createHash('sha256').update(secretKey).digest('hex');
    const keyPreview = secretKey.substring(0, 8);
    const tenantIdStr = tenantId.toString();

    const apiKey: ApiKey = {
      tenantId,
      keyId,
      keyName,
      key: hashedKey,
      keyPreview,
      scopes,
      rateLimit: 1000,
      requestTimeoutMs: 30000,
      isActive: true,
      createdBy: 'system',
      createdAt: new Date(),
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : undefined
    };

    if (!this.apiKeys.has(tenantIdStr)) {
      this.apiKeys.set(tenantIdStr, []);
    }

    this.apiKeys.get(tenantIdStr)!.push(apiKey);
    this.keyHashMap.set(hashedKey, keyId);

    return { apiKey, secretKey };
  }

  /**
   * Verify API key
   */
  async verifyApiKey(key: string, tenantId: mongoose.Types.ObjectId): Promise<ApiKey | null> {
    const hashedKey = crypto.createHash('sha256').update(key).digest('hex');
    const keyId = this.keyHashMap.get(hashedKey);

    if (!keyId) {
      return null;
    }

    const keys = this.apiKeys.get(tenantId.toString());
    if (!keys) {
      return null;
    }

    const apiKey = keys.find(k => k.keyId === keyId);

    if (!apiKey || !apiKey.isActive) {
      return null;
    }

    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return null;
    }

    apiKey.lastUsedAt = new Date();
    return apiKey;
  }

  /**
   * Deactivate API key
   */
  async deactivateApiKey(tenantId: mongoose.Types.ObjectId, keyId: string): Promise<void> {
    const keys = this.apiKeys.get(tenantId.toString());

    if (!keys) {
      throw new Error('API keys not found');
    }

    const key = keys.find(k => k.keyId === keyId);
    if (!key) {
      throw new Error('API key not found');
    }

    key.isActive = false;
  }

  /**
   * Get all API keys for tenant
   */
  async getApiKeys(tenantId: mongoose.Types.ObjectId): Promise<Omit<ApiKey, 'key'>[]> {
    const keys = this.apiKeys.get(tenantId.toString()) || [];
    return keys.map(k => {
      const { key, ...rest } = k;
      return rest;
    });
  }

  /**
   * Create webhook
   */
  async createWebhook(
    tenantId: mongoose.Types.ObjectId,
    webhook: Omit<WebhookConfig, '_id' | 'createdAt' | 'updatedAt' | 'webhookId' | 'secretKey'>
  ): Promise<{ webhook: WebhookConfig; secretKey: string }> {
    const webhookId = `webhook_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const secretKey = crypto.randomBytes(32).toString('hex');
    const tenantIdStr = tenantId.toString();

    const newWebhook: WebhookConfig = {
      ...webhook,
      tenantId,
      webhookId,
      secretKey,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!this.webhooks.has(tenantIdStr)) {
      this.webhooks.set(tenantIdStr, []);
    }

    this.webhooks.get(tenantIdStr)!.push(newWebhook);

    return { webhook: newWebhook, secretKey };
  }

  /**
   * Get webhooks
   */
  async getWebhooks(tenantId: mongoose.Types.ObjectId): Promise<Omit<WebhookConfig, 'secretKey'>[]> {
    const webhooks = this.webhooks.get(tenantId.toString()) || [];
    return webhooks.map(w => {
      const { secretKey, ...rest } = w;
      return rest;
    });
  }

  /**
   * Update webhook
   */
  async updateWebhook(
    tenantId: mongoose.Types.ObjectId,
    webhookId: string,
    updates: Partial<WebhookConfig>
  ): Promise<WebhookConfig> {
    const webhooks = this.webhooks.get(tenantId.toString());

    if (!webhooks) {
      throw new Error('Webhooks not found');
    }

    const webhook = webhooks.find(w => w.webhookId === webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    Object.assign(webhook, updates);
    webhook.updatedAt = new Date();

    return webhook;
  }

  /**
   * Track API usage
   */
  async trackApiUsage(
    tenantId: mongoose.Types.ObjectId,
    apiKeyId: string,
    endpoint: string,
    responseTimeMs: number,
    success: boolean
  ): Promise<void> {
    const tenantIdStr = tenantId.toString();

    if (!this.apiUsage.has(tenantIdStr)) {
      this.apiUsage.set(tenantIdStr, []);
    }

    const usage = this.apiUsage.get(tenantIdStr)!;
    const today = new Date().toISOString().split('T')[0];
    const existingUsage = usage.find(
      u => u.apiKeyId === apiKeyId && u.date.toISOString().split('T')[0] === today && u.endpoint === endpoint
    );

    if (existingUsage) {
      existingUsage.requestCount++;
      if (success) {
        existingUsage.successCount++;
      } else {
        existingUsage.errorCount++;
      }
      existingUsage.totalResponseTimeMs += responseTimeMs;
    } else {
      usage.push({
        tenantId,
        apiKeyId,
        endpoint,
        requestCount: 1,
        successCount: success ? 1 : 0,
        errorCount: success ? 0 : 1,
        totalResponseTimeMs: responseTimeMs,
        date: new Date()
      });
    }
  }

  /**
   * Get API usage analytics
   */
  async getApiUsage(
    tenantId: mongoose.Types.ObjectId,
    days: number = 30
  ): Promise<ApiUsage[]> {
    const usage = this.apiUsage.get(tenantId.toString()) || [];
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return usage.filter(u => u.date >= cutoffDate);
  }

  /**
   * Generate OpenAPI documentation
   */
  async generateApiDocumentation(
    tenantId: mongoose.Types.ObjectId,
    endpoints: ApiDocumentation['endpoints']
  ): Promise<ApiDocumentation> {
    const doc: ApiDocumentation = {
      tenantId,
      endpoints,
      baseUrl: `https://api.${tenantId.toString().substring(0, 8)}.local`,
      version: '1.0.0',
      generatedAt: new Date()
    };

    return doc;
  }

  /**
   * Update API rate limits
   */
  async updateRateLimits(
    tenantId: mongoose.Types.ObjectId,
    keyId: string,
    rateLimit: number,
    timeoutMs: number
  ): Promise<ApiKey> {
    const keys = this.apiKeys.get(tenantId.toString());

    if (!keys) {
      throw new Error('API keys not found');
    }

    const key = keys.find(k => k.keyId === keyId);
    if (!key) {
      throw new Error('API key not found');
    }

    key.rateLimit = rateLimit;
    key.requestTimeoutMs = timeoutMs;

    return key;
  }

  /**
   * Update API scopes
   */
  async updateScopes(
    tenantId: mongoose.Types.ObjectId,
    keyId: string,
    scopes: string[]
  ): Promise<ApiKey> {
    const keys = this.apiKeys.get(tenantId.toString());

    if (!keys) {
      throw new Error('API keys not found');
    }

    const key = keys.find(k => k.keyId === keyId);
    if (!key) {
      throw new Error('API key not found');
    }

    key.scopes = scopes;
    return key;
  }

  /**
   * Check scope permission
   */
  async hasScope(key: ApiKey, requiredScope: string): Promise<boolean> {
    return key.scopes.includes(requiredScope) || key.scopes.includes('*');
  }

  /**
   * Delete API key
   */
  async deleteApiKey(tenantId: mongoose.Types.ObjectId, keyId: string): Promise<boolean> {
    const keys = this.apiKeys.get(tenantId.toString());

    if (!keys) return false;

    const initialLength = keys.length;
    const filtered = keys.filter(k => k.keyId !== keyId);
    this.apiKeys.set(tenantId.toString(), filtered);

    return filtered.length < initialLength;
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(tenantId: mongoose.Types.ObjectId, webhookId: string): Promise<boolean> {
    const webhooks = this.webhooks.get(tenantId.toString());

    if (!webhooks) return false;

    const initialLength = webhooks.length;
    const filtered = webhooks.filter(w => w.webhookId !== webhookId);
    this.webhooks.set(tenantId.toString(), filtered);

    return filtered.length < initialLength;
  }

  /**
   * Get available scopes
   */
  getAvailableScopes(): string[] {
    return DEFAULT_SCOPES;
  }
}

import axios from 'axios';
import crypto from 'crypto';
import { WebhookEndpoint, WebhookLog } from '../models/index';
import mongoose from 'mongoose';

export interface WebhookPayload {
  event: string;
  timestamp: Date;
  tenantId: string;
  data: Record<string, any>;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  status: 'pending' | 'success' | 'failed';
  statusCode?: number;
  responseTime?: number;
  nextRetryAt?: Date;
}

class WebhookService {
  private readonly MAX_RETRIES = 5;
  private readonly TIMEOUT = 10000; // 10 seconds

  async registerWebhook(tenantId: string, url: string, events: string[], isActive: boolean = true) {
    try {
      const webhook = new WebhookEndpoint({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        url,
        events,
        isActive,
        secret: this.generateSecret(),
        deliveryAttempts: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
      });

      await webhook.save();
      return webhook;
    } catch (error) {
      console.error('Failed to register webhook:', error);
      throw error;
    }
  }

  async updateWebhook(webhookId: string, updates: Partial<any>) {
    try {
      const webhook = await WebhookEndpoint.findByIdAndUpdate(
        webhookId,
        { ...updates, updatedAt: new Date() },
        { new: true }
      );

      return webhook;
    } catch (error) {
      console.error('Failed to update webhook:', error);
      throw error;
    }
  }

  async deleteWebhook(webhookId: string) {
    try {
      await WebhookEndpoint.findByIdAndDelete(webhookId);
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      throw error;
    }
  }

  async getWebhooks(tenantId: string) {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const webhooks = await WebhookEndpoint.find({
        tenantId: tenantObjectId,
      }).lean();

      return webhooks;
    } catch (error) {
      console.error('Failed to get webhooks:', error);
      throw error;
    }
  }

  async triggerEvent(tenantId: string, event: string, data: Record<string, any>) {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      // Find all webhooks subscribed to this event
      const webhooks = await WebhookEndpoint.find({
        tenantId: tenantObjectId,
        events: event,
        isActive: true,
      });

      if (webhooks.length === 0) {
        return [];
      }

      const payload: WebhookPayload = {
        event,
        timestamp: new Date(),
        tenantId,
        data,
      };

      const deliveries: WebhookDelivery[] = [];

      for (const webhook of webhooks) {
        const delivery = await this.deliverWebhook(webhook, payload);
        deliveries.push(delivery);
      }

      return deliveries;
    } catch (error) {
      console.error('Failed to trigger webhook event:', error);
      return [];
    }
  }

  private async deliverWebhook(webhook: any, payload: WebhookPayload): Promise<WebhookDelivery> {
    const startTime = Date.now();
    const signature = this.generateSignature(payload, webhook.secret);

    const delivery = new WebhookLog({
      webhookId: webhook._id,
      tenantId: webhook.tenantId,
      event: payload.event,
      url: webhook.url,
      payload,
      status: 'pending',
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
      signature,
    });

    try {
      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-FleetPro-Signature': signature,
          'X-FleetPro-Event': payload.event,
          'X-FleetPro-Timestamp': payload.timestamp.toISOString(),
        },
        timeout: this.TIMEOUT,
      });

      const responseTime = Date.now() - startTime;

      delivery.status = 'success';
      delivery.statusCode = response.status;
      delivery.responseTime = responseTime;
      delivery.deliveredAt = new Date();

      webhook.successfulDeliveries += 1;
      webhook.lastSuccessfulDelivery = new Date();

      await Promise.all([delivery.save(), webhook.save()]);


      return {
        id: delivery._id.toString(),
        event: payload.event,
        status: 'success',
        statusCode: response.status,
        responseTime,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      delivery.status = 'failed';
      delivery.statusCode = error.response?.status;
      delivery.responseTime = responseTime;
      delivery.failureReason = error.message;
      delivery.nextRetryAt = this.calculateNextRetry(0);

      webhook.failedDeliveries += 1;
      webhook.lastFailedDelivery = new Date();

      await Promise.all([delivery.save(), webhook.save()]);

      console.error(`❌ Webhook delivery failed (${responseTime}ms): ${webhook.url} → ${payload.event}`);
      console.error(`   Error: ${error.message}`);

      return {
        id: delivery._id.toString(),
        event: payload.event,
        status: 'failed',
        statusCode: error.response?.status,
        responseTime,
        nextRetryAt: delivery.nextRetryAt,
      };
    }
  }

  async processFailedWebhooks() {
    try {
      // Find pending webhooks ready for retry
      const failedWebhooks = await WebhookLog.find({
        status: 'failed',
        retryCount: { $lt: this.MAX_RETRIES },
        nextRetryAt: { $lte: new Date() },
      }).limit(20);

      for (const log of failedWebhooks) {
        const webhook = await WebhookEndpoint.findById(log.webhookId);

        if (!webhook) {
          log.status = 'failed';
          log.failureReason = 'Webhook endpoint deleted';
          await log.save();
          continue;
        }

        const payload: WebhookPayload = {
          event: log.event,
          timestamp: log.createdAt,
          tenantId: log.tenantId.toString(),
          data: log.payload.data,
        };

        const startTime = Date.now();

        try {
          const response = await axios.post(webhook.url, payload, {
            headers: {
              'Content-Type': 'application/json',
              'X-FleetPro-Signature': log.signature,
              'X-FleetPro-Event': log.event,
              'X-FleetPro-Timestamp': log.createdAt.toISOString(),
              'X-FleetPro-Retry-Count': log.retryCount.toString(),
            },
            timeout: this.TIMEOUT,
          });

          const responseTime = Date.now() - startTime;

          log.status = 'success';
          log.statusCode = response.status;
          log.responseTime = responseTime;
          log.deliveredAt = new Date();

          webhook.successfulDeliveries += 1;
          webhook.lastSuccessfulDelivery = new Date();

          await Promise.all([log.save(), webhook.save()]);

        } catch (error: any) {
          const responseTime = Date.now() - startTime;

          log.retryCount += 1;
          log.statusCode = error.response?.status;
          log.responseTime = responseTime;
          log.failureReason = error.message;

          if (log.retryCount >= this.MAX_RETRIES) {
            log.status = 'failed';
          } else {
            log.nextRetryAt = this.calculateNextRetry(log.retryCount);
          }

          await log.save();
        }
      }
    } catch (error) {
      console.error('Error processing failed webhooks:', error);
    }
  }

  async getWebhookLogs(tenantId: string, webhookId?: string, limit: number = 50) {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const query: any = { tenantId: tenantObjectId };

      if (webhookId) {
        query.webhookId = new mongoose.Types.ObjectId(webhookId);
      }

      const logs = await WebhookLog.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return logs;
    } catch (error) {
      console.error('Failed to get webhook logs:', error);
      throw error;
    }
  }

  async getWebhookStats(tenantId: string) {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const webhooks = await WebhookEndpoint.find({
        tenantId: tenantObjectId,
      }).lean();

      const logs = await WebhookLog.find({
        tenantId: tenantObjectId,
      }).lean();

      const stats = {
        totalWebhooks: webhooks.length,
        activeWebhooks: webhooks.filter((w: any) => w.isActive).length,
        totalDeliveries: logs.length,
        successfulDeliveries: logs.filter((l: any) => l.status === 'success').length,
        failedDeliveries: logs.filter((l: any) => l.status === 'failed').length,
        pendingDeliveries: logs.filter((l: any) => l.status === 'pending').length,
        averageResponseTime: this.calculateAverageResponseTime(logs),
        successRate: logs.length > 0 ? (logs.filter((l: any) => l.status === 'success').length / logs.length * 100).toFixed(2) + '%' : 'N/A',
      };

      return stats;
    } catch (error) {
      console.error('Failed to get webhook stats:', error);
      throw error;
    }
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateSignature(payload: WebhookPayload, secret: string): string {
    const payloadString = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
  }

  private calculateNextRetry(retryCount: number): Date {
    // Exponential backoff: 30s, 5m, 30m, 2h, 8h
    const backoffSeconds = [30, 300, 1800, 7200, 28800];
    const delay = backoffSeconds[Math.min(retryCount, backoffSeconds.length - 1)];
    return new Date(Date.now() + delay * 1000);
  }

  private calculateAverageResponseTime(logs: any[]): string {
    const responseTimes = logs.filter((l: any) => l.responseTime).map((l: any) => l.responseTime);
    if (responseTimes.length === 0) return '0ms';

    const average = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    return Math.round(average) + 'ms';
  }
}

export const webhookService = new WebhookService();

// Start processing failed webhooks every 5 minutes
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    webhookService.processFailedWebhooks().catch(err => console.error('Webhook processing error:', err));
  }, 5 * 60 * 1000);
}

import { NotificationQueue, NotificationPreference } from '../models/index';
import { emailService } from './EmailService';
import mongoose from 'mongoose';

export interface QueueEmailPayload {
  tenantId?: string;
  userId?: string;
  recipientEmail: string;
  templateId: string;
  variables: Record<string, any>;
}

class NotificationQueueService {
  async queueEmail(payload: QueueEmailPayload): Promise<boolean> {
    try {
      // Check if user has disabled this notification
      if (payload.userId && payload.tenantId) {
        const preference = await NotificationPreference.findOne({
          tenantId: new mongoose.Types.ObjectId(payload.tenantId),
          userId: new mongoose.Types.ObjectId(payload.userId),
          templateId: payload.templateId,
        });

        if (preference && !preference.enabled) {
          return false;
        }
      }

      // Create queue entry
      const queueEntry = new NotificationQueue({
        tenantId: payload.tenantId ? new mongoose.Types.ObjectId(payload.tenantId) : undefined,
        userId: payload.userId ? new mongoose.Types.ObjectId(payload.userId) : undefined,
        recipientEmail: payload.recipientEmail,
        templateId: payload.templateId,
        variables: payload.variables,
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
      });

      await queueEntry.save();

      // Try to send immediately
      this.processQueue().catch(err => console.error('Queue processing error:', err));

      return true;
    } catch (error) {
      console.error('Failed to queue email:', error);
      return false;
    }
  }

  async processQueue() {
    try {
      // Find all pending emails
      const pendingEmails = await NotificationQueue.find({
        status: 'pending',
      }).limit(10);

      for (const email of pendingEmails) {
        const success = await emailService.sendEmail({
          to: email.recipientEmail,
          templateId: email.templateId,
          variables: email.variables,
          tenantId: email.tenantId?.toString(),
          userId: email.userId?.toString(),
        });

        if (success) {
          email.status = 'sent';
          email.sentAt = new Date();
          email.updatedAt = new Date();
        } else {
          email.retryCount += 1;
          if (email.retryCount >= email.maxRetries) {
            email.status = 'failed';
            email.failureReason = 'Max retries exceeded';
          } else {
            // Exponential backoff: 5 min, 15 min, 30 min
            const backoffMinutes = Math.pow(5, email.retryCount);
            email.nextRetryAt = new Date(Date.now() + backoffMinutes * 60000);
          }
          email.updatedAt = new Date();
        }

        await email.save();
      }

      // Process failed emails that are due for retry
      const retryEmails = await NotificationQueue.find({
        status: 'pending',
        nextRetryAt: { $lte: new Date() },
      }).limit(10);

      for (const email of retryEmails) {
        const success = await emailService.sendEmail({
          to: email.recipientEmail,
          templateId: email.templateId,
          variables: email.variables,
        });

        if (success) {
          email.status = 'sent';
          email.sentAt = new Date();
        } else {
          email.retryCount += 1;
          if (email.retryCount >= email.maxRetries) {
            email.status = 'failed';
            email.failureReason = 'Max retries exceeded';
          } else {
            const backoffMinutes = Math.pow(5, email.retryCount);
            email.nextRetryAt = new Date(Date.now() + backoffMinutes * 60000);
          }
        }

        email.updatedAt = new Date();
        await email.save();
      }
    } catch (error) {
      console.error('Error processing notification queue:', error);
    }
  }

  async setNotificationPreference(tenantId: string, userId: string, templateId: string, enabled: boolean, frequency?: string) {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const userObjectId = new mongoose.Types.ObjectId(userId);

      const preference = await NotificationPreference.findOneAndUpdate(
        {
          tenantId: tenantObjectId,
          userId: userObjectId,
          templateId,
        },
        {
          enabled,
          frequency: frequency || 'immediate',
          updatedAt: new Date(),
        },
        { upsert: true, new: true }
      );

      return preference;
    } catch (error) {
      console.error('Failed to set notification preference:', error);
      throw error;
    }
  }

  async getNotificationPreferences(tenantId: string, userId: string) {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const userObjectId = new mongoose.Types.ObjectId(userId);

      const preferences = await NotificationPreference.find({
        tenantId: tenantObjectId,
        userId: userObjectId,
      });

      return preferences;
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
      throw error;
    }
  }

  async getNotificationHistory(tenantId: string, limit = 50) {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const history = await NotificationQueue.find({
        tenantId: tenantObjectId,
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return history;
    } catch (error) {
      console.error('Failed to get notification history:', error);
      throw error;
    }
  }

  async retryFailedEmails() {
    try {
      const failedEmails = await NotificationQueue.find({
        status: 'failed',
        retryCount: { $lt: 5 }, // Allow up to 5 retries total
      }).limit(20);

      for (const email of failedEmails) {
        email.retryCount = 0;
        email.status = 'pending';
        email.nextRetryAt = new Date();
        await email.save();
      }

    } catch (error) {
      console.error('Failed to retry failed emails:', error);
    }
  }
}

export const notificationQueueService = new NotificationQueueService();

// Start processing queue every 5 minutes
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    notificationQueueService.processQueue().catch(err => console.error('Queue processing error:', err));
  }, 5 * 60 * 1000);
}

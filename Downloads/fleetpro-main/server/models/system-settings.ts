import mongoose, { Document, Schema } from 'mongoose';

export interface SystemSettings extends Document {
  maxLoginAttempts: number;
  sessionTimeout: number;
  passwordMinLength: number;
  requireSpecialChars: boolean;
  requireNumbers: boolean;
  requireUppercase: boolean;
  enableTwoFactor: boolean;
  enableAuditLogging: boolean;
  enableRateLimiting: boolean;
  maxRequestsPerMinute: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  emailNotifications: boolean;
  slackIntegration: boolean;
  slackWebhook: string;
  updatedAt: Date;
  updatedBy: string;
}

const systemSettingsSchema = new Schema<SystemSettings>({
  maxLoginAttempts: { type: Number, default: 5, min: 1, max: 20 },
  sessionTimeout: { type: Number, default: 3600, min: 300 },
  passwordMinLength: { type: Number, default: 8, min: 6, max: 20 },
  requireSpecialChars: { type: Boolean, default: true },
  requireNumbers: { type: Boolean, default: true },
  requireUppercase: { type: Boolean, default: true },
  enableTwoFactor: { type: Boolean, default: false },
  enableAuditLogging: { type: Boolean, default: true },
  enableRateLimiting: { type: Boolean, default: true },
  maxRequestsPerMinute: { type: Number, default: 100, min: 10, max: 1000 },
  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessage: { type: String, default: 'System under maintenance. Please try again later.' },
  emailNotifications: { type: Boolean, default: true },
  slackIntegration: { type: Boolean, default: false },
  slackWebhook: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String }
});

export const SystemSettingsModel = mongoose.model<SystemSettings>('SystemSettings', systemSettingsSchema);

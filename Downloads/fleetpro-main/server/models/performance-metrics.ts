import mongoose, { Document, Schema } from 'mongoose';

export interface PerformanceMetrics extends Document {
  timestamp: Date;
  cpu: number;
  memory: number;
  disk: number;
  responseTime: number;
  requestsPerSecond: number;
  errors: number;
  dbResponseTime: number;
  cacheHitRate: number;
  activeConnections: number;
}

const performanceMetricsSchema = new Schema<PerformanceMetrics>({
  timestamp: { type: Date, default: Date.now, index: true },
  cpu: { type: Number, default: 0 },
  memory: { type: Number, default: 0 },
  disk: { type: Number, default: 0 },
  responseTime: { type: Number, default: 0 },
  requestsPerSecond: { type: Number, default: 0 },
  errors: { type: Number, default: 0 },
  dbResponseTime: { type: Number, default: 0 },
  cacheHitRate: { type: Number, default: 0 },
  activeConnections: { type: Number, default: 0 }
});

// Auto-delete metrics after 30 days (2592000 seconds)
performanceMetricsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

export const PerformanceMetricsModel = mongoose.model<PerformanceMetrics>('PerformanceMetrics', performanceMetricsSchema);

import mongoose, { Document, Schema } from 'mongoose';

export interface AuditLog extends Document {
  timestamp: Date;
  userId: string;
  userName: string;
  userEmail: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ACCESS' | 'EXPORT' | 'IMPORT';
  resourceType: string;
  resourceId: string;
  changes: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failed';
  errorMessage?: string;
}

const auditLogSchema = new Schema<AuditLog>({
  timestamp: { type: Date, default: Date.now, index: true },
  userId: { type: String, required: true, index: true },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  action: {
    type: String,
    enum: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ACCESS', 'EXPORT', 'IMPORT'],
    index: true
  },
  resourceType: { type: String, index: true },
  resourceId: { type: String, index: true },
  changes: { type: Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  status: { type: String, enum: ['success', 'failed'], default: 'success' },
  errorMessage: { type: String }
});

// Add TTL index - auto-delete after 90 days (7776000 seconds)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

export const AuditLogModel = mongoose.model<AuditLog>('AuditLog', auditLogSchema);

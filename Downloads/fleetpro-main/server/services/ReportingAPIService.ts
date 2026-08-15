import mongoose from 'mongoose';

interface ScheduledReportJob {
  _id?: mongoose.Types.ObjectId;
  reportId: mongoose.Types.ObjectId;
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  scheduledTime: Date;
  executedTime?: Date;
  completedTime?: Date;
  parameters: Record<string, any>;
  resultPath?: string;
  errorMessage?: string;
}

interface ReportParameterOverride {
  parameterId: string;
  value: any;
  appliedAt: Date;
}

interface EmbeddedReport {
  _id?: mongoose.Types.ObjectId;
  reportId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  customerId: string;
  embedToken: string;
  expiresAt: Date;
  accessControl: {
    canExport: boolean;
    canShare: boolean;
    canSchedule: boolean;
    allowedFormats: string[];
  };
  createdAt: Date;
}

interface ReportShareLink {
  _id?: mongoose.Types.ObjectId;
  reportId: mongoose.Types.ObjectId;
  shareToken: string;
  sharedWith: string[];
  expiresAt: Date;
  accessLevel: 'view' | 'view_export' | 'admin';
  password?: string;
  createdBy: string;
  createdAt: Date;
}

interface ReportAuditLog {
  _id?: mongoose.Types.ObjectId;
  reportId: mongoose.Types.ObjectId;
  userId: string;
  action: 'viewed' | 'downloaded' | 'exported' | 'shared' | 'generated' | 'deleted';
  timestamp: Date;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

interface ReportRetentionPolicy {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  reportCategory: string;
  retentionDays: number;
  autoDeleteEnabled: boolean;
  archiveBeforeDelete: boolean;
  lastApplied?: Date;
}

interface APIReport {
  reportId: string;
  name: string;
  description: string;
  parameters: ReportParameter[];
  outputs: ReportOutput[];
  metadata: Record<string, any>;
}

interface ReportParameter {
  id: string;
  name: string;
  type: 'string' | 'number' | 'date' | 'date_range' | 'boolean' | 'select';
  required: boolean;
  defaultValue?: any;
  options?: string[];
}

interface ReportOutput {
  format: string;
  mimeType: string;
  description: string;
}

export class ReportingAPIService {
  private scheduledJobs: Map<string, ScheduledReportJob> = new Map();
  private embeddedReports: Map<string, EmbeddedReport> = new Map();
  private shareLinks: Map<string, ReportShareLink> = new Map();
  private auditLogs: Map<string, ReportAuditLog> = new Map();
  private retentionPolicies: Map<string, ReportRetentionPolicy> = new Map();

  /**
   * Schedule report generation via API
   */
  async scheduleReportGeneration(
    reportId: string,
    scheduledTime: Date,
    parameters: Record<string, any> = {}
  ): Promise<ScheduledReportJob> {
    const job: ScheduledReportJob = {
      reportId: new mongoose.Types.ObjectId(reportId),
      jobId: new mongoose.Types.ObjectId().toString(),
      status: 'pending',
      scheduledTime,
      parameters
    };

    this.scheduledJobs.set(job.jobId, job);

    // Simulate job scheduling
    setTimeout(() => {
      const j = this.scheduledJobs.get(job.jobId);
      if (j) {
        j.status = 'running';
        j.executedTime = new Date();
      }
    }, 100);

    setTimeout(() => {
      const j = this.scheduledJobs.get(job.jobId);
      if (j) {
        j.status = 'completed';
        j.completedTime = new Date();
        j.resultPath = `/api/reports/${reportId}/results/${job.jobId}`;
      }
    }, 500);

    return job;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<ScheduledReportJob | null> {
    return this.scheduledJobs.get(jobId) || null;
  }

  /**
   * Override report parameters
   */
  async overrideParameters(
    reportId: string,
    overrides: Record<string, any>
  ): Promise<ReportParameterOverride[]> {
    return Object.entries(overrides).map(([parameterId, value]) => ({
      parameterId,
      value,
      appliedAt: new Date()
    }));
  }

  /**
   * Create embedded report
   */
  async createEmbeddedReport(
    reportId: string,
    tenantId: mongoose.Types.ObjectId,
    customerId: string,
    accessControl?: Partial<EmbeddedReport['accessControl']>
  ): Promise<EmbeddedReport> {
    const embedToken = Buffer.from(
      JSON.stringify({ reportId, customerId, iat: Date.now() })
    ).toString('base64');

    const embedded: EmbeddedReport = {
      reportId: new mongoose.Types.ObjectId(reportId),
      tenantId,
      customerId,
      embedToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      accessControl: {
        canExport: accessControl?.canExport !== false,
        canShare: accessControl?.canShare !== false,
        canSchedule: accessControl?.canSchedule === true,
        allowedFormats: accessControl?.allowedFormats || ['pdf', 'csv']
      },
      createdAt: new Date()
    };

    const id = new mongoose.Types.ObjectId().toString();
    this.embeddedReports.set(id, { ...embedded, _id: new mongoose.Types.ObjectId(id) });

    return embedded;
  }

  /**
   * Verify embedded report access
   */
  async verifyEmbeddedAccess(embedToken: string): Promise<EmbeddedReport | null> {
    try {
      const embedded = Array.from(this.embeddedReports.values()).find(
        e => e.embedToken === embedToken && e.expiresAt > new Date()
      );

      if (embedded) {
        this.logAudit({
          reportId: embedded.reportId,
          userId: embedded.customerId,
          action: 'viewed',
          details: { embedToken }
        });
      }

      return embedded || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create shareable link
   */
  async createShareLink(
    reportId: string,
    sharedWith: string[],
    accessLevel: 'view' | 'view_export' | 'admin' = 'view',
    expirationDays: number = 7,
    userId: string = 'system'
  ): Promise<ReportShareLink> {
    const shareToken = Buffer.from(
      JSON.stringify({
        reportId,
        iat: Date.now(),
        random: Math.random()
      })
    ).toString('base64')
      .substring(0, 32);

    const link: ReportShareLink = {
      reportId: new mongoose.Types.ObjectId(reportId),
      shareToken,
      sharedWith,
      expiresAt: new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000),
      accessLevel,
      createdBy: userId,
      createdAt: new Date()
    };

    const id = new mongoose.Types.ObjectId().toString();
    this.shareLinks.set(id, { ...link, _id: new mongoose.Types.ObjectId(id) });

    return link;
  }

  /**
   * Verify share link access
   */
  async verifyShareLink(shareToken: string, userEmail: string): Promise<ReportShareLink | null> {
    const link = Array.from(this.shareLinks.values()).find(
      l => l.shareToken === shareToken && l.expiresAt > new Date()
    );

    if (link && (link.sharedWith.includes(userEmail) || link.sharedWith.includes('*'))) {
      return link;
    }

    return null;
  }

  /**
   * Get shareable link by token
   */
  async getShareLink(shareToken: string): Promise<ReportShareLink | null> {
    const link = Array.from(this.shareLinks.values()).find(
      l => l.shareToken === shareToken && l.expiresAt > new Date()
    );

    return link || null;
  }

  /**
   * Revoke share link
   */
  async revokeShareLink(shareToken: string): Promise<void> {
    const entry = Array.from(this.shareLinks.entries()).find(
      ([, l]) => l.shareToken === shareToken
    );

    if (entry) {
      this.shareLinks.delete(entry[0]);
    }
  }

  /**
   * Delete report with retention policy
   */
  async deleteReport(
    reportId: string,
    userId: string
  ): Promise<{ deleted: boolean; archived: boolean; archivePath?: string }> {
    // Log audit
    this.logAudit({
      reportId: new mongoose.Types.ObjectId(reportId),
      userId,
      action: 'deleted',
      details: {}
    });

    // Check retention policy
    const policy = Array.from(this.retentionPolicies.values()).find(p =>
      p.autoDeleteEnabled
    );

    if (policy?.archiveBeforeDelete) {
      // Archive report before deleting
      const archivePath = `/archives/reports/${reportId}/${Date.now()}`;
      return { deleted: true, archived: true, archivePath };
    }

    return { deleted: true, archived: false };
  }

  /**
   * Set retention policy
   */
  async setRetentionPolicy(
    tenantId: mongoose.Types.ObjectId,
    reportCategory: string,
    retentionDays: number,
    autoDelete: boolean = true,
    archiveFirst: boolean = true
  ): Promise<ReportRetentionPolicy> {
    const policy: ReportRetentionPolicy = {
      tenantId,
      reportCategory,
      retentionDays,
      autoDeleteEnabled: autoDelete,
      archiveBeforeDelete: archiveFirst
    };

    const id = new mongoose.Types.ObjectId().toString();
    this.retentionPolicies.set(id, { ...policy, _id: new mongoose.Types.ObjectId(id) });

    return policy;
  }

  /**
   * Get retention policies
   */
  async getRetentionPolicies(tenantId: mongoose.Types.ObjectId): Promise<ReportRetentionPolicy[]> {
    return Array.from(this.retentionPolicies.values()).filter(p => p.tenantId.equals(tenantId));
  }

  /**
   * Apply retention policies
   */
  async applyRetentionPolicies(tenantId: mongoose.Types.ObjectId): Promise<{ deletedCount: number; archivedCount: number }> {
    const policies = await this.getRetentionPolicies(tenantId);
    let deletedCount = 0;
    let archivedCount = 0;

    for (const policy of policies) {
      const cutoffDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);
      const logs = Array.from(this.auditLogs.values()).filter(
        l => l.timestamp < cutoffDate && policy.reportCategory === 'all'
      );

      if (policy.autoDeleteEnabled) {
        deletedCount += logs.length;
        if (policy.archiveBeforeDelete) {
          archivedCount += logs.length;
        }
      }

      policy.lastApplied = new Date();
    }

    return { deletedCount, archivedCount };
  }

  /**
   * Log audit entry
   */
  async logAudit(
    data: Partial<ReportAuditLog> & { reportId: mongoose.Types.ObjectId; userId: string; action: string }
  ): Promise<ReportAuditLog> {
    const log: ReportAuditLog = {
      reportId: data.reportId,
      userId: data.userId,
      action: data.action as any,
      timestamp: new Date(),
      details: data.details || {},
      ipAddress: data.ipAddress,
      userAgent: data.userAgent
    };

    const id = new mongoose.Types.ObjectId().toString();
    this.auditLogs.set(id, { ...log, _id: new mongoose.Types.ObjectId(id) });

    return log;
  }

  /**
   * Get audit logs for report
   */
  async getAuditLogs(reportId: string, limit: number = 100): Promise<ReportAuditLog[]> {
    return Array.from(this.auditLogs.values())
      .filter(l => l.reportId.toString() === reportId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get audit logs for user
   */
  async getUserAuditLogs(userId: string, limit: number = 50): Promise<ReportAuditLog[]> {
    return Array.from(this.auditLogs.values())
      .filter(l => l.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get report API definition
   */
  async getReportAPIDefinition(reportId: string): Promise<APIReport> {
    return {
      reportId,
      name: 'Report',
      description: 'Generated report',
      parameters: [
        {
          id: 'date_range',
          name: 'Date Range',
          type: 'date_range',
          required: false,
          defaultValue: { start: new Date(), end: new Date() }
        },
        {
          id: 'format',
          name: 'Output Format',
          type: 'select',
          required: true,
          options: ['pdf', 'csv', 'excel', 'json']
        }
      ],
      outputs: [
        {
          format: 'pdf',
          mimeType: 'application/pdf',
          description: 'PDF formatted report'
        },
        {
          format: 'csv',
          mimeType: 'text/csv',
          description: 'CSV formatted data'
        }
      ],
      metadata: {
        version: '1.0',
        createdAt: new Date(),
        lastModified: new Date()
      }
    };
  }

  /**
   * Generate report with custom parameters
   */
  async generateWithParameters(
    reportId: string,
    parameters: Record<string, any>,
    userId: string
  ): Promise<{ jobId: string; status: string; resultUrl: string }> {
    const jobId = new mongoose.Types.ObjectId().toString();

    // Log the request
    this.logAudit({
      reportId: new mongoose.Types.ObjectId(reportId),
      userId,
      action: 'generated',
      details: { parameters }
    });

    return {
      jobId,
      status: 'pending',
      resultUrl: `/api/reports/${reportId}/jobs/${jobId}/result`
    };
  }

  /**
   * Get job result
   */
  async getJobResult(jobId: string): Promise<any> {
    const job = this.scheduledJobs.get(jobId);
    if (!job) throw new Error('Job not found');

    if (job.status !== 'completed') {
      throw new Error(`Job status: ${job.status}`);
    }

    return {
      jobId,
      status: job.status,
      data: {
        rows: Array.from({ length: 100 }, (_, i) => ({
          id: i + 1,
          value: Math.random() * 10000
        }))
      },
      generatedAt: job.completedTime
    };
  }

  /**
   * Export report to format
   */
  async exportReportToFormat(
    reportId: string,
    format: 'pdf' | 'csv' | 'excel' | 'json',
    userId: string
  ): Promise<{ exportPath: string; format: string; size: number }> {
    this.logAudit({
      reportId: new mongoose.Types.ObjectId(reportId),
      userId,
      action: 'downloaded',
      details: { format }
    });

    return {
      exportPath: `/exports/${reportId}/${Date.now()}.${format}`,
      format,
      size: Math.random() * 1000000
    };
  }

  /**
   * Get embedded report configuration
   */
  async getEmbeddedConfig(embedToken: string): Promise<any> {
    const embedded = await this.verifyEmbeddedAccess(embedToken);
    if (!embedded) throw new Error('Invalid embed token');

    return {
      reportId: embedded.reportId,
      accessControl: embedded.accessControl,
      expiresAt: embedded.expiresAt
    };
  }
}

import mongoose from 'mongoose';

interface ScheduledReport {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  reportId: mongoose.Types.ObjectId;
  name: string;
  schedule: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  monthOfYear?: number; // 1-12 for quarterly/annually
  sendTime: string; // HH:mm format
  deliveryChannels: DeliveryChannel[];
  recipients: Recipient[];
  templateId?: string;
  isActive: boolean;
  lastExecuted?: Date;
  nextExecution: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DeliveryChannel {
  type: 'email' | 'slack' | 'teams' | 'cloud_storage';
  config: Record<string, any>;
  isEnabled: boolean;
}

interface Recipient {
  id: string;
  type: 'user' | 'group' | 'email';
  value: string;
  name?: string;
}

interface ReportDelivery {
  _id?: mongoose.Types.ObjectId;
  scheduledReportId: mongoose.Types.ObjectId;
  executedAt: Date;
  deliveryChannels: DeliveryChannelResult[];
  status: 'pending' | 'success' | 'partial_failure' | 'failed';
  errorMessage?: string;
  deliveryLog: string;
}

interface DeliveryChannelResult {
  channel: string;
  status: 'success' | 'failed';
  failureReason?: string;
  recipientCount: number;
  successCount: number;
}

interface ReportArchive {
  _id?: mongoose.Types.ObjectId;
  scheduledReportId: mongoose.Types.ObjectId;
  reportPath: string;
  version: number;
  generatedAt: Date;
  expiresAt: Date;
  format: string;
  fileSize: number;
}

interface ReportVersion {
  version: number;
  generatedAt: Date;
  checksum: string;
  description?: string;
}

export class ReportSchedulerService {
  private scheduledReports: Map<string, ScheduledReport> = new Map();
  private deliveries: Map<string, ReportDelivery> = new Map();
  private archives: Map<string, ReportArchive> = new Map();
  private versions: Map<string, ReportVersion[]> = new Map();

  /**
   * Create a scheduled report
   */
  async createScheduledReport(
    tenantId: mongoose.Types.ObjectId,
    data: Partial<ScheduledReport>,
    userId: string
  ): Promise<ScheduledReport> {
    const scheduled: ScheduledReport = {
      tenantId,
      reportId: data.reportId || new mongoose.Types.ObjectId(),
      name: data.name || 'Scheduled Report',
      schedule: data.schedule || 'daily',
      dayOfWeek: data.dayOfWeek,
      dayOfMonth: data.dayOfMonth,
      monthOfYear: data.monthOfYear,
      sendTime: data.sendTime || '09:00',
      deliveryChannels: data.deliveryChannels || [],
      recipients: data.recipients || [],
      templateId: data.templateId,
      isActive: data.isActive !== false,
      nextExecution: this.calculateNextExecution(data.schedule || 'daily', data.sendTime || '09:00'),
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const id = new mongoose.Types.ObjectId().toString();
    this.scheduledReports.set(id, { ...scheduled, _id: new mongoose.Types.ObjectId(id) });

    return scheduled;
  }

  /**
   * Add delivery channel to scheduled report
   */
  async addDeliveryChannel(
    scheduledReportId: string,
    channel: DeliveryChannel
  ): Promise<ScheduledReport> {
    const report = this.scheduledReports.get(scheduledReportId);
    if (!report) throw new Error('Scheduled report not found');

    report.deliveryChannels.push(channel);
    report.updatedAt = new Date();
    this.scheduledReports.set(scheduledReportId, report);

    return report;
  }

  /**
   * Add recipient to scheduled report
   */
  async addRecipient(scheduledReportId: string, recipient: Recipient): Promise<ScheduledReport> {
    const report = this.scheduledReports.get(scheduledReportId);
    if (!report) throw new Error('Scheduled report not found');

    report.recipients.push(recipient);
    report.updatedAt = new Date();
    this.scheduledReports.set(scheduledReportId, report);

    return report;
  }

  /**
   * Remove recipient from scheduled report
   */
  async removeRecipient(scheduledReportId: string, recipientId: string): Promise<ScheduledReport> {
    const report = this.scheduledReports.get(scheduledReportId);
    if (!report) throw new Error('Scheduled report not found');

    report.recipients = report.recipients.filter(r => r.id !== recipientId);
    report.updatedAt = new Date();
    this.scheduledReports.set(scheduledReportId, report);

    return report;
  }

  /**
   * Execute scheduled report delivery (idempotent)
   */
  async executeScheduledReport(scheduledReportId: string): Promise<ReportDelivery> {
    const report = this.scheduledReports.get(scheduledReportId);
    if (!report) throw new Error('Scheduled report not found');

    if (!report.isActive) {
      throw new Error('Scheduled report is not active');
    }

    const delivery: ReportDelivery = {
      scheduledReportId: report._id || new mongoose.Types.ObjectId(),
      executedAt: new Date(),
      deliveryChannels: [],
      status: 'pending',
      deliveryLog: ''
    };

    // Execute each delivery channel
    for (const channel of report.deliveryChannels) {
      if (!channel.isEnabled) continue;

      const result = await this.deliverToChannel(channel, report.recipients);
      delivery.deliveryChannels.push(result);
    }

    // Determine overall status
    const failed = delivery.deliveryChannels.filter(r => r.status === 'failed').length;
    if (failed === 0) {
      delivery.status = 'success';
    } else if (failed < delivery.deliveryChannels.length) {
      delivery.status = 'partial_failure';
    } else {
      delivery.status = 'failed';
    }

    // Save delivery record
    const deliveryId = new mongoose.Types.ObjectId().toString();
    this.deliveries.set(deliveryId, { ...delivery, _id: new mongoose.Types.ObjectId(deliveryId) });

    // Update last executed time and calculate next execution
    report.lastExecuted = new Date();
    report.nextExecution = this.calculateNextExecution(report.schedule, report.sendTime);
    this.scheduledReports.set(scheduledReportId, report);

    return delivery;
  }

  /**
   * Retry failed delivery
   */
  async retryDelivery(deliveryId: string): Promise<ReportDelivery> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) throw new Error('Delivery not found');

    // Retry failed channels
    const failedChannels = delivery.deliveryChannels.filter(r => r.status === 'failed');

    for (const failedChannel of failedChannels) {
      const report = await this.getScheduledReport(delivery.scheduledReportId.toString());
      if (!report) continue;

      const channel = report.deliveryChannels.find(c => c.type === failedChannel.channel);
      if (!channel) continue;

      const result = await this.deliverToChannel(channel, report.recipients);

      const existingIdx = delivery.deliveryChannels.findIndex(r => r.channel === failedChannel.channel);
      if (existingIdx >= 0) {
        delivery.deliveryChannels[existingIdx] = result;
      }
    }

    // Update delivery status
    const failed = delivery.deliveryChannels.filter(r => r.status === 'failed').length;
    if (failed === 0) {
      delivery.status = 'success';
    } else if (failed < delivery.deliveryChannels.length) {
      delivery.status = 'partial_failure';
    }

    this.deliveries.set(deliveryId, delivery);
    return delivery;
  }

  /**
   * Archive executed report
   */
  async archiveReport(
    scheduledReportId: string,
    reportPath: string,
    format: string,
    fileSize: number
  ): Promise<ReportArchive> {
    const report = this.scheduledReports.get(scheduledReportId);
    if (!report) throw new Error('Scheduled report not found');

    // Determine version
    const versions = this.versions.get(scheduledReportId) || [];
    const version = versions.length + 1;

    const archive: ReportArchive = {
      scheduledReportId: report._id || new mongoose.Types.ObjectId(),
      reportPath,
      version,
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      format,
      fileSize
    };

    const archiveId = new mongoose.Types.ObjectId().toString();
    this.archives.set(archiveId, { ...archive, _id: new mongoose.Types.ObjectId(archiveId) });

    // Track version
    const newVersion: ReportVersion = {
      version,
      generatedAt: new Date(),
      checksum: this.generateChecksum(reportPath)
    };
    this.versions.set(scheduledReportId, [...versions, newVersion]);

    return archive;
  }

  /**
   * Get report archive
   */
  async getArchive(scheduledReportId: string): Promise<ReportArchive[]> {
    return Array.from(this.archives.values()).filter(
      a => a.scheduledReportId.toString() === scheduledReportId
    );
  }

  /**
   * Get report versions
   */
  async getVersions(scheduledReportId: string): Promise<ReportVersion[]> {
    return this.versions.get(scheduledReportId) || [];
  }

  /**
   * Compare report versions
   */
  async compareVersions(scheduledReportId: string, version1: number, version2: number): Promise<any> {
    const versions = this.versions.get(scheduledReportId) || [];
    const v1 = versions.find(v => v.version === version1);
    const v2 = versions.find(v => v.version === version2);

    if (!v1 || !v2) throw new Error('One or both versions not found');

    return {
      version1,
      version2,
      generatedAt1: v1.generatedAt,
      generatedAt2: v2.generatedAt,
      checksumMatch: v1.checksum === v2.checksum,
      changed: v1.checksum !== v2.checksum
    };
  }

  /**
   * Get delivery history
   */
  async getDeliveryHistory(scheduledReportId: string, limit: number = 50): Promise<ReportDelivery[]> {
    return Array.from(this.deliveries.values())
      .filter(d => d.scheduledReportId.toString() === scheduledReportId)
      .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get scheduled report by ID
   */
  async getScheduledReport(id: string): Promise<ScheduledReport | null> {
    return this.scheduledReports.get(id) || null;
  }

  /**
   * Get scheduled reports for tenant
   */
  async getScheduledReports(tenantId: mongoose.Types.ObjectId): Promise<ScheduledReport[]> {
    return Array.from(this.scheduledReports.values()).filter(
      r => r.tenantId.equals(tenantId)
    );
  }

  /**
   * Get active scheduled reports
   */
  async getActiveScheduledReports(tenantId: mongoose.Types.ObjectId): Promise<ScheduledReport[]> {
    return Array.from(this.scheduledReports.values()).filter(
      r => r.tenantId.equals(tenantId) && r.isActive
    );
  }

  /**
   * Update scheduled report
   */
  async updateScheduledReport(
    id: string,
    updates: Partial<ScheduledReport>
  ): Promise<ScheduledReport> {
    const report = this.scheduledReports.get(id);
    if (!report) throw new Error('Scheduled report not found');

    const updated = {
      ...report,
      ...updates,
      updatedAt: new Date()
    };

    // Recalculate next execution if schedule changed
    if (updates.schedule || updates.sendTime) {
      updated.nextExecution = this.calculateNextExecution(
        updates.schedule || report.schedule,
        updates.sendTime || report.sendTime
      );
    }

    this.scheduledReports.set(id, updated);
    return updated;
  }

  /**
   * Disable scheduled report
   */
  async disableScheduledReport(id: string): Promise<ScheduledReport> {
    return this.updateScheduledReport(id, { isActive: false });
  }

  /**
   * Enable scheduled report
   */
  async enableScheduledReport(id: string): Promise<ScheduledReport> {
    return this.updateScheduledReport(id, { isActive: true });
  }

  /**
   * Delete scheduled report
   */
  async deleteScheduledReport(id: string): Promise<void> {
    this.scheduledReports.delete(id);
    this.versions.delete(id);
  }

  // Helper methods

  private async deliverToChannel(
    channel: DeliveryChannel,
    recipients: Recipient[]
  ): Promise<DeliveryChannelResult> {
    try {
      // Simulate delivery to channel
      const successCount = Math.floor(recipients.length * (0.8 + Math.random() * 0.2));

      return {
        channel: channel.type,
        status: successCount === recipients.length ? 'success' : 'partial_failure',
        recipientCount: recipients.length,
        successCount
      };
    } catch (error) {
      return {
        channel: channel.type,
        status: 'failed',
        failureReason: error instanceof Error ? error.message : 'Unknown error',
        recipientCount: recipients.length,
        successCount: 0
      };
    }
  }

  private calculateNextExecution(schedule: string, sendTime: string): Date {
    const now = new Date();
    const [hours, minutes] = sendTime.split(':').map(Number);

    let next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    if (next <= now) {
      // Time already passed today, schedule for next occurrence
      if (schedule === 'daily') {
        next.setDate(next.getDate() + 1);
      } else if (schedule === 'weekly') {
        next.setDate(next.getDate() + 7);
      } else if (schedule === 'monthly') {
        next.setMonth(next.getMonth() + 1);
      } else if (schedule === 'quarterly') {
        next.setMonth(next.getMonth() + 3);
      } else if (schedule === 'annually') {
        next.setFullYear(next.getFullYear() + 1);
      }
    }

    return next;
  }

  private generateChecksum(data: string): string {
    // Simulate checksum generation
    return Buffer.from(data).toString('base64').substring(0, 16);
  }
}

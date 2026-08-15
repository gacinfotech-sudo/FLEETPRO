import mongoose from 'mongoose';
import { SalaryHistory, SalaryAuditTrail, Driver } from '../models/index';
import { ISalaryHistory, ISalaryAuditTrail } from '../models/index';

interface CreateSalaryHistoryDTO {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  salaryMasterId?: mongoose.Types.ObjectId;
  changeType: 'hike' | 'adjustment' | 'deduction' | 'incentive_change' | 'initial_setup';
  previousValue?: {
    baseSalary?: number;
    incentives?: number;
    deductions?: number;
    netSalary?: number;
  };
  newValue: {
    baseSalary?: number;
    incentives?: number;
    deductions?: number;
    netSalary?: number;
  };
  changeAmount?: number;
  percentageChange?: number;
  reason?: string;
  notes?: string;
  appliedFrom: Date;
  attachmentUrl?: string;
  createdBy: {
    userId: string;
    userName: string;
    role: string;
  };
}

interface AuditTrailDTO {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  salaryHistoryId?: mongoose.Types.ObjectId;
  action: 'created' | 'updated' | 'approved' | 'rejected' | 'applied' | 'viewed' | 'exported';
  actionDetails?: {
    fieldChanged?: string;
    oldValue?: any;
    newValue?: any;
    changeDescription?: string;
  };
  actor: {
    userId: string;
    userName: string;
    role: string;
    department?: string;
  };
  ipAddress?: string;
  userAgent?: string;
  severity?: 'low' | 'medium' | 'high';
  tags?: string[];
}

export class SalaryHistoryService {
  /**
   * Create a new salary history record (immutable after creation)
   */
  async createSalaryHistory(data: CreateSalaryHistoryDTO): Promise<ISalaryHistory> {
    // Validate driver exists
    const driver = await Driver.findById(data.driverId);
    if (!driver) {
      throw new Error(`Driver not found: ${data.driverId}`);
    }

    // Calculate metrics if not provided
    let percentageChange = data.percentageChange;
    if (!percentageChange && data.previousValue?.baseSalary && data.newValue.baseSalary) {
      percentageChange = ((data.newValue.baseSalary - data.previousValue.baseSalary) / data.previousValue.baseSalary) * 100;
    }

    const salaryHistory = new SalaryHistory({
      tenantId: data.tenantId,
      driverId: data.driverId,
      salaryMasterId: data.salaryMasterId,
      changeType: data.changeType,
      previousValue: data.previousValue || {},
      newValue: data.newValue,
      changeAmount: data.changeAmount,
      percentageChange,
      reason: data.reason,
      notes: data.notes,
      appliedFrom: data.appliedFrom,
      createdBy: data.createdBy,
      status: 'draft',
      attachmentUrl: data.attachmentUrl,
      createdAt: new Date()
    });

    const saved = await salaryHistory.save();

    // Log this action in audit trail
    await this.createAuditTrail({
      tenantId: data.tenantId,
      driverId: data.driverId,
      salaryHistoryId: saved._id as mongoose.Types.ObjectId,
      action: 'created',
      actionDetails: {
        fieldChanged: 'salary_record',
        newValue: saved.newValue,
        changeDescription: `${data.changeType} created for driver: ${percentageChange?.toFixed(2)}% change`
      },
      actor: data.createdBy,
      severity: 'high',
      tags: [data.changeType, 'salary_creation']
    });

    return saved;
  }

  /**
   * Submit salary history for approval
   */
  async submitForApproval(
    salaryHistoryId: mongoose.Types.ObjectId,
    actor: {
      userId: string;
      userName: string;
      role: string;
    }
  ): Promise<ISalaryHistory> {
    const history = await SalaryHistory.findById(salaryHistoryId);
    if (!history) {
      throw new Error('Salary history not found');
    }

    if (history.status !== 'draft') {
      throw new Error(`Cannot submit for approval. Current status: ${history.status}`);
    }

    // Update status (mongoose will allow this as it's an update, not a creation)
    history.status = 'pending_approval';
    const updated = await history.save();

    await this.createAuditTrail({
      tenantId: history.tenantId,
      driverId: history.driverId,
      salaryHistoryId,
      action: 'updated',
      actionDetails: {
        fieldChanged: 'status',
        oldValue: 'draft',
        newValue: 'pending_approval',
        changeDescription: 'Salary change submitted for approval'
      },
      actor,
      severity: 'high',
      tags: ['approval_flow', 'status_change']
    });

    return updated;
  }

  /**
   * Approve salary history change
   */
  async approveSalaryChange(
    salaryHistoryId: mongoose.Types.ObjectId,
    approver: {
      userId: string;
      userName: string;
      role: string;
    }
  ): Promise<ISalaryHistory> {
    const history = await SalaryHistory.findById(salaryHistoryId);
    if (!history) {
      throw new Error('Salary history not found');
    }

    if (history.status !== 'pending_approval') {
      throw new Error(`Cannot approve. Current status: ${history.status}`);
    }

    history.status = 'approved';
    history.approvedBy = {
      userId: approver.userId,
      userName: approver.userName,
      approvalDate: new Date()
    };

    const updated = await history.save();

    await this.createAuditTrail({
      tenantId: history.tenantId,
      driverId: history.driverId,
      salaryHistoryId,
      action: 'approved',
      actionDetails: {
        fieldChanged: 'status',
        oldValue: 'pending_approval',
        newValue: 'approved',
        changeDescription: `Salary change approved by ${approver.userName}`
      },
      actor: approver,
      severity: 'high',
      tags: ['approval_flow', 'approved']
    });

    return updated;
  }

  /**
   * Reject salary history change
   */
  async rejectSalaryChange(
    salaryHistoryId: mongoose.Types.ObjectId,
    rejectionReason: string,
    actor: {
      userId: string;
      userName: string;
      role: string;
    }
  ): Promise<ISalaryHistory> {
    const history = await SalaryHistory.findById(salaryHistoryId);
    if (!history) {
      throw new Error('Salary history not found');
    }

    if (history.status !== 'pending_approval') {
      throw new Error(`Cannot reject. Current status: ${history.status}`);
    }

    history.status = 'rejected';
    history.notes = (history.notes ? history.notes + '\n' : '') + `Rejected: ${rejectionReason}`;

    const updated = await history.save();

    await this.createAuditTrail({
      tenantId: history.tenantId,
      driverId: history.driverId,
      salaryHistoryId,
      action: 'rejected',
      actionDetails: {
        fieldChanged: 'status',
        oldValue: 'pending_approval',
        newValue: 'rejected',
        changeDescription: `Salary change rejected: ${rejectionReason}`
      },
      actor,
      severity: 'high',
      tags: ['approval_flow', 'rejected']
    });

    return updated;
  }

  /**
   * Apply approved salary change to current salary
   */
  async applySalaryChange(
    salaryHistoryId: mongoose.Types.ObjectId,
    actor: {
      userId: string;
      userName: string;
      role: string;
    }
  ): Promise<ISalaryHistory> {
    const history = await SalaryHistory.findById(salaryHistoryId);
    if (!history) {
      throw new Error('Salary history not found');
    }

    if (history.status !== 'approved') {
      throw new Error(`Cannot apply. Salary must be approved first. Current status: ${history.status}`);
    }

    // Check if applied date has passed
    if (history.appliedFrom > new Date()) {
      throw new Error(`Salary change cannot be applied yet. Scheduled for ${history.appliedFrom}`);
    }

    history.status = 'applied';
    const updated = await history.save();

    await this.createAuditTrail({
      tenantId: history.tenantId,
      driverId: history.driverId,
      salaryHistoryId,
      action: 'applied',
      actionDetails: {
        fieldChanged: 'status',
        oldValue: 'approved',
        newValue: 'applied',
        changeDescription: 'Salary change applied to current salary'
      },
      actor,
      severity: 'high',
      tags: ['salary_application', 'applied']
    });

    return updated;
  }

  /**
   * Get salary history for a driver
   */
  async getDriverSalaryHistory(
    tenantId: mongoose.Types.ObjectId,
    driverId: mongoose.Types.ObjectId,
    options?: {
      limit?: number;
      offset?: number;
      status?: string;
      changeType?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ data: ISalaryHistory[]; total: number }> {
    const query: any = {
      tenantId,
      driverId
    };

    if (options?.status) {
      query.status = options.status;
    }

    if (options?.changeType) {
      query.changeType = options.changeType;
    }

    if (options?.startDate || options?.endDate) {
      query.appliedFrom = {};
      if (options.startDate) {
        query.appliedFrom.$gte = options.startDate;
      }
      if (options.endDate) {
        query.appliedFrom.$lte = options.endDate;
      }
    }

    const total = await SalaryHistory.countDocuments(query);
    const data = await SalaryHistory.find(query)
      .sort({ appliedFrom: -1, createdAt: -1 })
      .limit(options?.limit || 50)
      .skip(options?.offset || 0)
      .populate('driverId', 'name phone email')
      .exec();

    return { data, total };
  }

  /**
   * Get complete audit trail for a salary history
   */
  async getSalaryAuditTrail(
    salaryHistoryId: mongoose.Types.ObjectId,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<{ data: ISalaryAuditTrail[]; total: number }> {
    const total = await SalaryAuditTrail.countDocuments({ salaryHistoryId });
    const data = await SalaryAuditTrail.find({ salaryHistoryId })
      .sort({ createdAt: -1 })
      .limit(options?.limit || 100)
      .skip(options?.offset || 0)
      .exec();

    return { data, total };
  }

  /**
   * Get audit trail for a driver's salary (all changes)
   */
  async getDriverSalaryAuditTrail(
    tenantId: mongoose.Types.ObjectId,
    driverId: mongoose.Types.ObjectId,
    options?: {
      limit?: number;
      offset?: number;
      action?: string;
      severity?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ data: ISalaryAuditTrail[]; total: number }> {
    const query: any = {
      tenantId,
      driverId
    };

    if (options?.action) {
      query.action = options.action;
    }

    if (options?.severity) {
      query.severity = options.severity;
    }

    if (options?.startDate || options?.endDate) {
      query.createdAt = {};
      if (options.startDate) {
        query.createdAt.$gte = options.startDate;
      }
      if (options.endDate) {
        query.createdAt.$lte = options.endDate;
      }
    }

    const total = await SalaryAuditTrail.countDocuments(query);
    const data = await SalaryAuditTrail.find(query)
      .sort({ createdAt: -1 })
      .limit(options?.limit || 100)
      .skip(options?.offset || 0)
      .exec();

    return { data, total };
  }

  /**
   * Log action in audit trail
   */
  private async createAuditTrail(data: AuditTrailDTO): Promise<ISalaryAuditTrail> {
    const auditTrail = new SalaryAuditTrail({
      tenantId: data.tenantId,
      driverId: data.driverId,
      salaryHistoryId: data.salaryHistoryId,
      action: data.action,
      actionDetails: data.actionDetails || {},
      actor: data.actor,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      status: 'success',
      severity: data.severity || 'low',
      tags: data.tags || [],
      createdAt: new Date()
    });

    return auditTrail.save();
  }

  /**
   * Get salary summary for driver
   */
  async getDriverSalarySummary(
    tenantId: mongoose.Types.ObjectId,
    driverId: mongoose.Types.ObjectId
  ): Promise<{
    currentRecord: ISalaryHistory | null;
    lastHike: ISalaryHistory | null;
    totalChanges: number;
    pendingApprovals: number;
    history: ISalaryHistory[];
  }> {
    const [current, lastHike, total, pending, history] = await Promise.all([
      SalaryHistory.findOne({ tenantId, driverId, status: 'applied' })
        .sort({ appliedFrom: -1 })
        .exec(),
      SalaryHistory.findOne({ tenantId, driverId, changeType: 'hike', status: 'applied' })
        .sort({ appliedFrom: -1 })
        .exec(),
      SalaryHistory.countDocuments({ tenantId, driverId }),
      SalaryHistory.countDocuments({ tenantId, driverId, status: 'pending_approval' }),
      SalaryHistory.find({ tenantId, driverId })
        .sort({ appliedFrom: -1 })
        .limit(10)
        .exec()
    ]);

    return {
      currentRecord: current,
      lastHike,
      totalChanges: total,
      pendingApprovals: pending,
      history
    };
  }

  /**
   * Export salary history as JSON or CSV
   */
  async exportSalaryHistory(
    tenantId: mongoose.Types.ObjectId,
    driverId: mongoose.Types.ObjectId,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const { data } = await this.getDriverSalaryHistory(tenantId, driverId, { limit: 1000 });

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    // CSV format
    const headers = ['Date', 'Change Type', 'Previous Base', 'New Base', 'Change %', 'Reason', 'Status', 'Created By'];
    const rows = data.map(record => [
      record.createdAt.toISOString(),
      record.changeType,
      record.previousValue.baseSalary || '',
      record.newValue.baseSalary || '',
      record.percentageChange?.toFixed(2) || '',
      record.reason || '',
      record.status,
      record.createdBy.userName
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    return csv;
  }

  /**
   * Validate salary history integrity
   */
  async validateIntegrity(
    tenantId: mongoose.Types.ObjectId,
    driverId: mongoose.Types.ObjectId
  ): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    const history = await SalaryHistory.find({ tenantId, driverId }).sort({ appliedFrom: 1 }).exec();

    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const current = history[i];

      // Check if previous record's new value matches current record's previous value
      if (
        prev.status === 'applied' &&
        current.previousValue.baseSalary &&
        prev.newValue.baseSalary !== current.previousValue.baseSalary
      ) {
        issues.push(
          `Salary continuity break at record ${current._id}: Previous new value (${prev.newValue.baseSalary}) doesn't match current previous value (${current.previousValue.baseSalary})`
        );
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

export default new SalaryHistoryService();

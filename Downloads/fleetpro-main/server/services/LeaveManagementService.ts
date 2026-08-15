import {
  DriverLeave,
  LeaveType,
  LeaveAccrual,
  Attendance,
  DriverSalary,
  Driver,
  IDriverLeave,
  ILeaveAccrual,
} from '../models/index';
import mongoose from 'mongoose';

export class LeaveManagementService {
  /**
   * Request leave
   */
  static async requestLeave(tenantId: string, driverId: string, data: any) {
    try {
      // Validate leave type exists
      const leaveType = await LeaveType.findOne({
        _id: data.leaveType,
        tenantId,
        isActive: true,
      });

      if (!leaveType) {
        throw new Error('Invalid leave type');
      }

      // Calculate number of days
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      const days = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

      // Check balance if not unpaid leave
      if (!leaveType.isNonDeductible) {
        const currentYear = new Date().getFullYear();
        const accrual = await LeaveAccrual.findOne({
          tenantId,
          driverId,
          leaveType: data.leaveType,
          year: currentYear,
        });

        if (!accrual || accrual.balance < days) {
          throw new Error('Insufficient leave balance');
        }
      }

      // Create leave request
      const leave = new DriverLeave({
        tenantId,
        driverId,
        leaveType: data.leaveType,
        startDate,
        endDate,
        days,
        status: leaveType.requiresApproval ? 'pending' : 'approved',
        reason: data.reason,
        notes: data.notes,
      });

      await leave.save();

      // Auto-approve if no approval required
      if (!leaveType.requiresApproval) {
        await this.updateLeaveAccrual(tenantId, driverId, data.leaveType, days);
      }

      return leave;
    } catch (error: any) {
      throw new Error(`Failed to request leave: ${error.message}`);
    }
  }

  /**
   * Approve leave request
   */
  static async approveLeave(
    tenantId: string,
    leaveId: string,
    approver: { userId: string; userName: string }
  ) {
    try {
      const leave = await DriverLeave.findOne({ _id: leaveId, tenantId });

      if (!leave) {
        throw new Error('Leave request not found');
      }

      if (leave.status !== 'pending') {
        throw new Error(`Cannot approve ${leave.status} leave request`);
      }

      // Update leave status
      leave.status = 'approved';
      leave.approvedBy = {
        userId: approver.userId,
        userName: approver.userName,
        approvalDate: new Date(),
      };
      await leave.save();

      // Update leave accrual
      const leaveType = await LeaveType.findById(leave.leaveType);
      if (!leaveType?.isNonDeductible) {
        await this.updateLeaveAccrual(
          tenantId,
          leave.driverId.toString(),
          leave.leaveType.toString(),
          leave.days
        );
      }

      return leave;
    } catch (error: any) {
      throw new Error(`Failed to approve leave: ${error.message}`);
    }
  }

  /**
   * Reject leave request
   */
  static async rejectLeave(
    tenantId: string,
    leaveId: string,
    rejectionReason: string,
    approver: { userId: string; userName: string }
  ) {
    try {
      const leave = await DriverLeave.findOne({ _id: leaveId, tenantId });

      if (!leave) {
        throw new Error('Leave request not found');
      }

      if (leave.status !== 'pending') {
        throw new Error(`Cannot reject ${leave.status} leave request`);
      }

      leave.status = 'rejected';
      leave.rejectionReason = rejectionReason;
      leave.approvedBy = {
        userId: approver.userId,
        userName: approver.userName,
        approvalDate: new Date(),
      };
      await leave.save();

      return leave;
    } catch (error: any) {
      throw new Error(`Failed to reject leave: ${error.message}`);
    }
  }

  /**
   * Get leave balance for all leave types
   */
  static async getLeaveBalance(tenantId: string, driverId: string) {
    try {
      const currentYear = new Date().getFullYear();

      // Get all active leave types for tenant
      const leaveTypes = await LeaveType.find({
        tenantId,
        isActive: true,
      });

      const balances = [];

      for (const leaveType of leaveTypes) {
        // Get or create accrual record
        let accrual = await LeaveAccrual.findOne({
          tenantId,
          driverId,
          leaveType: leaveType._id,
          year: currentYear,
        });

        if (!accrual) {
          accrual = new LeaveAccrual({
            tenantId,
            driverId,
            leaveType: leaveType._id,
            accrued: leaveType.daysPerYear,
            used: 0,
            balance: leaveType.daysPerYear,
            year: currentYear,
          });
          await accrual.save();
        }

        balances.push({
          leaveTypeId: leaveType._id,
          leaveTypeName: leaveType.name,
          accrued: accrual.accrued,
          used: accrual.used,
          balance: accrual.balance,
          daysPerYear: leaveType.daysPerYear,
          isNonDeductible: leaveType.isNonDeductible,
        });
      }

      return balances;
    } catch (error: any) {
      throw new Error(`Failed to get leave balance: ${error.message}`);
    }
  }

  /**
   * Get leave history
   */
  static async getLeaveHistory(tenantId: string, driverId: string, limit = 50, offset = 0) {
    try {
      const leaves = await DriverLeave.find({
        tenantId,
        driverId,
      })
        .populate('leaveType', 'name isNonDeductible')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset);

      const total = await DriverLeave.countDocuments({
        tenantId,
        driverId,
      });

      return { leaves, total };
    } catch (error: any) {
      throw new Error(`Failed to get leave history: ${error.message}`);
    }
  }

  /**
   * Update leave accrual when leave is approved
   */
  private static async updateLeaveAccrual(
    tenantId: string,
    driverId: string,
    leaveTypeId: string,
    days: number
  ) {
    try {
      const currentYear = new Date().getFullYear();

      const accrual = await LeaveAccrual.findOne({
        tenantId,
        driverId,
        leaveType: leaveTypeId,
        year: currentYear,
      });

      if (accrual) {
        accrual.used += days;
        accrual.balance = accrual.accrued - accrual.used;
        accrual.lastUpdated = new Date();
        await accrual.save();
      }
    } catch (error: any) {
      console.error('Failed to update leave accrual:', error.message);
    }
  }

  /**
   * Create attendance records for approved leave
   */
  static async createLeaveAttendance(tenantId: string, driverId: string, leave: any) {
    try {
      const startDate = new Date(leave.startDate);
      const endDate = new Date(leave.endDate);

      const attendances = [];

      for (
        let date = new Date(startDate);
        date <= endDate;
        date.setDate(date.getDate() + 1)
      ) {
        const leaveType = await LeaveType.findById(leave.leaveType);
        const salary = await DriverSalary.findOne({
          tenantId,
          driverId,
        });

        let salaryCutoff = 0;
        if (!leaveType?.isNonDeductible && salary) {
          // Deduct 1.5x daily rate for unpaid leave
          salaryCutoff = (salary.baseSalary / 30) * 1.5;
        }

        const attendance = new Attendance({
          tenantId,
          driverId,
          date: new Date(date),
          status: 'LEAVE',
          leaveType: leaveType?.name.toLowerCase().includes('sick') ? 'sick' : 'casual',
          salaryCutoffAmount: salaryCutoff,
          autoMarked: true,
        });

        await attendance.save();
        attendances.push(attendance);
      }

      return attendances;
    } catch (error: any) {
      throw new Error(`Failed to create leave attendance: ${error.message}`);
    }
  }

  /**
   * Get leave statistics for dashboard
   */
  static async getLeaveStatistics(tenantId: string) {
    try {
      const currentYear = new Date().getFullYear();

      // Total pending approvals
      const pendingCount = await DriverLeave.countDocuments({
        tenantId,
        status: 'pending',
      });

      // Total approved this year
      const approvedCount = await DriverLeave.countDocuments({
        tenantId,
        status: 'approved',
        createdAt: {
          $gte: new Date(currentYear, 0, 1),
          $lte: new Date(currentYear, 11, 31),
        },
      });

      // Total leave days used this year
      const totalDaysUsed = await DriverLeave.aggregate([
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(tenantId),
            status: 'approved',
            createdAt: {
              $gte: new Date(currentYear, 0, 1),
              $lte: new Date(currentYear, 11, 31),
            },
          },
        },
        {
          $group: {
            _id: null,
            totalDays: { $sum: '$days' },
          },
        },
      ]);

      return {
        pendingApprovals: pendingCount,
        approvedLeaves: approvedCount,
        totalDaysUsed: totalDaysUsed[0]?.totalDays || 0,
      };
    } catch (error: any) {
      throw new Error(`Failed to get leave statistics: ${error.message}`);
    }
  }

  /**
   * Calculate salary deduction for unpaid leave
   */
  static async calculateLeaveDeduction(
    tenantId: string,
    driverId: string,
    month: number,
    year: number
  ) {
    try {
      const salary = await DriverSalary.findOne({
        tenantId,
        driverId,
        month,
        year,
      });

      if (!salary) {
        return 0;
      }

      // Get all unpaid leave for the month
      const leaves = await DriverLeave.find({
        tenantId,
        driverId,
        status: 'approved',
        startDate: { $gte: new Date(year, month - 1, 1) },
        endDate: { $lt: new Date(year, month, 1) },
      }).populate('leaveType');

      let deduction = 0;
      const dailyRate = salary.baseSalary / 30;

      for (const leave of leaves) {
        const leaveType: any = leave.leaveType;
        if (!leaveType?.isNonDeductible) {
          // Unpaid leave deduction: 1.5x daily rate
          deduction += leave.days * dailyRate * 1.5;
        }
      }

      return deduction;
    } catch (error: any) {
      throw new Error(`Failed to calculate leave deduction: ${error.message}`);
    }
  }
}

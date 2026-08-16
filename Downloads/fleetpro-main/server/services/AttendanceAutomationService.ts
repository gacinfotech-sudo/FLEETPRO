import mongoose from 'mongoose';
import { Attendance, Booking, Driver } from '../models/index';
import { IAttendance } from '../models/index';

/**
 * Attendance Status Types
 * - BOOKING_SERVE: Driver is actively serving a booking
 * - IDLE_AVAILABLE: Driver is available and idle (no active booking)
 * - LEAVE: Driver is on leave (sick, casual, earned, unpaid, emergency)
 * - ABSENT: Driver is absent without explanation
 * - MANUAL_OVERRIDE: Admin/Manager manually marked attendance
 */
export type AttendanceStatus = 'BOOKING_SERVE' | 'IDLE_AVAILABLE' | 'LEAVE' | 'ABSENT' | 'MANUAL_OVERRIDE';
export type LeaveType = 'sick' | 'casual' | 'earned' | 'unpaid' | 'emergency';

interface AutoMarkAttendanceDTO {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  date?: Date; // Defaults to today
  status: AttendanceStatus;
  leaveType?: LeaveType;
  bookingId?: mongoose.Types.ObjectId;
  notes?: string;
  checkInTime?: Date;
  checkOutTime?: Date;
}

interface ManualOverrideAttendanceDTO {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  date?: Date; // Defaults to today
  status: AttendanceStatus;
  leaveType?: LeaveType;
  notes?: string;
  markedBy: {
    userId: string;
    userName: string;
    role: string;
  };
  checkInTime?: Date;
  checkOutTime?: Date;
}

export class AttendanceAutomationService {
  /**
   * Get or create attendance record for a driver on a specific date
   */
  private async getOrCreateAttendanceRecord(
    tenantId: mongoose.Types.ObjectId,
    driverId: mongoose.Types.ObjectId,
    date: Date = new Date()
  ): Promise<IAttendance> {
    // Normalize date to start of day (00:00:00)
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    let attendance = await Attendance.findOne({
      tenantId,
      driverId,
      date: {
        $gte: normalizedDate,
        $lt: new Date(normalizedDate.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    if (!attendance) {
      attendance = new Attendance({
        tenantId,
        driverId,
        date: normalizedDate,
        status: 'IDLE_AVAILABLE',
        autoMarked: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return attendance;
  }

  /**
   * Determine attendance status based on driver state and active bookings
   */
  private async determineAttendanceStatus(
    tenantId: mongoose.Types.ObjectId,
    driverId: mongoose.Types.ObjectId,
    date: Date = new Date()
  ): Promise<{ status: AttendanceStatus; bookingId?: mongoose.Types.ObjectId }> {
    // Get driver info
    const driver = await Driver.findById(driverId);
    if (!driver) {
      throw new Error(`Driver not found: ${driverId}`);
    }

    // Check for active bookings on this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    const activeBooking = await Booking.findOne({
      tenantId,
      driverId,
      pickupDate: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      status: { $in: ['confirmed', 'completed'] },
      bookingType: { $in: ['with_driver', 'one_way', 'round_trip', 'local', 'airport'] }
    }).sort({ pickupDate: 1 });

    if (activeBooking) {
      return {
        status: 'BOOKING_SERVE',
        bookingId: activeBooking._id as mongoose.Types.ObjectId
      };
    }

    // Check driver status
    if (driver.status === 'off_duty') {
      return { status: 'LEAVE' };
    }

    // Default to idle available
    return { status: 'IDLE_AVAILABLE' };
  }

  /**
   * Auto-mark attendance for a single driver
   * This method intelligently determines the attendance status based on driver state
   */
  async autoMarkAttendance(data: AutoMarkAttendanceDTO): Promise<IAttendance> {
    const date = data.date || new Date();

    // Validate driver exists
    const driver = await Driver.findById(data.driverId);
    if (!driver) {
      throw new Error(`Driver not found: ${data.driverId}`);
    }

    // Get or create attendance record
    let attendance = await this.getOrCreateAttendanceRecord(data.tenantId, data.driverId, date);

    // Skip update if already manually marked
    if (!attendance.autoMarked && attendance.updatedAt) {
      const hoursSinceUpdate = (Date.now() - attendance.updatedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate < 24) {
        // Don't override recent manual marks
        return attendance;
      }
    }

    // Update attendance
    attendance.status = data.status;
    attendance.leaveType = data.leaveType;
    attendance.bookingId = data.bookingId;
    attendance.notes = data.notes || attendance.notes;
    attendance.checkInTime = data.checkInTime || attendance.checkInTime;
    attendance.checkOutTime = data.checkOutTime || attendance.checkOutTime;
    attendance.autoMarked = true;
    attendance.updatedAt = new Date();

    // Calculate total hours if both check-in and check-out times are present
    if (attendance.checkInTime && attendance.checkOutTime) {
      const diffMs = attendance.checkOutTime.getTime() - attendance.checkInTime.getTime();
      attendance.totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 2) / 2; // Round to nearest 0.5
    }

    return attendance.save();
  }

  /**
   * Process attendance for all drivers in a tenant
   * Automatically determines status based on driver state and bookings
   */
  async processAllDriversAttendance(
    tenantId: mongoose.Types.ObjectId,
    date: Date = new Date()
  ): Promise<{ processed: number; updated: number; errors: Array<{ driverId: string; error: string }> }> {
    const drivers = await Driver.find({
      tenantId,
      isActive: true
    });

    let processed = 0;
    let updated = 0;
    const errors: Array<{ driverId: string; error: string }> = [];

    for (const driver of drivers) {
      try {
        // Determine status based on driver state and bookings
        const { status, bookingId } = await this.determineAttendanceStatus(tenantId, driver._id as mongoose.Types.ObjectId, date);

        // Auto-mark attendance
        await this.autoMarkAttendance({
          tenantId,
          driverId: driver._id as mongoose.Types.ObjectId,
          date,
          status,
          bookingId
        });

        processed++;
        updated++;
      } catch (error) {
        errors.push({
          driverId: driver._id?.toString() || 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { processed: drivers.length, updated, errors };
  }

  /**
   * Manually override attendance for a driver
   * Used when admin/manager wants to set a specific attendance status
   */
  async manualOverrideAttendance(data: ManualOverrideAttendanceDTO): Promise<IAttendance> {
    const date = data.date || new Date();

    // Validate driver exists
    const driver = await Driver.findById(data.driverId);
    if (!driver) {
      throw new Error(`Driver not found: ${data.driverId}`);
    }

    // Get or create attendance record
    let attendance = await this.getOrCreateAttendanceRecord(data.tenantId, data.driverId, date);

    // Update attendance
    attendance.status = 'MANUAL_OVERRIDE';
    attendance.leaveType = data.leaveType;
    attendance.notes = data.notes || attendance.notes;
    attendance.checkInTime = data.checkInTime || attendance.checkInTime;
    attendance.checkOutTime = data.checkOutTime || attendance.checkOutTime;
    attendance.autoMarked = false;
    attendance.markedBy = data.markedBy;
    attendance.updatedAt = new Date();

    // Calculate total hours if both check-in and check-out times are present
    if (attendance.checkInTime && attendance.checkOutTime) {
      const diffMs = attendance.checkOutTime.getTime() - attendance.checkInTime.getTime();
      attendance.totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 2) / 2; // Round to nearest 0.5
    }

    return attendance.save();
  }

  /**
   * Mark driver as on leave for a date range
   */
  async markLeave(
    tenantId: mongoose.Types.ObjectId,
    driverId: mongoose.Types.ObjectId,
    startDate: Date,
    endDate: Date,
    leaveType: LeaveType,
    notes?: string,
    markedBy?: {
      userId: string;
      userName: string;
      role: string;
    }
  ): Promise<IAttendance[]> {
    const results: IAttendance[] = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    const normalizedEndDate = new Date(endDate);
    normalizedEndDate.setHours(23, 59, 59, 999);

    while (currentDate <= normalizedEndDate) {
      const attendance = await this.getOrCreateAttendanceRecord(tenantId, driverId, currentDate);

      attendance.status = markedBy ? 'MANUAL_OVERRIDE' : 'LEAVE';
      attendance.leaveType = leaveType;
      attendance.notes = notes || attendance.notes;
      attendance.autoMarked = !markedBy;
      if (markedBy) {
        attendance.markedBy = markedBy;
      }
      attendance.updatedAt = new Date();

      results.push(await attendance.save());

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return results;
  }

  /**
   * Get attendance records for a driver over a date range
   */
  async getAttendanceHistory(
    tenantId: mongoose.Types.ObjectId,
    driverId: mongoose.Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<IAttendance[]> {
    return Attendance.find({
      tenantId,
      driverId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ date: -1 });
  }

  /**
   * Get attendance statistics for a date range
   */
  async getAttendanceStats(
    tenantId: mongoose.Types.ObjectId,
    driverId: mongoose.Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalDays: number;
    presentDays: number;
    leaveDays: number;
    bookingDays: number;
    absentDays: number;
    avgHoursPerDay: number;
  }> {
    const records = await this.getAttendanceHistory(tenantId, driverId, startDate, endDate);

    const stats = {
      totalDays: records.length,
      presentDays: 0,
      leaveDays: 0,
      bookingDays: 0,
      absentDays: 0,
      avgHoursPerDay: 0
    };

    let totalHours = 0;

    for (const record of records) {
      switch (record.status) {
        case 'BOOKING_SERVE':
          stats.bookingDays++;
          stats.presentDays++;
          break;
        case 'IDLE_AVAILABLE':
          stats.presentDays++;
          break;
        case 'LEAVE':
          stats.leaveDays++;
          break;
        case 'ABSENT':
          stats.absentDays++;
          break;
        case 'MANUAL_OVERRIDE':
          stats.presentDays++;
          break;
      }

      if (record.totalHours) {
        totalHours += record.totalHours;
      }
    }

    if (records.length > 0) {
      stats.avgHoursPerDay = Math.round((totalHours / records.length) * 10) / 10;
    }

    return stats;
  }

  /**
   * Get attendance for a specific date across all drivers in a tenant
   */
  async getDailyAttendanceReport(
    tenantId: mongoose.Types.ObjectId,
    date: Date = new Date()
  ): Promise<Array<{
    driverId: mongoose.Types.ObjectId;
    driverName: string;
    status: AttendanceStatus | 'present' | 'absent';
    checkInTime?: Date;
    checkOutTime?: Date;
    totalHours?: number;
    leaveType?: LeaveType;
  }>> {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    const endDate = new Date(normalizedDate);
    endDate.setHours(23, 59, 59, 999);

    const records = await Attendance.find({
      tenantId,
      date: {
        $gte: normalizedDate,
        $lte: endDate
      }
    }).populate('driverId', 'name');

    return records.map((record) => ({
      driverId: record.driverId as mongoose.Types.ObjectId,
      driverName: (record.driverId as any)?.name || 'Unknown',
      status: record.status as any,
      checkInTime: record.checkInTime,
      checkOutTime: record.checkOutTime,
      totalHours: record.totalHours,
      leaveType: record.leaveType
    }));
  }

  /**
   * Bulk update attendance status
   * Useful for batch operations
   */
  async bulkUpdateAttendance(
    tenantId: mongoose.Types.ObjectId,
    driverIds: mongoose.Types.ObjectId[],
    date: Date,
    status: AttendanceStatus,
    leaveType?: LeaveType,
    notes?: string
  ): Promise<{ updated: number; failed: number }> {
    let updated = 0;
    let failed = 0;

    for (const driverId of driverIds) {
      try {
        await this.autoMarkAttendance({
          tenantId,
          driverId,
          date,
          status,
          leaveType,
          notes
        });
        updated++;
      } catch (error) {
        failed++;
      }
    }

    return { updated, failed };
  }

  /**
   * Get drivers with pending/missing attendance for a date
   */
  async getMissingAttendance(
    tenantId: mongoose.Types.ObjectId,
    date: Date = new Date()
  ): Promise<Array<{
    driverId: mongoose.Types.ObjectId;
    driverName: string;
    status: string;
    reason: string;
  }>> {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    const endDate = new Date(normalizedDate);
    endDate.setHours(23, 59, 59, 999);

    // Get all active drivers
    const allDrivers = await Driver.find({ tenantId, isActive: true });

    // Get marked attendance for this date
    const marked = await Attendance.find({
      tenantId,
      date: {
        $gte: normalizedDate,
        $lte: endDate
      }
    });

    const markedIds = new Set(marked.map((m) => m.driverId?.toString()));

    const missing = allDrivers
      .filter((driver) => !markedIds.has((driver._id as any)?.toString()))
      .map((driver) => ({
        driverId: driver._id as mongoose.Types.ObjectId,
        driverName: driver.name as string,
        status: driver.status,
        reason: 'Attendance not marked'
      }));

    return missing;
  }

  /**
   * Clear and rebuild attendance for a specific date (admin use only)
   * WARNING: This should be used with caution as it will delete existing records
   */
  async rebuildAttendanceForDate(tenantId: mongoose.Types.ObjectId, date: Date): Promise<number> {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    const endDate = new Date(normalizedDate);
    endDate.setHours(23, 59, 59, 999);

    // Delete existing records for this date
    await Attendance.deleteMany({
      tenantId,
      date: {
        $gte: normalizedDate,
        $lte: endDate
      }
    });

    // Process all drivers
    const result = await this.processAllDriversAttendance(tenantId, date);

    return result.updated;
  }
}

// Export singleton instance
export const attendanceAutomationService = new AttendanceAutomationService();

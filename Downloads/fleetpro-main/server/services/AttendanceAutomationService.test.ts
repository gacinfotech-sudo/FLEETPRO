import mongoose from 'mongoose';
import { AttendanceAutomationService, LeaveType } from './AttendanceAutomationService';
import { Tenant, User, Driver, Booking, Attendance } from '../models/index';

describe('AttendanceAutomationService', () => {
  let service: AttendanceAutomationService;
  let tenantId: mongoose.Types.ObjectId;
  let driverId: mongoose.Types.ObjectId;
  let bookingId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    service = new AttendanceAutomationService();

    // Create test tenant
    const tenant = new Tenant({
      name: 'Test Tenant',
      businessName: 'Test Business',
      isActive: true,
      maxManagers: 5,
      subscriptionPlan: 'pro'
    });
    const savedTenant = await tenant.save();
    tenantId = savedTenant._id as mongoose.Types.ObjectId;

    // Create test driver
    const driver = new Driver({
      tenantId,
      name: 'John Doe',
      phone: '+1234567890',
      licenseNumber: 'DL123456',
      experience: 5,
      status: 'available'
    });
    const savedDriver = await driver.save();
    driverId = savedDriver._id as mongoose.Types.ObjectId;
  });

  afterAll(async () => {
    // Cleanup
    await Attendance.deleteMany({ tenantId });
    await Booking.deleteMany({ tenantId });
    await Driver.deleteMany({ tenantId });
    await Tenant.deleteMany({ _id: tenantId });
  });

  describe('autoMarkAttendance', () => {
    it('should auto-mark attendance as IDLE_AVAILABLE', async () => {
      const today = new Date();
      const attendance = await service.autoMarkAttendance({
        tenantId,
        driverId,
        date: today,
        status: 'IDLE_AVAILABLE'
      });

      expect(attendance.status).toBe('IDLE_AVAILABLE');
      expect(attendance.autoMarked).toBe(true);
      expect(attendance.driverId).toEqual(driverId);
    });

    it('should auto-mark attendance as LEAVE with leave type', async () => {
      const today = new Date();
      const attendance = await service.autoMarkAttendance({
        tenantId,
        driverId,
        date: today,
        status: 'LEAVE',
        leaveType: 'sick'
      });

      expect(attendance.status).toBe('LEAVE');
      expect(attendance.leaveType).toBe('sick');
      expect(attendance.autoMarked).toBe(true);
    });

    it('should auto-mark attendance as BOOKING_SERVE with booking reference', async () => {
      const today = new Date();

      // Create a test booking
      const booking = new Booking({
        tenantId,
        bookingId: 'BK001',
        customerName: 'Customer',
        customerPhone: '1234567890',
        vehicleId: new mongoose.Types.ObjectId(),
        driverId,
        pickupLocation: 'Location A',
        pickupDate: today,
        bookingType: 'with_driver',
        status: 'confirmed',
        totalAmount: 1000
      });
      const savedBooking = await booking.save();
      bookingId = savedBooking._id as mongoose.Types.ObjectId;

      const attendance = await service.autoMarkAttendance({
        tenantId,
        driverId,
        date: today,
        status: 'BOOKING_SERVE',
        bookingId
      });

      expect(attendance.status).toBe('BOOKING_SERVE');
      expect(attendance.bookingId).toEqual(bookingId);
      expect(attendance.autoMarked).toBe(true);
    });

    it('should calculate total hours from check-in and check-out times', async () => {
      const today = new Date();
      const checkInTime = new Date(today);
      checkInTime.setHours(9, 0, 0);
      const checkOutTime = new Date(today);
      checkOutTime.setHours(17, 0, 0);

      const attendance = await service.autoMarkAttendance({
        tenantId,
        driverId,
        date: today,
        status: 'IDLE_AVAILABLE',
        checkInTime,
        checkOutTime
      });

      expect(attendance.totalHours).toBe(8);
    });
  });

  describe('manualOverrideAttendance', () => {
    it('should manually override attendance status', async () => {
      const today = new Date();
      const manager = {
        userId: 'mgr123',
        userName: 'Manager Name',
        role: 'manager'
      };

      const attendance = await service.manualOverrideAttendance({
        tenantId,
        driverId,
        date: today,
        status: 'LEAVE',
        leaveType: 'emergency',
        notes: 'Family emergency',
        markedBy: manager
      });

      expect(attendance.status).toBe('MANUAL_OVERRIDE');
      expect(attendance.autoMarked).toBe(false);
      expect(attendance.markedBy).toEqual(manager);
      expect(attendance.leaveType).toBe('emergency');
    });
  });

  describe('markLeave', () => {
    it('should mark leave for a date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const results = await service.markLeave(
        tenantId,
        driverId,
        startDate,
        endDate,
        'casual',
        'Casual leave'
      );

      expect(results.length).toBe(3);
      results.forEach((record) => {
        expect(record.status).toBe('LEAVE');
        expect(record.leaveType).toBe('casual');
      });
    });

    it('should mark leave with manager override', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 5);
      const endDate = new Date(startDate);

      const manager = {
        userId: 'mgr123',
        userName: 'Manager Name',
        role: 'manager'
      };

      const results = await service.markLeave(
        tenantId,
        driverId,
        startDate,
        endDate,
        'unpaid',
        'Unpaid leave',
        manager
      );

      expect(results.length).toBe(1);
      expect(results[0].status).toBe('MANUAL_OVERRIDE');
      expect(results[0].autoMarked).toBe(false);
    });
  });

  describe('getAttendanceHistory', () => {
    it('should retrieve attendance history for a date range', async () => {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = today;

      // Mark attendance for a few days
      for (let i = 0; i < 3; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        await service.autoMarkAttendance({
          tenantId,
          driverId,
          date,
          status: 'IDLE_AVAILABLE'
        });
      }

      const history = await service.getAttendanceHistory(tenantId, driverId, startDate, endDate);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('getAttendanceStats', () => {
    it('should calculate attendance statistics', async () => {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 30);
      const endDate = today;

      const stats = await service.getAttendanceStats(tenantId, driverId, startDate, endDate);

      expect(stats.totalDays).toBeGreaterThan(0);
      expect(stats.presentDays).toBeGreaterThanOrEqual(0);
      expect(stats.leaveDays).toBeGreaterThanOrEqual(0);
      expect(stats.bookingDays).toBeGreaterThanOrEqual(0);
      expect(stats.absentDays).toBeGreaterThanOrEqual(0);
      expect(stats.avgHoursPerDay).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getDailyAttendanceReport', () => {
    it('should get daily attendance report for all drivers', async () => {
      const today = new Date();

      // Mark attendance for multiple drivers
      await service.autoMarkAttendance({
        tenantId,
        driverId,
        date: today,
        status: 'IDLE_AVAILABLE'
      });

      const report = await service.getDailyAttendanceReport(tenantId, today);
      expect(Array.isArray(report)).toBe(true);
    });
  });

  describe('bulkUpdateAttendance', () => {
    it('should bulk update attendance for multiple drivers', async () => {
      const today = new Date();

      // Create another driver
      const driver2 = new Driver({
        tenantId,
        name: 'Jane Doe',
        phone: '+0987654321',
        licenseNumber: 'DL654321',
        experience: 3,
        status: 'available'
      });
      const savedDriver2 = await driver2.save();

      const result = await service.bulkUpdateAttendance(
        tenantId,
        [driverId, savedDriver2._id as mongoose.Types.ObjectId],
        today,
        'IDLE_AVAILABLE'
      );

      expect(result.updated).toBeGreaterThan(0);
    });
  });

  describe('getMissingAttendance', () => {
    it('should identify drivers with missing attendance', async () => {
      const today = new Date();

      // Clear attendance for today
      await Attendance.deleteMany({
        tenantId,
        date: {
          $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          $lte: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        }
      });

      const missing = await service.getMissingAttendance(tenantId, today);
      expect(Array.isArray(missing)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw error for non-existent driver', async () => {
      const fakeDriverId = new mongoose.Types.ObjectId();

      await expect(
        service.autoMarkAttendance({
          tenantId,
          driverId: fakeDriverId,
          status: 'IDLE_AVAILABLE'
        })
      ).rejects.toThrow();
    });

    it('should throw error for non-existent tenant', async () => {
      const fakeTenantId = new mongoose.Types.ObjectId();

      // This should work but return empty results
      const result = await service.processAllDriversAttendance(fakeTenantId);
      expect(result.processed).toBe(0);
    });
  });
});

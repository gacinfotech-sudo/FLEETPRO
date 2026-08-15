import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { SalaryHistory, SalaryAuditTrail, Driver, Tenant } from '../models/index';
import SalaryHistoryService from './SalaryHistoryService';

/**
 * Unit tests for SalaryHistoryService
 * These tests demonstrate the complete workflow and functionality
 */

describe('SalaryHistoryService', () => {
  let tenantId: mongoose.Types.ObjectId;
  let driverId: mongoose.Types.ObjectId;
  let tenant: any;
  let driver: any;

  beforeEach(async () => {
    // Create test tenant
    tenant = await Tenant.create({
      name: 'Test Tenant',
      businessName: 'Test Business'
    });
    tenantId = tenant._id;

    // Create test driver
    driver = await Driver.create({
      tenantId,
      name: 'Test Driver',
      phone: '1234567890',
      licenseNumber: 'DL123',
      experience: 5
    });
    driverId = driver._id;
  });

  afterEach(async () => {
    await SalaryHistory.deleteMany({});
    await SalaryAuditTrail.deleteMany({});
    await Driver.deleteMany({});
    await Tenant.deleteMany({});
  });

  describe('createSalaryHistory', () => {
    it('should create a new salary history record', async () => {
      const result = await SalaryHistoryService.createSalaryHistory({
        tenantId,
        driverId,
        changeType: 'hike',
        previousValue: { baseSalary: 20000 },
        newValue: { baseSalary: 23000 },
        changeAmount: 3000,
        reason: 'Annual raise',
        appliedFrom: new Date('2026-09-01'),
        createdBy: {
          userId: 'admin1',
          userName: 'Admin User',
          role: 'admin'
        }
      });

      expect(result).toBeDefined();
      expect(result._id).toBeDefined();
      expect(result.status).toBe('draft');
      expect(result.changeType).toBe('hike');
      expect(result.percentageChange).toBeCloseTo(15, 1);
    });

    it('should calculate percentage change correctly', async () => {
      const result = await SalaryHistoryService.createSalaryHistory({
        tenantId,
        driverId,
        changeType: 'hike',
        previousValue: { baseSalary: 20000 },
        newValue: { baseSalary: 22000 },
        reason: 'Test',
        appliedFrom: new Date('2026-09-01'),
        createdBy: {
          userId: 'admin1',
          userName: 'Admin',
          role: 'admin'
        }
      });

      expect(result.percentageChange).toBeCloseTo(10, 1);
    });

    it('should create audit trail entry', async () => {
      await SalaryHistoryService.createSalaryHistory({
        tenantId,
        driverId,
        changeType: 'hike',
        newValue: { baseSalary: 23000 },
        reason: 'Test',
        appliedFrom: new Date('2026-09-01'),
        createdBy: {
          userId: 'admin1',
          userName: 'Admin User',
          role: 'admin'
        }
      });

      const auditTrail = await SalaryAuditTrail.findOne({ driverId });
      expect(auditTrail).toBeDefined();
      expect(auditTrail?.action).toBe('created');
      expect(auditTrail?.severity).toBe('high');
    });

    it('should throw error for non-existent driver', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await expect(
        SalaryHistoryService.createSalaryHistory({
          tenantId,
          driverId: fakeId,
          changeType: 'hike',
          newValue: { baseSalary: 23000 },
          reason: 'Test',
          appliedFrom: new Date('2026-09-01'),
          createdBy: {
            userId: 'admin1',
            userName: 'Admin',
            role: 'admin'
          }
        })
      ).rejects.toThrow();
    });
  });

  describe('Approval Workflow', () => {
    let salaryHistoryId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const result = await SalaryHistoryService.createSalaryHistory({
        tenantId,
        driverId,
        changeType: 'hike',
        newValue: { baseSalary: 23000 },
        reason: 'Annual raise',
        appliedFrom: new Date('2026-09-01'),
        createdBy: {
          userId: 'admin1',
          userName: 'Admin User',
          role: 'admin'
        }
      });
      salaryHistoryId = result._id as mongoose.Types.ObjectId;
    });

    it('should submit for approval', async () => {
      const result = await SalaryHistoryService.submitForApproval(
        salaryHistoryId,
        {
          userId: 'admin1',
          userName: 'Admin User',
          role: 'admin'
        }
      );

      expect(result.status).toBe('pending_approval');
    });

    it('should approve salary change', async () => {
      await SalaryHistoryService.submitForApproval(salaryHistoryId, {
        userId: 'admin1',
        userName: 'Admin',
        role: 'admin'
      });

      const result = await SalaryHistoryService.approveSalaryChange(
        salaryHistoryId,
        {
          userId: 'manager1',
          userName: 'Manager User',
          role: 'manager'
        }
      );

      expect(result.status).toBe('approved');
      expect(result.approvedBy?.userName).toBe('Manager User');
    });

    it('should reject salary change', async () => {
      await SalaryHistoryService.submitForApproval(salaryHistoryId, {
        userId: 'admin1',
        userName: 'Admin',
        role: 'admin'
      });

      const result = await SalaryHistoryService.rejectSalaryChange(
        salaryHistoryId,
        'Needs more justification',
        {
          userId: 'manager1',
          userName: 'Manager',
          role: 'manager'
        }
      );

      expect(result.status).toBe('rejected');
      expect(result.notes).toContain('Needs more justification');
    });

    it('should apply salary change', async () => {
      await SalaryHistoryService.submitForApproval(salaryHistoryId, {
        userId: 'admin1',
        userName: 'Admin',
        role: 'admin'
      });

      await SalaryHistoryService.approveSalaryChange(salaryHistoryId, {
        userId: 'manager1',
        userName: 'Manager',
        role: 'manager'
      });

      const result = await SalaryHistoryService.applySalaryChange(
        salaryHistoryId,
        {
          userId: 'system',
          userName: 'System',
          role: 'system'
        }
      );

      expect(result.status).toBe('applied');
    });

    it('should not apply if not approved', async () => {
      await expect(
        SalaryHistoryService.applySalaryChange(salaryHistoryId, {
          userId: 'system',
          userName: 'System',
          role: 'system'
        })
      ).rejects.toThrow();
    });

    it('should not apply if effective date is in future', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const result = await SalaryHistoryService.createSalaryHistory({
        tenantId,
        driverId,
        changeType: 'hike',
        newValue: { baseSalary: 24000 },
        reason: 'Future raise',
        appliedFrom: futureDate,
        createdBy: {
          userId: 'admin1',
          userName: 'Admin',
          role: 'admin'
        }
      });

      const id = result._id as mongoose.Types.ObjectId;

      await SalaryHistoryService.submitForApproval(id, {
        userId: 'admin1',
        userName: 'Admin',
        role: 'admin'
      });

      await SalaryHistoryService.approveSalaryChange(id, {
        userId: 'manager1',
        userName: 'Manager',
        role: 'manager'
      });

      await expect(
        SalaryHistoryService.applySalaryChange(id, {
          userId: 'system',
          userName: 'System',
          role: 'system'
        })
      ).rejects.toThrow();
    });
  });

  describe('Query Methods', () => {
    beforeEach(async () => {
      // Create multiple salary history records
      for (let i = 0; i < 3; i++) {
        await SalaryHistoryService.createSalaryHistory({
          tenantId,
          driverId,
          changeType: i === 0 ? 'hike' : 'adjustment',
          newValue: { baseSalary: 20000 + (i * 1000) },
          reason: `Change ${i + 1}`,
          appliedFrom: new Date('2026-09-01'),
          createdBy: {
            userId: 'admin1',
            userName: 'Admin',
            role: 'admin'
          }
        });
      }
    });

    it('should get driver salary history', async () => {
      const { data, total } = await SalaryHistoryService.getDriverSalaryHistory(
        tenantId,
        driverId
      );

      expect(data).toHaveLength(3);
      expect(total).toBe(3);
    });

    it('should filter by status', async () => {
      const { data, total } = await SalaryHistoryService.getDriverSalaryHistory(
        tenantId,
        driverId,
        { status: 'draft' }
      );

      expect(data.length).toBeGreaterThan(0);
      expect(data.every(d => d.status === 'draft')).toBe(true);
    });

    it('should filter by change type', async () => {
      const { data } = await SalaryHistoryService.getDriverSalaryHistory(
        tenantId,
        driverId,
        { changeType: 'hike' }
      );

      expect(data.length).toBeGreaterThan(0);
      expect(data.every(d => d.changeType === 'hike')).toBe(true);
    });

    it('should paginate results', async () => {
      const { data: page1 } = await SalaryHistoryService.getDriverSalaryHistory(
        tenantId,
        driverId,
        { limit: 2, offset: 0 }
      );

      const { data: page2 } = await SalaryHistoryService.getDriverSalaryHistory(
        tenantId,
        driverId,
        { limit: 2, offset: 2 }
      );

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1);
    });
  });

  describe('Audit Trail', () => {
    let salaryHistoryId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const result = await SalaryHistoryService.createSalaryHistory({
        tenantId,
        driverId,
        changeType: 'hike',
        newValue: { baseSalary: 23000 },
        reason: 'Test',
        appliedFrom: new Date('2026-09-01'),
        createdBy: {
          userId: 'admin1',
          userName: 'Admin',
          role: 'admin'
        }
      });
      salaryHistoryId = result._id as mongoose.Types.ObjectId;
    });

    it('should get audit trail for salary history', async () => {
      await SalaryHistoryService.submitForApproval(salaryHistoryId, {
        userId: 'admin1',
        userName: 'Admin',
        role: 'admin'
      });

      const { data } = await SalaryHistoryService.getSalaryAuditTrail(
        salaryHistoryId
      );

      expect(data.length).toBeGreaterThan(0);
      expect(data.some(d => d.action === 'created')).toBe(true);
      expect(data.some(d => d.action === 'updated')).toBe(true);
    });

    it('should get driver audit trail', async () => {
      const { data } = await SalaryHistoryService.getDriverSalaryAuditTrail(
        tenantId,
        driverId
      );

      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('Data Summary', () => {
    beforeEach(async () => {
      // Create initial salary
      const initial = await SalaryHistoryService.createSalaryHistory({
        tenantId,
        driverId,
        changeType: 'initial_setup',
        newValue: { baseSalary: 20000 },
        reason: 'Initial salary',
        appliedFrom: new Date('2026-01-01'),
        createdBy: {
          userId: 'admin1',
          userName: 'Admin',
          role: 'admin'
        }
      });

      // Apply initial salary
      await SalaryHistoryService.submitForApproval(initial._id as mongoose.Types.ObjectId, {
        userId: 'admin1',
        userName: 'Admin',
        role: 'admin'
      });

      await SalaryHistoryService.approveSalaryChange(initial._id as mongoose.Types.ObjectId, {
        userId: 'manager1',
        userName: 'Manager',
        role: 'manager'
      });

      // Create hike
      const hike = await SalaryHistoryService.createSalaryHistory({
        tenantId,
        driverId,
        changeType: 'hike',
        previousValue: { baseSalary: 20000 },
        newValue: { baseSalary: 23000 },
        reason: 'Annual raise',
        appliedFrom: new Date('2026-09-01'),
        createdBy: {
          userId: 'admin1',
          userName: 'Admin',
          role: 'admin'
        }
      });

      // Submit hike but don't approve
      await SalaryHistoryService.submitForApproval(hike._id as mongoose.Types.ObjectId, {
        userId: 'admin1',
        userName: 'Admin',
        role: 'admin'
      });
    });

    it('should get salary summary', async () => {
      const summary = await SalaryHistoryService.getDriverSalarySummary(
        tenantId,
        driverId
      );

      expect(summary.currentRecord).toBeDefined();
      expect(summary.totalChanges).toBe(2);
      expect(summary.pendingApprovals).toBe(1);
    });
  });

  describe('Export & Validation', () => {
    beforeEach(async () => {
      await SalaryHistoryService.createSalaryHistory({
        tenantId,
        driverId,
        changeType: 'hike',
        previousValue: { baseSalary: 20000 },
        newValue: { baseSalary: 23000 },
        reason: 'Annual raise',
        appliedFrom: new Date('2026-09-01'),
        createdBy: {
          userId: 'admin1',
          userName: 'Admin',
          role: 'admin'
        }
      });
    });

    it('should export as JSON', async () => {
      const json = await SalaryHistoryService.exportSalaryHistory(
        tenantId,
        driverId,
        'json'
      );

      expect(json).toBeDefined();
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should export as CSV', async () => {
      const csv = await SalaryHistoryService.exportSalaryHistory(
        tenantId,
        driverId,
        'csv'
      );

      expect(csv).toBeDefined();
      expect(csv).toContain('Date');
      expect(csv).toContain('Change Type');
    });

    it('should validate integrity', async () => {
      const { valid, issues } = await SalaryHistoryService.validateIntegrity(
        tenantId,
        driverId
      );

      expect(valid).toBe(true);
      expect(issues).toHaveLength(0);
    });
  });
});

/**
 * Integration Test Example
 * This shows how to test the complete workflow
 */
describe('Salary History Integration Tests', () => {
  it('should complete full salary change workflow', async () => {
    // Setup
    const tenant = await Tenant.create({
      name: 'Test',
      businessName: 'Test'
    });

    const driver = await Driver.create({
      tenantId: tenant._id,
      name: 'Driver',
      phone: '123',
      licenseNumber: 'DL123',
      experience: 5
    });

    // 1. Create salary history
    const history = await SalaryHistoryService.createSalaryHistory({
      tenantId: tenant._id,
      driverId: driver._id,
      changeType: 'hike',
      previousValue: { baseSalary: 20000 },
      newValue: { baseSalary: 23000 },
      changeAmount: 3000,
      reason: 'Annual raise',
      appliedFrom: new Date('2026-09-01'),
      createdBy: {
        userId: 'admin1',
        userName: 'Admin',
        role: 'admin'
      }
    });

    // 2. Submit for approval
    let result = await SalaryHistoryService.submitForApproval(history._id as mongoose.Types.ObjectId, {
      userId: 'admin1',
      userName: 'Admin',
      role: 'admin'
    });
    expect(result.status).toBe('pending_approval');

    // 3. Approve
    result = await SalaryHistoryService.approveSalaryChange(
      history._id as mongoose.Types.ObjectId,
      {
        userId: 'manager1',
        userName: 'Manager',
        role: 'manager'
      }
    );
    expect(result.status).toBe('approved');

    // 4. Apply
    result = await SalaryHistoryService.applySalaryChange(
      history._id as mongoose.Types.ObjectId,
      {
        userId: 'system',
        userName: 'System',
        role: 'system'
      }
    );
    expect(result.status).toBe('applied');

    // 5. Verify audit trail
    const { data: auditTrail } = await SalaryHistoryService.getDriverSalaryAuditTrail(
      tenant._id,
      driver._id
    );

    expect(auditTrail.length).toBeGreaterThanOrEqual(4);
    expect(auditTrail.map(a => a.action)).toContain('created');
    expect(auditTrail.map(a => a.action)).toContain('approved');
    expect(auditTrail.map(a => a.action)).toContain('applied');

    // Cleanup
    await SalaryHistory.deleteMany({});
    await SalaryAuditTrail.deleteMany({});
    await Driver.deleteMany({});
    await Tenant.deleteMany({});
  });
});

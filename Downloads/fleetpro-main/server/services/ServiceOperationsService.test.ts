import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { ServiceTicketService } from './ServiceTicketService';
import { EngineerAssignmentService } from './EngineerAssignmentService';
import { FieldVisitService } from './FieldVisitService';
import { SLAService } from './SLAService';
import { ServiceTicket, FieldVisit, SLAMetrics, Tenant, Vehicle, Driver, User } from '../models/index';

describe('Service Operations - WAVE 9', () => {
  let tenantId: mongoose.Types.ObjectId;
  let vehicleId: mongoose.Types.ObjectId;
  let driverId: mongoose.Types.ObjectId;
  let engineerId: mongoose.Types.ObjectId;
  let ticketService: ServiceTicketService;
  let assignmentService: EngineerAssignmentService;
  let fieldVisitService: FieldVisitService;
  let slaService: SLAService;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fleetpro-test');
    }

    // Create test data
    const tenant = await Tenant.create({
      name: 'Test Fleet',
      businessName: 'Test Fleet Co',
      isActive: true,
      maxManagers: 5,
      subscriptionPlan: 'pro',
      limits: { vehicles: 10, drivers: 5, managers: 2 }
    });
    tenantId = tenant._id as mongoose.Types.ObjectId;

    const vehicle = await Vehicle.create({
      tenantId,
      make: 'Honda',
      vehicleModel: 'Civic',
      year: 2023,
      licensePlate: 'ABC123',
      type: 'sedan',
      status: 'available',
      features: ['AC', 'GPS'],
      pricePerDay: 50,
      pricePerHour: 5,
      pricePerKm: 0.5
    });
    vehicleId = vehicle._id as mongoose.Types.ObjectId;

    const driver = await Driver.create({
      tenantId,
      name: 'John Doe',
      phone: '9876543210',
      licenseNumber: 'DL123456',
      experience: 5,
      rating: 4.5,
      status: 'available',
      dateOfJoining: new Date('2020-01-01')
    });
    driverId = driver._id as mongoose.Types.ObjectId;

    const engineer = await User.create({
      userId: 'engineer1',
      password: 'hashed',
      role: 'manager',
      tenantId,
      isActive: true,
      permissions: [],
      loginAttempts: 0,
      failedLoginAttempts: 0,
      accountLocked: false
    });
    engineerId = engineer._id as mongoose.Types.ObjectId;

    // Initialize services
    ticketService = new ServiceTicketService();
    assignmentService = new EngineerAssignmentService();
    fieldVisitService = new FieldVisitService();
    slaService = new SLAService();
  });

  afterAll(async () => {
    // Cleanup
    await ServiceTicket.deleteMany({ tenantId });
    await FieldVisit.deleteMany({ tenantId });
    await SLAMetrics.deleteMany({ tenantId });
    await Vehicle.deleteMany({ tenantId });
    await Driver.deleteMany({ tenantId });
    await User.deleteMany({ tenantId });
    await Tenant.deleteMany({ _id: tenantId });
    await mongoose.connection.close();
  });

  describe('ServiceTicketService', () => {
    let ticketId: string;

    it('should create a service ticket in OPEN status', async () => {
      const ticket = await ticketService.createTicket({
        tenantId,
        assetId: vehicleId,
        assetType: 'vehicle',
        clientId: new mongoose.Types.ObjectId(),
        clientName: 'ABC Company',
        clientPhone: '9876543210',
        type: 'COMPLAINT',
        priority: 'CRITICAL',
        description: 'Vehicle not starting',
        createdBy: { userId: 'user1', role: 'client' }
      });

      expect(ticket).toBeDefined();
      expect(ticket.status).toBe('OPEN');
      expect(ticket.priority).toBe('CRITICAL');
      expect(ticket.slaResponseTime).toBe(30); // 30 minutes for CRITICAL
      expect(ticket.slaResolutionTime).toBe(480); // 8 hours for CRITICAL
      ticketId = ticket._id?.toString() || '';
    });

    it('should list tickets with filters', async () => {
      const { tickets, total } = await ticketService.listTickets(tenantId, {
        status: 'OPEN',
        limit: 10,
        offset: 0
      });

      expect(tickets.length).toBeGreaterThan(0);
      expect(total).toBeGreaterThan(0);
    });

    it('should get ticket details', async () => {
      const ticket = await ticketService.getTicket(tenantId, ticketId);
      expect(ticket).toBeDefined();
      expect(ticket?.ticketId).toMatch(/^TKT-/);
    });

    it('should update ticket status (OPEN -> ASSIGNED)', async () => {
      const ticket = await ticketService.updateTicketStatus(tenantId, ticketId, {
        status: 'ASSIGNED'
      });

      expect(ticket.status).toBe('ASSIGNED');
      expect(ticket.assignedAt).toBeDefined();
    });

    it('should not allow invalid status transitions', async () => {
      const ticket = await ServiceTicket.findOne({ tenantId, _id: ticketId });
      expect(ticket?.status).toBe('ASSIGNED');

      // Try to transition from ASSIGNED to OPEN (invalid)
      try {
        await ticketService.updateTicketStatus(tenantId, ticketId, {
          status: 'OPEN'
        });
        expect.fail('Should throw error');
      } catch (error: any) {
        expect(error.message).toContain('Cannot transition');
      }
    });

    it('should calculate SLA metrics for a ticket', async () => {
      const ticket = await ServiceTicket.findOne({ tenantId, _id: ticketId });
      if (!ticket) throw new Error('Ticket not found');

      const metrics = ticketService.getSLAMetrics(ticket);
      expect(metrics).toBeDefined();
      expect(metrics.responseTimeRemaining).toBeDefined();
      expect(metrics.resolutionTimeRemaining).toBeDefined();
    });

    it('should get breached tickets', async () => {
      const breached = await ticketService.getBreachedTickets(tenantId);
      expect(Array.isArray(breached)).toBe(true);
    });
  });

  describe('EngineerAssignmentService', () => {
    let ticketId: string;

    beforeAll(async () => {
      const ticket = await ticketService.createTicket({
        tenantId,
        assetId: vehicleId,
        assetType: 'vehicle',
        clientId: new mongoose.Types.ObjectId(),
        clientName: 'XYZ Corp',
        clientPhone: '9876543210',
        type: 'COMPLAINT',
        priority: 'HIGH',
        description: 'Engine issue',
        createdBy: { userId: 'user1', role: 'client' }
      });
      ticketId = ticket._id?.toString() || '';
    });

    it('should assign engineer to ticket with load balancing', async () => {
      const { ticket } = await assignmentService.assignTicketToEngineer(
        tenantId,
        ticketId,
        engineerId
      );

      expect(ticket.assignedEngineer).toBeDefined();
      expect(ticket.status).toBe('ASSIGNED');
      expect(ticket.assignedAt).toBeDefined();
    });

    it('should get engineer workload', async () => {
      const workload = await assignmentService.getEngineerWorkload(tenantId, engineerId);

      expect(workload).toBeDefined();
      expect(workload.engineerId).toBeDefined();
      expect(workload.activeTickets).toBeGreaterThanOrEqual(0);
      expect(['available', 'busy']).toContain(workload.status);
    });

    it('should get engineer schedule', async () => {
      const schedule = await assignmentService.getEngineerSchedule(tenantId, engineerId);

      expect(Array.isArray(schedule)).toBe(true);
    });

    it('should get all assigned tickets for engineer', async () => {
      const tickets = await assignmentService.getAssignedTickets(tenantId, engineerId);

      expect(Array.isArray(tickets)).toBe(true);
      expect(tickets.length).toBeGreaterThan(0);
    });

    it('should get all engineers with workload', async () => {
      const engineers = await assignmentService.getAllEngineersWithWorkload(tenantId);

      expect(Array.isArray(engineers)).toBe(true);
      expect(engineers.length).toBeGreaterThan(0);
    });
  });

  describe('FieldVisitService', () => {
    let ticketId: string;
    let visitId: string;

    beforeAll(async () => {
      const ticket = await ticketService.createTicket({
        tenantId,
        assetId: vehicleId,
        assetType: 'vehicle',
        clientId: new mongoose.Types.ObjectId(),
        clientName: 'Test Client',
        clientPhone: '9876543210',
        type: 'REPAIR',
        priority: 'MEDIUM',
        description: 'Battery replacement needed',
        createdBy: { userId: 'user1', role: 'client' }
      });
      ticketId = ticket._id?.toString() || '';
    });

    it('should create a field visit', async () => {
      const visit = await fieldVisitService.createFieldVisit({
        tenantId,
        ticketId: new mongoose.Types.ObjectId(ticketId),
        engineerId,
        engineerName: 'John Engineer',
        assetId: vehicleId,
        visitDate: new Date(),
        diagnosis: 'Battery dead',
        actionTaken: 'REPLACEMENT',
        assetConditionBefore: 'Not starting',
        assetConditionAfter: 'Working',
        partsUsed: [
          { partName: 'Car Battery', quantity: 1, cost: 5000 }
        ],
        laborCost: 500
      });

      expect(visit).toBeDefined();
      expect(visit.visitId).toMatch(/^VIS-/);
      expect(visit.totalCost).toBe(5500); // 5000 + 500
      visitId = visit._id?.toString() || '';
    });

    it('should record check-in time', async () => {
      const visit = await fieldVisitService.recordCheckIn(tenantId, visitId);

      expect(visit.checkInTime).toBeDefined();
    });

    it('should upload photo to visit', async () => {
      const visit = await fieldVisitService.uploadPhoto(tenantId, visitId, {
        url: 'https://example.com/photo1.jpg',
        description: 'Battery replacement'
      });

      expect(visit.photos.length).toBeGreaterThan(0);
      expect(visit.photos[0].url).toContain('photo1.jpg');
    });

    it('should record action taken', async () => {
      const visit = await fieldVisitService.recordAction(
        tenantId,
        visitId,
        'REPLACEMENT',
        [{ partName: 'Battery', quantity: 1, cost: 5000 }],
        500,
        'Battery replaced successfully'
      );

      expect(visit.actionTaken).toBe('REPLACEMENT');
      expect(visit.notes).toContain('replaced');
      expect(visit.totalCost).toBe(5500);
    });

    it('should record check-out time', async () => {
      const visit = await fieldVisitService.recordCheckOut(tenantId, visitId);

      expect(visit.checkOutTime).toBeDefined();
    });

    it('should get field visits by ticket', async () => {
      const visits = await fieldVisitService.getFieldVisitsByTicket(
        tenantId,
        new mongoose.Types.ObjectId(ticketId)
      );

      expect(Array.isArray(visits)).toBe(true);
      expect(visits.length).toBeGreaterThan(0);
    });

    it('should get asset service history', async () => {
      const history = await fieldVisitService.getAssetServiceHistory(tenantId, vehicleId);

      expect(history).toBeDefined();
      expect(history.visits).toBeDefined();
      expect(history.totalRepairs).toBeGreaterThan(0);
      expect(history.totalCost).toBeGreaterThan(0);
    });
  });

  describe('SLAService', () => {
    it('should calculate SLA metrics', async () => {
      const metrics = await slaService.calculateSLAMetrics(tenantId);

      expect(metrics).toBeDefined();
      expect(metrics.totalTickets).toBeGreaterThanOrEqual(0);
      expect(metrics.breachedTickets).toBeGreaterThanOrEqual(0);
      expect(metrics.averageResponseTime).toBeGreaterThanOrEqual(0);
      expect(metrics.averageResolutionTime).toBeGreaterThanOrEqual(0);
    });

    it('should get SLA dashboard', async () => {
      const dashboard = await slaService.getSLADashboard(tenantId, 7);

      expect(dashboard).toBeDefined();
      expect(dashboard.metrics).toBeDefined();
      expect(dashboard.summary).toBeDefined();
      expect(dashboard.summary.avgBreachRate).toBeGreaterThanOrEqual(0);
      expect(dashboard.summary.avgResponseTime).toBeGreaterThanOrEqual(0);
    });

    it('should get breached SLAs', async () => {
      const breaches = await slaService.getBreachedSLAs(tenantId);

      expect(breaches).toBeDefined();
      expect(breaches.critical).toBeDefined();
      expect(breaches.high).toBeDefined();
      expect(breaches.medium).toBeDefined();
      expect(breaches.low).toBeDefined();
    });

    it('should check and alert on SLA breaches', async () => {
      const breaches = await slaService.checkAndAlertSLABreaches(tenantId);

      expect(Array.isArray(breaches)).toBe(true);
    });

    it('should get SLA trend', async () => {
      const trend = await slaService.getSLATrend(tenantId, 7);

      expect(trend).toBeDefined();
      expect(trend.dates).toBeDefined();
      expect(trend.breachRates).toBeDefined();
      expect(trend.responseTimesTrend).toBeDefined();
      expect(trend.resolutionTimesTrend).toBeDefined();
    });
  });

  describe('Complete Ticket Lifecycle', () => {
    it('should complete full ticket lifecycle: OPEN -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED', async () => {
      // 1. Create ticket (OPEN)
      const ticket1 = await ticketService.createTicket({
        tenantId,
        assetId: vehicleId,
        assetType: 'vehicle',
        clientId: new mongoose.Types.ObjectId(),
        clientName: 'Lifecycle Test',
        clientPhone: '9876543210',
        type: 'MAINTENANCE',
        priority: 'MEDIUM',
        description: 'Oil change required',
        createdBy: { userId: 'user1', role: 'client' }
      });

      expect(ticket1.status).toBe('OPEN');
      const ticketId = ticket1._id?.toString() || '';

      // 2. Assign engineer (OPEN -> ASSIGNED)
      const { ticket: ticket2 } = await assignmentService.assignTicketToEngineer(
        tenantId,
        ticketId,
        engineerId
      );

      expect(ticket2.status).toBe('ASSIGNED');
      expect(ticket2.assignedEngineer).toBeDefined();

      // 3. Record field visit and update to IN_PROGRESS
      const visit = await fieldVisitService.createFieldVisit({
        tenantId,
        ticketId: new mongoose.Types.ObjectId(ticketId),
        engineerId,
        engineerName: 'John Engineer',
        assetId: vehicleId,
        visitDate: new Date(),
        diagnosis: 'Oil level low',
        actionTaken: 'REPAIR',
        assetConditionBefore: 'Needs service',
        assetConditionAfter: 'Serviced',
        partsUsed: [{ partName: 'Motor Oil', quantity: 5, cost: 2000 }],
        laborCost: 500
      });

      expect(visit).toBeDefined();

      // 4. Update to IN_PROGRESS
      const ticket3 = await ticketService.updateTicketStatus(tenantId, ticketId, {
        status: 'IN_PROGRESS'
      });

      expect(ticket3.status).toBe('IN_PROGRESS');

      // 5. Resolve ticket (IN_PROGRESS -> RESOLVED)
      const ticket4 = await ticketService.updateTicketStatus(tenantId, ticketId, {
        status: 'RESOLVED',
        diagnosis: 'Oil changed successfully',
        resolution: 'Oil change completed'
      });

      expect(ticket4.status).toBe('RESOLVED');
      expect(ticket4.resolvedAt).toBeDefined();

      // 6. Close ticket (RESOLVED -> CLOSED)
      const ticket5 = await ticketService.updateTicketStatus(tenantId, ticketId, {
        status: 'CLOSED'
      });

      expect(ticket5.status).toBe('CLOSED');
      expect(ticket5.closedAt).toBeDefined();
    });

    it('should prevent closing unresolved ticket', async () => {
      const ticket = await ticketService.createTicket({
        tenantId,
        assetId: vehicleId,
        assetType: 'vehicle',
        clientId: new mongoose.Types.ObjectId(),
        clientName: 'Cannot Close Test',
        clientPhone: '9876543210',
        type: 'COMPLAINT',
        priority: 'LOW',
        description: 'Minor issue',
        createdBy: { userId: 'user1', role: 'client' }
      });

      const ticketId = ticket._id?.toString() || '';

      // Try to close without resolving
      try {
        await ticketService.updateTicketStatus(tenantId, ticketId, {
          status: 'CLOSED'
        });
        expect.fail('Should throw error');
      } catch (error: any) {
        expect(error.message).toContain('Cannot close');
      }
    });
  });
});

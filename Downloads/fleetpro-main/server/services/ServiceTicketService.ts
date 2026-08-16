import mongoose from 'mongoose';
import { ServiceTicket, FieldVisit, Vehicle, Driver } from '../models/index';
import { IServiceTicket } from '../models/index';
import { nanoid } from 'nanoid';

interface CreateServiceTicketDTO {
  tenantId: mongoose.Types.ObjectId;
  assetId: mongoose.Types.ObjectId;
  assetType: 'vehicle' | 'driver' | 'equipment';
  clientId: mongoose.Types.ObjectId;
  clientName: string;
  clientPhone: string;
  type: 'COMPLAINT' | 'INSTALLATION' | 'PICKUP' | 'MAINTENANCE' | 'REPLACEMENT' | 'REPAIR';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  createdBy: {
    userId: string;
    role: string;
  };
}

interface UpdateTicketStatusDTO {
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  diagnosis?: string;
  resolution?: string;
}

export class ServiceTicketService {
  /**
   * Create a new service ticket (OPEN status)
   */
  async createTicket(data: CreateServiceTicketDTO): Promise<IServiceTicket> {
    // Validate asset exists
    let asset;
    if (data.assetType === 'vehicle') {
      asset = await Vehicle.findById(data.assetId);
    } else if (data.assetType === 'driver') {
      asset = await Driver.findById(data.assetId);
    }

    if (!asset) {
      throw new Error(`Asset not found: ${data.assetId}`);
    }

    // Calculate SLA times based on priority
    const slaConfig: Record<string, { response: number; resolution: number }> = {
      CRITICAL: { response: 30, resolution: 480 }, // 30 min response, 8 hours resolution
      HIGH: { response: 120, resolution: 1440 }, // 2 hours response, 24 hours resolution
      MEDIUM: { response: 360, resolution: 2880 }, // 6 hours response, 48 hours resolution
      LOW: { response: 1440, resolution: 4320 } // 24 hours response, 72 hours resolution
    };

    const sla = slaConfig[data.priority];

    const ticketId = `TKT-${Date.now()}-${nanoid(6)}`;

    const ticket = new ServiceTicket({
      tenantId: data.tenantId,
      ticketId,
      assetId: data.assetId,
      assetType: data.assetType,
      clientId: data.clientId,
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      type: data.type,
      priority: data.priority,
      status: 'OPEN',
      description: data.description,
      slaResponseTime: sla.response,
      slaResolutionTime: sla.resolution,
      slaBreached: false,
      createdBy: data.createdBy,
      createdAt: new Date()
    });

    return await ticket.save();
  }

  /**
   * Get ticket by ID
   */
  async getTicket(tenantId: mongoose.Types.ObjectId, ticketId: string): Promise<IServiceTicket | null> {
    const ticket = await ServiceTicket.findOne({
      tenantId,
      _id: ticketId
    }).populate('assignedEngineer fieldVisits');

    return ticket;
  }

  /**
   * List tickets with filters
   */
  async listTickets(
    tenantId: mongoose.Types.ObjectId,
    filters?: {
      status?: string;
      priority?: string;
      clientId?: string;
      assetId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ tickets: IServiceTicket[]; total: number }> {
    const query: any = { tenantId };

    if (filters?.status) query.status = filters.status;
    if (filters?.priority) query.priority = filters.priority;
    if (filters?.clientId) query.clientId = filters.clientId;
    if (filters?.assetId) query.assetId = filters.assetId;

    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;

    const total = await ServiceTicket.countDocuments(query);
    const tickets = await ServiceTicket.find(query)
      .populate('assignedEngineer fieldVisits')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset);

    return { tickets, total };
  }

  /**
   * Update ticket status (OPEN -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED)
   */
  async updateTicketStatus(
    tenantId: mongoose.Types.ObjectId,
    ticketId: string,
    data: UpdateTicketStatusDTO
  ): Promise<IServiceTicket> {
    const ticket = await ServiceTicket.findOne({ tenantId, _id: ticketId });

    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      'OPEN': ['ASSIGNED'],
      'ASSIGNED': ['IN_PROGRESS'],
      'IN_PROGRESS': ['RESOLVED'],
      'RESOLVED': ['CLOSED'],
      'CLOSED': []
    };

    if (!validTransitions[ticket.status].includes(data.status)) {
      throw new Error(`Cannot transition from ${ticket.status} to ${data.status}`);
    }

    // Cannot close unresolved ticket
    if (data.status === 'CLOSED' && ticket.status !== 'RESOLVED') {
      throw new Error('Cannot close unresolved ticket');
    }

    // Update status
    ticket.status = data.status;

    if (data.diagnosis) ticket.diagnosis = data.diagnosis;
    if (data.resolution) ticket.resolution = data.resolution;

    // Set timing fields
    if (data.status === 'ASSIGNED' && !ticket.assignedAt) {
      ticket.assignedAt = new Date();
      // Calculate actual response time
      const responseTime = Math.round((ticket.assignedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60));
      ticket.actualResponseTime = responseTime;
      ticket.slaBreached = responseTime > (ticket.slaResponseTime || 0);
    }

    if (data.status === 'RESOLVED' && !ticket.resolvedAt) {
      ticket.resolvedAt = new Date();
      // Calculate actual resolution time
      const resolutionTime = Math.round((ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60));
      ticket.actualResolutionTime = resolutionTime;
      ticket.slaBreached = ticket.slaBreached || resolutionTime > (ticket.slaResolutionTime || 0);
    }

    if (data.status === 'CLOSED' && !ticket.closedAt) {
      ticket.closedAt = new Date();
    }

    return await ticket.save();
  }

  /**
   * Assign engineer to ticket
   */
  async assignEngineer(
    tenantId: mongoose.Types.ObjectId,
    ticketId: string,
    engineerId: mongoose.Types.ObjectId,
    engineerName: string
  ): Promise<IServiceTicket> {
    const ticket = await ServiceTicket.findOne({ tenantId, _id: ticketId });

    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }

    if (ticket.status !== 'OPEN') {
      throw new Error('Can only assign open tickets');
    }

    ticket.assignedEngineer = engineerId;
    ticket.engineerName = engineerName;
    ticket.status = 'ASSIGNED';
    ticket.assignedAt = new Date();

    // Calculate actual response time
    const responseTime = Math.round((ticket.assignedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60));
    ticket.actualResponseTime = responseTime;
    ticket.slaBreached = responseTime > (ticket.slaResponseTime || 0);

    return await ticket.save();
  }

  /**
   * Add field visit to ticket
   */
  async addFieldVisit(
    tenantId: mongoose.Types.ObjectId,
    ticketId: string,
    visitId: mongoose.Types.ObjectId
  ): Promise<IServiceTicket> {
    const ticket = await ServiceTicket.findOne({ tenantId, _id: ticketId });

    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }

    if (!ticket.fieldVisits) {
      ticket.fieldVisits = [];
    }

    ticket.fieldVisits.push(visitId);
    return await ticket.save();
  }

  /**
   * Calculate SLA metrics for a ticket
   */
  getSLAMetrics(ticket: IServiceTicket): {
    responseTimeRemaining: number | null;
    resolutionTimeRemaining: number | null;
    breached: boolean;
  } {
    const now = new Date();
    let breached = false;
    let responseTimeRemaining = null;
    let resolutionTimeRemaining = null;

    if (ticket.status !== 'CLOSED' && ticket.slaResponseTime) {
      const createdTime = ticket.createdAt.getTime();
      const elapsedMinutes = Math.round((now.getTime() - createdTime) / (1000 * 60));
      responseTimeRemaining = ticket.slaResponseTime - elapsedMinutes;
      if (responseTimeRemaining < 0) breached = true;
    }

    if (ticket.status !== 'CLOSED' && ticket.slaResolutionTime) {
      const createdTime = ticket.createdAt.getTime();
      const elapsedMinutes = Math.round((now.getTime() - createdTime) / (1000 * 60));
      resolutionTimeRemaining = ticket.slaResolutionTime - elapsedMinutes;
      if (resolutionTimeRemaining < 0) breached = true;
    }

    return { responseTimeRemaining, resolutionTimeRemaining, breached };
  }

  /**
   * Get SLA breached tickets
   */
  async getBreachedTickets(tenantId: mongoose.Types.ObjectId): Promise<IServiceTicket[]> {
    const tickets = await ServiceTicket.find({
      tenantId,
      slaBreached: true,
      status: { $ne: 'CLOSED' }
    }).populate('assignedEngineer');

    return tickets;
  }
}

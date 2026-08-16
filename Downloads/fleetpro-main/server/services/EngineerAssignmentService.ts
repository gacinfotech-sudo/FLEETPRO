import mongoose from 'mongoose';
import { ServiceTicket, User } from '../models/index';
import { IServiceTicket } from '../models/index';

interface EngineerWorkload {
  engineerId: mongoose.Types.ObjectId;
  engineerName: string;
  activeTickets: number;
  status: 'available' | 'busy';
}

export class EngineerAssignmentService {
  /**
   * Assign ticket to engineer with load balancing
   */
  async assignTicketToEngineer(
    tenantId: mongoose.Types.ObjectId,
    ticketId: string,
    engineerId?: mongoose.Types.ObjectId
  ): Promise<{ ticket: IServiceTicket; engineerId: mongoose.Types.ObjectId }> {
    const ticket = await ServiceTicket.findOne({ tenantId, _id: ticketId });

    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }

    if (ticket.status !== 'OPEN') {
      throw new Error('Can only assign open tickets');
    }

    let selectedEngineerId = engineerId;

    // If no engineer specified, load balance
    if (!selectedEngineerId) {
      selectedEngineerId = (await this.getAvailableEngineer(tenantId)) || undefined;
    }

    if (!selectedEngineerId) {
      throw new Error('No available engineers');
    }

    // Get engineer details
    const engineer = await User.findById(selectedEngineerId);
    if (!engineer) {
      throw new Error('Engineer not found');
    }

    // Assign ticket
    ticket.assignedEngineer = selectedEngineerId;
    ticket.engineerName = engineer.userId;
    ticket.status = 'ASSIGNED';
    ticket.assignedAt = new Date();

    const responseTime = Math.round((ticket.assignedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60));
    ticket.actualResponseTime = responseTime;
    ticket.slaBreached = responseTime > (ticket.slaResponseTime || 0);

    await ticket.save();

    return { ticket, engineerId: selectedEngineerId };
  }

  /**
   * Get engineer workload
   */
  async getEngineerWorkload(tenantId: mongoose.Types.ObjectId, engineerId: mongoose.Types.ObjectId): Promise<EngineerWorkload> {
    const activeTickets = await ServiceTicket.countDocuments({
      tenantId,
      assignedEngineer: engineerId,
      status: { $in: ['ASSIGNED', 'IN_PROGRESS'] }
    });

    const engineer = await User.findById(engineerId);

    return {
      engineerId,
      engineerName: engineer?.userId || 'Unknown',
      activeTickets,
      status: activeTickets > 5 ? 'busy' : 'available'
    };
  }

  /**
   * Get engineer schedule (assigned tickets)
   */
  async getEngineerSchedule(
    tenantId: mongoose.Types.ObjectId,
    engineerId: mongoose.Types.ObjectId
  ): Promise<IServiceTicket[]> {
    const tickets = await ServiceTicket.find({
      tenantId,
      assignedEngineer: engineerId,
      status: { $in: ['ASSIGNED', 'IN_PROGRESS'] }
    }).sort({ createdAt: -1 });

    return tickets;
  }

  /**
   * Get all assigned tickets for engineer
   */
  async getAssignedTickets(
    tenantId: mongoose.Types.ObjectId,
    engineerId: mongoose.Types.ObjectId,
    includeResolved: boolean = false
  ): Promise<IServiceTicket[]> {
    const statuses = includeResolved
      ? ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED']
      : ['ASSIGNED', 'IN_PROGRESS'];

    const tickets = await ServiceTicket.find({
      tenantId,
      assignedEngineer: engineerId,
      status: { $in: statuses }
    }).populate('fieldVisits').sort({ createdAt: -1 });

    return tickets;
  }

  /**
   * Update engineer availability
   */
  async updateEngineerAvailability(
    tenantId: mongoose.Types.ObjectId,
    engineerId: mongoose.Types.ObjectId,
    available: boolean
  ): Promise<EngineerWorkload> {
    // In a real system, we might update user status or availability field
    // For now, we'll return the current workload
    return this.getEngineerWorkload(tenantId, engineerId);
  }

  /**
   * Reassign ticket to different engineer
   */
  async reassignTicket(
    tenantId: mongoose.Types.ObjectId,
    ticketId: string,
    newEngineerId: mongoose.Types.ObjectId
  ): Promise<IServiceTicket> {
    const ticket = await ServiceTicket.findOne({ tenantId, _id: ticketId });

    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }

    const engineer = await User.findById(newEngineerId);
    if (!engineer) {
      throw new Error('Engineer not found');
    }

    ticket.assignedEngineer = newEngineerId;
    ticket.engineerName = engineer.userId;

    return await ticket.save();
  }

  /**
   * Get available engineer with lowest workload
   */
  private async getAvailableEngineer(tenantId: mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId | null> {
    // Get all engineers (users with role 'manager' or specific engineer role)
    const engineers = await User.find({
      tenantId,
      isActive: true
    }).limit(50);

    if (engineers.length === 0) {
      return null;
    }

    // Find engineer with lowest workload
    let lowestWorkload = Infinity;
    let selectedEngineer: mongoose.Types.ObjectId | null = null;

    for (const engineer of engineers) {
      const workload = await ServiceTicket.countDocuments({
        tenantId,
        assignedEngineer: engineer._id,
        status: { $in: ['ASSIGNED', 'IN_PROGRESS'] }
      });

      if (workload < lowestWorkload) {
        lowestWorkload = workload;
        selectedEngineer = engineer._id as mongoose.Types.ObjectId;
      }
    }

    return selectedEngineer;
  }

  /**
   * Get all engineers with their workload
   */
  async getAllEngineersWithWorkload(tenantId: mongoose.Types.ObjectId): Promise<EngineerWorkload[]> {
    const engineers = await User.find({
      tenantId,
      isActive: true
    }).limit(50);

    const workloads: EngineerWorkload[] = [];

    for (const engineer of engineers) {
      const activeTickets = await ServiceTicket.countDocuments({
        tenantId,
        assignedEngineer: engineer._id,
        status: { $in: ['ASSIGNED', 'IN_PROGRESS'] }
      });

      workloads.push({
        engineerId: engineer._id as mongoose.Types.ObjectId,
        engineerName: engineer.userId,
        activeTickets,
        status: activeTickets > 5 ? 'busy' : 'available'
      });
    }

    return workloads.sort((a, b) => a.activeTickets - b.activeTickets);
  }
}

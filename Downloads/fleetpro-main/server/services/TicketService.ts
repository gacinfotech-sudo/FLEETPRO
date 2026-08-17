import mongoose from 'mongoose';
import { SupportTicket } from '../models/index';

class TicketService {
  async createTicket(data: any): Promise<any> {
    try {
      const ticket = new SupportTicket({
        tenantId: new mongoose.Types.ObjectId(data.tenantId),
        ticketNumber: `TKT-${Date.now()}`,
        userId: new mongoose.Types.ObjectId(data.userId),
        category: data.category || 'GENERAL',
        priority: data.priority || 'MEDIUM',
        subject: data.subject,
        description: data.description,
        status: 'OPEN',
        replies: [],
      });

      await ticket.save();
      return ticket;
    } catch (error) {
      console.error('Failed to create ticket:', error);
      throw error;
    }
  }

  async getTickets(filter: any = {}): Promise<any[]> {
    try {
      const query: any = {};
      if (filter.tenantId) query.tenantId = new mongoose.Types.ObjectId(filter.tenantId);
      if (filter.status) query.status = filter.status;
      if (filter.priority) query.priority = filter.priority;

      const tickets = await SupportTicket.find(query)
        .sort({ createdAt: -1 })
        .limit(filter.limit || 100)
        .lean();

      return tickets;
    } catch (error) {
      console.error('Failed to get tickets:', error);
      throw error;
    }
  }

  async getTicketById(ticketId: string): Promise<any> {
    try {
      const objectId = new mongoose.Types.ObjectId(ticketId);
      const ticket = await SupportTicket.findById(objectId);
      if (!ticket) throw new Error('Ticket not found');
      return ticket;
    } catch (error) {
      console.error('Failed to get ticket:', error);
      throw error;
    }
  }

  async assignTicket(ticketId: string, adminId: string): Promise<any> {
    try {
      const ticketObjectId = new mongoose.Types.ObjectId(ticketId);
      const adminObjectId = new mongoose.Types.ObjectId(adminId);

      const ticket = await SupportTicket.findByIdAndUpdate(
        ticketObjectId,
        {
          assignedTo: adminObjectId,
          status: 'ASSIGNED',
          updatedAt: new Date(),
        },
        { new: true }
      );

      return ticket;
    } catch (error) {
      console.error('Failed to assign ticket:', error);
      throw error;
    }
  }

  async addReply(ticketId: string, userId: string, message: string, isInternal: boolean = false): Promise<any> {
    try {
      const ticketObjectId = new mongoose.Types.ObjectId(ticketId);
      const userObjectId = new mongoose.Types.ObjectId(userId);

      const ticket = await SupportTicket.findById(ticketObjectId);
      if (!ticket) throw new Error('Ticket not found');

      ticket.replies.push({
        userId: userObjectId,
        message,
        internalNote: isInternal,
        timestamp: new Date(),
      });

      if (!isInternal) {
        ticket.respondedAt = new Date();
      }

      await ticket.save();
      return ticket;
    } catch (error) {
      console.error('Failed to add reply:', error);
      throw error;
    }
  }

  async closeTicket(ticketId: string): Promise<any> {
    try {
      const ticketObjectId = new mongoose.Types.ObjectId(ticketId);

      const ticket = await SupportTicket.findByIdAndUpdate(
        ticketObjectId,
        {
          status: 'CLOSED',
          resolvedAt: new Date(),
          updatedAt: new Date(),
        },
        { new: true }
      );

      return ticket;
    } catch (error) {
      console.error('Failed to close ticket:', error);
      throw error;
    }
  }

  async countOpenTickets(): Promise<number> {
    try {
      const count = await SupportTicket.countDocuments({
        status: { $in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING'] },
      });

      return count;
    } catch (error) {
      console.error('Failed to count open tickets:', error);
      throw error;
    }
  }

  async countCriticalTickets(): Promise<number> {
    try {
      const count = await SupportTicket.countDocuments({
        priority: 'CRITICAL',
        status: { $in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
      });

      return count;
    } catch (error) {
      console.error('Failed to count critical tickets:', error);
      throw error;
    }
  }
}

export const ticketService = new TicketService();

import mongoose from 'mongoose';
import { ServiceTicket, SLAMetrics } from '../models/index';
import { ISLAMetrics } from '../models/index';

interface SLABreach {
  ticketId: string;
  type: 'RESPONSE' | 'RESOLUTION';
  priority: string;
  breachTimeMinutes: number;
  actualTime: number;
  slaTime: number;
}

export class SLAService {
  /**
   * Calculate SLA metrics for a tenant on a specific date
   */
  async calculateSLAMetrics(
    tenantId: mongoose.Types.ObjectId,
    metricsDate?: Date
  ): Promise<ISLAMetrics> {
    const date = metricsDate || new Date();
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

    // Get all tickets created on this date
    const allTickets = await ServiceTicket.find({
      tenantId,
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    });

    const openTickets = await ServiceTicket.countDocuments({
      tenantId,
      createdAt: { $gte: startOfDay, $lt: endOfDay },
      status: { $in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] }
    });

    // Find breached tickets
    const breachedTickets: string[] = [];
    const ticketsBreaching: any[] = [];
    let totalResponseTime = 0;
    let totalResolutionTime = 0;
    let responseTimeCount = 0;
    let resolutionTimeCount = 0;

    for (const ticket of allTickets) {
      let breached = false;

      // Check response time SLA
      if (ticket.actualResponseTime !== undefined && ticket.slaResponseTime) {
        totalResponseTime += ticket.actualResponseTime;
        responseTimeCount++;

        if (ticket.actualResponseTime > ticket.slaResponseTime) {
          breached = true;
          const breachTime = ticket.actualResponseTime - ticket.slaResponseTime;
          ticketsBreaching.push({
            ticketId: ticket.ticketId,
            breachType: 'RESPONSE',
            breachTime
          });
        }
      }

      // Check resolution time SLA
      if (ticket.actualResolutionTime !== undefined && ticket.slaResolutionTime) {
        totalResolutionTime += ticket.actualResolutionTime;
        resolutionTimeCount++;

        if (ticket.actualResolutionTime > ticket.slaResolutionTime) {
          breached = true;
          const breachTime = ticket.actualResolutionTime - ticket.slaResolutionTime;
          ticketsBreaching.push({
            ticketId: ticket.ticketId,
            breachType: 'RESOLUTION',
            breachTime
          });
        }
      }

      if (breached) {
        breachedTickets.push(ticket.ticketId);
      }
    }

    const metrics = new SLAMetrics({
      tenantId,
      metricsDate: date,
      totalTickets: allTickets.length,
      openTickets,
      breachedTickets: breachedTickets.length,
      averageResponseTime: responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : 0,
      averageResolutionTime: resolutionTimeCount > 0 ? Math.round(totalResolutionTime / resolutionTimeCount) : 0,
      ticketsBreaching,
      createdAt: new Date()
    });

    return await metrics.save();
  }

  /**
   * Get SLA metrics dashboard
   */
  async getSLADashboard(
    tenantId: mongoose.Types.ObjectId,
    days: number = 7
  ): Promise<{
    metrics: ISLAMetrics[];
    summary: {
      avgBreachRate: number;
      avgResponseTime: number;
      avgResolutionTime: number;
      totalTickets: number;
      totalBreached: number;
    };
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await SLAMetrics.find({
      tenantId,
      metricsDate: { $gte: startDate }
    }).sort({ metricsDate: -1 });

    // Calculate summary
    let totalTickets = 0;
    let totalBreached = 0;
    let totalResponseTime = 0;
    let totalResolutionTime = 0;

    for (const metric of metrics) {
      totalTickets += metric.totalTickets;
      totalBreached += metric.breachedTickets;
      totalResponseTime += metric.averageResponseTime;
      totalResolutionTime += metric.averageResolutionTime;
    }

    const avgBreachRate = totalTickets > 0
      ? Math.round((totalBreached / totalTickets) * 100)
      : 0;

    const avgResponseTime = metrics.length > 0
      ? Math.round(totalResponseTime / metrics.length)
      : 0;

    const avgResolutionTime = metrics.length > 0
      ? Math.round(totalResolutionTime / metrics.length)
      : 0;

    return {
      metrics,
      summary: {
        avgBreachRate,
        avgResponseTime,
        avgResolutionTime,
        totalTickets,
        totalBreached
      }
    };
  }

  /**
   * Get breached SLAs alert
   */
  async getBreachedSLAs(
    tenantId: mongoose.Types.ObjectId
  ): Promise<{
    critical: any[];
    high: any[];
    medium: any[];
    low: any[];
  }> {
    const breachedTickets = await ServiceTicket.find({
      tenantId,
      slaBreached: true,
      status: { $ne: 'CLOSED' }
    }).populate('assignedEngineer');

    // Group by priority
    const critical = breachedTickets.filter(t => t.priority === 'CRITICAL');
    const high = breachedTickets.filter(t => t.priority === 'HIGH');
    const medium = breachedTickets.filter(t => t.priority === 'MEDIUM');
    const low = breachedTickets.filter(t => t.priority === 'LOW');

    return { critical, high, medium, low };
  }

  /**
   * Alert on SLA breach
   */
  async checkAndAlertSLABreaches(
    tenantId: mongoose.Types.ObjectId
  ): Promise<SLABreach[]> {
    const now = new Date();
    const breaches: SLABreach[] = [];

    const activeTickets = await ServiceTicket.find({
      tenantId,
      status: { $in: ['ASSIGNED', 'IN_PROGRESS'] }
    });

    for (const ticket of activeTickets) {
      // Check response time SLA
      if (ticket.slaResponseTime) {
        const elapsedMinutes = Math.round(
          (now.getTime() - ticket.createdAt.getTime()) / (1000 * 60)
        );

        if (elapsedMinutes > ticket.slaResponseTime) {
          breaches.push({
            ticketId: ticket.ticketId,
            type: 'RESPONSE',
            priority: ticket.priority,
            breachTimeMinutes: elapsedMinutes - ticket.slaResponseTime,
            actualTime: elapsedMinutes,
            slaTime: ticket.slaResponseTime
          });

          // Mark ticket as breached
          ticket.slaBreached = true;
          await ticket.save();
        }
      }

      // Check resolution time SLA
      if (ticket.slaResolutionTime) {
        const elapsedMinutes = Math.round(
          (now.getTime() - ticket.createdAt.getTime()) / (1000 * 60)
        );

        if (elapsedMinutes > ticket.slaResolutionTime) {
          breaches.push({
            ticketId: ticket.ticketId,
            type: 'RESOLUTION',
            priority: ticket.priority,
            breachTimeMinutes: elapsedMinutes - ticket.slaResolutionTime,
            actualTime: elapsedMinutes,
            slaTime: ticket.slaResolutionTime
          });

          // Mark ticket as breached
          ticket.slaBreached = true;
          await ticket.save();
        }
      }
    }

    return breaches;
  }

  /**
   * Get SLA trend
   */
  async getSLATrend(
    tenantId: mongoose.Types.ObjectId,
    days: number = 30
  ): Promise<{
    dates: string[];
    breachRates: number[];
    responseTimesTrend: number[];
    resolutionTimesTrend: number[];
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await SLAMetrics.find({
      tenantId,
      metricsDate: { $gte: startDate, $lte: endDate }
    }).sort({ metricsDate: 1 });

    const dates: string[] = [];
    const breachRates: number[] = [];
    const responseTimesTrend: number[] = [];
    const resolutionTimesTrend: number[] = [];

    for (const metric of metrics) {
      dates.push(metric.metricsDate.toISOString().split('T')[0]);
      const rate = metric.totalTickets > 0
        ? Math.round((metric.breachedTickets / metric.totalTickets) * 100)
        : 0;
      breachRates.push(rate);
      responseTimesTrend.push(metric.averageResponseTime);
      resolutionTimesTrend.push(metric.averageResolutionTime);
    }

    return {
      dates,
      breachRates,
      responseTimesTrend,
      resolutionTimesTrend
    };
  }

  /**
   * Escalate breached ticket
   */
  async escalateBreach(
    tenantId: mongoose.Types.ObjectId,
    ticketId: string,
    reason: string
  ): Promise<any> {
    const ticket = await ServiceTicket.findOne({ tenantId, _id: ticketId });

    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }

    // In a real system, this would trigger notifications, escalation queue, etc.
    return {
      success: true,
      ticketId: ticket.ticketId,
      escalatedAt: new Date(),
      reason,
      priority: ticket.priority
    };
  }
}

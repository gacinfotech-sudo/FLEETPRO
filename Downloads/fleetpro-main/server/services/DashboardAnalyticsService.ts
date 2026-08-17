import mongoose from 'mongoose';
import { Vehicle, Driver, Booking, Expense, NotificationQueue } from '../models/index';

class DashboardAnalyticsService {
  async getExecutiveDashboard(tenantId: string): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const year = new Date(now.getFullYear(), 0, 1);

      const [kpis, todayMetrics, monthMetrics, yearMetrics] = await Promise.all([
        this.getMainKPIs(tenantObjectId),
        this.getDateRangeMetrics(tenantObjectId, this.getStartOfDay(now), now),
        this.getDateRangeMetrics(tenantObjectId, monthStart, now),
        this.getDateRangeMetrics(tenantObjectId, year, now),
      ]);

      return {
        period: 'today',
        kpis,
        today: todayMetrics,
        month: monthMetrics,
        year: yearMetrics,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Failed to get executive dashboard:', error);
      throw error;
    }
  }

  async getOperationalDashboard(tenantId: string): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const [fleetStatus, activeBookings, driverStatus, upcomingMaintenance] = await Promise.all([
        this.getFleetStatus(tenantObjectId),
        this.getActiveBookings(tenantObjectId),
        this.getDriverStatus(tenantObjectId),
        this.getUpcomingMaintenance(tenantObjectId),
      ]);

      return {
        fleet: fleetStatus,
        activeBookings,
        drivers: driverStatus,
        maintenance: upcomingMaintenance,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('Failed to get operational dashboard:', error);
      throw error;
    }
  }

  async getFinancialDashboard(tenantId: string): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const monthStart = new Date();
      monthStart.setDate(1);

      const [revenue, expenses, profitability, cashflow] = await Promise.all([
        this.getMonthlyRevenue(tenantObjectId, monthStart),
        this.getMonthlyExpenses(tenantObjectId, monthStart),
        this.getProfitabilityMetrics(tenantObjectId, monthStart),
        this.getCashflowMetrics(tenantObjectId, monthStart),
      ]);

      return {
        revenue,
        expenses,
        profitability,
        cashflow,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Failed to get financial dashboard:', error);
      throw error;
    }
  }

  private async getMainKPIs(tenantId: any): Promise<any> {
    const vehicles = await Vehicle.countDocuments({ tenantId });
    const drivers = await Driver.countDocuments({ tenantId });
    const bookings = await Booking.countDocuments({ tenantId });

    const todayStart = this.getStartOfDay(new Date());
    const todayEnd = this.getEndOfDay(new Date());

    const todayBookings = await Booking.countDocuments({
      tenantId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });

    const todayRevenue = await Booking.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: todayStart, $lte: todayEnd },
          status: 'completed',
        },
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);

    return {
      totalVehicles: vehicles,
      totalDrivers: drivers,
      totalBookings: bookings,
      todayBookings,
      todayRevenue: todayRevenue[0]?.total || 0,
    };
  }

  private async getDateRangeMetrics(tenantId: any, startDate: Date, endDate: Date): Promise<any> {
    const bookings = await Booking.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        },
      },
    ]);

    const expenses = await Expense.aggregate([
      {
        $match: {
          tenantId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    const bookingData = bookings[0] || { count: 0, revenue: 0, completed: 0 };
    const expenseData = expenses[0] || { total: 0 };

    return {
      bookings: bookingData.count,
      completedBookings: bookingData.completed,
      revenue: bookingData.revenue,
      expenses: expenseData.total,
      profit: bookingData.revenue - expenseData.total,
    };
  }

  private async getFleetStatus(tenantId: any): Promise<any> {
    const statuses = await Vehicle.aggregate([
      { $match: { tenantId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await Vehicle.countDocuments({ tenantId });

    return {
      total,
      byStatus: statuses.reduce((acc: any, item: any) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      utilizationRate: total > 0 ? Math.round(((statuses.find((s: any) => s._id === 'booked')?.count || 0) / total) * 100) : 0,
    };
  }

  private async getActiveBookings(tenantId: any): Promise<any> {
    const active = await Booking.find({
      tenantId,
      status: { $in: ['confirmed', 'in_progress'] },
    })
      .populate('vehicleId', 'licensePlate')
      .populate('driverId', 'name phone')
      .limit(10)
      .lean();

    return active.map((b: any) => ({
      bookingId: b.bookingId,
      customerName: b.customerName,
      vehicle: b.vehicleId,
      driver: b.driverId,
      status: b.status,
      pickupDate: b.pickupDate,
      returnDate: b.returnDate,
    }));
  }

  private async getDriverStatus(tenantId: any): Promise<any> {
    const statuses = await Driver.aggregate([
      { $match: { tenantId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      available: statuses.find((s: any) => s._id === 'available')?.count || 0,
      busy: statuses.find((s: any) => s._id === 'busy')?.count || 0,
      offDuty: statuses.find((s: any) => s._id === 'off_duty')?.count || 0,
    };
  }

  private async getUpcomingMaintenance(tenantId: any): Promise<any> {
    // Placeholder for maintenance data - would need maintenance model
    return {
      dueThisWeek: 0,
      overdue: 0,
      scheduled: [],
    };
  }

  private async getMonthlyRevenue(tenantId: any, startDate: Date): Promise<any> {
    const endDate = new Date();

    const daily = await Booking.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          revenue: { $sum: '$totalAmount' },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const total = daily.reduce((sum: number, d: any) => sum + d.revenue, 0);

    return {
      total,
      daily,
      average: daily.length > 0 ? Math.round(total / daily.length) : 0,
    };
  }

  private async getMonthlyExpenses(tenantId: any, startDate: Date): Promise<any> {
    const endDate = new Date();

    const byCategory = await Expense.aggregate([
      {
        $match: {
          tenantId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const total = byCategory.reduce((sum: number, item: any) => sum + item.total, 0);

    return {
      total,
      byCategory: byCategory.reduce((acc: any, item: any) => {
        acc[item._id] = item.total;
        return acc;
      }, {}),
    };
  }

  private async getProfitabilityMetrics(tenantId: any, startDate: Date): Promise<any> {
    const endDate = new Date();

    const [revenue, expenses] = await Promise.all([
      Booking.aggregate([
        {
          $match: {
            tenantId,
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'completed',
          },
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Expense.aggregate([
        {
          $match: {
            tenantId,
            date: { $gte: startDate, $lte: endDate },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const totalRevenue = revenue[0]?.total || 0;
    const totalExpenses = expenses[0]?.total || 0;
    const profit = totalRevenue - totalExpenses;

    return {
      revenue: totalRevenue,
      expenses: totalExpenses,
      profit,
      margin: totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0,
    };
  }

  private async getCashflowMetrics(tenantId: any, startDate: Date): Promise<any> {
    const endDate = new Date();

    const inflows = await Booking.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: startDate, $lte: endDate },
          paymentStatus: 'paid',
        },
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);

    const outflows = await Expense.aggregate([
      {
        $match: {
          tenantId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const totalInflow = inflows[0]?.total || 0;
    const totalOutflow = outflows[0]?.total || 0;

    return {
      inflows: totalInflow,
      outflows: totalOutflow,
      netCashflow: totalInflow - totalOutflow,
    };
  }

  private getStartOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private getEndOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }
}

export const dashboardAnalyticsService = new DashboardAnalyticsService();

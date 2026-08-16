import mongoose from 'mongoose';
import { Booking, Vehicle, Driver, Expense } from '../models/index';

interface ChurnPredictionResult {
  driverId: string;
  churnProbability: number;
  riskLevel: 'low' | 'medium' | 'high';
  factors: string[];
  recommendedActions: string[];
  confidence: number;
}

interface RevenueForecast {
  month: string;
  forecastedRevenue: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  seasonalFactor: number;
}

interface MaintenancePrediction {
  vehicleId: string;
  predictedFailureDate: Date;
  component: string;
  probability: number;
  estimatedCost: number;
  urgency: 'low' | 'medium' | 'high';
}

interface DemandForecast {
  assetType: string;
  period: string;
  forecastedDemand: number;
  trend: 'up' | 'down' | 'stable';
  seasonalPeak: boolean;
}

interface AnomalyDetection {
  timestamp: Date;
  anomalyType: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedEntity: string;
  confidence: number;
}

interface CustomerLTV {
  customerId: string;
  estimatedLTV: number;
  projectionPeriod: number; // months
  basedOnTransactions: number;
  growthRate: number;
}

interface NextPurchasePrediction {
  customerId: string;
  predictedPurchaseDate: Date;
  probability: number;
  estimatedValue: number;
  productType: string;
}

interface PropensityModel {
  customerId: string;
  upsellPropensity: number;
  crosssellPropensity: number;
  recommendedProducts: string[];
  winbackProbability: number;
}

export class PredictiveAnalyticsService {
  /**
   * Predict churn probability for drivers based on historical behavior
   */
  async predictChurn(tenantId: mongoose.Types.ObjectId): Promise<ChurnPredictionResult[]> {
    const drivers = await Driver.find({ tenantId });
    const results: ChurnPredictionResult[] = [];

    for (const driver of drivers) {
      // Get driver booking history
      const bookings = await Booking.find({
        tenantId,
        driverId: driver._id,
        createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Last 90 days
      });

      const bookingTrend = this.calculateTrend(bookings);
      const inactivityDays = this.calculateInactivityDays(bookings);
      const ratingTrend = this.calculateRatingTrend(bookings);
      const completionRate = bookings.filter(b => b.status === 'completed').length / (bookings.length || 1);

      // Churn risk factors
      const factors: string[] = [];
      let riskScore = 0;

      if (inactivityDays > 30) {
        factors.push('High inactivity');
        riskScore += 25;
      }
      if (bookingTrend < -0.2) {
        factors.push('Declining bookings');
        riskScore += 20;
      }
      if (ratingTrend < 0) {
        factors.push('Declining ratings');
        riskScore += 15;
      }
      if (completionRate < 0.8) {
        factors.push('Low completion rate');
        riskScore += 20;
      }

      const probability = Math.min(riskScore / 100, 0.95);
      const riskLevel = probability > 0.7 ? 'high' : probability > 0.4 ? 'medium' : 'low';
      const confidence = 0.85 + Math.random() * 0.15;

      const recommendedActions = this.getChurnMitigationActions(factors);

      results.push({
        driverId: (driver._id as any).toString(),
        churnProbability: probability,
        riskLevel,
        factors,
        recommendedActions,
        confidence
      });
    }

    return results;
  }

  /**
   * Forecast revenue for the next 12 months
   */
  async forecastRevenue(tenantId: mongoose.Types.ObjectId): Promise<RevenueForecast[]> {
    const forecasts: RevenueForecast[] = [];
    const historicalBookings = await Booking.find({
      tenantId,
      createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
    });

    // Calculate monthly revenue
    const monthlyRevenue = this.aggregateByMonth(historicalBookings);
    const avgMonthlyRevenue = Object.values(monthlyRevenue).reduce((a, b) => a + b, 0) / 12;
    const volatility = this.calculateVolatility(Object.values(monthlyRevenue));

    const baseGrowthRate = 0.05; // 5% growth
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();

    for (let i = 0; i < 12; i++) {
      const monthIndex = (currentMonth + i + 1) % 12;
      const month = months[monthIndex];
      const seasonalFactor = this.getSeasonalFactor(monthIndex);
      const baseRevenue = avgMonthlyRevenue * (1 + baseGrowthRate) * seasonalFactor;
      const stdDev = baseRevenue * volatility;
      const confidence = 0.85;

      forecasts.push({
        month,
        forecastedRevenue: baseRevenue,
        lowerBound: baseRevenue - 1.96 * stdDev,
        upperBound: baseRevenue + 1.96 * stdDev,
        confidence,
        seasonalFactor
      });
    }

    return forecasts;
  }

  /**
   * Predict maintenance needs for vehicles
   */
  async predictMaintenance(tenantId: mongoose.Types.ObjectId): Promise<MaintenancePrediction[]> {
    const vehicles = await Vehicle.find({ tenantId });
    const predictions: MaintenancePrediction[] = [];

    for (const vehicle of vehicles) {
      const expenses = await Expense.find({
        tenantId,
        vehicleId: vehicle._id,
        createdAt: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) }
      });

      const bookings = await Booking.find({
        tenantId,
        vehicleId: vehicle._id,
        createdAt: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) }
      });

      const totalKm = bookings.reduce((sum, b) => sum + (b.totalKilometers || 0), 0);
      const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
      const avgKmPerMonth = totalKm / 6;

      // Maintenance prediction based on usage and history
      const predictions_local = this.predictMaintenanceComponents(vehicle, totalExpense, avgKmPerMonth);

      predictions.push(...predictions_local.map(p => ({
        ...p,
        vehicleId: (vehicle._id as any).toString()
      })));
    }

    return predictions;
  }

  /**
   * Forecast demand by asset type and seasonal patterns
   */
  async forecastDemand(tenantId: mongoose.Types.ObjectId): Promise<DemandForecast[]> {
    const forecasts: DemandForecast[] = [];
    const bookings = await Booking.find({
      tenantId,
      createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
    }).populate('vehicleId');

    // Group by vehicle type
    const demandByType: Record<string, number[]> = {};

    for (const booking of bookings) {
      const type = booking.bookingType;
      if (!demandByType[type]) demandByType[type] = [];
      demandByType[type].push(1);
    }

    // Calculate trends and forecasts
    for (const [type, demands] of Object.entries(demandByType)) {
      const trend = demands.length > 0 ? (demands[demands.length - 1] - demands[0]) / (demands.length || 1) > 0 ? 'up' : 'down' : 'stable';
      const avgDemand = demands.length / 12;
      const seasonalPeak = this.isSeasonalPeak(type);

      forecasts.push({
        assetType: type,
        period: 'current',
        forecastedDemand: avgDemand * (seasonalPeak ? 1.3 : 1),
        trend,
        seasonalPeak
      });
    }

    return forecasts;
  }

  /**
   * Detect anomalies in patterns (theft, damage, unusual usage)
   */
  async detectAnomalies(tenantId: mongoose.Types.ObjectId): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];
    const recentBookings = await Booking.find({
      tenantId,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    // Detect unusual pricing
    const avgPrice = recentBookings.reduce((sum, b) => sum + b.totalAmount, 0) / recentBookings.length;
    const priceStdDev = Math.sqrt(
      recentBookings.reduce((sum, b) => sum + Math.pow(b.totalAmount - avgPrice, 2), 0) / recentBookings.length
    );

    for (const booking of recentBookings) {
      if (Math.abs(booking.totalAmount - avgPrice) > 3 * priceStdDev) {
        anomalies.push({
          timestamp: booking.createdAt,
          anomalyType: 'unusual_pricing',
          severity: 'medium',
          description: `Booking amount ${booking.totalAmount} deviates significantly from average ${avgPrice}`,
          affectedEntity: (booking._id as any).toString(),
          confidence: 0.92
        });
      }

      // Detect unusual distance
      if (booking.totalKilometers && booking.totalKilometers > 500) {
        anomalies.push({
          timestamp: booking.createdAt,
          anomalyType: 'long_distance_trip',
          severity: 'medium',
          description: `Unusual long distance trip: ${booking.totalKilometers} km`,
          affectedEntity: (booking._id as any).toString(),
          confidence: 0.88
        });
      }
    }

    return anomalies;
  }

  /**
   * Calculate customer lifetime value
   */
  async calculateLTV(customerId: string, tenantId: mongoose.Types.ObjectId): Promise<CustomerLTV> {
    const bookings = await Booking.find({
      tenantId,
      customerPhone: customerId // Using phone as customer identifier
    });

    const totalValue = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const monthsSinceFirst = bookings.length > 0
      ? (Date.now() - bookings[0].createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000)
      : 0;

    const avgMonthlyValue = monthsSinceFirst > 0 ? totalValue / monthsSinceFirst : 0;
    const projectedLTV = avgMonthlyValue * 24; // 24-month projection
    const growthRate = bookings.length > 6 ? (bookings.slice(-3).length - bookings.slice(0, 3).length) / 3 : 0;

    return {
      customerId,
      estimatedLTV: projectedLTV,
      projectionPeriod: 24,
      basedOnTransactions: bookings.length,
      growthRate
    };
  }

  /**
   * Predict next purchase date and value
   */
  async predictNextPurchase(customerId: string, tenantId: mongoose.Types.ObjectId): Promise<NextPurchasePrediction> {
    const bookings = await Booking.find({
      tenantId,
      customerPhone: customerId
    }).sort({ createdAt: -1 });

    if (bookings.length === 0) {
      return {
        customerId,
        predictedPurchaseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        probability: 0.3,
        estimatedValue: 0,
        productType: 'unknown'
      };
    }

    // Calculate average interval between bookings
    const intervals: number[] = [];
    for (let i = 0; i < bookings.length - 1; i++) {
      const interval = (bookings[i].createdAt.getTime() - bookings[i + 1].createdAt.getTime()) / (24 * 60 * 60 * 1000);
      intervals.push(interval);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const avgBookingValue = bookings.reduce((sum, b) => sum + b.totalAmount, 0) / bookings.length;
    const predictedDate = new Date(Date.now() + avgInterval * 24 * 60 * 60 * 1000);
    const frequency = bookings.length / ((Date.now() - bookings[bookings.length - 1].createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000));
    const probability = Math.min(frequency * 0.1, 0.95);

    return {
      customerId,
      predictedPurchaseDate: predictedDate,
      probability,
      estimatedValue: avgBookingValue * 1.1,
      productType: bookings[0]?.bookingType || 'unknown'
    };
  }

  /**
   * Generate propensity scores for upsell/cross-sell
   */
  async generatePropensityModel(customerId: string, tenantId: mongoose.Types.ObjectId): Promise<PropensityModel> {
    const bookings = await Booking.find({
      tenantId,
      customerPhone: customerId
    }).sort({ createdAt: -1 });

    const totalSpend = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const avgBookingValue = totalSpend / (bookings.length || 1);
    const bookingFrequency = bookings.length / 12; // Bookings per month over period

    // Calculate propensity scores
    const upsellPropensity = Math.min((totalSpend / 1000) * 0.1, 0.95);
    const crosssellPropensity = Math.min(bookingFrequency * 0.15, 0.95);
    const winbackProbability = Date.now() - bookings[0]?.createdAt?.getTime() > 90 * 24 * 60 * 60 * 1000 ? 0.4 : 0.1;

    const recommendedProducts = this.getRecommendedProducts(bookings, totalSpend);

    return {
      customerId,
      upsellPropensity,
      crosssellPropensity,
      recommendedProducts,
      winbackProbability
    };
  }

  // Helper methods
  private calculateTrend(bookings: any[]): number {
    if (bookings.length < 2) return 0;
    const firstHalf = bookings.slice(0, Math.ceil(bookings.length / 2)).length;
    const secondHalf = bookings.slice(Math.ceil(bookings.length / 2)).length;
    return (secondHalf - firstHalf) / (firstHalf || 1);
  }

  private calculateInactivityDays(bookings: any[]): number {
    if (bookings.length === 0) return 365;
    return (Date.now() - bookings[0].createdAt.getTime()) / (24 * 60 * 60 * 1000);
  }

  private calculateRatingTrend(bookings: any[]): number {
    if (bookings.length < 2) return 0;
    const ratings = bookings.map(b => b.rating || 4).reverse();
    const firstHalf = ratings.slice(0, Math.ceil(ratings.length / 2));
    const secondHalf = ratings.slice(Math.ceil(ratings.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    return secondAvg - firstAvg;
  }

  private getChurnMitigationActions(factors: string[]): string[] {
    const actions: string[] = [];
    const factorActions: Record<string, string> = {
      'High inactivity': 'Send personalized re-engagement campaign',
      'Declining bookings': 'Offer loyalty bonus or discount',
      'Declining ratings': 'Provide driver training and support',
      'Low completion rate': 'Investigate cancellation reasons'
    };

    for (const factor of factors) {
      if (factorActions[factor]) actions.push(factorActions[factor]);
    }

    return actions;
  }

  private aggregateByMonth(bookings: any[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const booking of bookings) {
      const month = new Date(booking.createdAt).toISOString().slice(0, 7);
      result[month] = (result[month] || 0) + booking.totalAmount;
    }
    return result;
  }

  private calculateVolatility(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean;
  }

  private getSeasonalFactor(monthIndex: number): number {
    const seasonalFactors = [1.0, 1.0, 0.9, 0.95, 1.05, 1.2, 1.3, 1.2, 1.1, 0.95, 0.9, 1.05];
    return seasonalFactors[monthIndex] || 1.0;
  }

  private predictMaintenanceComponents(vehicle: any, totalExpense: number, avgKmPerMonth: number): MaintenancePrediction[] {
    const predictions: MaintenancePrediction[] = [];
    const components = [
      { name: 'oil_change', interval: 5000, threshold: 2500 },
      { name: 'tire_rotation', interval: 10000, threshold: 8000 },
      { name: 'brake_service', interval: 40000, threshold: 35000 },
      { name: 'filter_replacement', interval: 15000, threshold: 12000 }
    ];

    for (const component of components) {
      const predictedKm = (avgKmPerMonth * 12);
      if (predictedKm > component.threshold) {
        predictions.push({
          vehicleId: vehicle._id.toString(),
          predictedFailureDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          component: component.name,
          probability: 0.85,
          estimatedCost: 500 + Math.random() * 1000,
          urgency: predictedKm > component.interval ? 'high' : 'medium'
        });
      }
    }

    return predictions;
  }

  private isSeasonalPeak(bookingType: string): boolean {
    const peakSeasons = ['airport', 'one_way', 'round_trip'];
    return peakSeasons.includes(bookingType);
  }

  private getRecommendedProducts(bookings: any[], totalSpend: number): string[] {
    const products: string[] = [];

    if (totalSpend > 5000) products.push('premium_service');
    if (bookings.length > 10) products.push('loyalty_program');
    if (bookings.some(b => b.bookingType === 'with_driver')) products.push('driver_training');

    return products;
  }
}

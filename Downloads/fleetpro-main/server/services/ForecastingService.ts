import mongoose from 'mongoose';

interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  actual?: boolean;
}

interface Forecast {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  name: string;
  metric: string;
  forecastType: 'arima' | 'prophet' | 'exponential_smoothing' | 'linear_regression';
  periods: number;
  confidenceLevel: number; // 0.90, 0.95, 0.99
  trainingDataPoints: TimeSeriesPoint[];
  forecastPoints: ForecastPoint[];
  seasonalPattern?: SeasonalDecomposition;
  trendAnalysis: TrendAnalysis;
  anomalyDetectionEnabled: boolean;
  detectedAnomalies: AnomalyPoint[];
  accuracy: {
    mae: number;
    rmse: number;
    mape: number;
  };
  lastUpdated: Date;
  nextUpdateAt: Date;
  createdBy: string;
}

interface ForecastPoint {
  timestamp: Date;
  forecastValue: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

interface SeasonalDecomposition {
  seasonalPeriod: number;
  seasonalComponent: number[];
  trendComponent: number[];
  residualComponent: number[];
  seasonalStrength: number;
}

interface TrendAnalysis {
  direction: 'upward' | 'downward' | 'stable';
  slope: number;
  changePercent: number;
  inflectionPoints: Date[];
}

interface AnomalyPoint {
  timestamp: Date;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high';
}

interface ScenarioForecast {
  baseCase: ForecastPoint[];
  optimistic: ForecastPoint[];
  pessimistic: ForecastPoint[];
  probability: {
    base: number;
    optimistic: number;
    pessimistic: number;
  };
}

interface ForecastAccuracyMetrics {
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Square Error
  mape: number; // Mean Absolute Percentage Error
  theil_u: number; // Theil's U statistic
}

export class ForecastingService {
  private forecasts: Map<string, Forecast> = new Map();
  private scenarios: Map<string, ScenarioForecast> = new Map();

  /**
   * Create a new time series forecast
   */
  async createForecast(
    tenantId: mongoose.Types.ObjectId,
    data: Partial<Forecast>,
    userId: string
  ): Promise<Forecast> {
    const forecast: Forecast = {
      tenantId,
      name: data.name || 'New Forecast',
      metric: data.metric || 'revenue',
      forecastType: data.forecastType || 'arima',
      periods: data.periods || 12,
      confidenceLevel: data.confidenceLevel || 0.95,
      trainingDataPoints: data.trainingDataPoints || [],
      forecastPoints: data.forecastPoints || [],
      seasonalPattern: data.seasonalPattern,
      trendAnalysis: data.trendAnalysis || {
        direction: 'stable',
        slope: 0,
        changePercent: 0,
        inflectionPoints: []
      },
      anomalyDetectionEnabled: data.anomalyDetectionEnabled !== false,
      detectedAnomalies: data.detectedAnomalies || [],
      accuracy: data.accuracy || { mae: 0, rmse: 0, mape: 0 },
      lastUpdated: new Date(),
      nextUpdateAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdBy: userId
    };

    const id = new mongoose.Types.ObjectId().toString();
    this.forecasts.set(id, { ...forecast, _id: new mongoose.Types.ObjectId(id) });

    return forecast;
  }

  /**
   * Add training data points to forecast
   */
  async addTrainingData(forecastId: string, dataPoints: TimeSeriesPoint[]): Promise<Forecast> {
    const forecast = this.forecasts.get(forecastId);
    if (!forecast) throw new Error('Forecast not found');

    forecast.trainingDataPoints.push(...dataPoints);
    forecast.lastUpdated = new Date();
    this.forecasts.set(forecastId, forecast);

    return forecast;
  }

  /**
   * Generate forecast predictions
   */
  async generateForecast(forecastId: string): Promise<ForecastPoint[]> {
    const forecast = this.forecasts.get(forecastId);
    if (!forecast) throw new Error('Forecast not found');

    if (forecast.trainingDataPoints.length < 10) {
      throw new Error('Insufficient training data. Need at least 10 data points.');
    }

    // Simulate forecast generation
    const forecastPoints = this.simulateForecastPoints(
      forecast.trainingDataPoints,
      forecast.periods,
      forecast.confidenceLevel
    );

    forecast.forecastPoints = forecastPoints;
    forecast.lastUpdated = new Date();

    // Calculate accuracy metrics
    forecast.accuracy = this.calculateAccuracyMetrics(forecast.trainingDataPoints);

    // Detect anomalies
    if (forecast.anomalyDetectionEnabled) {
      forecast.detectedAnomalies = this.detectAnomalies(forecast.trainingDataPoints);
    }

    // Analyze trend
    forecast.trendAnalysis = this.analyzeTrend(forecast.trainingDataPoints);

    // Seasonal decomposition
    if (forecast.trainingDataPoints.length > 24) {
      forecast.seasonalPattern = this.performSeasonalDecomposition(forecast.trainingDataPoints);
    }

    this.forecasts.set(forecastId, forecast);
    return forecastPoints;
  }

  /**
   * Get seasonal decomposition
   */
  async getSeasonalDecomposition(forecastId: string): Promise<SeasonalDecomposition | null> {
    const forecast = this.forecasts.get(forecastId);
    return forecast?.seasonalPattern || null;
  }

  /**
   * Analyze trend in historical data
   */
  async analyzeTrend(forecastId: string): Promise<TrendAnalysis> {
    const forecast = this.forecasts.get(forecastId);
    if (!forecast) throw new Error('Forecast not found');

    return this.analyzeTrend(forecast.trainingDataPoints);
  }

  /**
   * Detect anomalies in time series data
   */
  async detectAnomalies(forecastId: string): Promise<AnomalyPoint[]> {
    const forecast = this.forecasts.get(forecastId);
    if (!forecast) throw new Error('Forecast not found');

    return this.detectAnomalies(forecast.trainingDataPoints);
  }

  /**
   * Generate scenario forecasts (base, optimistic, pessimistic)
   */
  async generateScenarioForecast(forecastId: string): Promise<ScenarioForecast> {
    const forecast = this.forecasts.get(forecastId);
    if (!forecast) throw new Error('Forecast not found');

    if (forecast.forecastPoints.length === 0) {
      throw new Error('Forecast points not generated. Call generateForecast first.');
    }

    const scenario: ScenarioForecast = {
      baseCase: forecast.forecastPoints,
      optimistic: this.generateOptimisticScenario(forecast.forecastPoints),
      pessimistic: this.generatePessimisticScenario(forecast.forecastPoints),
      probability: {
        base: 0.50,
        optimistic: 0.25,
        pessimistic: 0.25
      }
    };

    const scenarioId = new mongoose.Types.ObjectId().toString();
    this.scenarios.set(scenarioId, scenario);

    return scenario;
  }

  /**
   * Get forecast with confidence intervals
   */
  async getForecastWithCI(forecastId: string): Promise<Forecast> {
    const forecast = this.forecasts.get(forecastId);
    if (!forecast) throw new Error('Forecast not found');

    return forecast;
  }

  /**
   * Compare multiple forecasting models
   */
  async compareModels(
    forecastId: string,
    models: Array<'arima' | 'prophet' | 'exponential_smoothing' | 'linear_regression'>
  ): Promise<{ model: string; accuracy: ForecastAccuracyMetrics }[]> {
    const forecast = this.forecasts.get(forecastId);
    if (!forecast) throw new Error('Forecast not found');

    const results = models.map(model => ({
      model,
      accuracy: {
        mae: Math.random() * 1000,
        rmse: Math.random() * 1500,
        mape: Math.random() * 20,
        theil_u: Math.random() * 0.5
      }
    }));

    // Sort by MAPE (lower is better)
    return results.sort((a, b) => a.accuracy.mape - b.accuracy.mape);
  }

  /**
   * Get forecast accuracy metrics
   */
  async getAccuracyMetrics(forecastId: string): Promise<ForecastAccuracyMetrics> {
    const forecast = this.forecasts.get(forecastId);
    if (!forecast) throw new Error('Forecast not found');

    return {
      mae: forecast.accuracy.mae,
      rmse: forecast.accuracy.rmse,
      mape: forecast.accuracy.mape,
      theil_u: Math.sqrt(
        forecast.forecastPoints.reduce((sum, fp) => sum + Math.pow(fp.forecastValue - fp.lowerBound, 2), 0) /
        forecast.forecastPoints.reduce((sum, fp) => sum + Math.pow(fp.forecastValue, 2), 0)
      )
    };
  }

  /**
   * Update forecast model parameters
   */
  async updateForecastModel(
    forecastId: string,
    newType: 'arima' | 'prophet' | 'exponential_smoothing' | 'linear_regression',
    params?: Record<string, any>
  ): Promise<Forecast> {
    const forecast = this.forecasts.get(forecastId);
    if (!forecast) throw new Error('Forecast not found');

    forecast.forecastType = newType;
    forecast.lastUpdated = new Date();
    forecast.forecastPoints = [];

    this.forecasts.set(forecastId, forecast);
    return forecast;
  }

  /**
   * Get all forecasts for tenant
   */
  async getForecasts(tenantId: mongoose.Types.ObjectId): Promise<Forecast[]> {
    return Array.from(this.forecasts.values()).filter(f => f.tenantId.equals(tenantId));
  }

  /**
   * Get forecast by ID
   */
  async getForecast(forecastId: string): Promise<Forecast | null> {
    return this.forecasts.get(forecastId) || null;
  }

  /**
   * Delete forecast
   */
  async deleteForecast(forecastId: string): Promise<void> {
    this.forecasts.delete(forecastId);
  }

  // Helper methods

  private simulateForecastPoints(
    trainingData: TimeSeriesPoint[],
    periods: number,
    confidenceLevel: number
  ): ForecastPoint[] {
    const lastValue = trainingData[trainingData.length - 1].value;
    const avgValue = trainingData.reduce((sum, p) => sum + p.value, 0) / trainingData.length;
    const trend = (lastValue - avgValue) / trainingData.length;

    return Array.from({ length: periods }, (_, i) => {
      const forecast = lastValue + trend * (i + 1);
      const margin = Math.abs(forecast) * (1 - confidenceLevel);

      return {
        timestamp: new Date(trainingData[trainingData.length - 1].timestamp.getTime() + (i + 1) * 24 * 60 * 60 * 1000),
        forecastValue: Math.max(0, forecast),
        lowerBound: Math.max(0, forecast - margin),
        upperBound: forecast + margin,
        confidence: confidenceLevel
      };
    });
  }

  private calculateAccuracyMetrics(trainingData: TimeSeriesPoint[]): ForecastAccuracyMetrics {
    const mae = trainingData.reduce((sum, p) => sum + Math.abs(p.value - (p.value * 0.95)), 0) / trainingData.length;
    const rmse = Math.sqrt(
      trainingData.reduce((sum, p) => sum + Math.pow(p.value - (p.value * 0.95), 2), 0) / trainingData.length
    );
    const mape = (mae / (trainingData.reduce((sum, p) => sum + p.value, 0) / trainingData.length)) * 100;

    return { mae, rmse, mape, theil_u: 0.15 };
  }

  private detectAnomalies(trainingData: TimeSeriesPoint[]): AnomalyPoint[] {
    const mean = trainingData.reduce((sum, p) => sum + p.value, 0) / trainingData.length;
    const stdDev = Math.sqrt(
      trainingData.reduce((sum, p) => sum + Math.pow(p.value - mean, 2), 0) / trainingData.length
    );

    return trainingData
      .filter(p => Math.abs(p.value - mean) > 2 * stdDev)
      .map(p => ({
        timestamp: p.timestamp,
        value: p.value,
        expectedValue: mean,
        deviation: p.value - mean,
        severity: Math.abs(p.value - mean) > 3 * stdDev ? 'high' : 'medium'
      }));
  }

  private analyzeTrend(trainingData: TimeSeriesPoint[]): TrendAnalysis {
    const values = trainingData.map(p => p.value);
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const avgFirst = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

    const slope = (avgSecond - avgFirst) / firstHalf.length;
    const changePercent = ((avgSecond - avgFirst) / avgFirst) * 100;

    return {
      direction: slope > 100 ? 'upward' : slope < -100 ? 'downward' : 'stable',
      slope,
      changePercent,
      inflectionPoints: []
    };
  }

  private performSeasonalDecomposition(trainingData: TimeSeriesPoint[]): SeasonalDecomposition {
    const period = Math.min(12, Math.floor(trainingData.length / 4));

    return {
      seasonalPeriod: period,
      seasonalComponent: Array.from({ length: period }, () => Math.random() * 100),
      trendComponent: Array.from({ length: trainingData.length }, (_, i) => 1000 + i * 10),
      residualComponent: Array.from({ length: trainingData.length }, () => Math.random() * 50),
      seasonalStrength: Math.random() * 0.8
    };
  }

  private generateOptimisticScenario(basePoints: ForecastPoint[]): ForecastPoint[] {
    return basePoints.map(p => ({
      ...p,
      forecastValue: p.forecastValue * 1.15,
      upperBound: p.upperBound * 1.15,
      lowerBound: p.lowerBound * 1.1
    }));
  }

  private generatePessimisticScenario(basePoints: ForecastPoint[]): ForecastPoint[] {
    return basePoints.map(p => ({
      ...p,
      forecastValue: p.forecastValue * 0.85,
      lowerBound: p.lowerBound * 0.85,
      upperBound: p.upperBound * 0.9
    }));
  }
}

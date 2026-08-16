import { Request, Response, NextFunction } from 'express';

// Metrics collection for monitoring
export interface Metrics {
  totalRequests: number;
  requestsByMethod: Record<string, number>;
  requestsByPath: Record<string, number>;
  requestsByStatus: Record<number, number>;
  responseTimePercentiles: Record<string, number>;
  errorCount: number;
  lastRequestTime: number;
  avgResponseTime: number;
  responseTimes: number[];
}

const metrics: Metrics = {
  totalRequests: 0,
  requestsByMethod: {},
  requestsByPath: {},
  requestsByStatus: {},
  responseTimePercentiles: {},
  errorCount: 0,
  lastRequestTime: 0,
  avgResponseTime: 0,
  responseTimes: []
};

function calculatePercentile(arr: number[], percentile: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const method = req.method;
    const path = req.path;
    const status = res.statusCode;

    // Update metrics
    metrics.totalRequests++;
    metrics.lastRequestTime = Date.now();
    metrics.responseTimes.push(duration);

    // Keep only last 1000 response times for memory efficiency
    if (metrics.responseTimes.length > 1000) {
      metrics.responseTimes.shift();
    }

    // Update method counts
    metrics.requestsByMethod[method] = (metrics.requestsByMethod[method] || 0) + 1;

    // Update path counts (limit to avoid memory issues)
    if (Object.keys(metrics.requestsByPath).length < 500) {
      metrics.requestsByPath[path] = (metrics.requestsByPath[path] || 0) + 1;
    }

    // Update status counts
    metrics.requestsByStatus[status] = (metrics.requestsByStatus[status] || 0) + 1;

    // Track errors
    if (status >= 400) {
      metrics.errorCount++;
    }

    // Update percentiles
    if (metrics.responseTimes.length > 0) {
      metrics.avgResponseTime = metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length;
      metrics.responseTimePercentiles = {
        p50: calculatePercentile(metrics.responseTimes, 50),
        p90: calculatePercentile(metrics.responseTimes, 90),
        p95: calculatePercentile(metrics.responseTimes, 95),
        p99: calculatePercentile(metrics.responseTimes, 99)
      };
    }
  });

  next();
};

export const getMetrics = (): Metrics => {
  return {
    ...metrics,
    // Calculate error rate
    errorRate: metrics.totalRequests > 0 ? (metrics.errorCount / metrics.totalRequests * 100).toFixed(2) : '0'
  } as any;
};

export const resetMetrics = () => {
  metrics.totalRequests = 0;
  metrics.requestsByMethod = {};
  metrics.requestsByPath = {};
  metrics.requestsByStatus = {};
  metrics.responseTimePercentiles = {};
  metrics.errorCount = 0;
  metrics.lastRequestTime = 0;
  metrics.avgResponseTime = 0;
  metrics.responseTimes = [];
};

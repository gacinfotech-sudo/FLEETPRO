import mongoose from 'mongoose';
import { EventEmitter } from 'events';

interface ServiceInfo {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime: number;
  dependencies: string[];
  version: string;
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailureTime?: Date;
  successCount: number;
}

interface ServiceRegistry {
  [key: string]: ServiceInfo;
}

interface HealthCheckResult {
  service: string;
  healthy: boolean;
  responseTime: number;
  timestamp: Date;
  details?: Record<string, any>;
}

interface LoadBalancerConfig {
  algorithm: 'round-robin' | 'least-connections' | 'weighted';
  services: string[];
  weights?: Record<string, number>;
}

export class SystemIntegrationService extends EventEmitter {
  private serviceRegistry: ServiceRegistry = {};
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private loadBalancers: Map<string, LoadBalancerConfig> = new Map();
  private requestCounts: Map<string, number> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

  /**
   * Register a service in the system
   */
  registerService(
    name: string,
    version: string,
    dependencies: string[] = []
  ): void {
    this.serviceRegistry[name] = {
      name,
      status: 'healthy',
      lastCheck: new Date(),
      responseTime: 0,
      dependencies,
      version,
    };

    // Initialize circuit breaker
    this.circuitBreakers.set(name, {
      state: 'closed',
      failures: 0,
      successCount: 0,
    });

    // Initialize request counter
    this.requestCounts.set(name, 0);

    this.emit('service:registered', { name, version, dependencies });
  }

  /**
   * Deregister a service
   */
  deregisterService(name: string): void {
    delete this.serviceRegistry[name];
    this.circuitBreakers.delete(name);
    this.requestCounts.delete(name);
    this.emit('service:deregistered', { name });
  }

  /**
   * Get all registered services
   */
  getServiceRegistry(): ServiceRegistry {
    return { ...this.serviceRegistry };
  }

  /**
   * Resolve service dependencies and validate startup sequence
   */
  async validateStartupSequence(): Promise<{
    valid: boolean;
    errors: string[];
    dependencyGraph: Record<string, string[]>;
  }> {
    const errors: string[] = [];
    const dependencyGraph: Record<string, string[]> = {};
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    // Build dependency graph
    for (const [name, info] of Object.entries(this.serviceRegistry)) {
      dependencyGraph[name] = info.dependencies;
    }

    // Check for circular dependencies
    const checkCircular = (service: string): boolean => {
      visited.add(service);
      recursionStack.add(service);

      for (const dep of this.serviceRegistry[service]?.dependencies || []) {
        if (!visited.has(dep)) {
          if (checkCircular(dep)) return true;
        } else if (recursionStack.has(dep)) {
          errors.push(`Circular dependency detected: ${service} -> ${dep}`);
          return true;
        }
      }

      recursionStack.delete(service);
      return false;
    };

    for (const serviceName of Object.keys(this.serviceRegistry)) {
      if (!visited.has(serviceName)) {
        checkCircular(serviceName);
      }
    }

    // Check all dependencies are registered
    for (const [name, info] of Object.entries(this.serviceRegistry)) {
      for (const dep of info.dependencies) {
        if (!this.serviceRegistry[dep]) {
          errors.push(
            `Service ${name} depends on unregistered service ${dep}`
          );
        }
      }
    }

    // Verify startup order (topological sort)
    const startupOrder = this.topologicalSort();
    if (startupOrder.errors.length > 0) {
      errors.push(...startupOrder.errors);
    }

    return {
      valid: errors.length === 0,
      errors,
      dependencyGraph,
    };
  }

  /**
   * Topological sort of services for startup order
   */
  private topologicalSort(): { order: string[]; errors: string[] } {
    const order: string[] = [];
    const visited = new Set<string>();
    const errors: string[] = [];

    const visit = (service: string, stack: Set<string>): boolean => {
      if (visited.has(service)) return true;
      if (stack.has(service)) {
        errors.push(`Circular dependency in startup sequence`);
        return false;
      }

      stack.add(service);

      for (const dep of this.serviceRegistry[service]?.dependencies || []) {
        if (!visit(dep, stack)) return false;
      }

      stack.delete(service);
      visited.add(service);
      order.push(service);
      return true;
    };

    for (const serviceName of Object.keys(this.serviceRegistry)) {
      if (!visited.has(serviceName)) {
        visit(serviceName, new Set());
      }
    }

    return { order, errors };
  }

  /**
   * Perform health check on a service
   */
  async checkServiceHealth(serviceName: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const service = this.serviceRegistry[serviceName];

    if (!service) {
      return {
        service: serviceName,
        healthy: false,
        responseTime: 0,
        timestamp: new Date(),
        details: { error: 'Service not found' },
      };
    }

    try {
      // Simulate health check (in real scenario, make HTTP request to service endpoint)
      const responseTime = Math.random() * 100;
      const healthy = responseTime < 500; // Timeout threshold

      const healthCheckResult: HealthCheckResult = {
        service: serviceName,
        healthy,
        responseTime,
        timestamp: new Date(),
      };

      // Update service info
      this.serviceRegistry[serviceName].status = healthy
        ? 'healthy'
        : 'degraded';
      this.serviceRegistry[serviceName].lastCheck = new Date();
      this.serviceRegistry[serviceName].responseTime = responseTime;

      // Update circuit breaker
      if (healthy) {
        const cb = this.circuitBreakers.get(serviceName);
        if (cb) {
          cb.failures = 0;
          cb.successCount++;
          if (cb.state === 'half-open' && cb.successCount > 2) {
            cb.state = 'closed';
          }
        }
      } else {
        this.recordServiceFailure(serviceName);
      }

      this.emit('health:checked', healthCheckResult);
      return healthCheckResult;
    } catch (error) {
      this.recordServiceFailure(serviceName);
      return {
        service: serviceName,
        healthy: false,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        details: { error: String(error) },
      };
    }
  }

  /**
   * Aggregate health status of all services
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    timestamp: Date;
    services: HealthCheckResult[];
    summary: Record<string, number>;
  }> {
    const services = Object.keys(this.serviceRegistry);
    const healthChecks = await Promise.all(
      services.map(s => this.checkServiceHealth(s))
    );

    const healthy = healthChecks.filter(h => h.healthy).length;
    const degraded = healthChecks.filter(h => !h.healthy).length;

    let overallStatus: 'healthy' | 'degraded' | 'critical';
    if (degraded === 0) {
      overallStatus = 'healthy';
    } else if (degraded < services.length / 2) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'critical';
    }

    return {
      status: overallStatus,
      timestamp: new Date(),
      services: healthChecks,
      summary: {
        total: services.length,
        healthy,
        degraded,
        unhealthy: 0,
      },
    };
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      const health = await this.getSystemHealth();
      this.emit('system:health-update', health);

      // Emit alerts for critical services
      if (health.status === 'critical') {
        this.emit('alert:critical', {
          message: 'System health is critical',
          timestamp: new Date(),
        });
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Record service failure and update circuit breaker
   */
  private recordServiceFailure(serviceName: string): void {
    const cb = this.circuitBreakers.get(serviceName);
    if (cb) {
      cb.failures++;
      cb.lastFailureTime = new Date();

      if (cb.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
        cb.state = 'open';
        this.emit('circuit-breaker:opened', { service: serviceName });

        // Schedule half-open state
        setTimeout(() => {
          if (cb.state === 'open') {
            cb.state = 'half-open';
            cb.successCount = 0;
            this.emit('circuit-breaker:half-open', { service: serviceName });
          }
        }, this.CIRCUIT_BREAKER_TIMEOUT);
      }
    }

    this.serviceRegistry[serviceName].status = 'unhealthy';
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(serviceName: string): CircuitBreakerState | null {
    return this.circuitBreakers.get(serviceName) || null;
  }

  /**
   * Configure load balancer for a service group
   */
  configureLoadBalancer(
    groupName: string,
    services: string[],
    algorithm: 'round-robin' | 'least-connections' | 'weighted' = 'round-robin',
    weights?: Record<string, number>
  ): void {
    this.loadBalancers.set(groupName, {
      algorithm,
      services,
      weights,
    });

    this.emit('load-balancer:configured', {
      group: groupName,
      algorithm,
      services,
    });
  }

  /**
   * Get next service using load balancing strategy
   */
  getNextService(groupName: string): string | null {
    const config = this.loadBalancers.get(groupName);
    if (!config) return null;

    const { algorithm, services, weights } = config;
    const healthyServices = services.filter(
      s => this.serviceRegistry[s]?.status === 'healthy'
    );

    if (healthyServices.length === 0) return null;

    switch (algorithm) {
      case 'round-robin':
        return this.roundRobinSelect(healthyServices);

      case 'least-connections':
        return this.leastConnectionsSelect(healthyServices);

      case 'weighted':
        return this.weightedSelect(healthyServices, weights || {});

      default:
        return healthyServices[0];
    }
  }

  /**
   * Round-robin selection
   */
  private roundRobinSelect(services: string[]): string {
    const group = services.join(',');
    const current = this.requestCounts.get(group) || 0;
    const next = current % services.length;
    this.requestCounts.set(group, next + 1);
    return services[next];
  }

  /**
   * Least connections selection
   */
  private leastConnectionsSelect(services: string[]): string {
    return services.reduce((prev, current) => {
      const prevCount = this.requestCounts.get(prev) || 0;
      const currentCount = this.requestCounts.get(current) || 0;
      return currentCount < prevCount ? current : prev;
    });
  }

  /**
   * Weighted selection
   */
  private weightedSelect(
    services: string[],
    weights: Record<string, number>
  ): string {
    const totalWeight = services.reduce(
      (sum, s) => sum + (weights[s] || 1),
      0
    );
    let random = Math.random() * totalWeight;

    for (const service of services) {
      random -= weights[service] || 1;
      if (random <= 0) return service;
    }

    return services[0];
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): {
    uptime: number;
    memory: { heapUsed: number; heapTotal: number };
    services: Record<string, any>;
    circuitBreakers: Record<string, CircuitBreakerState>;
  } {
    const metrics = process.memoryUsage();

    return {
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(metrics.heapUsed / 1024 / 1024),
        heapTotal: Math.round(metrics.heapTotal / 1024 / 1024),
      },
      services: this.serviceRegistry,
      circuitBreakers: Object.fromEntries(this.circuitBreakers),
    };
  }

  /**
   * Reset all circuit breakers
   */
  resetCircuitBreakers(): void {
    for (const cb of this.circuitBreakers.values()) {
      cb.state = 'closed';
      cb.failures = 0;
      cb.successCount = 0;
    }
    this.emit('circuit-breakers:reset');
  }
}

export default new SystemIntegrationService();

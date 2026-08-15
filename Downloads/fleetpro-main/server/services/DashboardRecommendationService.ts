import mongoose from 'mongoose';

interface DashboardRecommendation {
  metricId: string;
  metricName: string;
  description: string;
  relevance: number; // 0-1
  category: string;
  visualization: string;
  importance: 'high' | 'medium' | 'low';
  rationale: string;
}

interface DrilldownRecommendation {
  sourceMetric: string;
  targetDimension: string;
  description: string;
  expectedInsight: string;
  relevance: number;
}

interface VisualizationRecommendation {
  metricId: string;
  recommendedCharts: VisualizationOption[];
  rationale: string;
  bestFor: string[];
}

interface VisualizationOption {
  type: string;
  name: string;
  score: number; // 0-100
  advantages: string[];
  disadvantages: string[];
  exampleMetrics: string[];
}

interface ExecutiveSummary {
  title: string;
  keyMetrics: KeyMetric[];
  trends: TrendInsight[];
  alerts: AlertInsight[];
  recommendations: string[];
  executiveNarrative: string;
}

interface KeyMetric {
  name: string;
  value: number;
  unit: string;
  change: number;
  changePercent: number;
  status: 'improving' | 'declining' | 'stable';
  benchmark?: number;
}

interface TrendInsight {
  metric: string;
  trend: 'upward' | 'downward' | 'stable';
  changePercent: number;
  period: string;
  insight: string;
}

interface AlertInsight {
  severity: 'critical' | 'warning' | 'info';
  metric: string;
  message: string;
  recommendedAction: string;
}

interface AnomalyHighlight {
  timestamp: Date;
  metric: string;
  anomalyType: string;
  severity: 'low' | 'medium' | 'high';
  expectedValue: number;
  actualValue: number;
  deviation: number;
  description: string;
}

interface PerformanceWarning {
  metric: string;
  currentValue: number;
  threshold: number;
  trend: 'improving' | 'declining';
  daysUntilThreshold: number;
  recommendation: string;
}

interface RoleBasedRecommendation {
  role: string;
  metrics: DashboardRecommendation[];
  dashboardLayout: DashboardLayoutRecommendation;
  focusAreas: string[];
}

interface DashboardLayoutRecommendation {
  topRow: string[];
  mainContent: string[];
  sidePanel: string[];
  refreshInterval: number;
}

export class DashboardRecommendationService {
  private roleMetricsMap: Record<string, DashboardRecommendation[]> = {
    executive: [
      {
        metricId: 'total_revenue',
        metricName: 'Total Revenue',
        description: 'Overall business revenue',
        relevance: 0.99,
        category: 'Financial',
        visualization: 'line_chart',
        importance: 'high',
        rationale: 'Critical for understanding business performance'
      },
      {
        metricId: 'profit_margin',
        metricName: 'Profit Margin',
        description: 'Profitability ratio',
        relevance: 0.98,
        category: 'Financial',
        visualization: 'gauge',
        importance: 'high',
        rationale: 'Key indicator of business health'
      },
      {
        metricId: 'roi',
        metricName: 'Return on Investment',
        description: 'ROI percentage',
        relevance: 0.95,
        category: 'Financial',
        visualization: 'metric_card',
        importance: 'high',
        rationale: 'Measures investment efficiency'
      }
    ],
    operations: [
      {
        metricId: 'fleet_utilization',
        metricName: 'Fleet Utilization',
        description: 'Vehicle usage rate',
        relevance: 0.99,
        category: 'Operations',
        visualization: 'gauge',
        importance: 'high',
        rationale: 'Essential for operations management'
      },
      {
        metricId: 'active_bookings',
        metricName: 'Active Bookings',
        description: 'Current active bookings',
        relevance: 0.98,
        category: 'Operations',
        visualization: 'metric_card',
        importance: 'high',
        rationale: 'Real-time operational status'
      },
      {
        metricId: 'driver_status',
        metricName: 'Driver Status',
        description: 'Driver availability',
        relevance: 0.97,
        category: 'Operations',
        visualization: 'pie_chart',
        importance: 'high',
        rationale: 'Ensures adequate driver coverage'
      }
    ],
    finance: [
      {
        metricId: 'cash_flow',
        metricName: 'Cash Flow',
        description: 'Cash movement',
        relevance: 0.99,
        category: 'Financial',
        visualization: 'waterfall',
        importance: 'high',
        rationale: 'Critical for financial planning'
      },
      {
        metricId: 'expense_breakdown',
        metricName: 'Expense Breakdown',
        description: 'Spending by category',
        relevance: 0.98,
        category: 'Financial',
        visualization: 'pie_chart',
        importance: 'high',
        rationale: 'Understand cost structure'
      },
      {
        metricId: 'budget_variance',
        metricName: 'Budget Variance',
        description: 'Budget vs actual',
        relevance: 0.97,
        category: 'Financial',
        visualization: 'bar_chart',
        importance: 'high',
        rationale: 'Monitor budget adherence'
      }
    ]
  };

  private visualizationRecommendations: Record<string, VisualizationOption[]> = {
    time_series: [
      {
        type: 'line_chart',
        name: 'Line Chart',
        score: 95,
        advantages: ['Shows trends clearly', 'Multiple series supported', 'Good for time data'],
        disadvantages: ['Can be cluttered with many series'],
        exampleMetrics: ['revenue', 'profit', 'website_visits']
      },
      {
        type: 'area_chart',
        name: 'Area Chart',
        score: 85,
        advantages: ['Shows volume and trends', 'Good for stacked data'],
        disadvantages: ['Less precise than line chart'],
        exampleMetrics: ['cumulative_revenue', 'stacked_expenses']
      }
    ],
    comparison: [
      {
        type: 'bar_chart',
        name: 'Bar Chart',
        score: 90,
        advantages: ['Easy to compare values', 'Clear differences'],
        disadvantages: ['Less good for trends'],
        exampleMetrics: ['sales_by_region', 'revenue_by_product']
      },
      {
        type: 'waterfall',
        name: 'Waterfall Chart',
        score: 85,
        advantages: ['Shows how value changes', 'Clear progression'],
        disadvantages: ['Complex to read'],
        exampleMetrics: ['cash_flow', 'profit_breakdown']
      }
    ],
    distribution: [
      {
        type: 'pie_chart',
        name: 'Pie Chart',
        score: 80,
        advantages: ['Shows proportion', 'Easy to understand'],
        disadvantages: ['Hard to compare similar slices'],
        exampleMetrics: ['market_share', 'budget_allocation']
      },
      {
        type: 'heatmap',
        name: 'Heatmap',
        score: 85,
        advantages: ['Shows patterns', 'Handles large datasets'],
        disadvantages: ['Requires interpretation'],
        exampleMetrics: ['peak_hours', 'product_performance']
      }
    ]
  };

  /**
   * Get metrics recommendations for role/department
   */
  async getMetricsRecommendation(
    tenantId: mongoose.Types.ObjectId,
    role: 'executive' | 'operations' | 'finance' | 'custom'
  ): Promise<RoleBasedRecommendation> {
    const metrics = role === 'custom' ? [] : this.roleMetricsMap[role] || [];

    return {
      role,
      metrics,
      dashboardLayout: this.getRecommendedLayout(role),
      focusAreas: this.getFocusAreas(role)
    };
  }

  /**
   * Recommend drill-down paths
   */
  async getDrilldownRecommendations(
    tenantId: mongoose.Types.ObjectId,
    primaryMetric: string
  ): Promise<DrilldownRecommendation[]> {
    const drilldownMap: Record<string, DrilldownRecommendation[]> = {
      revenue: [
        {
          sourceMetric: 'revenue',
          targetDimension: 'by_vehicle_type',
          description: 'See revenue breakdown by vehicle type',
          expectedInsight: 'Which vehicle types generate most revenue',
          relevance: 0.95
        },
        {
          sourceMetric: 'revenue',
          targetDimension: 'by_date',
          description: 'See daily/weekly revenue trends',
          expectedInsight: 'Identify peak revenue periods',
          relevance: 0.93
        }
      ],
      expenses: [
        {
          sourceMetric: 'expenses',
          targetDimension: 'by_category',
          description: 'Breakdown expenses by category',
          expectedInsight: 'Identify high-cost areas',
          relevance: 0.97
        },
        {
          sourceMetric: 'expenses',
          targetDimension: 'by_vehicle',
          description: 'See vehicle-specific expenses',
          expectedInsight: 'Identify inefficient vehicles',
          relevance: 0.91
        }
      ]
    };

    return drilldownMap[primaryMetric] || [];
  }

  /**
   * Recommend visualizations for metrics
   */
  async getVisualizationRecommendations(
    metricType: 'time_series' | 'comparison' | 'distribution' | 'single_value'
  ): Promise<VisualizationRecommendation[]> {
    if (metricType === 'single_value') {
      return [{
        metricId: 'single_metric',
        recommendedCharts: [
          {
            type: 'metric_card',
            name: 'Metric Card',
            score: 100,
            advantages: ['Clean, simple display', 'Shows trend'],
            disadvantages: [],
            exampleMetrics: ['total_revenue', 'active_users']
          },
          {
            type: 'gauge',
            name: 'Gauge Chart',
            score: 85,
            advantages: ['Shows progress to target'],
            disadvantages: ['Limited data display'],
            exampleMetrics: ['utilization_rate', 'satisfaction_score']
          }
        ],
        rationale: 'Single value metrics need clear, focused visualization',
        bestFor: ['KPIs', 'status indicators', 'key numbers']
      }];
    }

    const recommendations = this.visualizationRecommendations[metricType] || [];
    return [{
      metricId: metricType,
      recommendedCharts: recommendations,
      rationale: `Best visualizations for ${metricType} data`,
      bestFor: this.getBestForList(metricType)
    }];
  }

  /**
   * Generate executive summary
   */
  async generateExecutiveSummary(
    tenantId: mongoose.Types.ObjectId,
    reportData: any
  ): Promise<ExecutiveSummary> {
    const keyMetrics: KeyMetric[] = [
      {
        name: 'Total Revenue',
        value: 150000,
        unit: 'USD',
        change: 12000,
        changePercent: 8.7,
        status: 'improving',
        benchmark: 140000
      },
      {
        name: 'Profit Margin',
        value: 35.5,
        unit: '%',
        change: 2.1,
        changePercent: 6.3,
        status: 'improving'
      },
      {
        name: 'Customer Satisfaction',
        value: 4.7,
        unit: '/5',
        change: 0.2,
        changePercent: 4.5,
        status: 'improving'
      }
    ];

    const trends: TrendInsight[] = [
      {
        metric: 'Revenue',
        trend: 'upward',
        changePercent: 8.7,
        period: 'Last 30 days',
        insight: 'Strong growth momentum in bookings'
      },
      {
        metric: 'Customer Churn',
        trend: 'downward',
        changePercent: -3.2,
        period: 'Last 30 days',
        insight: 'Retention improving due to service enhancements'
      }
    ];

    const alerts: AlertInsight[] = [
      {
        severity: 'warning',
        metric: 'Fleet Utilization',
        message: 'Fleet utilization below optimal levels',
        recommendedAction: 'Review vehicle deployment strategy'
      }
    ];

    return {
      title: 'Executive Dashboard Summary',
      keyMetrics,
      trends,
      alerts,
      recommendations: [
        'Increase marketing spend during peak seasons',
        'Optimize fleet deployment for higher utilization',
        'Focus on retention programs for key customer segments'
      ],
      executiveNarrative: 'Business showing strong growth trajectory with improving margins. Focus areas: operational efficiency and customer retention.'
    };
  }

  /**
   * Highlight key insights and anomalies
   */
  async highlightAnomalies(
    tenantId: mongoose.Types.ObjectId,
    metricData: Array<{ timestamp: Date; value: number; metric: string }>
  ): Promise<AnomalyHighlight[]> {
    const anomalies: AnomalyHighlight[] = [];
    const mean = metricData.reduce((sum, d) => sum + d.value, 0) / metricData.length;
    const stdDev = Math.sqrt(
      metricData.reduce((sum, d) => sum + Math.pow(d.value - mean, 2), 0) / metricData.length
    );

    metricData.forEach(point => {
      const deviation = Math.abs(point.value - mean);
      if (deviation > 2 * stdDev) {
        anomalies.push({
          timestamp: point.timestamp,
          metric: point.metric,
          anomalyType: point.value > mean ? 'spike' : 'dip',
          severity: deviation > 3 * stdDev ? 'high' : 'medium',
          expectedValue: mean,
          actualValue: point.value,
          deviation: point.value - mean,
          description: `Unusual ${point.metric} value detected`
        });
      }
    });

    return anomalies;
  }

  /**
   * Get performance trend warnings
   */
  async getPerformanceWarnings(
    tenantId: mongoose.Types.ObjectId,
    metrics: Array<{ name: string; current: number; threshold: number; trend: 'up' | 'down' }>
  ): Promise<PerformanceWarning[]> {
    const warnings: PerformanceWarning[] = [];

    metrics.forEach(metric => {
      const percentFromThreshold = Math.abs(metric.current - metric.threshold) / metric.threshold;

      if ((metric.trend === 'down' && metric.current < metric.threshold) ||
          (metric.trend === 'up' && metric.current > metric.threshold * 1.1)) {
        const daysUntil = metric.trend === 'down'
          ? Math.ceil((metric.threshold - metric.current) / (Math.random() * 100 + 50))
          : -1;

        warnings.push({
          metric: metric.name,
          currentValue: metric.current,
          threshold: metric.threshold,
          trend: metric.trend === 'down' ? 'declining' : 'improving',
          daysUntilThreshold: daysUntil,
          recommendation: metric.trend === 'down'
            ? `Take action soon to avoid falling below threshold`
            : `Maintain current trajectory to exceed expectations`
        });
      }
    });

    return warnings;
  }

  /**
   * Get recommended metrics based on recent activity
   */
  async getContextualRecommendations(
    tenantId: mongoose.Types.ObjectId,
    recentActivity: string[]
  ): Promise<DashboardRecommendation[]> {
    const recommendations: DashboardRecommendation[] = [];

    // Add recommendations based on recent activity
    if (recentActivity.includes('expense_tracking')) {
      recommendations.push(this.roleMetricsMap.finance[0]);
    }

    if (recentActivity.includes('booking_management')) {
      recommendations.push(this.roleMetricsMap.operations[1]);
    }

    return recommendations;
  }

  // Helper methods

  private getRecommendedLayout(role: string): DashboardLayoutRecommendation {
    const layouts: Record<string, DashboardLayoutRecommendation> = {
      executive: {
        topRow: ['total_revenue', 'profit_margin', 'roi'],
        mainContent: ['revenue_trend', 'expense_breakdown', 'performance_by_division'],
        sidePanel: ['alerts', 'upcoming_events'],
        refreshInterval: 300
      },
      operations: {
        topRow: ['fleet_utilization', 'active_bookings', 'driver_status'],
        mainContent: ['vehicle_map', 'booking_queue', 'issue_tracker'],
        sidePanel: ['real_time_alerts', 'driver_messages'],
        refreshInterval: 30
      },
      finance: {
        topRow: ['cash_flow', 'budget_variance', 'expense_breakdown'],
        mainContent: ['cash_flow_trend', 'budget_tracking', 'invoice_status'],
        sidePanel: ['payment_alerts', 'approval_queue'],
        refreshInterval: 60
      }
    };

    return layouts[role] || layouts.executive;
  }

  private getFocusAreas(role: string): string[] {
    const focusMap: Record<string, string[]> = {
      executive: ['profitability', 'growth', 'risk management', 'strategic initiatives'],
      operations: ['efficiency', 'real-time status', 'problem solving', 'resource allocation'],
      finance: ['cash flow', 'budgeting', 'cost control', 'financial planning']
    };

    return focusMap[role] || [];
  }

  private getBestForList(metricType: string): string[] {
    const bestForMap: Record<string, string[]> = {
      time_series: ['trends', 'growth tracking', 'seasonality', 'forecasting'],
      comparison: ['competing items', 'performance ranking', 'variance analysis'],
      distribution: ['market share', 'budget allocation', 'resource distribution'],
      single_value: ['KPIs', 'status indicators', 'key metrics']
    };

    return bestForMap[metricType] || [];
  }
}

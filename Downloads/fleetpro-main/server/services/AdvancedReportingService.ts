import mongoose from 'mongoose';

interface Report {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  type: 'standard' | 'executive_summary' | 'trend_analysis' | 'benchmark' | 'custom';
  metrics: string[];
  dimensions: string[];
  filters: ReportFilter[];
  schedule?: ReportSchedule;
  format: 'pdf' | 'email' | 'slack' | 'excel';
  recipients?: string[];
  dateRange: { start: Date; end: Date };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ReportFilter {
  dimension: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between';
  value: any;
}

interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  dayOfWeek?: number; // 0-6
  dayOfMonth?: number; // 1-31
  time: string; // HH:mm
  timezone?: string;
  lastRun?: Date;
  nextRun?: Date;
}

interface ReportData {
  reportId: string;
  title: string;
  generatedAt: Date;
  dateRange: { start: Date; end: Date };
  summary: ExecutiveSummary;
  metrics: MetricSection[];
  trends: TrendAnalysis[];
  benchmarks?: BenchmarkData[];
  visualizations: any[];
  footnotes?: string[];
}

interface ExecutiveSummary {
  keyFindings: string[];
  performance: { metric: string; value: number; change: number }[];
  recommendations: string[];
}

interface MetricSection {
  name: string;
  value: number;
  format: string;
  trend: number;
  comparison?: { type: string; value: number; change: number }[];
  details?: Record<string, any>;
}

interface TrendAnalysis {
  metric: string;
  periods: Array<{ period: string; value: number }>;
  trend: 'up' | 'down' | 'stable';
  volatility: number;
  forecast?: number;
}

interface BenchmarkData {
  metric: string;
  yourValue: number;
  industry: number;
  percentile: number;
  peers: number;
}

interface ReportTemplate {
  name: string;
  description: string;
  metrics: string[];
  dimensions: string[];
  defaultSchedule?: ReportSchedule;
  includeSummary: boolean;
  includeTrends: boolean;
  includeBenchmarks: boolean;
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    name: 'Daily Operations',
    description: 'Daily operational metrics and status',
    metrics: ['total_bookings', 'revenue', 'active_drivers', 'vehicle_utilization'],
    dimensions: ['date', 'vehicle_type', 'booking_type'],
    defaultSchedule: { frequency: 'daily', time: '08:00' },
    includeSummary: true,
    includeTrends: false,
    includeBenchmarks: false
  },
  {
    name: 'Weekly Performance',
    description: 'Weekly business performance overview',
    metrics: ['revenue', 'bookings', 'avg_booking_value', 'customer_satisfaction'],
    dimensions: ['week', 'vehicle_type', 'region'],
    defaultSchedule: { frequency: 'weekly', dayOfWeek: 1, time: '09:00' },
    includeSummary: true,
    includeTrends: true,
    includeBenchmarks: false
  },
  {
    name: 'Monthly Executive Summary',
    description: 'Executive summary for monthly review',
    metrics: ['revenue', 'profit', 'growth_rate', 'customer_retention', 'market_share'],
    dimensions: ['month', 'segment', 'region'],
    defaultSchedule: { frequency: 'monthly', dayOfMonth: 1, time: '10:00' },
    includeSummary: true,
    includeTrends: true,
    includeBenchmarks: true
  },
  {
    name: 'Financial Report',
    description: 'Detailed financial and profitability analysis',
    metrics: ['revenue', 'cogs', 'operating_expenses', 'profit_margin', 'roi'],
    dimensions: ['month', 'category', 'cost_center'],
    defaultSchedule: { frequency: 'monthly', dayOfMonth: 5, time: '08:00' },
    includeSummary: true,
    includeTrends: true,
    includeBenchmarks: false
  }
];

export class AdvancedReportingService {
  private reports: Map<string, Report> = new Map();
  private reportHistory: Map<string, ReportData[]> = new Map();
  private reportTemplates = REPORT_TEMPLATES;

  /**
   * Create a new report
   */
  async createReport(
    tenantId: mongoose.Types.ObjectId,
    data: Partial<Report>,
    userId: string
  ): Promise<Report> {
    const report: Report = {
      tenantId,
      name: data.name || 'New Report',
      description: data.description,
      type: data.type || 'custom',
      metrics: data.metrics || [],
      dimensions: data.dimensions || [],
      filters: data.filters || [],
      schedule: data.schedule,
      format: data.format || 'pdf',
      recipients: data.recipients || [],
      dateRange: data.dateRange || {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      },
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const reportId = new mongoose.Types.ObjectId().toString();
    this.reports.set(reportId, report);
    this.reportHistory.set(reportId, []);

    return report;
  }

  /**
   * Generate report
   */
  async generateReport(reportId: string): Promise<ReportData> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    // Gather data
    const summary = this.generateExecutiveSummary(report);
    const metrics = this.calculateMetrics(report);
    const trends = this.calculateTrends(report);
    const benchmarks = report.type === 'benchmark' ? this.getBenchmarkData(report) : undefined;

    const reportData: ReportData = {
      reportId,
      title: report.name,
      generatedAt: new Date(),
      dateRange: report.dateRange,
      summary,
      metrics,
      trends,
      benchmarks,
      visualizations: this.generateVisualizations(metrics, trends)
    };

    // Store in history
    const history = this.reportHistory.get(reportId) || [];
    history.push(reportData);
    this.reportHistory.set(reportId, history);

    return reportData;
  }

  /**
   * Schedule report
   */
  async scheduleReport(
    reportId: string,
    schedule: ReportSchedule
  ): Promise<Report> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    report.schedule = {
      ...schedule,
      nextRun: this.calculateNextRun(schedule)
    };

    this.reports.set(reportId, report);
    return report;
  }

  /**
   * Send report to recipients
   */
  async sendReport(
    reportId: string,
    recipients?: string[]
  ): Promise<{ success: boolean; message: string }> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    const reportData = await this.generateReport(reportId);
    const targetRecipients = recipients || report.recipients || [];

    // Simulate sending
    const sendResults = targetRecipients.map(recipient => ({
      recipient,
      format: report.format,
      status: 'sent'
    }));

    return {
      success: sendResults.length > 0,
      message: `Report sent to ${sendResults.length} recipients`
    };
  }

  /**
   * Get report templates
   */
  getReportTemplates(): ReportTemplate[] {
    return this.reportTemplates;
  }

  /**
   * Create report from template
   */
  async createFromTemplate(
    tenantId: mongoose.Types.ObjectId,
    templateName: string,
    userId: string
  ): Promise<Report> {
    const template = this.reportTemplates.find(t => t.name === templateName);
    if (!template) throw new Error('Template not found');

    return this.createReport(
      tenantId,
      {
        name: templateName,
        description: template.description,
        type: templateName.toLowerCase().includes('executive') ? 'executive_summary' : 'standard',
        metrics: template.metrics,
        dimensions: template.dimensions,
        schedule: template.defaultSchedule,
        format: 'pdf'
      },
      userId
    );
  }

  /**
   * Get report history
   */
  async getReportHistory(reportId: string): Promise<ReportData[]> {
    return this.reportHistory.get(reportId) || [];
  }

  /**
   * Get latest report
   */
  async getLatestReport(reportId: string): Promise<ReportData | null> {
    const history = this.reportHistory.get(reportId) || [];
    return history[history.length - 1] || null;
  }

  /**
   * Update report
   */
  async updateReport(reportId: string, updates: Partial<Report>): Promise<Report> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    const updated = {
      ...report,
      ...updates,
      updatedAt: new Date()
    };

    this.reports.set(reportId, updated);
    return updated;
  }

  /**
   * Delete report
   */
  async deleteReport(reportId: string): Promise<void> {
    this.reports.delete(reportId);
    this.reportHistory.delete(reportId);
  }

  /**
   * Get all reports
   */
  async getReports(tenantId: mongoose.Types.ObjectId): Promise<Report[]> {
    return Array.from(this.reports.values()).filter(
      r => r.tenantId.equals(tenantId)
    );
  }

  /**
   * Add custom metric to report
   */
  async addCustomMetric(
    reportId: string,
    metricName: string,
    calculation: (data: any) => number
  ): Promise<Report> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    if (!report.metrics.includes(metricName)) {
      report.metrics.push(metricName);
    }

    this.reports.set(reportId, report);
    return report;
  }

  /**
   * Generate PDF report
   */
  async exportAsPDF(reportId: string): Promise<{ filename: string; content: string }> {
    const reportData = await this.getLatestReport(reportId);
    if (!reportData) throw new Error('No report data found');

    const content = this.formatReportContent(reportData, 'pdf');

    return {
      filename: `${reportData.title}-${reportData.generatedAt.toISOString()}.pdf`,
      content
    };
  }

  /**
   * Export as Excel
   */
  async exportAsExcel(reportId: string): Promise<{ filename: string; sheets: any[] }> {
    const reportData = await this.getLatestReport(reportId);
    if (!reportData) throw new Error('No report data found');

    const sheets = [
      {
        name: 'Summary',
        data: this.formatSummarySheet(reportData)
      },
      {
        name: 'Metrics',
        data: this.formatMetricsSheet(reportData)
      },
      {
        name: 'Trends',
        data: this.formatTrendsSheet(reportData)
      }
    ];

    return {
      filename: `${reportData.title}-${reportData.generatedAt.toISOString()}.xlsx`,
      sheets
    };
  }

  // Helper methods
  private generateExecutiveSummary(report: Report): ExecutiveSummary {
    return {
      keyFindings: [
        'Revenue exceeded targets by 12%',
        'Customer retention improved to 94%',
        'Operational efficiency increased by 8%'
      ],
      performance: [
        { metric: 'Revenue', value: 250000, change: 12 },
        { metric: 'Bookings', value: 1250, change: 8 },
        { metric: 'Customer Satisfaction', value: 4.8, change: 5 }
      ],
      recommendations: [
        'Expand operations in high-demand markets',
        'Invest in driver training programs',
        'Optimize pricing strategy based on demand'
      ]
    };
  }

  private calculateMetrics(report: Report): MetricSection[] {
    return report.metrics.map(metric => ({
      name: metric,
      value: Math.floor(Math.random() * 100000),
      format: 'number',
      trend: Math.random() * 20 - 10,
      comparison: [
        { type: 'previous_period', value: Math.floor(Math.random() * 80000), change: Math.random() * 15 - 5 }
      ]
    }));
  }

  private calculateTrends(report: Report): TrendAnalysis[] {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return report.metrics.slice(0, 3).map(metric => ({
      metric,
      periods: months.map(month => ({
        period: month,
        value: Math.floor(Math.random() * 50000)
      })),
      trend: Math.random() > 0.5 ? 'up' : 'down',
      volatility: Math.random() * 0.3,
      forecast: Math.floor(Math.random() * 100000)
    }));
  }

  private getBenchmarkData(report: Report): BenchmarkData[] {
    return report.metrics.map(metric => ({
      metric,
      yourValue: Math.floor(Math.random() * 100000),
      industry: Math.floor(Math.random() * 80000),
      percentile: Math.floor(Math.random() * 100),
      peers: Math.floor(Math.random() * 75000)
    }));
  }

  private generateVisualizations(metrics: MetricSection[], trends: TrendAnalysis[]): any[] {
    return [
      {
        type: 'bar_chart',
        title: 'Key Metrics Overview',
        data: metrics
      },
      {
        type: 'line_chart',
        title: 'Trends',
        data: trends
      }
    ];
  }

  private calculateNextRun(schedule: ReportSchedule): Date {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);

    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    if (next <= now) {
      switch (schedule.frequency) {
        case 'daily':
          next.setDate(next.getDate() + 1);
          break;
        case 'weekly':
          next.setDate(next.getDate() + (schedule.dayOfWeek || 1));
          break;
        case 'monthly':
          next.setMonth(next.getMonth() + 1);
          if (schedule.dayOfMonth) next.setDate(schedule.dayOfMonth);
          break;
        case 'quarterly':
          next.setMonth(next.getMonth() + 3);
          break;
        case 'annually':
          next.setFullYear(next.getFullYear() + 1);
          break;
      }
    }

    return next;
  }

  private formatReportContent(reportData: ReportData, format: string): string {
    let content = `# ${reportData.title}\n\n`;
    content += `Generated: ${reportData.generatedAt.toISOString()}\n`;
    content += `Period: ${reportData.dateRange.start.toISOString()} to ${reportData.dateRange.end.toISOString()}\n\n`;

    content += '## Executive Summary\n';
    reportData.summary.keyFindings.forEach(finding => {
      content += `- ${finding}\n`;
    });

    content += '\n## Key Metrics\n';
    reportData.metrics.forEach(metric => {
      content += `- ${metric.name}: ${metric.value} (${metric.trend > 0 ? '+' : ''}${metric.trend.toFixed(1)}%)\n`;
    });

    return content;
  }

  private formatSummarySheet(reportData: ReportData): any[] {
    return [
      ['Key Findings'],
      ...reportData.summary.keyFindings.map(k => [k]),
      [],
      ['Metric', 'Value', 'Change'],
      ...reportData.summary.performance.map(p => [p.metric, p.value, `${p.change}%`])
    ];
  }

  private formatMetricsSheet(reportData: ReportData): any[] {
    return [
      ['Metric', 'Value', 'Trend'],
      ...reportData.metrics.map(m => [m.name, m.value, m.trend])
    ];
  }

  private formatTrendsSheet(reportData: ReportData): any[] {
    const rows: any[] = [['Metric', 'Period', 'Value']];
    reportData.trends.forEach(trend => {
      trend.periods.forEach(period => {
        rows.push([trend.metric, period.period, period.value]);
      });
    });
    return rows;
  }
}

import mongoose from 'mongoose';

interface ReportDefinition {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  dataSources: DataSource[];
  selectedMetrics: Metric[];
  selectedDimensions: Dimension[];
  filters: ReportFilter[];
  sorting: SortConfig[];
  grouping: GroupConfig[];
  aggregations: AggregationConfig[];
  drilldownPaths: DrilldownPath[];
  exportFormats: ExportFormat[];
  refreshInterval?: number;
  createdBy: string;
  lastModifiedBy: string;
  createdAt: Date;
  updatedAt: Date;
  isTemplate: boolean;
  tags?: string[];
}

interface DataSource {
  id: string;
  type: 'bookings' | 'vehicles' | 'drivers' | 'expenses' | 'revenue' | 'custom';
  name: string;
  description?: string;
  isSelected: boolean;
}

interface Metric {
  id: string;
  name: string;
  type: 'sum' | 'average' | 'count' | 'min' | 'max' | 'percentile' | 'stddev';
  field: string;
  label: string;
  format?: string;
}

interface Dimension {
  id: string;
  name: string;
  field: string;
  type: 'date' | 'category' | 'numeric' | 'text';
  format?: string;
  groupBy?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
}

interface ReportFilter {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'between' | 'contains';
  value: any;
  dataType: string;
}

interface SortConfig {
  fieldId: string;
  direction: 'asc' | 'desc';
  priority: number;
}

interface GroupConfig {
  fieldId: string;
  hierarchy?: number;
  subtotals: boolean;
}

interface AggregationConfig {
  metricId: string;
  aggregationType: 'sum' | 'average' | 'count' | 'distinct';
  groupByDimensionId?: string;
}

interface DrilldownPath {
  id: string;
  sourceField: string;
  targetDimension: string;
  targetMetrics: string[];
  label: string;
}

type ExportFormat = 'pdf' | 'excel' | 'csv' | 'json';

interface ReportData {
  reportId: string;
  data: any[];
  summary: {
    totalRows: number;
    executionTime: number;
    generatedAt: Date;
  };
  metadata: {
    columns: ColumnMetadata[];
    filters: ReportFilter[];
  };
}

interface ColumnMetadata {
  fieldId: string;
  label: string;
  type: string;
  format?: string;
}

interface ReportExecution {
  _id?: mongoose.Types.ObjectId;
  reportId: mongoose.Types.ObjectId;
  executedAt: Date;
  executedBy: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  resultPath?: string;
  exportedFormats: ExportFormat[];
  errorMessage?: string;
}

export class CustomReportBuilderService {
  private reports: Map<string, ReportDefinition> = new Map();
  private executions: Map<string, ReportExecution> = new Map();
  private reportData: Map<string, ReportData> = new Map();

  private readonly availableDataSources: DataSource[] = [
    { id: 'bookings', type: 'bookings', name: 'Bookings', description: 'Booking transaction data', isSelected: false },
    { id: 'vehicles', type: 'vehicles', name: 'Vehicles', description: 'Fleet vehicle data', isSelected: false },
    { id: 'drivers', type: 'drivers', name: 'Drivers', description: 'Driver information', isSelected: false },
    { id: 'expenses', type: 'expenses', name: 'Expenses', description: 'Expense tracking', isSelected: false },
    { id: 'revenue', type: 'revenue', name: 'Revenue', description: 'Revenue analytics', isSelected: false }
  ];

  /**
   * Create a new custom report definition
   */
  async createReport(
    tenantId: mongoose.Types.ObjectId,
    data: Partial<ReportDefinition>,
    userId: string
  ): Promise<ReportDefinition> {
    const report: ReportDefinition = {
      tenantId,
      name: data.name || 'New Report',
      description: data.description,
      dataSources: data.dataSources || [],
      selectedMetrics: data.selectedMetrics || [],
      selectedDimensions: data.selectedDimensions || [],
      filters: data.filters || [],
      sorting: data.sorting || [],
      grouping: data.grouping || [],
      aggregations: data.aggregations || [],
      drilldownPaths: data.drilldownPaths || [],
      exportFormats: data.exportFormats || ['csv'],
      refreshInterval: data.refreshInterval,
      createdBy: userId,
      lastModifiedBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      isTemplate: data.isTemplate || false,
      tags: data.tags || []
    };

    const id = new mongoose.Types.ObjectId().toString();
    this.reports.set(id, { ...report, _id: new mongoose.Types.ObjectId(id) });

    return report;
  }

  /**
   * Add data source to report
   */
  async addDataSource(reportId: string, dataSource: DataSource): Promise<ReportDefinition> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    report.dataSources.push(dataSource);
    report.updatedAt = new Date();
    this.reports.set(reportId, report);

    return report;
  }

  /**
   * Remove data source from report
   */
  async removeDataSource(reportId: string, sourceId: string): Promise<ReportDefinition> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    report.dataSources = report.dataSources.filter(ds => ds.id !== sourceId);
    report.updatedAt = new Date();
    this.reports.set(reportId, report);

    return report;
  }

  /**
   * Add metric to report
   */
  async addMetric(reportId: string, metric: Metric): Promise<ReportDefinition> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    report.selectedMetrics.push(metric);
    report.updatedAt = new Date();
    this.reports.set(reportId, report);

    return report;
  }

  /**
   * Remove metric from report
   */
  async removeMetric(reportId: string, metricId: string): Promise<ReportDefinition> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    report.selectedMetrics = report.selectedMetrics.filter(m => m.id !== metricId);
    report.updatedAt = new Date();
    this.reports.set(reportId, report);

    return report;
  }

  /**
   * Add dimension to report
   */
  async addDimension(reportId: string, dimension: Dimension): Promise<ReportDefinition> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    report.selectedDimensions.push(dimension);
    report.updatedAt = new Date();
    this.reports.set(reportId, report);

    return report;
  }

  /**
   * Configure filters for report
   */
  async applyFilters(reportId: string, filters: ReportFilter[]): Promise<ReportDefinition> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    report.filters = filters;
    report.updatedAt = new Date();
    this.reports.set(reportId, report);

    return report;
  }

  /**
   * Configure sorting
   */
  async applySorting(reportId: string, sorting: SortConfig[]): Promise<ReportDefinition> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    report.sorting = sorting.sort((a, b) => a.priority - b.priority);
    report.updatedAt = new Date();
    this.reports.set(reportId, report);

    return report;
  }

  /**
   * Configure grouping
   */
  async applyGrouping(reportId: string, grouping: GroupConfig[]): Promise<ReportDefinition> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    report.grouping = grouping;
    report.updatedAt = new Date();
    this.reports.set(reportId, report);

    return report;
  }

  /**
   * Configure aggregations
   */
  async applyAggregations(reportId: string, aggregations: AggregationConfig[]): Promise<ReportDefinition> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    report.aggregations = aggregations;
    report.updatedAt = new Date();
    this.reports.set(reportId, report);

    return report;
  }

  /**
   * Add drill-down path to report
   */
  async addDrilldownPath(reportId: string, path: DrilldownPath): Promise<ReportDefinition> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    report.drilldownPaths.push(path);
    report.updatedAt = new Date();
    this.reports.set(reportId, report);

    return report;
  }

  /**
   * Set export formats for report
   */
  async setExportFormats(reportId: string, formats: ExportFormat[]): Promise<ReportDefinition> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    report.exportFormats = formats;
    report.updatedAt = new Date();
    this.reports.set(reportId, report);

    return report;
  }

  /**
   * Generate report data (async background job)
   */
  async generateReport(reportId: string, userId: string): Promise<ReportExecution> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    const execution: ReportExecution = {
      reportId: report._id || new mongoose.Types.ObjectId(),
      executedAt: new Date(),
      executedBy: userId,
      status: 'pending',
      exportedFormats: []
    };

    const executionId = new mongoose.Types.ObjectId().toString();
    this.executions.set(executionId, { ...execution, _id: new mongoose.Types.ObjectId(executionId) });

    // Simulate async report generation
    setTimeout(() => {
      const data = this.simulateReportData(report);
      this.reportData.set(reportId, data);
      const exec = this.executions.get(executionId);
      if (exec) {
        exec.status = 'completed';
        exec.resultPath = `/reports/${reportId}/data`;
        exec.exportedFormats = report.exportFormats;
      }
    }, 100);

    return execution;
  }

  /**
   * Get report execution status
   */
  async getExecutionStatus(executionId: string): Promise<ReportExecution | null> {
    return this.executions.get(executionId) || null;
  }

  /**
   * Get generated report data
   */
  async getReportData(reportId: string): Promise<ReportData | null> {
    return this.reportData.get(reportId) || null;
  }

  /**
   * Export report to specified format
   */
  async exportReport(reportId: string, format: ExportFormat): Promise<{ url: string; format: ExportFormat }> {
    const data = this.reportData.get(reportId);
    if (!data) throw new Error('Report data not found');

    const url = `/reports/${reportId}/export/${format}`;

    return {
      url,
      format
    };
  }

  /**
   * Save report as template
   */
  async saveAsTemplate(reportId: string, templateName: string): Promise<ReportDefinition> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    const template: ReportDefinition = {
      ...report,
      _id: new mongoose.Types.ObjectId(),
      name: templateName,
      isTemplate: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const templateId = new mongoose.Types.ObjectId().toString();
    this.reports.set(templateId, template);

    return template;
  }

  /**
   * Create report from template
   */
  async createFromTemplate(
    tenantId: mongoose.Types.ObjectId,
    templateId: string,
    reportName: string,
    userId: string
  ): Promise<ReportDefinition> {
    const template = this.reports.get(templateId);
    if (!template) throw new Error('Template not found');

    return this.createReport(
      tenantId,
      {
        name: reportName,
        dataSources: template.dataSources,
        selectedMetrics: template.selectedMetrics,
        selectedDimensions: template.selectedDimensions,
        filters: template.filters,
        sorting: template.sorting,
        grouping: template.grouping,
        aggregations: template.aggregations,
        exportFormats: template.exportFormats
      },
      userId
    );
  }

  /**
   * Get available data sources
   */
  getAvailableDataSources(): DataSource[] {
    return this.availableDataSources;
  }

  /**
   * Get available metrics for a data source
   */
  getAvailableMetrics(dataSourceType: string): Metric[] {
    const metricsMap: Record<string, Metric[]> = {
      bookings: [
        { id: 'booking_count', name: 'Booking Count', type: 'count', field: '_id', label: 'Total Bookings' },
        { id: 'total_revenue', name: 'Total Revenue', type: 'sum', field: 'totalAmount', label: 'Revenue', format: 'currency' },
        { id: 'avg_value', name: 'Average Value', type: 'average', field: 'totalAmount', label: 'Avg Value', format: 'currency' },
        { id: 'booking_success_rate', name: 'Success Rate', type: 'average', field: 'status', label: 'Success Rate', format: 'percent' }
      ],
      vehicles: [
        { id: 'vehicle_count', name: 'Vehicle Count', type: 'count', field: '_id', label: 'Total Vehicles' },
        { id: 'utilization_rate', name: 'Utilization', type: 'average', field: 'utilizationRate', label: 'Avg Utilization', format: 'percent' },
        { id: 'maintenance_cost', name: 'Maintenance Cost', type: 'sum', field: 'maintenanceCost', label: 'Total Maintenance', format: 'currency' }
      ],
      drivers: [
        { id: 'driver_count', name: 'Driver Count', type: 'count', field: '_id', label: 'Total Drivers' },
        { id: 'avg_rating', name: 'Average Rating', type: 'average', field: 'rating', label: 'Avg Rating' },
        { id: 'active_drivers', name: 'Active Drivers', type: 'count', field: 'status', label: 'Active Count' }
      ]
    };

    return metricsMap[dataSourceType] || [];
  }

  /**
   * Get available dimensions
   */
  getAvailableDimensions(dataSourceType: string): Dimension[] {
    const dimensionsMap: Record<string, Dimension[]> = {
      bookings: [
        { id: 'date', name: 'Date', field: 'createdAt', type: 'date', groupBy: 'day', format: 'YYYY-MM-DD' },
        { id: 'status', name: 'Status', field: 'status', type: 'category' },
        { id: 'vehicle_type', name: 'Vehicle Type', field: 'vehicleType', type: 'category' }
      ],
      vehicles: [
        { id: 'vehicle_status', name: 'Vehicle Status', field: 'status', type: 'category' },
        { id: 'vehicle_type', name: 'Vehicle Type', field: 'type', type: 'category' }
      ]
    };

    return dimensionsMap[dataSourceType] || [];
  }

  /**
   * Get all reports for tenant
   */
  async getReports(tenantId: mongoose.Types.ObjectId): Promise<ReportDefinition[]> {
    return Array.from(this.reports.values()).filter(
      r => r.tenantId.equals(tenantId) && !r.isTemplate
    );
  }

  /**
   * Get report by ID
   */
  async getReport(reportId: string): Promise<ReportDefinition | null> {
    return this.reports.get(reportId) || null;
  }

  /**
   * Update report
   */
  async updateReport(reportId: string, updates: Partial<ReportDefinition>, userId: string): Promise<ReportDefinition> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error('Report not found');

    const updated = {
      ...report,
      ...updates,
      lastModifiedBy: userId,
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
    this.reportData.delete(reportId);
  }

  /**
   * Simulate report data generation
   */
  private simulateReportData(report: ReportDefinition): ReportData {
    const rows = Array.from({ length: 100 }, (_, i) => {
      const row: any = {};
      report.selectedDimensions.forEach((dim, idx) => {
        if (dim.type === 'date') {
          row[dim.field] = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000);
        } else if (dim.type === 'category') {
          row[dim.field] = ['Active', 'Inactive', 'Pending'][Math.floor(Math.random() * 3)];
        } else {
          row[dim.field] = Math.floor(Math.random() * 1000);
        }
      });

      report.selectedMetrics.forEach(metric => {
        row[metric.field] = Math.floor(Math.random() * 100000);
      });

      return row;
    });

    return {
      reportId: report._id?.toString() || '',
      data: rows,
      summary: {
        totalRows: rows.length,
        executionTime: Math.floor(Math.random() * 5000),
        generatedAt: new Date()
      },
      metadata: {
        columns: [
          ...report.selectedDimensions.map(d => ({
            fieldId: d.id,
            label: d.name,
            type: d.type
          })),
          ...report.selectedMetrics.map(m => ({
            fieldId: m.id,
            label: m.label,
            type: m.type
          }))
        ],
        filters: report.filters
      }
    };
  }
}

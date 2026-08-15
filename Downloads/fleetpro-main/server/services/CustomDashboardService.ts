import mongoose from 'mongoose';

interface Dashboard {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  isDefault: boolean;
  layout: LayoutConfig;
  widgets: Widget[];
  filters: CustomFilter[];
  refreshInterval: number; // in seconds
  isPublished: boolean;
  sharedWith?: string[]; // user IDs
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface LayoutConfig {
  columns: number;
  rows: number;
  gaps: { horizontal: number; vertical: number };
}

interface Widget {
  id: string;
  type: string;
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: WidgetConfig;
  dataSource: string;
  refreshInterval?: number;
  filters?: string[];
}

interface WidgetConfig {
  metricType: string;
  aggregation?: string;
  timeRange?: string;
  comparison?: boolean;
  customization?: Record<string, any>;
}

interface CustomFilter {
  id: string;
  name: string;
  type: 'select' | 'date_range' | 'number_range' | 'text';
  operators?: string[];
  defaultValue?: any;
  options?: { label: string; value: any }[];
}

interface SavedView {
  _id?: mongoose.Types.ObjectId;
  dashboardId: mongoose.Types.ObjectId;
  name: string;
  filterValues: Record<string, any>;
  createdBy: string;
  createdAt: Date;
}

interface ScheduledReport {
  _id?: mongoose.Types.ObjectId;
  dashboardId: mongoose.Types.ObjectId;
  name: string;
  recipients: string[];
  schedule: 'daily' | 'weekly' | 'monthly';
  format: 'pdf' | 'email' | 'slack';
  sendTime: string; // HH:mm
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
}

const WIDGET_TYPES = [
  'metric_card', 'line_chart', 'bar_chart', 'pie_chart', 'table', 'gauge',
  'heatmap', 'scatter', 'area_chart', 'number_stat', 'trend_indicator',
  'progress_bar', 'funnel', 'sankey', 'map', 'timeline', 'calendar_heatmap',
  'waterfall', 'radar', 'text_block', 'kpi_panel'
];

const DASHBOARD_TEMPLATES = [
  {
    name: 'Executive Summary',
    widgets: [
      { type: 'metric_card', title: 'Total Revenue', dataSource: 'bookings' },
      { type: 'metric_card', title: 'Active Bookings', dataSource: 'bookings' },
      { type: 'line_chart', title: 'Revenue Trend', dataSource: 'bookings' },
      { type: 'pie_chart', title: 'Booking Types', dataSource: 'bookings' }
    ]
  },
  {
    name: 'Operations Dashboard',
    widgets: [
      { type: 'metric_card', title: 'Fleet Status', dataSource: 'vehicles' },
      { type: 'table', title: 'Active Drivers', dataSource: 'drivers' },
      { type: 'bar_chart', title: 'Vehicle Utilization', dataSource: 'vehicles' },
      { type: 'heatmap', title: 'Peak Hours', dataSource: 'bookings' }
    ]
  },
  {
    name: 'Financial Performance',
    widgets: [
      { type: 'metric_card', title: 'Total Income', dataSource: 'bookings' },
      { type: 'metric_card', title: 'Total Expenses', dataSource: 'expenses' },
      { type: 'area_chart', title: 'Profit Margin', dataSource: 'bookings' },
      { type: 'waterfall', title: 'Revenue Breakdown', dataSource: 'bookings' }
    ]
  }
];

export class CustomDashboardService {
  private dashboards: Map<string, Dashboard> = new Map();
  private savedViews: Map<string, SavedView> = new Map();
  private scheduledReports: Map<string, ScheduledReport> = new Map();

  /**
   * Create a new custom dashboard
   */
  async createDashboard(
    tenantId: mongoose.Types.ObjectId,
    data: Partial<Dashboard>,
    userId: string
  ): Promise<Dashboard> {
    const dashboard: Dashboard = {
      tenantId,
      name: data.name || 'New Dashboard',
      description: data.description,
      isDefault: data.isDefault || false,
      layout: data.layout || { columns: 12, rows: 24, gaps: { horizontal: 16, vertical: 16 } },
      widgets: data.widgets || [],
      filters: data.filters || [],
      refreshInterval: data.refreshInterval || 60,
      isPublished: data.isPublished || false,
      sharedWith: data.sharedWith || [],
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const id = new mongoose.Types.ObjectId().toString();
    this.dashboards.set(id, dashboard);

    return dashboard;
  }

  /**
   * Update dashboard configuration
   */
  async updateDashboard(
    dashboardId: string,
    data: Partial<Dashboard>
  ): Promise<Dashboard> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) throw new Error('Dashboard not found');

    const updated = {
      ...dashboard,
      ...data,
      updatedAt: new Date()
    };

    this.dashboards.set(dashboardId, updated);
    return updated;
  }

  /**
   * Add widget to dashboard
   */
  async addWidget(
    dashboardId: string,
    widget: Widget
  ): Promise<Dashboard> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) throw new Error('Dashboard not found');

    dashboard.widgets.push(widget);
    this.dashboards.set(dashboardId, dashboard);

    return dashboard;
  }

  /**
   * Remove widget from dashboard
   */
  async removeWidget(
    dashboardId: string,
    widgetId: string
  ): Promise<Dashboard> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) throw new Error('Dashboard not found');

    dashboard.widgets = dashboard.widgets.filter(w => w.id !== widgetId);
    this.dashboards.set(dashboardId, dashboard);

    return dashboard;
  }

  /**
   * Update widget configuration
   */
  async updateWidget(
    dashboardId: string,
    widgetId: string,
    config: Partial<Widget>
  ): Promise<Widget> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) throw new Error('Dashboard not found');

    const widget = dashboard.widgets.find(w => w.id === widgetId);
    if (!widget) throw new Error('Widget not found');

    Object.assign(widget, config);
    this.dashboards.set(dashboardId, dashboard);

    return widget;
  }

  /**
   * Get widget library with all available widget types
   */
  getWidgetLibrary(): Record<string, any> {
    return {
      types: WIDGET_TYPES,
      widgets: {
        metric_card: {
          name: 'Metric Card',
          description: 'Display single metric value',
          defaultSize: { w: 3, h: 2 },
          configOptions: ['numberFormat', 'compareTooltip', 'sparkline']
        },
        line_chart: {
          name: 'Line Chart',
          description: 'Time series line visualization',
          defaultSize: { w: 6, h: 4 },
          configOptions: ['xAxis', 'yAxis', 'legend', 'tooltip']
        },
        bar_chart: {
          name: 'Bar Chart',
          description: 'Categorical bar visualization',
          defaultSize: { w: 6, h: 4 },
          configOptions: ['orientation', 'stacked', 'grouping']
        },
        pie_chart: {
          name: 'Pie Chart',
          description: 'Proportional pie/donut chart',
          defaultSize: { w: 4, h: 4 },
          configOptions: ['donut', 'innerRadius', 'legend']
        },
        table: {
          name: 'Data Table',
          description: 'Interactive data table',
          defaultSize: { w: 8, h: 4 },
          configOptions: ['sortable', 'filterable', 'pagination']
        },
        gauge: {
          name: 'Gauge Chart',
          description: 'Progress gauge visualization',
          defaultSize: { w: 3, h: 3 },
          configOptions: ['min', 'max', 'thresholds']
        },
        heatmap: {
          name: 'Heatmap',
          description: 'Density heatmap visualization',
          defaultSize: { w: 6, h: 4 },
          configOptions: ['colorScale', 'cellSize']
        },
        area_chart: {
          name: 'Area Chart',
          description: 'Stacked area chart',
          defaultSize: { w: 6, h: 4 },
          configOptions: ['stacked', 'smooth', 'fillOpacity']
        },
        kpi_panel: {
          name: 'KPI Panel',
          description: 'Multiple KPIs with trends',
          defaultSize: { w: 6, h: 3 },
          configOptions: ['layout', 'trendIndicator', 'comparison']
        }
      }
    };
  }

  /**
   * Add filter to dashboard
   */
  async addFilter(
    dashboardId: string,
    filter: CustomFilter
  ): Promise<Dashboard> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) throw new Error('Dashboard not found');

    dashboard.filters.push(filter);
    this.dashboards.set(dashboardId, dashboard);

    return dashboard;
  }

  /**
   * Remove filter from dashboard
   */
  async removeFilter(
    dashboardId: string,
    filterId: string
  ): Promise<Dashboard> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) throw new Error('Dashboard not found');

    dashboard.filters = dashboard.filters.filter(f => f.id !== filterId);
    this.dashboards.set(dashboardId, dashboard);

    return dashboard;
  }

  /**
   * Save current view/filter state
   */
  async saveView(
    dashboardId: string,
    name: string,
    filterValues: Record<string, any>,
    userId: string
  ): Promise<SavedView> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) throw new Error('Dashboard not found');

    const view: SavedView = {
      dashboardId: dashboard._id || new mongoose.Types.ObjectId(),
      name,
      filterValues,
      createdBy: userId,
      createdAt: new Date()
    };

    const viewId = new mongoose.Types.ObjectId().toString();
    this.savedViews.set(viewId, view);

    return view;
  }

  /**
   * Get saved views
   */
  async getSavedViews(dashboardId: string): Promise<SavedView[]> {
    return Array.from(this.savedViews.values()).filter(
      v => v.dashboardId.toString() === dashboardId
    );
  }

  /**
   * Load saved view
   */
  async loadView(viewId: string): Promise<SavedView | null> {
    return this.savedViews.get(viewId) || null;
  }

  /**
   * Share dashboard with users
   */
  async shareDashboard(
    dashboardId: string,
    userIds: string[],
    readOnly: boolean = true
  ): Promise<Dashboard> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) throw new Error('Dashboard not found');

    dashboard.sharedWith = [...new Set([...(dashboard.sharedWith || []), ...userIds])];
    this.dashboards.set(dashboardId, dashboard);

    return dashboard;
  }

  /**
   * Schedule dashboard report
   */
  async scheduleReport(
    dashboardId: string,
    report: Partial<ScheduledReport>,
    userId: string
  ): Promise<ScheduledReport> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) throw new Error('Dashboard not found');

    const scheduled: ScheduledReport = {
      dashboardId: dashboard._id || new mongoose.Types.ObjectId(),
      name: report.name || 'Scheduled Report',
      recipients: report.recipients || [],
      schedule: report.schedule || 'daily',
      format: report.format || 'email',
      sendTime: report.sendTime || '09:00',
      isActive: report.isActive !== false,
      createdBy: userId,
      createdAt: new Date()
    };

    const reportId = new mongoose.Types.ObjectId().toString();
    this.scheduledReports.set(reportId, scheduled);

    return scheduled;
  }

  /**
   * Get scheduled reports for dashboard
   */
  async getScheduledReports(dashboardId: string): Promise<ScheduledReport[]> {
    return Array.from(this.scheduledReports.values()).filter(
      r => r.dashboardId.toString() === dashboardId
    );
  }

  /**
   * Get dashboard templates
   */
  getDashboardTemplates(): typeof DASHBOARD_TEMPLATES {
    return DASHBOARD_TEMPLATES;
  }

  /**
   * Create dashboard from template
   */
  async createFromTemplate(
    tenantId: mongoose.Types.ObjectId,
    templateName: string,
    userId: string
  ): Promise<Dashboard> {
    const template = DASHBOARD_TEMPLATES.find(t => t.name === templateName);
    if (!template) throw new Error('Template not found');

    const widgets: Widget[] = template.widgets.map((w, idx) => ({
      id: new mongoose.Types.ObjectId().toString(),
      type: w.type,
      title: w.title,
      position: {
        x: (idx % 2) * 6,
        y: Math.floor(idx / 2) * 4,
        w: 6,
        h: 4
      },
      config: { metricType: w.dataSource },
      dataSource: w.dataSource
    }));

    return this.createDashboard(
      tenantId,
      {
        name: templateName,
        description: `Dashboard based on ${templateName} template`,
        widgets,
        isPublished: true
      },
      userId
    );
  }

  /**
   * Get dashboard by ID
   */
  async getDashboard(dashboardId: string): Promise<Dashboard | null> {
    return this.dashboards.get(dashboardId) || null;
  }

  /**
   * List user dashboards
   */
  async getDashboards(tenantId: mongoose.Types.ObjectId): Promise<Dashboard[]> {
    return Array.from(this.dashboards.values()).filter(
      d => d.tenantId.equals(tenantId)
    );
  }

  /**
   * Delete dashboard
   */
  async deleteDashboard(dashboardId: string): Promise<void> {
    this.dashboards.delete(dashboardId);
    // Also delete associated views and reports
    for (const [id, view] of this.savedViews) {
      if (view.dashboardId.toString() === dashboardId) {
        this.savedViews.delete(id);
      }
    }
    for (const [id, report] of this.scheduledReports) {
      if (report.dashboardId.toString() === dashboardId) {
        this.scheduledReports.delete(id);
      }
    }
  }

  /**
   * Get widget data with filters applied
   */
  async getWidgetData(
    widget: Widget,
    filters: Record<string, any>
  ): Promise<any> {
    // Simulate data fetching based on widget type and data source
    return {
      widget: widget.id,
      title: widget.title,
      data: this.generateMockData(widget.type),
      filters: filters,
      timestamp: new Date()
    };
  }

  /**
   * Generate mock data for different widget types
   */
  private generateMockData(widgetType: string): any {
    switch (widgetType) {
      case 'metric_card':
        return { value: Math.floor(Math.random() * 100000), trend: '+12%' };
      case 'line_chart':
        return Array.from({ length: 12 }, (_, i) => ({
          month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
          value: Math.floor(Math.random() * 50000)
        }));
      case 'bar_chart':
        return Array.from({ length: 5 }, (_, i) => ({
          category: `Category ${i + 1}`,
          value: Math.floor(Math.random() * 10000)
        }));
      case 'pie_chart':
        return Array.from({ length: 4 }, (_, i) => ({
          name: `Segment ${i + 1}`,
          value: Math.floor(Math.random() * 30)
        }));
      case 'table':
        return Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          name: `Item ${i + 1}`,
          value: Math.floor(Math.random() * 10000),
          status: ['active', 'inactive', 'pending'][Math.floor(Math.random() * 3)]
        }));
      default:
        return { data: 'Mock data' };
    }
  }
}

import mongoose from 'mongoose';

interface ReportTemplate {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  templateId: string;
  name: string;
  description?: string;
  category: 'financial' | 'operational' | 'analytics' | 'custom';
  sections: ReportSection[];
  branding: {
    logoUrl?: string;
    headerText: string;
    footerText: string;
    primaryColor: string;
    accentColor: string;
  };
  chartConfigs: ChartConfig[];
  multiLanguage: {
    defaultLanguage: string;
    translations: Record<string, Record<string, string>>;
  };
  scheduling?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number; // 0-6
    dayOfMonth?: number; // 1-31
    time: string; // HH:mm
  };
  distribution?: {
    recipients: string[]; // email addresses
    format: 'pdf' | 'email' | 'slack';
    attachPDF: boolean;
  };
  approvalWorkflow?: {
    requiresApproval: boolean;
    approvers: string[]; // user IDs
    reviewComments?: string;
  };
  watermark?: {
    enabled: boolean;
    text: string;
    opacity: number;
    rotation: number;
  };
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ReportSection {
  sectionId: string;
  title: string;
  type: 'summary' | 'detailed' | 'chart' | 'table' | 'custom';
  content?: string;
  chartId?: string;
  tableConfig?: {
    columns: string[];
    dataSource: string;
  };
  displayOrder: number;
}

interface ChartConfig {
  chartId: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'heatmap';
  dataSource: string;
  xAxis?: string;
  yAxis?: string;
  dimension?: string;
  metric?: string;
  colors?: string[];
  options?: Record<string, any>;
}

interface GeneratedReport {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  reportId: string;
  templateId: string;
  templateName: string;
  generatedAt: Date;
  generatedBy: string;
  dateRange: { startDate: Date; endDate: Date };
  language: string;
  status: 'draft' | 'approved' | 'published';
  content: string;
  pdfUrl?: string;
  signature?: {
    signedBy: string;
    signedAt: Date;
    approvalNotes?: string;
  };
}

export class ReportTemplateService {
  private templates: Map<string, ReportTemplate[]> = new Map();
  private generatedReports: Map<string, GeneratedReport[]> = new Map();
  private templateVersions: Map<string, ReportTemplate[][]> = new Map();

  /**
   * Create report template
   */
  async createTemplate(
    tenantId: mongoose.Types.ObjectId,
    template: Omit<ReportTemplate, '_id' | 'createdAt' | 'updatedAt' | 'templateId'>
  ): Promise<ReportTemplate> {
    const templateId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tenantIdStr = tenantId.toString();

    const newTemplate: ReportTemplate = {
      ...template,
      tenantId,
      templateId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!this.templates.has(tenantIdStr)) {
      this.templates.set(tenantIdStr, []);
    }

    this.templates.get(tenantIdStr)!.push(newTemplate);

    // Initialize version history
    if (!this.templateVersions.has(tenantIdStr)) {
      this.templateVersions.set(tenantIdStr, []);
    }
    this.templateVersions.get(tenantIdStr)!.push([newTemplate]);

    return newTemplate;
  }

  /**
   * Get templates
   */
  async getTemplates(tenantId: mongoose.Types.ObjectId): Promise<ReportTemplate[]> {
    return this.templates.get(tenantId.toString()) || [];
  }

  /**
   * Get template by ID
   */
  async getTemplate(tenantId: mongoose.Types.ObjectId, templateId: string): Promise<ReportTemplate> {
    const templates = this.templates.get(tenantId.toString());

    if (!templates) {
      throw new Error('Templates not found');
    }

    const template = templates.find(t => t.templateId === templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    return template;
  }

  /**
   * Update template
   */
  async updateTemplate(
    tenantId: mongoose.Types.ObjectId,
    templateId: string,
    updates: Partial<ReportTemplate>
  ): Promise<ReportTemplate> {
    const template = await this.getTemplate(tenantId, templateId);

    Object.assign(template, updates);
    template.updatedAt = new Date();

    // Store version
    const versions = this.templateVersions.get(tenantId.toString());
    if (versions) {
      const versionArray = versions.find(v => v[0].templateId === templateId);
      if (versionArray) {
        versionArray.push(template);
      }
    }

    return template;
  }

  /**
   * Add section to template
   */
  async addSection(
    tenantId: mongoose.Types.ObjectId,
    templateId: string,
    section: ReportSection
  ): Promise<ReportTemplate> {
    const template = await this.getTemplate(tenantId, templateId);

    template.sections.push(section);
    template.updatedAt = new Date();

    return template;
  }

  /**
   * Update template branding
   */
  async updateBranding(
    tenantId: mongoose.Types.ObjectId,
    templateId: string,
    branding: Partial<ReportTemplate['branding']>
  ): Promise<ReportTemplate['branding']> {
    const template = await this.getTemplate(tenantId, templateId);

    template.branding = {
      ...template.branding,
      ...branding
    };
    template.updatedAt = new Date();

    return template.branding;
  }

  /**
   * Configure watermark
   */
  async configureWatermark(
    tenantId: mongoose.Types.ObjectId,
    templateId: string,
    watermark: Partial<ReportTemplate['watermark']>
  ): Promise<ReportTemplate['watermark']> {
    const template = await this.getTemplate(tenantId, templateId);

    template.watermark = {
      ...template.watermark,
      ...watermark
    };
    template.updatedAt = new Date();

    return template.watermark!;
  }

  /**
   * Setup scheduling
   */
  async setupScheduling(
    tenantId: mongoose.Types.ObjectId,
    templateId: string,
    scheduling: Partial<ReportTemplate['scheduling']>
  ): Promise<ReportTemplate['scheduling']> {
    const template = await this.getTemplate(tenantId, templateId);

    template.scheduling = {
      ...template.scheduling,
      ...scheduling
    };
    template.updatedAt = new Date();

    return template.scheduling!;
  }

  /**
   * Setup distribution
   */
  async setupDistribution(
    tenantId: mongoose.Types.ObjectId,
    templateId: string,
    distribution: Partial<ReportTemplate['distribution']>
  ): Promise<ReportTemplate['distribution']> {
    const template = await this.getTemplate(tenantId, templateId);

    template.distribution = {
      ...template.distribution,
      ...distribution
    };
    template.updatedAt = new Date();

    return template.distribution!;
  }

  /**
   * Setup approval workflow
   */
  async setupApprovalWorkflow(
    tenantId: mongoose.Types.ObjectId,
    templateId: string,
    workflow: Partial<ReportTemplate['approvalWorkflow']>
  ): Promise<ReportTemplate['approvalWorkflow']> {
    const template = await this.getTemplate(tenantId, templateId);

    template.approvalWorkflow = {
      ...template.approvalWorkflow,
      ...workflow
    };
    template.updatedAt = new Date();

    return template.approvalWorkflow!;
  }

  /**
   * Generate report from template
   */
  async generateReport(
    tenantId: mongoose.Types.ObjectId,
    templateId: string,
    dateRange: { startDate: Date; endDate: Date },
    language: string = 'en',
    userId: string
  ): Promise<GeneratedReport> {
    const template = await this.getTemplate(tenantId, templateId);
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tenantIdStr = tenantId.toString();

    // Generate content (mock implementation)
    const content = this.generateReportContent(template, dateRange, language);

    const report: GeneratedReport = {
      tenantId,
      reportId,
      templateId,
      templateName: template.name,
      generatedAt: new Date(),
      generatedBy: userId,
      dateRange,
      language,
      status: template.approvalWorkflow?.requiresApproval ? 'draft' : 'published',
      content
    };

    if (!this.generatedReports.has(tenantIdStr)) {
      this.generatedReports.set(tenantIdStr, []);
    }

    this.generatedReports.get(tenantIdStr)!.push(report);

    return report;
  }

  /**
   * Approve report
   */
  async approveReport(
    tenantId: mongoose.Types.ObjectId,
    reportId: string,
    approverUserId: string,
    notes?: string
  ): Promise<GeneratedReport> {
    const reports = this.generatedReports.get(tenantId.toString());

    if (!reports) {
      throw new Error('Reports not found');
    }

    const report = reports.find(r => r.reportId === reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    report.status = 'approved';
    report.signature = {
      signedBy: approverUserId,
      signedAt: new Date(),
      approvalNotes: notes
    };

    return report;
  }

  /**
   * Get generated reports
   */
  async getGeneratedReports(tenantId: mongoose.Types.ObjectId): Promise<GeneratedReport[]> {
    return this.generatedReports.get(tenantId.toString()) || [];
  }

  /**
   * Add chart to template
   */
  async addChart(
    tenantId: mongoose.Types.ObjectId,
    templateId: string,
    chart: ChartConfig
  ): Promise<ReportTemplate> {
    const template = await this.getTemplate(tenantId, templateId);

    template.chartConfigs.push(chart);
    template.updatedAt = new Date();

    return template;
  }

  /**
   * Clone template
   */
  async cloneTemplate(
    tenantId: mongoose.Types.ObjectId,
    templateId: string,
    newName: string
  ): Promise<ReportTemplate> {
    const source = await this.getTemplate(tenantId, templateId);

    return this.createTemplate(tenantId, {
      name: newName,
      description: `Clone of ${source.name}`,
      category: source.category,
      sections: [...source.sections],
      branding: { ...source.branding },
      chartConfigs: [...source.chartConfigs],
      multiLanguage: { ...source.multiLanguage },
      scheduling: source.scheduling,
      distribution: source.distribution,
      approvalWorkflow: source.approvalWorkflow,
      watermark: source.watermark,
      isActive: true,
      createdBy: source.createdBy
    });
  }

  /**
   * Delete template
   */
  async deleteTemplate(tenantId: mongoose.Types.ObjectId, templateId: string): Promise<boolean> {
    const templates = this.templates.get(tenantId.toString());

    if (!templates) return false;

    const initialLength = templates.length;
    const filtered = templates.filter(t => t.templateId !== templateId);
    this.templates.set(tenantId.toString(), filtered);

    return filtered.length < initialLength;
  }

  /**
   * Generate mock report content
   */
  private generateReportContent(
    template: ReportTemplate,
    dateRange: { startDate: Date; endDate: Date },
    language: string
  ): string {
    const translations = template.multiLanguage.translations[language] || {};

    let content = `
      <html>
        <head><title>${template.name}</title></head>
        <body>
          <header style="background-color: ${template.branding.primaryColor}">
            ${template.branding.logoUrl ? `<img src="${template.branding.logoUrl}" />` : ''}
            <h1>${translations[template.branding.headerText] || template.branding.headerText}</h1>
          </header>
          <main>
            <h2>${template.name}</h2>
            <p>Date Range: ${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}</p>
    `;

    // Add sections
    template.sections.forEach(section => {
      content += `<section><h3>${translations[section.title] || section.title}</h3>`;

      if (section.content) {
        content += `<p>${section.content}</p>`;
      }

      content += `</section>`;
    });

    content += `
          </main>
          <footer style="background-color: #f3f4f6">
            <p>${template.branding.footerText}</p>
          </footer>
        </body>
      </html>
    `;

    return content;
  }
}

import mongoose from 'mongoose';
import { CompliancePolicy, DataRetention } from '../models/index';

export interface CompliancePolicyRequest {
  tenantId: string;
  policyName: string;
  description: string;
  framework: 'GDPR' | 'CCPA' | 'HIPAA' | 'SOC2' | 'ISO27001' | 'CUSTOM';
  requirements: string[];
  status: 'draft' | 'active' | 'archived';
  effectiveDate: Date;
  expiryDate?: Date;
}

export interface DataRetentionRequest {
  tenantId: string;
  dataType: string;
  retentionDays: number;
  autoDelete: boolean;
  archiveBeforeDelete: boolean;
  purpose: string;
}

class ComplianceService {
  async createPolicy(request: CompliancePolicyRequest): Promise<any> {
    try {
      const policy = new CompliancePolicy({
        tenantId: new mongoose.Types.ObjectId(request.tenantId),
        policyName: request.policyName,
        description: request.description,
        framework: request.framework,
        requirements: request.requirements,
        status: request.status,
        effectiveDate: request.effectiveDate,
        expiryDate: request.expiryDate,
      });

      await policy.save();
      return policy;
    } catch (error) {
      console.error('Failed to create compliance policy:', error);
      throw error;
    }
  }

  async getPolicies(tenantId: string): Promise<any[]> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const policies = await CompliancePolicy.find({
        tenantId: tenantObjectId,
      }).lean();

      return policies;
    } catch (error) {
      console.error('Failed to get compliance policies:', error);
      throw error;
    }
  }

  async getPoliciesByFramework(tenantId: string, framework: string): Promise<any[]> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const policies = await CompliancePolicy.find({
        tenantId: tenantObjectId,
        framework,
        status: 'active',
      }).lean();

      return policies;
    } catch (error) {
      console.error('Failed to get policies by framework:', error);
      throw error;
    }
  }

  async setDataRetention(request: DataRetentionRequest): Promise<any> {
    try {
      const retention = new DataRetention({
        tenantId: new mongoose.Types.ObjectId(request.tenantId),
        dataType: request.dataType,
        retentionDays: request.retentionDays,
        autoDelete: request.autoDelete,
        archiveBeforeDelete: request.archiveBeforeDelete,
        purpose: request.purpose,
      });

      await retention.save();
      return retention;
    } catch (error) {
      console.error('Failed to set data retention:', error);
      throw error;
    }
  }

  async getRetentionPolicy(tenantId: string, dataType: string): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const retention = await DataRetention.findOne({
        tenantId: tenantObjectId,
        dataType,
      }).lean();

      return retention;
    } catch (error) {
      console.error('Failed to get retention policy:', error);
      throw error;
    }
  }

  async getAllRetentionPolicies(tenantId: string): Promise<any[]> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const policies = await DataRetention.find({
        tenantId: tenantObjectId,
      }).lean();

      return policies;
    } catch (error) {
      console.error('Failed to get retention policies:', error);
      throw error;
    }
  }

  async generateGDPRReport(tenantId: string, userId: string): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const userObjectId = new mongoose.Types.ObjectId(userId);

      return {
        requestId: new mongoose.Types.ObjectId(),
        userId: userObjectId,
        tenantId: tenantObjectId,
        requestType: 'GDPR_DATA_EXPORT',
        status: 'pending',
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        dataIncluded: [
          'profile_data',
          'transaction_history',
          'communication_logs',
          'activity_logs',
          'file_uploads',
        ],
      };
    } catch (error) {
      console.error('Failed to generate GDPR report:', error);
      throw error;
    }
  }

  async generateSOC2Report(tenantId: string): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const policies = await CompliancePolicy.find({
        tenantId: tenantObjectId,
        framework: 'SOC2',
        status: 'active',
      }).lean();

      return {
        reportId: new mongoose.Types.ObjectId(),
        tenantId: tenantObjectId,
        reportType: 'SOC2_COMPLIANCE',
        framework: 'SOC2 Type II',
        trustPrinciples: [
          'CC - Security',
          'A - Availability',
          'P - Processing Integrity',
          'C - Confidentiality',
          'PI - Privacy',
        ],
        controlAreas: [
          'Access Control',
          'Encryption',
          'Audit Logging',
          'Incident Response',
          'Change Management',
          'Disaster Recovery',
        ],
        policies: policies.length,
        generatedAt: new Date(),
        auditScope: 'Full infrastructure and data processing',
      };
    } catch (error) {
      console.error('Failed to generate SOC2 report:', error);
      throw error;
    }
  }

  async generateCCPAReport(tenantId: string): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      return {
        reportId: new mongoose.Types.ObjectId(),
        tenantId: tenantObjectId,
        reportType: 'CCPA_COMPLIANCE',
        framework: 'CCPA/CPRA',
        requirements: [
          'Right to Know',
          'Right to Delete',
          'Right to Opt-Out',
          'Right to Non-Discrimination',
        ],
        dataCategories: [
          'Identifiers',
          'Commercial Information',
          'Biometric Information',
          'Internet Activity',
          'Geolocation Data',
          'Professional Information',
        ],
        disclosures: {
          dataCategoryCount: 6,
          businessPurposes: 5,
          thirdPartyShares: 3,
        },
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Failed to generate CCPA report:', error);
      throw error;
    }
  }

  async checkComplianceStatus(tenantId: string): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const policies = await CompliancePolicy.find({
        tenantId: tenantObjectId,
      }).lean();

      const activePolicies = policies.filter((p: any) => p.status === 'active');
      const frameworks = [...new Set(policies.map((p: any) => p.framework))];

      const retentionPolicies = await DataRetention.find({
        tenantId: tenantObjectId,
      }).lean();

      return {
        tenantId: tenantObjectId,
        complianceScore: Math.min(100, (activePolicies.length / (policies.length || 1)) * 100),
        totalPolicies: policies.length,
        activePolicies: activePolicies.length,
        frameworksCovered: frameworks,
        dataRetentionPolicies: retentionPolicies.length,
        lastReview: new Date(),
        status: activePolicies.length > 0 ? 'compliant' : 'non-compliant',
      };
    } catch (error) {
      console.error('Failed to check compliance status:', error);
      throw error;
    }
  }
}

export const complianceService = new ComplianceService();

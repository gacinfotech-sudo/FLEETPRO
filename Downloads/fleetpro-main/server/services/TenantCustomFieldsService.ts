import mongoose from 'mongoose';

type FieldType = 'text' | 'number' | 'date' | 'dropdown' | 'multi_select' | 'checkbox' | 'email' | 'phone' | 'textarea' | 'url';

interface CustomField {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  fieldId: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  description?: string;
  placeholder?: string;
  defaultValue?: any;
  options?: Array<{ label: string; value: any }>;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    customRules?: string[];
  };
  conditional?: {
    dependsOn: string;
    condition: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
    value: any;
    show: boolean;
  };
  permissions?: {
    read: string[]; // role IDs
    write: string[];
  };
  displayOrder: number;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CustomFieldSchema {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  schemaName: string;
  description?: string;
  fields: CustomField[];
  version: number;
  isPublished: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CustomFieldValue {
  _id?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  entityId: string;
  entityType: string; // e.g., 'vehicle', 'driver', 'booking'
  fieldId: string;
  value: any;
  createdAt: Date;
  updatedAt: Date;
}

interface FieldDefinitionExport {
  fields: CustomField[];
  schemaVersion: number;
  exportDate: Date;
}

export class TenantCustomFieldsService {
  private customFields: Map<string, CustomField[]> = new Map();
  private customSchemas: Map<string, CustomFieldSchema[]> = new Map();
  private customValues: Map<string, CustomFieldValue[]> = new Map();

  /**
   * Create a custom field
   */
  async createField(
    tenantId: mongoose.Types.ObjectId,
    field: Omit<CustomField, '_id' | 'createdAt' | 'updatedAt' | 'fieldId'>
  ): Promise<CustomField> {
    const fieldId = `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tenantIdStr = tenantId.toString();

    const customField: CustomField = {
      ...field,
      fieldId,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!this.customFields.has(tenantIdStr)) {
      this.customFields.set(tenantIdStr, []);
    }

    this.customFields.get(tenantIdStr)!.push(customField);
    return customField;
  }

  /**
   * Update a custom field
   */
  async updateField(
    tenantId: mongoose.Types.ObjectId,
    fieldId: string,
    updates: Partial<CustomField>
  ): Promise<CustomField> {
    const tenantIdStr = tenantId.toString();
    const fields = this.customFields.get(tenantIdStr);

    if (!fields) {
      throw new Error('Tenant fields not found');
    }

    const field = fields.find(f => f.fieldId === fieldId);
    if (!field) {
      throw new Error('Field not found');
    }

    Object.assign(field, updates);
    field.updatedAt = new Date();

    return field;
  }

  /**
   * Delete a custom field
   */
  async deleteField(tenantId: mongoose.Types.ObjectId, fieldId: string): Promise<boolean> {
    const tenantIdStr = tenantId.toString();
    const fields = this.customFields.get(tenantIdStr);

    if (!fields) return false;

    const initialLength = fields.length;
    const filtered = fields.filter(f => f.fieldId !== fieldId);
    this.customFields.set(tenantIdStr, filtered);

    return filtered.length < initialLength;
  }

  /**
   * Get all custom fields for tenant
   */
  async getFields(tenantId: mongoose.Types.ObjectId): Promise<CustomField[]> {
    return this.customFields.get(tenantId.toString()) || [];
  }

  /**
   * Get field by ID
   */
  async getField(tenantId: mongoose.Types.ObjectId, fieldId: string): Promise<CustomField> {
    const fields = this.customFields.get(tenantId.toString());

    if (!fields) {
      throw new Error('Tenant fields not found');
    }

    const field = fields.find(f => f.fieldId === fieldId);
    if (!field) {
      throw new Error('Field not found');
    }

    return field;
  }

  /**
   * Validate field value
   */
  async validateFieldValue(
    tenantId: mongoose.Types.ObjectId,
    fieldId: string,
    value: any
  ): Promise<{ valid: boolean; errors: string[] }> {
    const field = await this.getField(tenantId, fieldId);
    const errors: string[] = [];

    // Required check
    if (field.required && (value === null || value === undefined || value === '')) {
      errors.push(`${field.label} is required`);
    }

    if (value === null || value === undefined) {
      return { valid: errors.length === 0, errors };
    }

    // Type validation
    switch (field.type) {
      case 'number':
        if (isNaN(Number(value))) {
          errors.push(`${field.label} must be a number`);
        } else {
          const num = Number(value);
          if (field.validation?.min !== undefined && num < field.validation.min) {
            errors.push(`${field.label} must be at least ${field.validation.min}`);
          }
          if (field.validation?.max !== undefined && num > field.validation.max) {
            errors.push(`${field.label} must be at most ${field.validation.max}`);
          }
        }
        break;

      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push(`${field.label} must be a valid email`);
        }
        break;

      case 'phone':
        if (!/^\d{10,15}$/.test(String(value).replace(/\D/g, ''))) {
          errors.push(`${field.label} must be a valid phone number`);
        }
        break;

      case 'url':
        try {
          new URL(value);
        } catch {
          errors.push(`${field.label} must be a valid URL`);
        }
        break;

      case 'date':
        if (isNaN(new Date(value).getTime())) {
          errors.push(`${field.label} must be a valid date`);
        }
        break;

      case 'text':
      case 'textarea':
        if (field.validation?.minLength && value.length < field.validation.minLength) {
          errors.push(`${field.label} must be at least ${field.validation.minLength} characters`);
        }
        if (field.validation?.maxLength && value.length > field.validation.maxLength) {
          errors.push(`${field.label} must be at most ${field.validation.maxLength} characters`);
        }
        if (field.validation?.pattern) {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(value)) {
            errors.push(`${field.label} format is invalid`);
          }
        }
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Create custom field schema
   */
  async createSchema(
    tenantId: mongoose.Types.ObjectId,
    schema: Omit<CustomFieldSchema, '_id' | 'createdAt' | 'updatedAt' | 'version'>
  ): Promise<CustomFieldSchema> {
    const tenantIdStr = tenantId.toString();

    const customSchema: CustomFieldSchema = {
      ...schema,
      tenantId,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!this.customSchemas.has(tenantIdStr)) {
      this.customSchemas.set(tenantIdStr, []);
    }

    this.customSchemas.get(tenantIdStr)!.push(customSchema);
    return customSchema;
  }

  /**
   * Get custom schemas
   */
  async getSchemas(tenantId: mongoose.Types.ObjectId): Promise<CustomFieldSchema[]> {
    return this.customSchemas.get(tenantId.toString()) || [];
  }

  /**
   * Store custom field value
   */
  async setFieldValue(
    tenantId: mongoose.Types.ObjectId,
    entityId: string,
    entityType: string,
    fieldId: string,
    value: any
  ): Promise<CustomFieldValue> {
    const tenantIdStr = tenantId.toString();

    // Validate first
    const validation = await this.validateFieldValue(tenantId, fieldId, value);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    if (!this.customValues.has(tenantIdStr)) {
      this.customValues.set(tenantIdStr, []);
    }

    const values = this.customValues.get(tenantIdStr)!;
    const existing = values.find(v => v.entityId === entityId && v.fieldId === fieldId && v.entityType === entityType);

    const fieldValue: CustomFieldValue = {
      tenantId,
      entityId,
      entityType,
      fieldId,
      value,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date()
    };

    if (existing) {
      Object.assign(existing, fieldValue);
      return existing;
    }

    values.push(fieldValue);
    return fieldValue;
  }

  /**
   * Get field values for entity
   */
  async getEntityFieldValues(
    tenantId: mongoose.Types.ObjectId,
    entityId: string,
    entityType: string
  ): Promise<Record<string, any>> {
    const values = this.customValues.get(tenantId.toString()) || [];
    const entityValues = values.filter(v => v.entityId === entityId && v.entityType === entityType);

    const result: Record<string, any> = {};
    entityValues.forEach(v => {
      result[v.fieldId] = v.value;
    });

    return result;
  }

  /**
   * Bulk import field values
   */
  async bulkImportValues(
    tenantId: mongoose.Types.ObjectId,
    entityType: string,
    data: Array<{ entityId: string; [fieldId: string]: any }>
  ): Promise<number> {
    let imported = 0;

    for (const row of data) {
      const { entityId, ...fieldValues } = row;

      for (const [fieldId, value] of Object.entries(fieldValues)) {
        try {
          await this.setFieldValue(tenantId, entityId, entityType, fieldId, value);
          imported++;
        } catch (error) {
          // Log error but continue
          console.error(`Failed to import value for entity ${entityId}, field ${fieldId}:`, error);
        }
      }
    }

    return imported;
  }

  /**
   * Export field definitions
   */
  async exportFieldDefinitions(tenantId: mongoose.Types.ObjectId): Promise<FieldDefinitionExport> {
    const fields = await this.getFields(tenantId);

    return {
      fields,
      schemaVersion: 1,
      exportDate: new Date()
    };
  }

  /**
   * Import field definitions
   */
  async importFieldDefinitions(
    tenantId: mongoose.Types.ObjectId,
    definitions: FieldDefinitionExport
  ): Promise<number> {
    let imported = 0;

    for (const field of definitions.fields) {
      try {
        await this.createField(tenantId, {
          name: field.name,
          label: field.label,
          type: field.type,
          required: field.required,
          description: field.description,
          placeholder: field.placeholder,
          defaultValue: field.defaultValue,
          options: field.options,
          validation: field.validation,
          conditional: field.conditional,
          permissions: field.permissions,
          displayOrder: field.displayOrder,
          isActive: field.isActive,
          createdBy: field.createdBy
        });
        imported++;
      } catch (error) {
        console.error(`Failed to import field ${field.name}:`, error);
      }
    }

    return imported;
  }

  /**
   * Reorder fields
   */
  async reorderFields(
    tenantId: mongoose.Types.ObjectId,
    fieldIds: string[]
  ): Promise<void> {
    const fields = this.customFields.get(tenantId.toString());

    if (!fields) {
      throw new Error('Tenant fields not found');
    }

    fieldIds.forEach((fieldId, index) => {
      const field = fields.find(f => f.fieldId === fieldId);
      if (field) {
        field.displayOrder = index;
      }
    });

    fields.sort((a, b) => a.displayOrder - b.displayOrder);
  }
}

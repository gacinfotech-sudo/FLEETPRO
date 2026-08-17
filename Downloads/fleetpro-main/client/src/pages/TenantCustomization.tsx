import React, { useState, useEffect } from 'react';
import { Palette, Globe, Sliders, Code, FileText, Zap, Save } from 'lucide-react';
import SettingsUIBuilder from '../components/SettingsUIBuilder';

interface BrandingData {
  logo?: string;
  favicon?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  darkModeEnabled: boolean;
  lightModeEnabled: boolean;
}

interface WhiteLabelData {
  customDomain?: string;
  removePoweredBy: boolean;
  supportEmail?: string;
  documentationUrl?: string;
  companyName: string;
}

interface CustomFieldData {
  entityType: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: 'text' | 'number' | 'date' | 'dropdown' | 'checkbox';
  required: boolean;
}

interface ApiConfigData {
  rateLimit: number;
  requestTimeout: number;
  enableWebhooks: boolean;
  apiVersion: string;
}

const TenantCustomization: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'branding' | 'whitelabel' | 'fields' | 'pages' | 'api' | 'reports'>('branding');
  const [tenantId, setTenantId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [brandingData, setBrandingData] = useState<BrandingData>({
    primaryColor: '#3B82F6',
    secondaryColor: '#10B981',
    accentColor: '#F59E0B',
    fontFamily: 'Inter',
    darkModeEnabled: true,
    lightModeEnabled: true
  });

  const [whiteLabelData, setWhiteLabelData] = useState<WhiteLabelData>({
    removePoweredBy: false,
    companyName: ''
  });

  const [customFields, setCustomFields] = useState<CustomFieldData[]>([]);
  const [apiConfig, setApiConfig] = useState<ApiConfigData>({
    rateLimit: 1000,
    requestTimeout: 30000,
    enableWebhooks: false,
    apiVersion: 'v1'
  });

  useEffect(() => {
    // Get tenant ID from auth context or URL
    const storedTenantId = localStorage.getItem('tenantId');
    if (storedTenantId) {
      setTenantId(storedTenantId);
      loadTenantConfiguration(storedTenantId);
    }
  }, []);

  const loadTenantConfiguration = async (id: string) => {
    setLoading(true);
    try {
      // Mock API call - replace with actual API endpoint
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load configuration' });
    } finally {
      setLoading(false);
    }
  };

  const handleBrandingChange = (key: keyof BrandingData, value: any) => {
    setBrandingData(prev => ({ ...prev, [key]: value }));
  };

  const handleWhiteLabelChange = (key: keyof WhiteLabelData, value: any) => {
    setWhiteLabelData(prev => ({ ...prev, [key]: value }));
  };

  const handleApiConfigChange = (key: keyof ApiConfigData, value: any) => {
    setApiConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleAddCustomField = () => {
    setCustomFields(prev => [...prev, {
      entityType: 'vehicle',
      fieldName: '',
      fieldLabel: '',
      fieldType: 'text',
      required: false
    }]);
  };

  const handleUpdateCustomField = (index: number, field: CustomFieldData) => {
    const updated = [...customFields];
    updated[index] = field;
    setCustomFields(updated);
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveBranding = async (settings: Record<string, any>) => {
    setSaving(true);
    try {
      // Mock API call - replace with actual endpoint
      setMessage({ type: 'success', text: 'Branding updated successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save branding settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWhiteLabel = async (settings: Record<string, any>) => {
    setSaving(true);
    try {
      setMessage({ type: 'success', text: 'White-label settings updated successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save white-label settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApiConfig = async (settings: Record<string, any>) => {
    setSaving(true);
    try {
      setMessage({ type: 'success', text: 'API configuration updated successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save API configuration' });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'branding', label: 'Branding', icon: <Palette className="w-5 h-5" /> },
    { id: 'whitelabel', label: 'White-Label', icon: <Globe className="w-5 h-5" /> },
    { id: 'fields', label: 'Custom Fields', icon: <Sliders className="w-5 h-5" /> },
    { id: 'pages', label: 'Pages', icon: <FileText className="w-5 h-5" /> },
    { id: 'api', label: 'API', icon: <Code className="w-5 h-5" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="w-5 h-5" /> }
  ];

  const brandingPanels = [
    {
      id: 'colors',
      label: 'Brand Colors',
      icon: '🎨',
      description: 'Customize your brand colors',
      visible: true,
      items: [
        { id: 'primary', label: 'Primary Color', type: 'color' as const, value: brandingData.primaryColor, description: 'Main brand color' },
        { id: 'secondary', label: 'Secondary Color', type: 'color' as const, value: brandingData.secondaryColor, description: 'Secondary brand color' },
        { id: 'accent', label: 'Accent Color', type: 'color' as const, value: brandingData.accentColor, description: 'Accent color for highlights' }
      ]
    },
    {
      id: 'fonts',
      label: 'Typography',
      icon: '✏️',
      description: 'Configure fonts and typography',
      visible: true,
      items: [
        { id: 'font', label: 'Font Family', type: 'select' as const, value: brandingData.fontFamily, options: [
          { label: 'Inter', value: 'Inter' },
          { label: 'Roboto', value: 'Roboto' },
          { label: 'Poppins', value: 'Poppins' },
          { label: 'Segoe UI', value: 'Segoe UI' }
        ], description: 'Default font for the application' }
      ]
    },
    {
      id: 'theme',
      label: 'Theme Settings',
      icon: '🌓',
      description: 'Enable dark mode and light mode',
      visible: true,
      items: [
        { id: 'darkMode', label: 'Dark Mode', type: 'toggle' as const, value: brandingData.darkModeEnabled, description: 'Enable dark theme' },
        { id: 'lightMode', label: 'Light Mode', type: 'toggle' as const, value: brandingData.lightModeEnabled, description: 'Enable light theme' }
      ]
    }
  ];

  const whiteLabelPanels = [
    {
      id: 'domain',
      label: 'Domain Configuration',
      icon: '🌐',
      description: 'Set up custom domain',
      visible: true,
      items: [
        { id: 'domain', label: 'Custom Domain', type: 'text' as const, value: whiteLabelData.customDomain || '', description: 'Your custom domain (e.g., mycompany.com)' }
      ]
    },
    {
      id: 'branding',
      label: 'Remove Branding',
      icon: '✂️',
      description: 'Remove "Powered by" branding',
      visible: true,
      items: [
        { id: 'removePoweredBy', label: 'Remove "Powered by" text', type: 'toggle' as const, value: whiteLabelData.removePoweredBy, description: 'Hide platform branding' }
      ]
    },
    {
      id: 'support',
      label: 'Support Configuration',
      icon: '📧',
      description: 'Configure support links',
      visible: true,
      items: [
        { id: 'company', label: 'Company Name', type: 'text' as const, value: whiteLabelData.companyName, description: 'Your company name' },
        { id: 'email', label: 'Support Email', type: 'text' as const, value: whiteLabelData.supportEmail || '', description: 'Email for support' },
        { id: 'docs', label: 'Documentation URL', type: 'text' as const, value: whiteLabelData.documentationUrl || '', description: 'Link to your documentation' }
      ]
    }
  ];

  const apiPanels = [
    {
      id: 'api-config',
      label: 'API Configuration',
      icon: '⚙️',
      description: 'Configure API settings and limits',
      visible: true,
      items: [
        { id: 'rateLimit', label: 'Rate Limit (requests/hour)', type: 'number' as const, value: apiConfig.rateLimit, description: 'Maximum requests per hour' },
        { id: 'timeout', label: 'Request Timeout (ms)', type: 'number' as const, value: apiConfig.requestTimeout, description: 'Request timeout in milliseconds' },
        { id: 'webhooks', label: 'Enable Webhooks', type: 'toggle' as const, value: apiConfig.enableWebhooks, description: 'Enable webhook functionality' }
      ]
    }
  ];

  return (
    <div className="tenant-customization min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Tenant Customization</h1>
          <p className="text-gray-600 dark:text-gray-400">Configure your tenant's branding, white-label settings, and features</p>
        </div>

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-lg mb-6 ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900 text-green-800 dark:text-green-100'
              : 'bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-100'
          }`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'branding' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <SettingsUIBuilder
              tenantId={tenantId}
              panels={brandingPanels}
              onSave={handleSaveBranding}
              loading={loading}
            />
          </div>
        )}

        {activeTab === 'whitelabel' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <SettingsUIBuilder
              tenantId={tenantId}
              panels={whiteLabelPanels}
              onSave={handleSaveWhiteLabel}
              loading={loading}
            />
          </div>
        )}

        {activeTab === 'fields' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Custom Fields</h2>
            <button
              onClick={handleAddCustomField}
              className="mb-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add Custom Field
            </button>
            <div className="space-y-4">
              {customFields.map((field, index) => (
                <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded">
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Field Name"
                      value={field.fieldName}
                      onChange={(e) => handleUpdateCustomField(index, { ...field, fieldName: e.target.value })}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="Field Label"
                      value={field.fieldLabel}
                      onChange={(e) => handleUpdateCustomField(index, { ...field, fieldLabel: e.target.value })}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                    />
                    <select
                      value={field.fieldType}
                      onChange={(e) => handleUpdateCustomField(index, { ...field, fieldType: e.target.value as any })}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="dropdown">Dropdown</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                    <select
                      value={field.entityType}
                      onChange={(e) => handleUpdateCustomField(index, { ...field, entityType: e.target.value })}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                    >
                      <option value="vehicle">Vehicle</option>
                      <option value="driver">Driver</option>
                      <option value="booking">Booking</option>
                    </select>
                  </div>
                  <button
                    onClick={() => handleRemoveCustomField(index)}
                    className="mt-3 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <SettingsUIBuilder
              tenantId={tenantId}
              panels={apiPanels}
              onSave={handleSaveApiConfig}
              loading={loading}
            />
          </div>
        )}

        {activeTab === 'pages' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Page Customization</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Coming soon: Customize your pages, onboarding flow, and feature toggles</p>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Report Templates</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Coming soon: Create and customize report templates</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TenantCustomization;

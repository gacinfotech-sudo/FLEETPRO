import React, { useState } from 'react';
import { ChevronDown, Settings, Save, X } from 'lucide-react';

interface SettingsPanel {
  id: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  visible: boolean;
  items?: SettingsItem[];
}

interface SettingsItem {
  id: string;
  label: string;
  type: 'toggle' | 'select' | 'text' | 'number' | 'color' | 'textarea';
  value: any;
  options?: Array<{ label: string; value: any }>;
  description?: string;
  required?: boolean;
  hidden?: boolean;
}

interface SettingsUIBuilderProps {
  tenantId: string;
  panels: SettingsPanel[];
  tabs?: string[];
  onSave?: (settings: Record<string, any>) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

export const SettingsUIBuilder: React.FC<SettingsUIBuilderProps> = ({
  tenantId,
  panels,
  tabs = [],
  onSave,
  onCancel,
  loading = false
}) => {
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState(tabs[0] || 'general');
  const [saving, setSaving] = useState(false);

  const togglePanel = (panelId: string) => {
    const newExpanded = new Set(expandedPanels);
    if (newExpanded.has(panelId)) {
      newExpanded.delete(panelId);
    } else {
      newExpanded.add(panelId);
    }
    setExpandedPanels(newExpanded);
  };

  const handleItemChange = (panelId: string, itemId: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [panelId]: {
        ...(prev[panelId] || {}),
        [itemId]: value
      }
    }));
  };

  const handleSave = async () => {
    if (onSave) {
      setSaving(true);
      try {
        await onSave(settings);
      } catch (error) {
        console.error('Failed to save settings:', error);
      } finally {
        setSaving(false);
      }
    }
  };

  const visiblePanels = panels.filter(p => p.visible);

  return (
    <div className="settings-ui-builder max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <div className="flex gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {tabs.length > 0 && (
        <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium ${
                activeTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {visiblePanels.map(panel => (
          <div
            key={panel.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => togglePanel(panel.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                {panel.icon && <span className="text-xl">{panel.icon}</span>}
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{panel.label}</h3>
                  {panel.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{panel.description}</p>
                  )}
                </div>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${
                  expandedPanels.has(panel.id) ? 'transform rotate-180' : ''
                }`}
              />
            </button>

            {expandedPanels.has(panel.id) && panel.items && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900 space-y-6">
                {panel.items.map(item => (
                  !item.hidden && (
                    <SettingsItem
                      key={item.id}
                      item={item}
                      value={settings[panel.id]?.[item.id] ?? item.value}
                      onChange={(value) => handleItemChange(panel.id, item.id, value)}
                    />
                  )
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

interface SettingsItemProps {
  item: SettingsItem;
  value: any;
  onChange: (value: any) => void;
}

const SettingsItem: React.FC<SettingsItemProps> = ({ item, value, onChange }) => {
  return (
    <div className="flex flex-col gap-2">
      <label className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
        {item.label}
        {item.required && <span className="text-red-500">*</span>}
      </label>

      {item.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
      )}

      {item.type === 'toggle' && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => onChange(!value)}
            className={`relative w-14 h-8 rounded-full transition-colors ${
              value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <div
              className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                value ? 'translate-x-6' : ''
              }`}
            />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">{value ? 'Enabled' : 'Disabled'}</span>
        </div>
      )}

      {item.type === 'select' && (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">Select an option</option>
          {item.options?.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {item.type === 'text' && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={item.label}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      )}

      {item.type === 'number' && (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      )}

      {item.type === 'color' && (
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-12 h-12 rounded cursor-pointer"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex-1"
          />
        </div>
      )}

      {item.type === 'textarea' && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={item.label}
          rows={4}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      )}
    </div>
  );
};

export default SettingsUIBuilder;

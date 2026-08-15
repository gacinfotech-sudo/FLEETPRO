import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Edit2, Trash2, Eye, EyeOff, Settings } from "lucide-react";

interface Widget {
  id: string;
  type: string;
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: any;
  dataSource: string;
}

interface DashboardWidgetProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
  onRemove: () => void;
}

const WIDGET_TYPES = [
  { value: 'metric_card', label: 'Metric Card' },
  { value: 'line_chart', label: 'Line Chart' },
  { value: 'bar_chart', label: 'Bar Chart' },
  { value: 'pie_chart', label: 'Pie Chart' },
  { value: 'area_chart', label: 'Area Chart' },
  { value: 'table', label: 'Data Table' },
  { value: 'gauge', label: 'Gauge' },
  { value: 'heatmap', label: 'Heatmap' }
];

const DATA_SOURCES = [
  { value: 'bookings', label: 'Bookings' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'drivers', label: 'Drivers' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'customers', label: 'Customers' }
];

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

// Mock data for different widget types
const MOCK_DATA = {
  line_chart: [
    { month: 'Jan', value: 4000 },
    { month: 'Feb', value: 3000 },
    { month: 'Mar', value: 2000 },
    { month: 'Apr', value: 2780 },
    { month: 'May', value: 1890 },
    { month: 'Jun', value: 2390 }
  ],
  bar_chart: [
    { category: 'Category A', value: 4000 },
    { category: 'Category B', value: 3000 },
    { category: 'Category C', value: 2000 },
    { category: 'Category D', value: 2780 }
  ],
  pie_chart: [
    { name: 'Segment 1', value: 400 },
    { name: 'Segment 2', value: 300 },
    { name: 'Segment 3', value: 300 },
    { name: 'Segment 4', value: 200 }
  ],
  area_chart: [
    { month: 'Jan', value: 400 },
    { month: 'Feb', value: 300 },
    { month: 'Mar', value: 200 },
    { month: 'Apr', value: 278 },
    { month: 'May', value: 189 },
    { month: 'Jun', value: 239 }
  ]
};

export default function DashboardWidget({ widget, onUpdate, onRemove }: DashboardWidgetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [widgetType, setWidgetType] = useState(widget.type);
  const [dataSource, setDataSource] = useState(widget.dataSource);
  const [showSettings, setShowSettings] = useState(false);

  const handleTypeChange = (newType: string) => {
    setWidgetType(newType);
    onUpdate({ type: newType });
  };

  const handleDataSourceChange = (newSource: string) => {
    setDataSource(newSource);
    onUpdate({ dataSource: newSource });
  };

  const renderChart = () => {
    const chartHeight = 250;

    switch (widgetType) {
      case 'metric_card':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-slate-600 text-sm mb-2">Current Value</p>
            <p className="text-4xl font-bold text-blue-600">24,580</p>
            <p className="text-green-600 text-sm mt-2">+12.5% vs last period</p>
          </div>
        );

      case 'line_chart':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={MOCK_DATA.line_chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar_chart':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={MOCK_DATA.bar_chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie_chart':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie
                data={MOCK_DATA.pie_chart}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {MOCK_DATA.pie_chart.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'area_chart':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={MOCK_DATA.area_chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="value" fill="#3b82f6" stroke="#3b82f6" />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'table':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="text-left py-2 px-3 font-semibold">Item</th>
                  <th className="text-right py-2 px-3 font-semibold">Value</th>
                  <th className="text-right py-2 px-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {['Item 1', 'Item 2', 'Item 3', 'Item 4'].map((item, idx) => (
                  <tr key={idx} className="border-b hover:bg-slate-50">
                    <td className="py-2 px-3">{item}</td>
                    <td className="text-right py-2 px-3">${Math.floor(Math.random() * 10000)}</td>
                    <td className="text-right py-2 px-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        Math.random() > 0.5
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {Math.random() > 0.5 ? 'Active' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'gauge':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="relative w-32 h-32">
              <div className="absolute inset-0 rounded-full border-8 border-slate-200"></div>
              <div
                className="absolute inset-0 rounded-full border-8 border-transparent border-t-blue-600 border-r-blue-600"
                style={{ transform: 'rotate(45deg)' }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">75%</span>
              </div>
            </div>
          </div>
        );

      case 'heatmap':
        return (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 28 }).map((_, idx) => (
              <div
                key={idx}
                className="h-6 rounded"
                style={{
                  backgroundColor: `rgba(59, 130, 246, ${Math.random() * 0.8})`
                }}
                title={`Day ${idx + 1}`}
              ></div>
            ))}
          </div>
        );

      default:
        return <div className="text-center py-8 text-slate-500">Chart type not supported</div>;
    }
  };

  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition">
      {/* Header */}
      <CardHeader className="pb-3 border-b">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <CardTitle className="text-base">{widget.title}</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Source: {dataSource}</p>
          </div>
          <div className="flex gap-1">
            {!isEditing && (
              <>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-1.5 hover:bg-slate-100 rounded transition"
                  title="Settings"
                >
                  <Settings className="w-4 h-4 text-slate-600" />
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 hover:bg-slate-100 rounded transition"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4 text-slate-600" />
                </button>
              </>
            )}
            <button
              onClick={onRemove}
              className="p-1.5 hover:bg-red-50 rounded transition"
              title="Remove"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        </div>
      </CardHeader>

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-4 py-3 bg-slate-50 border-b space-y-3">
          <div>
            <label className="text-xs font-semibold block mb-1">Widget Type</label>
            <Select value={widgetType} onValueChange={handleTypeChange}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WIDGET_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">Data Source</label>
            <Select value={dataSource} onValueChange={handleDataSourceChange}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_SOURCES.map(source => (
                  <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Content */}
      <CardContent className="pt-4 pb-4">
        {renderChart()}
      </CardContent>

      {/* Footer */}
      {isEditing && (
        <div className="px-4 py-3 border-t bg-slate-50 flex gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditing(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              setIsEditing(false);
              setShowSettings(false);
            }}
          >
            Done
          </Button>
        </div>
      )}
    </Card>
  );
}

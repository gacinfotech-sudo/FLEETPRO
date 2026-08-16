import { useState, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Share2, Clock, Download, Eye } from "lucide-react";
import DashboardWidget from "../components/DashboardWidget";

interface Dashboard {
  _id?: string;
  name: string;
  description?: string;
  widgets: any[];
  isDefault: boolean;
  refreshInterval: number;
  isPublished: boolean;
  sharedWith?: string[];
  createdAt?: string;
}

interface Widget {
  id: string;
  type: string;
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: any;
  dataSource: string;
}

const DASHBOARD_TEMPLATES = [
  {
    name: "Executive Summary",
    description: "High-level business metrics and KPIs",
    widgets: [
      { type: "metric_card", title: "Total Revenue", position: { x: 0, y: 0, w: 3, h: 2 } },
      { type: "metric_card", title: "Active Bookings", position: { x: 3, y: 0, w: 3, h: 2 } },
      { type: "line_chart", title: "Revenue Trend", position: { x: 0, y: 2, w: 6, h: 4 } },
      { type: "pie_chart", title: "Booking Types", position: { x: 6, y: 0, w: 6, h: 4 } }
    ]
  },
  {
    name: "Operations Dashboard",
    description: "Fleet and driver operations metrics",
    widgets: [
      { type: "metric_card", title: "Fleet Utilization", position: { x: 0, y: 0, w: 3, h: 2 } },
      { type: "metric_card", title: "Active Drivers", position: { x: 3, y: 0, w: 3, h: 2 } },
      { type: "table", title: "Vehicle Status", position: { x: 0, y: 2, w: 6, h: 4 } },
      { type: "heatmap", title: "Peak Hours", position: { x: 6, y: 2, w: 6, h: 4 } }
    ]
  },
  {
    name: "Financial Performance",
    description: "Income, expenses, and profitability",
    widgets: [
      { type: "metric_card", title: "Total Income", position: { x: 0, y: 0, w: 3, h: 2 } },
      { type: "metric_card", title: "Total Expenses", position: { x: 3, y: 0, w: 3, h: 2 } },
      { type: "area_chart", title: "Profit Margin", position: { x: 0, y: 2, w: 6, h: 4 } },
      { type: "bar_chart", title: "Expense Breakdown", position: { x: 6, y: 2, w: 6, h: 4 } }
    ]
  }
];

export default function CustomDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedDashboard, setSelectedDashboard] = useState<string | null>(null);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    template: "Executive Summary"
  });
  const [editingDashboard, setEditingDashboard] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [widgets, setWidgets] = useState<Widget[]>([]);

  // Fetch dashboards
  const { data: dashboardList = [] as Dashboard[], isLoading } = useQuery<Dashboard[]>({
    queryKey: ["/api/dashboards"],
    enabled: !!user
  });

  useEffect(() => {
    if (dashboardList.length > 0) {
      setDashboards(dashboardList);
      if (!selectedDashboard) setSelectedDashboard(dashboardList[0]._id || "0");
    }
  }, [dashboardList]);

  // Load widgets for selected dashboard
  useEffect(() => {
    if (selectedDashboard && dashboards.length > 0) {
      const dash = dashboards.find(d => d._id === selectedDashboard);
      if (dash) {
        setWidgets(dash.widgets || []);
        setRefreshInterval(dash.refreshInterval || 60);
      }
    }
  }, [selectedDashboard, dashboards]);

  // Create dashboard
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const template = DASHBOARD_TEMPLATES.find(t => t.name === formData.template);
      const response = await fetch("/api/dashboards", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          widgets: template?.widgets || [],
          isPublished: false
        }),
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) throw new Error("Failed to create dashboard");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Dashboard created successfully" });
      setShowCreateForm(false);
      setFormData({ name: "", description: "", template: "Executive Summary" });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
    }
  });

  // Delete dashboard
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/dashboards/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete dashboard");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Dashboard deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
      setSelectedDashboard(null);
    }
  });

  // Add widget
  const addWidget = () => {
    const newWidget: Widget = {
      id: Date.now().toString(),
      type: "metric_card",
      title: "New Widget",
      position: { x: 0, y: 0, w: 3, h: 2 },
      config: {},
      dataSource: "bookings"
    };
    setWidgets([...widgets, newWidget]);
  };

  // Remove widget
  const removeWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id));
  };

  // Update widget
  const updateWidget = (id: string, updates: Partial<Widget>) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, ...updates } : w));
  };

  // Save dashboard
  const saveDashboard = async () => {
    if (!selectedDashboard) return;

    try {
      const response = await fetch(`/api/dashboards/${selectedDashboard}`, {
        method: "PATCH",
        body: JSON.stringify({ widgets, refreshInterval }),
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) throw new Error("Failed to save dashboard");

      toast({ title: "Success", description: "Dashboard saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save dashboard",
        variant: "destructive"
      });
    }
  };

  const currentDashboard = dashboards.find(d => d._id === selectedDashboard);

  return (
    <div className="flex flex-col gap-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Custom Dashboards</h1>
          <p className="text-slate-600 mt-1">Create and manage personalized dashboards</p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Dashboard
        </Button>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <Card className="border-blue-200 bg-white">
          <CardHeader>
            <CardTitle>Create New Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Dashboard Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Dashboard"
                />
              </div>
              <div>
                <Label>Template</Label>
                <Select value={formData.template} onValueChange={(v) => setFormData({ ...formData, template: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DASHBOARD_TEMPLATES.map(t => (
                      <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => createMutation.mutate(formData)}
                disabled={!formData.name || createMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Create
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar - Dashboard List */}
        <div className="col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dashboards</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <p className="text-slate-500 text-sm">Loading...</p>
              ) : dashboards.length === 0 ? (
                <p className="text-slate-500 text-sm">No dashboards yet</p>
              ) : (
                dashboards.map(dash => (
                  <div
                    key={dash._id}
                    className={`p-3 rounded-lg cursor-pointer transition ${
                      selectedDashboard === dash._id
                        ? "bg-blue-100 border-2 border-blue-500"
                        : "bg-slate-50 border-2 border-transparent hover:bg-slate-100"
                    }`}
                    onClick={() => setSelectedDashboard(dash._id || "")}
                  >
                    <p className="font-medium text-sm">{dash.name}</p>
                    {dash.description && (
                      <p className="text-xs text-slate-600 mt-1">{dash.description}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button className="text-xs text-blue-600 hover:underline">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(dash._id || "");
                        }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="col-span-9">
          {currentDashboard ? (
            <>
              {/* Dashboard Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{currentDashboard.name}</h2>
                  {currentDashboard.description && (
                    <p className="text-slate-600 mt-1">{currentDashboard.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Share2 className="w-4 h-4" />
                    Share
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                  <Button onClick={saveDashboard} className="bg-green-600 hover:bg-green-700" size="sm">
                    Save Changes
                  </Button>
                </div>
              </div>

              {/* Settings Card */}
              <Card className="mb-6 bg-white">
                <CardHeader>
                  <CardTitle className="text-base">Dashboard Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Refresh Interval (seconds)</Label>
                      <Select value={refreshInterval.toString()} onValueChange={(v) => setRefreshInterval(Number(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 seconds</SelectItem>
                          <SelectItem value="60">1 minute</SelectItem>
                          <SelectItem value="300">5 minutes</SelectItem>
                          <SelectItem value="600">10 minutes</SelectItem>
                          <SelectItem value="3600">1 hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Visibility</Label>
                      <Select value={currentDashboard.isPublished ? "public" : "private"}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="private">Private</SelectItem>
                          <SelectItem value="public">Public</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Widgets */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-slate-900">Widgets</h3>
                  <Button onClick={addWidget} variant="outline" size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Widget
                  </Button>
                </div>

                {widgets.length === 0 ? (
                  <Card className="bg-slate-50 border-dashed">
                    <CardContent className="py-12 text-center">
                      <p className="text-slate-600">No widgets yet. Click "Add Widget" to get started.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {widgets.map(widget => (
                      <DashboardWidget
                        key={widget.id}
                        widget={widget}
                        onUpdate={(updates) => updateWidget(widget.id, updates)}
                        onRemove={() => removeWidget(widget.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <Card className="bg-slate-50 border-dashed">
              <CardContent className="py-12 text-center">
                <Eye className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <p className="text-slate-600">Select a dashboard to view and edit</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Download, Save, Eye, Copy } from "lucide-react";

interface DataSource {
  id: string;
  type: string;
  name: string;
  isSelected: boolean;
}

interface Metric {
  id: string;
  name: string;
  type: string;
  label: string;
  format?: string;
}

interface Dimension {
  id: string;
  name: string;
  field: string;
  type: string;
}

interface ReportFilter {
  id: string;
  field: string;
  operator: string;
  value: any;
}

const AVAILABLE_DATA_SOURCES = [
  { id: "bookings", type: "bookings", name: "Bookings", isSelected: false },
  { id: "vehicles", type: "vehicles", name: "Vehicles", isSelected: false },
  { id: "drivers", type: "drivers", name: "Drivers", isSelected: false },
  { id: "expenses", type: "expenses", name: "Expenses", isSelected: false },
  { id: "revenue", type: "revenue", name: "Revenue", isSelected: false }
];

const EXPORT_FORMATS = ["pdf", "excel", "csv", "json"];

export default function ReportBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [reportName, setReportName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [selectedSources, setSelectedSources] = useState<DataSource[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<Metric[]>([]);
  const [selectedDimensions, setSelectedDimensions] = useState<Dimension[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [exportFormats, setExportFormats] = useState<string[]>(["csv"]);
  const [currentStep, setCurrentStep] = useState<"sources" | "metrics" | "config" | "preview">("sources");

  // Available metrics based on selected source
  const getAvailableMetrics = (): Metric[] => {
    if (!selectedSources.length) return [];

    const metricsMap: Record<string, Metric[]> = {
      bookings: [
        { id: "booking_count", name: "Booking Count", type: "count", label: "Total Bookings" },
        { id: "total_revenue", name: "Total Revenue", type: "sum", label: "Revenue", format: "currency" },
        { id: "avg_value", name: "Average Value", type: "average", label: "Avg Value" }
      ],
      vehicles: [
        { id: "vehicle_count", name: "Vehicle Count", type: "count", label: "Total Vehicles" },
        { id: "utilization_rate", name: "Utilization", type: "average", label: "Avg Utilization" }
      ],
      drivers: [
        { id: "driver_count", name: "Driver Count", type: "count", label: "Total Drivers" },
        { id: "avg_rating", name: "Average Rating", type: "average", label: "Avg Rating" }
      ]
    };

    return selectedSources.flatMap(s => metricsMap[s.type] || []);
  };

  const availableMetrics = getAvailableMetrics();

  const handleAddSource = (source: DataSource) => {
    if (!selectedSources.find(s => s.id === source.id)) {
      setSelectedSources([...selectedSources, { ...source, isSelected: true }]);
      toast({ title: "Source added", description: `${source.name} added to report` });
    }
  };

  const handleRemoveSource = (sourceId: string) => {
    setSelectedSources(selectedSources.filter(s => s.id !== sourceId));
  };

  const handleAddMetric = (metric: Metric) => {
    if (!selectedMetrics.find(m => m.id === metric.id)) {
      setSelectedMetrics([...selectedMetrics, metric]);
    }
  };

  const handleRemoveMetric = (metricId: string) => {
    setSelectedMetrics(selectedMetrics.filter(m => m.id !== metricId));
  };

  const handleToggleExportFormat = (format: string) => {
    if (exportFormats.includes(format)) {
      setExportFormats(exportFormats.filter(f => f !== format));
    } else {
      setExportFormats([...exportFormats, format]);
    }
  };

  const handleSaveReport = async () => {
    if (!reportName.trim()) {
      toast({ title: "Error", description: "Report name is required" });
      return;
    }

    if (selectedMetrics.length === 0) {
      toast({ title: "Error", description: "Select at least one metric" });
      return;
    }

    try {
      // API call to save report
      toast({ title: "Success", description: "Report saved successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save report" });
    }
  };

  const handleGenerateReport = async () => {
    try {
      toast({ title: "Generating", description: "Your report is being generated..." });
      // Simulate report generation
      setTimeout(() => {
        toast({ title: "Success", description: "Report generated successfully" });
      }, 2000);
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate report" });
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Report Builder</h1>
          <p className="text-muted-foreground">Create custom reports with flexible configuration</p>
        </div>

        {/* Tabs Navigation */}
        <div className="flex gap-4 mb-8 border-b">
          {(["sources", "metrics", "config", "preview"] as const).map(step => (
            <button
              key={step}
              onClick={() => setCurrentStep(step)}
              className={`px-4 py-2 font-medium capitalize ${
                currentStep === step
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {step}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Report Info */}
            <Card>
              <CardHeader>
                <CardTitle>Report Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Report Name</Label>
                  <Input
                    id="name"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    placeholder="Enter report name"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Step: Data Sources */}
            {currentStep === "sources" && (
              <Card>
                <CardHeader>
                  <CardTitle>Select Data Sources</CardTitle>
                  <CardDescription>Choose which data sources to include</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {AVAILABLE_DATA_SOURCES.map(source => (
                      <div
                        key={source.id}
                        className="border rounded-lg p-4 cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => handleAddSource(source)}
                      >
                        <h3 className="font-semibold">{source.name}</h3>
                        <p className="text-sm text-muted-foreground">{source.type}</p>
                      </div>
                    ))}
                  </div>

                  {selectedSources.length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-semibold mb-3">Selected Sources</h3>
                      <div className="space-y-2">
                        {selectedSources.map(source => (
                          <div key={source.id} className="flex items-center justify-between bg-secondary p-3 rounded">
                            <span>{source.name}</span>
                            <button
                              onClick={() => handleRemoveSource(source.id)}
                              className="text-destructive hover:text-destructive/80"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step: Metrics */}
            {currentStep === "metrics" && (
              <Card>
                <CardHeader>
                  <CardTitle>Select Metrics</CardTitle>
                  <CardDescription>Choose metrics to include in your report</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {availableMetrics.length === 0 ? (
                    <p className="text-muted-foreground">Select data sources first</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {availableMetrics.map(metric => (
                          <div
                            key={metric.id}
                            className="border rounded-lg p-4 cursor-pointer hover:bg-accent transition-colors"
                            onClick={() => handleAddMetric(metric)}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-semibold">{metric.name}</h3>
                                <p className="text-sm text-muted-foreground">{metric.type}</p>
                              </div>
                              <Plus className="h-5 w-5" />
                            </div>
                          </div>
                        ))}
                      </div>

                      {selectedMetrics.length > 0 && (
                        <div className="mt-6">
                          <h3 className="font-semibold mb-3">Selected Metrics</h3>
                          <div className="space-y-2">
                            {selectedMetrics.map(metric => (
                              <div key={metric.id} className="flex items-center justify-between bg-secondary p-3 rounded">
                                <span>{metric.label}</span>
                                <button
                                  onClick={() => handleRemoveMetric(metric.id)}
                                  className="text-destructive hover:text-destructive/80"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step: Configuration */}
            {currentStep === "config" && (
              <Card>
                <CardHeader>
                  <CardTitle>Report Configuration</CardTitle>
                  <CardDescription>Set up filters and export options</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label className="text-base font-semibold mb-3 block">Export Formats</Label>
                    <div className="grid grid-cols-2 gap-4">
                      {EXPORT_FORMATS.map(format => (
                        <div key={format} className="flex items-center space-x-2">
                          <Checkbox
                            id={format}
                            checked={exportFormats.includes(format)}
                            onCheckedChange={() => handleToggleExportFormat(format)}
                          />
                          <Label htmlFor={format} className="text-sm font-medium cursor-pointer">
                            {format.toUpperCase()}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-base font-semibold mb-3 block">Filters</Label>
                    <p className="text-sm text-muted-foreground">Filter configuration coming soon</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step: Preview */}
            {currentStep === "preview" && (
              <Card>
                <CardHeader>
                  <CardTitle>Report Preview</CardTitle>
                  <CardDescription>Review your report configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-secondary p-4 rounded space-y-2">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <p className="font-semibold">{reportName || "Unnamed Report"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data Sources:</span>
                      <p className="font-semibold">{selectedSources.map(s => s.name).join(", ") || "None"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Metrics:</span>
                      <p className="font-semibold">{selectedMetrics.map(m => m.label).join(", ") || "None"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Export Formats:</span>
                      <p className="font-semibold">{exportFormats.map(f => f.toUpperCase()).join(", ")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm text-muted-foreground">Data Sources</span>
                  <p className="text-2xl font-bold">{selectedSources.length}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Metrics</span>
                  <p className="text-2xl font-bold">{selectedMetrics.length}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Export Formats</span>
                  <p className="text-2xl font-bold">{exportFormats.length}</p>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={handleSaveReport} className="w-full" variant="outline">
                  <Save className="h-4 w-4 mr-2" />
                  Save Report
                </Button>
                <Button onClick={handleGenerateReport} className="w-full">
                  <Eye className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
                <Button variant="outline" className="w-full">
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </Button>
              </CardContent>
            </Card>

            {/* Step Navigation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Navigation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  onClick={() => {
                    const steps: typeof currentStep[] = ["sources", "metrics", "config", "preview"];
                    const idx = steps.indexOf(currentStep);
                    if (idx > 0) setCurrentStep(steps[idx - 1]);
                  }}
                  variant="outline"
                  className="w-full"
                  disabled={currentStep === "sources"}
                >
                  Previous
                </Button>
                <Button
                  onClick={() => {
                    const steps: typeof currentStep[] = ["sources", "metrics", "config", "preview"];
                    const idx = steps.indexOf(currentStep);
                    if (idx < steps.length - 1) setCurrentStep(steps[idx + 1]);
                  }}
                  className="w-full"
                  disabled={currentStep === "preview"}
                >
                  Next
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

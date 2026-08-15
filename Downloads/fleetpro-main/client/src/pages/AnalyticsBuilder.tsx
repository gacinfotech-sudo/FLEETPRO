import { useState, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Target, Play, Save, Download } from "lucide-react";

interface CohortData {
  cohortId: string;
  name: string;
  memberCount: number;
  retentionRate: number;
  avgRevenue: number;
  churnRate: number;
}

interface ABTestData {
  experimentId: string;
  name: string;
  status: string;
  variants: {
    name: string;
    conversionRate: number;
    userCount: number;
    uplift?: number;
  }[];
  significance: {
    pValue: number;
    isSignificant: boolean;
  };
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

const MOCK_COHORT_DATA: CohortData[] = [
  { cohortId: '1', name: 'Jan 2024 Cohort', memberCount: 450, retentionRate: 0.85, avgRevenue: 12500, churnRate: 0.15 },
  { cohortId: '2', name: 'Feb 2024 Cohort', memberCount: 520, retentionRate: 0.82, avgRevenue: 13200, churnRate: 0.18 },
  { cohortId: '3', name: 'Mar 2024 Cohort', memberCount: 380, retentionRate: 0.88, avgRevenue: 11800, churnRate: 0.12 }
];

const MOCK_AB_TEST: ABTestData[] = [
  {
    experimentId: '1',
    name: 'Pricing Page A/B Test',
    status: 'completed',
    variants: [
      { name: 'Control', conversionRate: 0.045, userCount: 5000 },
      { name: 'Variant A', conversionRate: 0.052, userCount: 5100, uplift: 15.6 }
    ],
    significance: { pValue: 0.032, isSignificant: true }
  },
  {
    experimentId: '2',
    name: 'Homepage CTA Test',
    status: 'running',
    variants: [
      { name: 'Control', conversionRate: 0.038, userCount: 3200 },
      { name: 'Variant B', conversionRate: 0.041, userCount: 3150, uplift: 7.9 }
    ],
    significance: { pValue: 0.18, isSignificant: false }
  }
];

const RETENTION_CURVE_DATA = [
  { month: 'Month 0', retention: 100 },
  { month: 'Month 1', retention: 92 },
  { month: 'Month 2', retention: 86 },
  { month: 'Month 3', retention: 81 },
  { month: 'Month 4', retention: 76 },
  { month: 'Month 5', retention: 72 },
  { month: 'Month 6', retention: 68 }
];

const REVENUE_FORECAST = [
  { month: 'Jul', forecast: 85000, lower: 72000, upper: 98000 },
  { month: 'Aug', forecast: 92000, lower: 78000, upper: 106000 },
  { month: 'Sep', forecast: 98000, lower: 82000, upper: 114000 },
  { month: 'Oct', forecast: 105000, lower: 88000, upper: 122000 },
  { month: 'Nov', forecast: 115000, lower: 96000, upper: 134000 },
  { month: 'Dec', forecast: 128000, lower: 106000, upper: 150000 }
];

export default function AnalyticsBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("cohort");
  const [selectedCohorts, setSelectedCohorts] = useState<string[]>(['1']);
  const [selectedMetric, setSelectedMetric] = useState<string>('retention');
  const [selectedABTest, setSelectedABTest] = useState<string | null>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);

  // Fetch cohorts
  const { data: cohorts = MOCK_COHORT_DATA } = useQuery({
    queryKey: ["/api/analytics/cohorts"],
    enabled: !!user
  });

  // Fetch AB tests
  const { data: abTests = MOCK_AB_TEST } = useQuery({
    queryKey: ["/api/analytics/experiments"],
    enabled: !!user
  });

  // Run anomaly detection
  const runAnomalyDetection = async () => {
    try {
      const response = await fetch('/api/analytics/anomalies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        setAnomalies(data || []);
        toast({ title: "Success", description: "Anomaly detection completed" });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to run anomaly detection",
        variant: "destructive"
      });
    }
  };

  const filteredCohortData = cohorts.filter(c => selectedCohorts.includes(c.cohortId));

  return (
    <div className="flex flex-col gap-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Advanced Analytics</h1>
          <p className="text-slate-600 mt-1">Cohort analysis, A/B testing, and predictions</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="cohort" className="gap-2">
            <Target className="w-4 h-4" />
            Cohort Analysis
          </TabsTrigger>
          <TabsTrigger value="abtesting" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            A/B Testing
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Forecasting
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="gap-2">
            <LineChart className="w-4 h-4" />
            Anomalies
          </TabsTrigger>
        </TabsList>

        {/* Cohort Analysis Tab */}
        <TabsContent value="cohort" className="space-y-6">
          {/* Cohort Selection */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-lg">Cohort Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm mb-3 block">Select Cohorts to Compare</Label>
                <div className="grid grid-cols-3 gap-3">
                  {cohorts.map(cohort => (
                    <label key={cohort.cohortId} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCohorts.includes(cohort.cohortId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCohorts([...selectedCohorts, cohort.cohortId]);
                          } else {
                            setSelectedCohorts(selectedCohorts.filter(id => id !== cohort.cohortId));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{cohort.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm">Metric to Display</Label>
                <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retention">Retention Rate</SelectItem>
                    <SelectItem value="revenue">Average Revenue</SelectItem>
                    <SelectItem value="churn">Churn Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Retention Curves */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-lg">Retention Curves</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={RETENTION_CURVE_DATA}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {filteredCohortData.map((cohort, idx) => (
                    <Line
                      key={cohort.cohortId}
                      type="monotone"
                      dataKey="retention"
                      stroke={COLORS[idx % COLORS.length]}
                      name={cohort.name}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cohort Performance Table */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-lg">Cohort Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 font-semibold">Cohort</th>
                      <th className="text-right py-2 font-semibold">Members</th>
                      <th className="text-right py-2 font-semibold">Retention</th>
                      <th className="text-right py-2 font-semibold">Churn Rate</th>
                      <th className="text-right py-2 font-semibold">Avg Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCohortData.map(cohort => (
                      <tr key={cohort.cohortId} className="border-b hover:bg-slate-50">
                        <td className="py-3">{cohort.name}</td>
                        <td className="text-right">{cohort.memberCount}</td>
                        <td className="text-right">
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                            {(cohort.retentionRate * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-right">
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                            {(cohort.churnRate * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-right font-semibold">${(cohort.avgRevenue / 1000).toFixed(1)}K</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* A/B Testing Tab */}
        <TabsContent value="abtesting" className="space-y-6">
          {abTests.map(test => (
            <Card key={test.experimentId} className="bg-white">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{test.name}</CardTitle>
                    <p className="text-sm text-slate-600 mt-1">Status: {test.status}</p>
                  </div>
                  {test.status === 'running' && (
                    <Button variant="outline" size="sm">
                      <Play className="w-4 h-4 mr-2" />
                      View Live
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Significance Badge */}
                {test.significance.isSignificant && (
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <p className="text-sm text-green-800 font-semibold">
                      ✓ Statistically Significant (p = {test.significance.pValue.toFixed(3)})
                    </p>
                  </div>
                )}

                {/* Variants Comparison */}
                <div className="grid grid-cols-2 gap-4">
                  {test.variants.map((variant, idx) => (
                    <div key={idx} className="border rounded-lg p-4 bg-slate-50">
                      <p className="font-semibold text-sm mb-3">{variant.name}</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Conversion Rate:</span>
                          <span className="font-semibold">{(variant.conversionRate * 100).toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Users:</span>
                          <span className="font-semibold">{variant.userCount.toLocaleString()}</span>
                        </div>
                        {variant.uplift && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">Uplift:</span>
                            <span className="font-semibold text-green-600">+{variant.uplift.toFixed(1)}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Results Chart */}
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={test.variants.map(v => ({
                    name: v.name,
                    'Conversion Rate': v.conversionRate * 100
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(v) => `${v.toFixed(2)}%`} />
                    <Bar dataKey="Conversion Rate" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Forecasting Tab */}
        <TabsContent value="forecast" className="space-y-6">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-lg">Revenue Forecast (12 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={REVENUE_FORECAST}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
                  <Legend />
                  <Line type="monotone" dataKey="forecast" stroke="#3b82f6" strokeWidth={2} name="Forecast" />
                  <Line type="monotone" dataKey="lower" stroke="#ef4444" strokeDasharray="5 5" name="Lower Bound" />
                  <Line type="monotone" dataKey="upper" stroke="#10b981" strokeDasharray="5 5" name="Upper Bound" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Forecast Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-white">
              <CardContent className="pt-6">
                <p className="text-slate-600 text-sm">Average Forecast</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">$100,500</p>
              </CardContent>
            </Card>
            <Card className="bg-white">
              <CardContent className="pt-6">
                <p className="text-slate-600 text-sm">Growth Rate</p>
                <p className="text-2xl font-bold text-green-600 mt-2">+12.5%</p>
              </CardContent>
            </Card>
            <Card className="bg-white">
              <CardContent className="pt-6">
                <p className="text-slate-600 text-sm">Confidence Level</p>
                <p className="text-2xl font-bold text-blue-600 mt-2">95%</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies" className="space-y-6">
          <div className="flex gap-2">
            <Button onClick={runAnomalyDetection} className="bg-blue-600 hover:bg-blue-700">
              <Play className="w-4 h-4 mr-2" />
              Run Detection
            </Button>
            <Button variant="outline">
              <Save className="w-4 h-4 mr-2" />
              Save Analysis
            </Button>
          </div>

          {anomalies.length === 0 ? (
            <Card className="bg-slate-50 border-dashed">
              <CardContent className="py-12 text-center">
                <p className="text-slate-600">No anomalies detected. Run analysis to check for unusual patterns.</p>
              </CardContent>
            </Card>
          ) : (
            anomalies.map((anomaly, idx) => (
              <Card key={idx} className="bg-white border-l-4 border-yellow-400">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{anomaly.type}</p>
                      <p className="text-sm text-slate-600 mt-1">{anomaly.description}</p>
                      <div className="flex gap-4 mt-3">
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                          Severity: {anomaly.severity}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          Confidence: {(anomaly.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

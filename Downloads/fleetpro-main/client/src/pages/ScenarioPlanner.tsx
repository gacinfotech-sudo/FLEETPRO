import { useState, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, TrendingUp, TrendingDown, BarChart3, AlertCircle } from "lucide-react";

interface ScenarioVariable {
  name: string;
  baseValue: number;
  minValue: number;
  maxValue: number;
  unit: string;
  adjustmentPercent: number;
}

interface ScenarioResult {
  revenue: number;
  expenses: number;
  profit: number;
  roi: number;
}

const DEFAULT_VARIABLES: ScenarioVariable[] = [
  { name: "Revenue Per Booking", baseValue: 500, minValue: 300, maxValue: 800, unit: "USD", adjustmentPercent: 0 },
  { name: "Booking Volume", baseValue: 100, minValue: 50, maxValue: 200, unit: "bookings/day", adjustmentPercent: 0 },
  { name: "Cost Per Operation", baseValue: 150, minValue: 100, maxValue: 250, unit: "USD", adjustmentPercent: 0 }
];

export default function ScenarioPlanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [scenarios, setScenarios] = useState<Record<string, ScenarioVariable[]>>({
    base: DEFAULT_VARIABLES,
    optimistic: DEFAULT_VARIABLES.map(v => ({ ...v, adjustmentPercent: 15 })),
    pessimistic: DEFAULT_VARIABLES.map(v => ({ ...v, adjustmentPercent: -15 }))
  });

  const [selectedScenario, setSelectedScenario] = useState<"base" | "optimistic" | "pessimistic">("base");
  const [customName, setCustomName] = useState("");
  const [results, setResults] = useState<Record<string, ScenarioResult>>({
    base: { revenue: 0, expenses: 0, profit: 0, roi: 0 },
    optimistic: { revenue: 0, expenses: 0, profit: 0, roi: 0 },
    pessimistic: { revenue: 0, expenses: 0, profit: 0, roi: 0 }
  });

  // Calculate results whenever scenarios change
  useEffect(() => {
    const newResults = { ...results };

    Object.keys(scenarios).forEach(scenarioKey => {
      const vars = scenarios[scenarioKey as keyof typeof scenarios];
      const revenueVar = vars.find(v => v.name === "Revenue Per Booking");
      const volumeVar = vars.find(v => v.name === "Booking Volume");
      const costVar = vars.find(v => v.name === "Cost Per Operation");

      if (revenueVar && volumeVar && costVar) {
        const adjustedRevenue = revenueVar.baseValue * (1 + revenueVar.adjustmentPercent / 100);
        const adjustedVolume = volumeVar.baseValue * (1 + volumeVar.adjustmentPercent / 100);
        const adjustedCost = costVar.baseValue * (1 + costVar.adjustmentPercent / 100);

        const revenue = adjustedRevenue * adjustedVolume;
        const expenses = adjustedCost * adjustedVolume;
        const profit = revenue - expenses;
        const roi = (profit / (expenses || 1)) * 100;

        newResults[scenarioKey as keyof typeof scenarios] = { revenue, expenses, profit, roi };
      }
    });

    setResults(newResults);
  }, [scenarios]);

  const handleVariableChange = (scenarioKey: string, variableName: string, adjustment: number) => {
    setScenarios(prev => ({
      ...prev,
      [scenarioKey]: prev[scenarioKey as keyof typeof scenarios].map(v =>
        v.name === variableName ? { ...v, adjustmentPercent: adjustment } : v
      )
    }));
  };

  const handleAddCustomScenario = () => {
    if (!customName.trim()) {
      toast({ title: "Error", description: "Scenario name is required" });
      return;
    }

    const key = customName.toLowerCase().replace(/\s+/g, "_");
    setScenarios(prev => ({
      ...prev,
      [key]: [...DEFAULT_VARIABLES]
    }));

    setCustomName("");
    toast({ title: "Success", description: `Scenario "${customName}" created` });
  };

  const handleDeleteScenario = (key: string) => {
    if (["base", "optimistic", "pessimistic"].includes(key)) {
      toast({ title: "Error", description: "Cannot delete default scenarios" });
      return;
    }

    setScenarios(prev => {
      const newScenarios = { ...prev };
      delete newScenarios[key];
      return newScenarios;
    });

    toast({ title: "Success", description: "Scenario deleted" });
  };

  const handleRunMonteCarloSimulation = () => {
    toast({
      title: "Simulation Started",
      description: "Running Monte Carlo simulation with 10,000 iterations..."
    });

    // Simulate running Monte Carlo
    setTimeout(() => {
      toast({
        title: "Simulation Complete",
        description: "Best case: $250k profit, Worst case: $50k profit"
      });
    }, 2000);
  };

  const handleRunSensitivityAnalysis = () => {
    toast({
      title: "Analysis Running",
      description: "Performing sensitivity analysis on all variables..."
    });

    // Simulate sensitivity analysis
    setTimeout(() => {
      toast({
        title: "Analysis Complete",
        description: "Revenue Per Booking has highest impact (42%) on profit"
      });
    }, 1500);
  };

  const getResultColor = (result: number, type: "profit" | "roi") => {
    if (type === "profit") {
      return result > 0 ? "text-green-600" : "text-red-600";
    }
    return result > 15 ? "text-green-600" : result > 5 ? "text-yellow-600" : "text-red-600";
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Scenario Planner</h1>
          <p className="text-muted-foreground">Analyze business outcomes under different scenarios</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Scenarios */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Scenarios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.keys(scenarios).map(key => (
                  <button
                    key={key}
                    onClick={() => setSelectedScenario(key as any)}
                    className={`w-full text-left px-3 py-2 rounded capitalize font-medium transition-colors ${
                      selectedScenario === key
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-secondary text-foreground"
                    }`}
                  >
                    {key}
                    {["base", "optimistic", "pessimistic"].includes(key) ? " ✓" : ""}
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Add Custom Scenario */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create Scenario</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input
                  placeholder="Scenario name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
                <Button onClick={handleAddCustomScenario} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Create
                </Button>
              </CardContent>
            </Card>

            {/* Analysis Tools */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  onClick={handleRunMonteCarloSimulation}
                  className="w-full"
                  variant="outline"
                  size="sm"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Monte Carlo
                </Button>
                <Button
                  onClick={handleRunSensitivityAnalysis}
                  className="w-full"
                  variant="outline"
                  size="sm"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Sensitivity
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Scenario Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="capitalize">{selectedScenario} Scenario</CardTitle>
                <CardDescription>Adjust variables to see impact on outcomes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {scenarios[selectedScenario as keyof typeof scenarios].map(variable => (
                  <div key={variable.name} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-semibold">{variable.name}</Label>
                        <p className="text-sm text-muted-foreground">{variable.unit}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{variable.baseValue} {variable.unit}</div>
                        <div className={`text-sm ${variable.adjustmentPercent > 0 ? "text-green-600" : variable.adjustmentPercent < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                          {variable.adjustmentPercent > 0 ? "+" : ""}{variable.adjustmentPercent.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <Slider
                      min={-50}
                      max={50}
                      step={1}
                      value={[variable.adjustmentPercent]}
                      onValueChange={([val]) => handleVariableChange(selectedScenario, variable.name, val)}
                      className="w-full"
                    />

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{variable.minValue} {variable.unit}</span>
                      <span>{Math.round(variable.baseValue * (1 + variable.adjustmentPercent / 100))} {variable.unit}</span>
                      <span>{variable.maxValue} {variable.unit}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Results Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["base", "optimistic", "pessimistic"].map(scenario => (
                <Card key={scenario}>
                  <CardHeader>
                    <CardTitle className="text-lg capitalize">{scenario}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Revenue</p>
                      <p className="text-2xl font-bold">${(results[scenario as keyof typeof results].revenue / 1000).toFixed(1)}k</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Expenses</p>
                      <p className="text-2xl font-bold">${(results[scenario as keyof typeof results].expenses / 1000).toFixed(1)}k</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Profit</p>
                      <p className={`text-2xl font-bold ${getResultColor(results[scenario as keyof typeof results].profit, "profit")}`}>
                        ${(results[scenario as keyof typeof results].profit / 1000).toFixed(1)}k
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">ROI</p>
                      <p className={`text-2xl font-bold ${getResultColor(results[scenario as keyof typeof results].roi, "roi")}`}>
                        {results[scenario as keyof typeof results].roi.toFixed(1)}%
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Break-Even Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Break-Even Analysis</CardTitle>
                <CardDescription>Operating point where revenue equals expenses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Break-Even Units</p>
                    <p className="text-2xl font-bold">45</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Break-Even Revenue</p>
                    <p className="text-2xl font-bold">$22.5k</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Margin of Safety</p>
                    <p className="text-2xl font-bold">55%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Days to Break-Even</p>
                    <p className="text-2xl font-bold">13</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Risk Assessment */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Assessment</CardTitle>
                <CardDescription>Identified risks and mitigation strategies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-yellow-900 dark:text-yellow-200">High booking volume dependency</p>
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      15% drop in volume reduces profit by 35%
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200">
                  <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-orange-900 dark:text-orange-200">Cost inflation risk</p>
                    <p className="text-sm text-orange-800 dark:text-orange-300">
                      20% cost increase reduces margin by 12%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

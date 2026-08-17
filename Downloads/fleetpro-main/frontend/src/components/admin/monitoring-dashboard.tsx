import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertCircle, CheckCircle, Clock, Zap, Database, Server } from "lucide-react";
import { apiRequest } from "../../lib/api";

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<any[]>([]);

  const { data: health = {} } = useQuery({
    queryKey: ["/api/admin/health"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/admin/health`);
        return await res.json();
      } catch {
        return {};
      }
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: performanceData = [] } = useQuery({
    queryKey: ["/api/admin/metrics/performance"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/admin/metrics/performance`);
        return await res.json();
      } catch {
        return [];
      }
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  useEffect(() => {
    if (performanceData.length > 0) {
      setMetrics(prev => [...prev.slice(-59), ...performanceData].slice(-60));
    }
  }, [performanceData]);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'critical': return <AlertCircle className="h-5 w-5 text-red-600" />;
      default: return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">System Monitoring</h2>
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Overall Status */}
      <Card className="border-2 border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Overall Health</p>
              <p className="text-3xl font-bold text-green-600">{health.overallStatus || 'HEALTHY'}</p>
            </div>
            <div className="text-right space-y-2">
              <p className="text-sm text-gray-600">Uptime</p>
              <p className="text-2xl font-bold text-green-600">{health.uptime || '99.9'}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Component Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4" />
              API Server
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge className={getStatusColor(health.apiStatus || 'healthy')}>
                {health.apiStatus || 'Healthy'}
              </Badge>
              <p className="text-xs text-gray-600">Response: {health.apiResponseTime || 0}ms</p>
              <p className="text-xs text-gray-600">Requests: {health.requestsPerSecond || 0}/s</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Database
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge className={getStatusColor(health.databaseStatus || 'healthy')}>
                {health.databaseStatus || 'Healthy'}
              </Badge>
              <p className="text-xs text-gray-600">Response: {health.dbResponseTime || 0}ms</p>
              <p className="text-xs text-gray-600">Connections: {health.dbConnections || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Cache
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge className={getStatusColor(health.cacheStatus || 'healthy')}>
                {health.cacheStatus || 'Healthy'}
              </Badge>
              <p className="text-xs text-gray-600">Hit Rate: {health.cacheHitRate || 0}%</p>
              <p className="text-xs text-gray-600">Memory: {health.cacheMemory || 0}MB</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge className={getStatusColor(health.queueStatus || 'healthy')}>
                {health.queueStatus || 'Healthy'}
              </Badge>
              <p className="text-xs text-gray-600">Pending: {health.queuePending || 0}</p>
              <p className="text-xs text-gray-600">Processed: {health.queueProcessed || 0}/min</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU & Memory */}
        <Card>
          <CardHeader>
            <CardTitle>CPU & Memory Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={metrics.slice(-30)}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCpu)" />
                <Area type="monotone" dataKey="memory" stroke="#ef4444" fillOpacity={1} fill="url(#colorMemory)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Response Time Trend */}
        <Card>
          <CardHeader>
            <CardTitle>API Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="responseTime" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Request Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Request Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="requests" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Error Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Resource Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Resource Usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">CPU Usage</span>
              <span className="text-sm font-bold">{health.cpuUsage || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${health.cpuUsage > 80 ? 'bg-red-600' : health.cpuUsage > 50 ? 'bg-yellow-600' : 'bg-green-600'}`}
                style={{ width: `${health.cpuUsage || 0}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Memory Usage</span>
              <span className="text-sm font-bold">{health.memoryUsage || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${health.memoryUsage > 80 ? 'bg-red-600' : health.memoryUsage > 50 ? 'bg-yellow-600' : 'bg-green-600'}`}
                style={{ width: `${health.memoryUsage || 0}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Disk Usage</span>
              <span className="text-sm font-bold">{health.diskUsage || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${health.diskUsage > 80 ? 'bg-red-600' : health.diskUsage > 50 ? 'bg-yellow-600' : 'bg-green-600'}`}
                style={{ width: `${health.diskUsage || 0}%` }}
              ></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

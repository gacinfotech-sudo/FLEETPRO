import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, TrendingUp, Users, Database } from 'lucide-react';

interface UsageData {
  activeUsers: {
    count: number;
    limit: number;
    trend: number;
  };
  apiCalls: {
    current: number;
    limit: number;
    trend: number;
  };
  storage: {
    used: number;
    limit: number;
    trend: number;
  };
  monthlyBreakdown: Array<{
    date: string;
    apiCalls: number;
    users: number;
  }>;
}

const TenantUsage: React.FC = () => {
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5050';

  // Fetch usage data
  const { data: usageData, isLoading } = useQuery<UsageData>({
    queryKey: ['/api/tenant/usage'],
    queryFn: async () => {
      const response = await fetch(`${apiBase}/api/tenant/usage`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch usage data');
      return response.json();
    },
    retry: 1
  });

  if (isLoading) {
    return (
      <div className="grid gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-1/3" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-10 bg-muted rounded" />
                <div className="h-10 bg-muted rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const userPercentage = usageData ? (usageData.activeUsers.count / usageData.activeUsers.limit) * 100 : 0;
  const apiPercentage = usageData ? (usageData.apiCalls.current / usageData.apiCalls.limit) * 100 : 0;
  const storagePercentage = usageData ? (usageData.storage.used / usageData.storage.limit) * 100 : 0;

  const getUsageStatus = (percentage: number): 'success' | 'warning' | 'error' => {
    if (percentage >= 90) return 'error';
    if (percentage >= 70) return 'warning';
    return 'success';
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="grid gap-6">
      {/* Usage Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Active Users Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">
              {usageData?.activeUsers.count || 0}
              <span className="text-sm text-muted-foreground font-normal">
                / {usageData?.activeUsers.limit || 0}
              </span>
            </div>
            <Progress value={userPercentage} className="h-2" />
            <div className="flex items-center gap-2 text-xs">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span className={usageData && usageData.activeUsers.trend > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                {usageData?.activeUsers.trend || 0}% this month
              </span>
            </div>
          </CardContent>
        </Card>

        {/* API Calls Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">API Calls</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">
              {(usageData?.apiCalls.current || 0).toLocaleString()}
              <span className="text-sm text-muted-foreground font-normal">
                / {(usageData?.apiCalls.limit || 0).toLocaleString()}
              </span>
            </div>
            <Progress value={apiPercentage} className="h-2" />
            <div className="flex items-center gap-2 text-xs">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span className={usageData && usageData.apiCalls.trend > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                {usageData?.apiCalls.trend || 0}% this month
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Storage Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Storage</CardTitle>
              <Database className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">
              {usageData ? formatBytes(usageData.storage.used) : '0 B'}
              <span className="text-sm text-muted-foreground font-normal">
                / {usageData ? formatBytes(usageData.storage.limit) : '0 B'}
              </span>
            </div>
            <Progress value={storagePercentage} className="h-2" />
            <div className="flex items-center gap-2 text-xs">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span className={usageData && usageData.storage.trend > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                {usageData?.storage.trend || 0}% this month
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Usage Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Usage Breakdown</CardTitle>
          <CardDescription>Current month usage statistics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Active Users */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Active Users</p>
                <p className="text-sm text-muted-foreground">
                  {usageData?.activeUsers.count || 0} of {usageData?.activeUsers.limit || 0} users
                </p>
              </div>
              <Badge
                variant={getUsageStatus(userPercentage) === 'success' ? 'default' : 'secondary'}
                className={
                  getUsageStatus(userPercentage) === 'error'
                    ? 'bg-red-600'
                    : getUsageStatus(userPercentage) === 'warning'
                    ? 'bg-yellow-600'
                    : ''
                }
              >
                {Math.round(userPercentage)}%
              </Badge>
            </div>
            <Progress value={userPercentage} className="h-3" />
            {userPercentage > 80 && (
              <p className="text-xs text-amber-600">
                You're using more than 80% of your user limit. Consider upgrading your plan.
              </p>
            )}
          </div>

          {/* API Calls */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">API Calls This Month</p>
                <p className="text-sm text-muted-foreground">
                  {(usageData?.apiCalls.current || 0).toLocaleString()} of{' '}
                  {(usageData?.apiCalls.limit || 0).toLocaleString()} calls
                </p>
              </div>
              <Badge
                variant={getUsageStatus(apiPercentage) === 'success' ? 'default' : 'secondary'}
                className={
                  getUsageStatus(apiPercentage) === 'error'
                    ? 'bg-red-600'
                    : getUsageStatus(apiPercentage) === 'warning'
                    ? 'bg-yellow-600'
                    : ''
                }
              >
                {Math.round(apiPercentage)}%
              </Badge>
            </div>
            <Progress value={apiPercentage} className="h-3" />
            {apiPercentage > 90 && (
              <Alert className="border-red-200 bg-red-50 dark:bg-red-950">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800 dark:text-red-200">
                  You've reached 90% of your API quota. Further requests may be throttled.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Storage */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Storage Used</p>
                <p className="text-sm text-muted-foreground">
                  {usageData ? formatBytes(usageData.storage.used) : '0 B'} of{' '}
                  {usageData ? formatBytes(usageData.storage.limit) : '0 B'}
                </p>
              </div>
              <Badge
                variant={getUsageStatus(storagePercentage) === 'success' ? 'default' : 'secondary'}
                className={
                  getUsageStatus(storagePercentage) === 'error'
                    ? 'bg-red-600'
                    : getUsageStatus(storagePercentage) === 'warning'
                    ? 'bg-yellow-600'
                    : ''
                }
              >
                {Math.round(storagePercentage)}%
              </Badge>
            </div>
            <Progress value={storagePercentage} className="h-3" />
            {storagePercentage > 80 && (
              <p className="text-xs text-amber-600">
                You're using more than 80% of your storage. Consider cleaning up old data.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Trend</CardTitle>
          <CardDescription>API calls usage over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usageData?.monthlyBreakdown.map((day, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{day.date}</span>
                  <span className="font-medium">{day.apiCalls.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${(day.apiCalls / (usageData?.apiCalls.limit || 1000)) * 100}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Recommendation */}
      {usageData && (apiPercentage > 80 || userPercentage > 80 || storagePercentage > 80) && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            You're approaching your usage limits. Upgrading to a higher plan will increase your quotas and prevent service interruptions.
          </AlertDescription>
        </Alert>
      )}

      {/* Usage Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Alerts</CardTitle>
          <CardDescription>Set up alerts for when you approach your limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border">
            <input type="checkbox" id="userAlert" defaultChecked className="w-4 h-4 rounded" />
            <label htmlFor="userAlert" className="flex-1 cursor-pointer text-sm">
              Alert me when active users exceed 80% of my limit
            </label>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border">
            <input type="checkbox" id="apiAlert" defaultChecked className="w-4 h-4 rounded" />
            <label htmlFor="apiAlert" className="flex-1 cursor-pointer text-sm">
              Alert me when API calls exceed 80% of my limit
            </label>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border">
            <input type="checkbox" id="storageAlert" defaultChecked className="w-4 h-4 rounded" />
            <label htmlFor="storageAlert" className="flex-1 cursor-pointer text-sm">
              Alert me when storage exceeds 80% of my limit
            </label>
          </div>
          <Button className="w-full mt-4">Save Alert Preferences</Button>
        </CardContent>
      </Card>

      {/* Optimization Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Optimization Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-2">
            <span className="text-primary">•</span>
            <span>Use API pagination to reduce request size and improve performance</span>
          </div>
          <div className="flex gap-2">
            <span className="text-primary">•</span>
            <span>Implement caching in your application to reduce API calls</span>
          </div>
          <div className="flex gap-2">
            <span className="text-primary">•</span>
            <span>Clean up old data periodically to reduce storage usage</span>
          </div>
          <div className="flex gap-2">
            <span className="text-primary">•</span>
            <span>Monitor API call patterns to identify unused integrations</span>
          </div>
          <div className="flex gap-2">
            <span className="text-primary">•</span>
            <span>Use batch operations for bulk data updates instead of individual requests</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TenantUsage;

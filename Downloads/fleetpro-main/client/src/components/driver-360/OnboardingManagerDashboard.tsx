import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Eye, CheckCircle, Clock } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface OnboardingDriver {
  _id: string;
  driverId: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    status: string;
    rating?: number;
  };
  status: 'in_progress' | 'completed' | 'paused';
  overallProgress: number;
  createdAt: string;
  completedAt?: string;
}

interface OnboardingManagerDashboardProps {
  tenantId: string;
}

const OnboardingManagerDashboard: React.FC<OnboardingManagerDashboardProps> = ({
  tenantId
}) => {
  const [checklists, setChecklists] = useState<OnboardingDriver[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/driver-onboarding/stats');
        if (!response.ok) throw new Error('Failed to fetch stats');
        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error('Error fetching stats:', err);
      }
    };

    fetchStats();
  }, []);

  // Fetch checklists
  useEffect(() => {
    const fetchChecklists = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '10'
        });

        if (filterStatus && filterStatus !== 'all') {
          params.append('status', filterStatus);
        } else if (!filterStatus) {
          // Default to incomplete
          params.append('status', 'in_progress');
        }

        const response = await fetch(`/api/driver-onboarding?${params}`);
        if (!response.ok) throw new Error('Failed to fetch checklists');

        const data = await response.json();
        setChecklists(data.data);
        setTotalPages(data.pagination.pages);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch checklists');
      } finally {
        setLoading(false);
      }
    };

    fetchChecklists();
  }, [filterStatus, page]);

  const handleFilterChange = (value: string) => {
    setFilterStatus(value);
    setPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-100 text-yellow-800">Paused</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Drivers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <p className="text-xs text-gray-500 mt-1">{stats.completionRate}% complete</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Paused</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.paused}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Driver Onboarding Status</CardTitle>
              <CardDescription>Manage and track driver onboarding progress</CardDescription>
            </div>
            <div className="w-48">
              <Select value={filterStatus} onValueChange={handleFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Incomplete</SelectItem>
                  <SelectItem value="all">All Drivers</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="text-center py-8">Loading onboarding data...</div>
          ) : checklists.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No drivers found with the selected filter</p>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checklists.map((checklist) => (
                      <TableRow key={checklist._id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{checklist.driverId.name}</p>
                            <p className="text-xs text-gray-500">{checklist.driverId.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(checklist.status)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Progress value={checklist.overallProgress} className="h-2" />
                            <span className="text-xs text-gray-600">{checklist.overallProgress}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {checklist.driverId.rating ? (
                            <span className="text-sm font-medium">
                              {checklist.driverId.rating.toFixed(1)} ⭐
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">Not rated</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-gray-600">
                            {new Date(checklist.createdAt).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Navigate to driver onboarding page
                              window.location.href = `/drivers/${checklist.driverId._id}/onboarding`;
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingManagerDashboard;

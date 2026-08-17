import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "../../lib/api";
import { Search, MoreVertical, Eye, Edit, Trash2, Mail, Download, Upload } from "lucide-react";

export default function AdvancedTenantManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedTenants, setSelectedTenants] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'revenue'>('created');
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data: tenantsData = { tenants: [], total: 0 }, isLoading } = useQuery({
    queryKey: ["/api/admin/tenants/search", search, filterStatus, filterPlan, sortBy, page],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        params.append('search', search);
        params.append('status', filterStatus);
        if (filterPlan !== 'all') params.append('plan', filterPlan);
        params.append('sortBy', sortBy);
        params.append('page', page.toString());
        params.append('limit', limit.toString());

        const res = await apiRequest("GET", `/api/admin/tenants/search?${params}`);
        return await res.json();
      } catch {
        return { tenants: [], total: 0 };
      }
    }
  });

  const bulkActionMutation = useMutation({
    mutationFn: async ({ action, tenantIds }: { action: string; tenantIds: string[] }) => {
      const res = await apiRequest("POST", `/api/admin/tenants/bulk-action`, {
        action,
        tenantIds
      });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants/search"] });
      setSelectedTenants(new Set());
      toast({
        title: "Success",
        description: `${data.processed} tenants updated`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Bulk action failed",
        variant: "destructive",
      });
    }
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTenants(new Set(tenantsData.tenants.map((t: any) => t._id)));
    } else {
      setSelectedTenants(new Set());
    }
  };

  const handleSelectTenant = (tenantId: string, checked: boolean) => {
    const newSelected = new Set(selectedTenants);
    if (checked) {
      newSelected.add(tenantId);
    } else {
      newSelected.delete(tenantId);
    }
    setSelectedTenants(newSelected);
  };

  const handleBulkAction = (action: string) => {
    if (selectedTenants.size === 0) {
      toast({
        title: "Error",
        description: "No tenants selected",
        variant: "destructive",
      });
      return;
    }

    bulkActionMutation.mutate({
      action,
      tenantIds: Array.from(selectedTenants)
    });
  };

  const handleExportTenants = async () => {
    try {
      const res = await apiRequest("GET", `/api/admin/tenants/export?format=csv`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tenants-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (error) {
      toast({
        title: "Error",
        description: "Export failed",
        variant: "destructive",
      });
    }
  };

  const { tenants = [], total = 0 } = tenantsData;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Tenant Management</h2>
        <Button onClick={handleExportTenants} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search & Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, phone..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value as any);
                setPage(1);
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              value={filterPlan}
              onChange={(e) => {
                setFilterPlan(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white"
            >
              <option value="all">All Plans</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white"
            >
              <option value="created">Newest First</option>
              <option value="name">Name (A-Z)</option>
              <option value="revenue">Revenue</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedTenants.size > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <p className="font-medium text-blue-900">
                {selectedTenants.size} tenant{selectedTenants.size !== 1 ? 's' : ''} selected
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleBulkAction('send-email')}
                  variant="outline"
                  className="gap-2"
                  size="sm"
                >
                  <Mail className="h-4 w-4" />
                  Send Email
                </Button>
                <Button
                  onClick={() => handleBulkAction('activate')}
                  variant="outline"
                  className="gap-2"
                  size="sm"
                >
                  Activate
                </Button>
                <Button
                  onClick={() => handleBulkAction('deactivate')}
                  variant="outline"
                  className="gap-2"
                  size="sm"
                >
                  Deactivate
                </Button>
                <Button
                  onClick={() => handleBulkAction('export-data')}
                  variant="outline"
                  className="gap-2"
                  size="sm"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tenants Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedTenants.size === tenants.length && tenants.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Tenant Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Monthly Revenue</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      Loading tenants...
                    </TableCell>
                  </TableRow>
                ) : tenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      No tenants found
                    </TableCell>
                  </TableRow>
                ) : (
                  tenants.map((tenant: any) => (
                    <TableRow key={tenant._id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedTenants.has(tenant._id)}
                          onCheckedChange={(checked) => handleSelectTenant(tenant._id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{tenant.name}</p>
                          <p className="text-xs text-gray-500">{tenant.businessName}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{tenant.email}</p>
                          <p className="text-gray-500">{tenant.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {tenant.subscriptionPlan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={tenant.isActive ? 'default' : 'secondary'}>
                          {tenant.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {tenant.activeUsers || 0} users
                      </TableCell>
                      <TableCell className="font-medium">
                        ₹{(tenant.monthlyRevenue || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(tenant.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-2"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{tenant.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm text-gray-600">Business Name</p>
                                <p className="font-medium">{tenant.businessName}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Email</p>
                                <p className="font-medium">{tenant.email}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Phone</p>
                                <p className="font-medium">{tenant.phone}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Plan</p>
                                <p className="font-medium">{tenant.subscriptionPlan}</p>
                              </div>
                              <div className="flex gap-2 pt-4">
                                <Button variant="outline" className="flex-1 gap-2">
                                  <Eye className="h-4 w-4" />
                                  View Details
                                </Button>
                                <Button variant="outline" className="flex-1 gap-2">
                                  <Edit className="h-4 w-4" />
                                  Edit
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-6">
              <p className="text-sm text-gray-600">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} tenants
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  variant="outline"
                >
                  Previous
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => page - 2 + i).filter(p => p > 0 && p <= totalPages).map(p => (
                  <Button
                    key={p}
                    onClick={() => setPage(p)}
                    variant={page === p ? 'default' : 'outline'}
                    className="w-10"
                  >
                    {p}
                  </Button>
                ))}
                <Button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

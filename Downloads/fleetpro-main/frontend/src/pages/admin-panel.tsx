import { useState, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Car, Calendar, Plus, Search, LogOut, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ClientForm from "../components/admin/client-form";
import ManagerControlModal from "../components/admin/manager-control-modal";
import PlanManagementModal from "../components/admin/plan-management-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function AdminPanel() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Debug logging
  useEffect(() => {
  }, []);
  const [searchTerm, setSearchTerm] = useState("");
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<any>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [selectedTenantForManagers, setSelectedTenantForManagers] = useState<any>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedTenantForPlan, setSelectedTenantForPlan] = useState<any>(null);
  
  // Confirmation dialog states
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showDeactivateAllConfirmation, setShowDeactivateAllConfirmation] = useState(false);
  const [selectedTenantForAction, setSelectedTenantForAction] = useState<any>(null);
  const [confirmationText, setConfirmationText] = useState("");

  const { data: tenants = [], isLoading: tenantsLoading, error: tenantsError } = useQuery({
    queryKey: ["/api/admin/tenants"]
  });

  // Handle tenant loading error
  useEffect(() => {
    if (tenantsError) {
      console.error('Failed to load tenants:', tenantsError);
      toast({
        title: "Error",
        description: "Failed to load clients data",
        variant: "destructive",
      });
    }
  }, [tenantsError]);

  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ["/api/admin/users"]
  });

  useEffect(() => {
    if (usersError) {
      console.error('Failed to load users:', usersError);
      toast({
        title: "Error", 
        description: "Failed to load users data",
        variant: "destructive",
      });
    }
  }, [usersError]);



  const deleteTenantMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/tenants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "Client and associated user deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete client",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, tempPassword }: { userId: string; tempPassword: string }) => {
      await apiRequest("POST", `/api/admin/users/${userId}/reset-password`, {
        tempPassword
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setShowResetPasswordDialog(false);
      setSelectedUserForReset(null);
      setTempPassword("");
      toast({
        title: "Password Reset Successful",
        description: `Temporary password set for ${selectedUserForReset.userId}. The user can now login with the temporary password and will be required to set a new password. All user data remains intact.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  const toggleActivationMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}/toggle-activation`, {
        isActive
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User activation status updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update activation status",
        variant: "destructive",
      });
    },
  });

  const deactivateAllMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      await apiRequest("PATCH", `/api/admin/tenants/${tenantId}/deactivate-all`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "Client and all managers deactivated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate client and managers",
        variant: "destructive",
      });
    },
  });

  const activateAllMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      await apiRequest("PATCH", `/api/admin/tenants/${tenantId}/activate-all`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "Client and all managers activated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to activate client and managers",
        variant: "destructive",
      });
    },
  });

  const handleLogout = async () => {
    // Log admin logout for security audit
    await logout();
  };

  // Add session activity tracking
  useEffect(() => {
    const logActivity = () => {
    };
    
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      document.addEventListener(event, logActivity, { passive: true });
    });
    
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, logActivity);
      });
    };
  }, []);

  const handleResetPassword = () => {
    if (!tempPassword) {
      toast({
        title: "Error",
        description: "Please enter a temporary password",
        variant: "destructive",
      });
      return;
    }

    if (tempPassword.length < 6) {
      toast({
        title: "Error",
        description: "Temporary password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    resetPasswordMutation.mutate({
      userId: selectedUserForReset._id || selectedUserForReset.id,
      tempPassword
    });
  };

  const filteredTenants = (tenants as any[]).filter((tenant: any) =>
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.businessName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate stats
  const activeTenants = (tenants as any[]).filter((t: any) => t.isActive).length;
  const totalVehicles = 0; // Would need to aggregate from all tenants
  const todayBookings = 0; // Would need to aggregate from all tenants

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                <Shield className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
                <p className="text-sm text-gray-500">Super Administrator</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Dialog open={showClientForm} onOpenChange={setShowClientForm}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2" size={16} />
                    Add Client
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingClient ? "Edit Client" : "Add New Client"}
                    </DialogTitle>
                  </DialogHeader>
                  <ClientForm
                    client={editingClient}
                    onSuccess={() => {
                      setShowClientForm(false);
                      setEditingClient(null);
                    }}
                  />
                </DialogContent>
              </Dialog>
              <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="mr-2" size={16} />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="text-blue-600" size={24} />
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-bold text-gray-900">{activeTenants}</h3>
                  <p className="text-gray-600">Active Clients</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Car className="text-green-600" size={24} />
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-bold text-gray-900">{totalVehicles}</h3>
                  <p className="text-gray-600">Total Vehicles</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Calendar className="text-purple-600" size={24} />
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-bold text-gray-900">{todayBookings}</h3>
                  <p className="text-gray-600">Today's Bookings</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Functions Info */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Available Admin Functions:</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs text-blue-700">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span><strong>Edit:</strong> Modify client details</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  <span><strong>Reset Password:</strong> Set temporary password for forgotten passwords</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span><strong>Activate/Deactivate:</strong> Control user access</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  <span><strong>Delete:</strong> Remove client and all data</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Client Management Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl font-semibold text-gray-900">
                Client Management
              </CardTitle>
              <div className="flex space-x-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <Input
                    placeholder="Search clients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Button 
                  onClick={() => {
                    setEditingClient(null);
                    setShowClientForm(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="mr-2" size={16} />
                  Add Client
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {tenantsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Managers</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.map((tenant: any) => {
                    const tenantId = tenant._id || tenant.id;
                    const clientUser = (users as any[]).find((user: any) => {
                      const userTenantId = user.tenantId?._id || user.tenantId?.id || user.tenantId;
                      return userTenantId === tenantId || userTenantId?.toString() === tenantId?.toString();
                    });
                    return (
                      <TableRow key={tenant._id || tenant.id}>
                        <TableCell>
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-medium">
                                {tenant.name.substring(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{tenant.name}</div>
                              <div className="text-sm text-gray-500">{tenant.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{clientUser?.userId || "N/A"}</TableCell>
                        <TableCell>{tenant.businessName}</TableCell>
                        <TableCell>{tenant.phone}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedTenantForManagers(tenant);
                              setShowManagerModal(true);
                            }}
                            className="flex items-center space-x-1"
                          >
                            <Users className="w-4 h-4" />
                            <span>View Managers</span>
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Badge variant={tenant.isActive ? "default" : "secondary"}>
                            {tenant.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-1 flex-wrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingClient(tenant);
                                setShowClientForm(true);
                              }}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              Edit
                            </Button>

                            {/* Manage Plan Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedTenantForPlan(tenant);
                                setShowPlanModal(true);
                              }}
                              className="text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100"
                            >
                              <Settings className="w-3 h-3 mr-1" />
                              Plan
                            </Button>
                            
                            {/* Reset Password Button - Always show if clientUser exists */}
                            {clientUser ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedUserForReset(clientUser);
                                  setShowResetPasswordDialog(true);
                                }}
                                className="text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100"
                              >
                                Reset Password
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled
                                className="text-gray-400"
                                title="No user found for this tenant"
                              >
                                No User
                              </Button>
                            )}
                            
                            {/* Activate/Deactivate Button */}
                            {clientUser && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  toggleActivationMutation.mutate({
                                    userId: clientUser._id || clientUser.id,
                                    isActive: !clientUser.isActive
                                  });
                                }}
                                disabled={toggleActivationMutation.isPending}
                                className={`${clientUser.isActive 
                                  ? 'text-yellow-600 hover:text-yellow-700 bg-yellow-50 hover:bg-yellow-100' 
                                  : 'text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100'
                                }`}
                              >
                                {clientUser.isActive ? "Deactivate" : "Activate"}
                              </Button>
                            )}
                            
                            {/* Activate All / Deactivate All Button */}
                            {tenant.isActive ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedTenantForAction(tenant);
                                  setShowDeactivateAllConfirmation(true);
                                  setConfirmationText("");
                                }}
                                className="text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100"
                              >
                                Deactivate All
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(`This will enable login for ${tenant.name} and all its sub-users. Continue?`)) {
                                    activateAllMutation.mutate(tenant._id || tenant.id);
                                  }
                                }}
                                className="text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100"
                              >
                                Activate All
                              </Button>
                            )}
                            
                            {/* Delete Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedTenantForAction(tenant);
                                setShowDeleteConfirmation(true);
                                setConfirmationText("");
                              }}
                              className="text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100"
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Shield className="text-orange-600" size={20} />
              <span>Reset User Password</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
              <div className="text-sm text-orange-800">
                <p className="font-medium mb-2">User: {selectedUserForReset?.userId}</p>
                <p className="text-xs mb-2">
                  <strong>Password Reset Process:</strong>
                </p>
                <ul className="text-xs space-y-1 ml-4">
                  <li>• You set a temporary password for the client</li>
                  <li>• Client can login with this temporary password</li>
                  <li>• Client will be forced to set their own new password</li>
                  <li>• All user data (vehicles, drivers, bookings, reports) remain intact</li>
                  <li>• No data loss occurs during password reset</li>
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="tempPassword" className="text-sm font-medium">
                Temporary Password
              </Label>
              <Input
                id="tempPassword"
                type="text"
                placeholder="Enter temporary password (min 6 characters)"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                className="h-10"
              />
              <p className="text-xs text-gray-500">
                Suggested format: temp@123, reset@456, etc.
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowResetPasswordDialog(false);
                  setSelectedUserForReset(null);
                  setTempPassword("");
                }}
                disabled={resetPasswordMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={resetPasswordMutation.isPending || !tempPassword}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {resetPasswordMutation.isPending ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Resetting...</span>
                  </div>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manager Control Modal */}
      <ManagerControlModal
        isOpen={showManagerModal}
        onClose={() => {
          setShowManagerModal(false);
          setSelectedTenantForManagers(null);
        }}
        tenant={selectedTenantForManagers}
      />

      {/* Plan Management Modal */}
      <PlanManagementModal
        isOpen={showPlanModal}
        onClose={() => {
          setShowPlanModal(false);
          setSelectedTenantForPlan(null);
        }}
        tenant={selectedTenantForPlan}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-red-600">
              <Shield className="text-red-600" size={20} />
              <span>⚠️ DANGEROUS ACTION - DELETE CLIENT</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="text-sm text-red-800">
                <p className="font-bold mb-3">⚠️ THIS ACTION IS IRREVERSIBLE!</p>
                <p className="font-medium mb-2">Client: {selectedTenantForAction?.name}</p>
                <p className="font-medium mb-3">What will be PERMANENTLY DELETED:</p>
                <ul className="text-xs space-y-1 ml-4 mb-3">
                  <li>• Client company and business profile</li>
                  <li>• All vehicles and driver records</li>
                  <li>• Complete booking history and revenue data</li>
                  <li>• All manager accounts and sub-users</li>
                  <li>• All expenses and financial records</li>
                  <li>• All uploaded documents and signatures</li>
                </ul>
                <p className="font-bold text-red-900">
                  This will completely remove all data for this client!
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="deleteConfirmation" className="text-sm font-medium">
                Type "DELETE PERMANENTLY" to confirm:
              </Label>
              <Input
                id="deleteConfirmation"
                type="text"
                placeholder="Type DELETE PERMANENTLY"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                className="h-10"
              />
              <p className="text-xs text-red-600">
                This action cannot be undone. All client data will be lost forever.
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirmation(false);
                  setSelectedTenantForAction(null);
                  setConfirmationText("");
                }}
                disabled={deleteTenantMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirmationText === "DELETE PERMANENTLY") {
                    deleteTenantMutation.mutate(selectedTenantForAction._id || selectedTenantForAction.id);
                    setShowDeleteConfirmation(false);
                    setSelectedTenantForAction(null);
                    setConfirmationText("");
                  }
                }}
                disabled={deleteTenantMutation.isPending || confirmationText !== "DELETE PERMANENTLY"}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteTenantMutation.isPending ? "Deleting..." : "DELETE PERMANENTLY"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deactivate All Confirmation Dialog */}
      <Dialog open={showDeactivateAllConfirmation} onOpenChange={setShowDeactivateAllConfirmation}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-orange-600">
              <Shield className="text-orange-600" size={20} />
              <span>⚠️ DEACTIVATE ALL USERS</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="text-sm text-orange-800">
                <p className="font-bold mb-3">⚠️ THIS WILL DISABLE ALL ACCESS!</p>
                <p className="font-medium mb-2">Client: {selectedTenantForAction?.name}</p>
                <p className="font-medium mb-3">What will happen:</p>
                <ul className="text-xs space-y-1 ml-4 mb-3">
                  <li>• Client owner will be unable to login</li>
                  <li>• All manager accounts will be disabled</li>
                  <li>• All sub-users will lose access</li>
                  <li>• Fleet management will be suspended</li>
                  <li>• Booking system will be inaccessible</li>
                  <li>• Revenue reports will be unavailable</li>
                </ul>
                <p className="font-bold text-orange-900">
                  NO DATA WILL BE DELETED - Only access will be disabled
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="deactivateConfirmation" className="text-sm font-medium">
                Type "DEACTIVATE ALL" to confirm:
              </Label>
              <Input
                id="deactivateConfirmation"
                type="text"
                placeholder="Type DEACTIVATE ALL"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                className="h-10"
              />
              <p className="text-xs text-orange-600">
                This will disable login for the client and all sub-users.
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeactivateAllConfirmation(false);
                  setSelectedTenantForAction(null);
                  setConfirmationText("");
                }}
                disabled={deactivateAllMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirmationText === "DEACTIVATE ALL") {
                    deactivateAllMutation.mutate(selectedTenantForAction._id || selectedTenantForAction.id);
                    setShowDeactivateAllConfirmation(false);
                    setSelectedTenantForAction(null);
                    setConfirmationText("");
                  }
                }}
                disabled={deactivateAllMutation.isPending || confirmationText !== "DEACTIVATE ALL"}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {deactivateAllMutation.isPending ? "Deactivating..." : "DEACTIVATE ALL"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

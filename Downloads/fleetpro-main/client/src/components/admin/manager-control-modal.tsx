import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Users, 
  RotateCcw, 
  Trash2, 
  Ban, 
  Eye, 
  EyeOff,
  Settings
} from "lucide-react";

interface ManagerControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: any;
}

export default function ManagerControlModal({
  isOpen,
  onClose,
  tenant,
}: ManagerControlModalProps) {
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [selectedManager, setSelectedManager] = useState<any>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [passwordConfirmed, setPasswordConfirmed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showManagerLimitDialog, setShowManagerLimitDialog] = useState(false);
  const [newManagerLimit, setNewManagerLimit] = useState(tenant?.maxManagers || 5);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch managers for this tenant
  const { data: managers = [], isLoading } = useQuery({
    queryKey: [`/api/admin/tenants/${tenant?._id || tenant?.id}/managers`],
    enabled: isOpen && !!tenant,
  });

  // Reset manager password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ managerId, tempPassword }: { managerId: string; tempPassword: string }) => {
      await apiRequest("POST", `/api/admin/managers/${managerId}/reset-password`, {
        tempPassword
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/tenants/${tenant?._id || tenant?.id}/managers`] });
      setShowResetDialog(false);
      setSelectedManager(null);
      setTempPassword("");
      setPasswordConfirmed(false);
      toast({
        title: "Password Reset Successful",
        description: `Temporary password set for ${selectedManager?.userId}. Manager can now login and will be required to set a new password.`,
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

  // Delete manager mutation
  const deleteManagerMutation = useMutation({
    mutationFn: async (managerId: string) => {
      await apiRequest("DELETE", `/api/admin/managers/${managerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/tenants/${tenant?._id || tenant?.id}/managers`] });
      toast({
        title: "Manager Deleted",
        description: "Manager account has been permanently deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete manager",
        variant: "destructive",
      });
    },
  });

  // Toggle manager activation mutation
  const toggleActivationMutation = useMutation({
    mutationFn: async ({ managerId, isActive }: { managerId: string; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/admin/users/${managerId}/toggle-activation`, {
        isActive
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/tenants/${tenant?._id || tenant?.id}/managers`] });
      toast({
        title: "Manager Status Updated",
        description: "Manager activation status updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update manager status",
        variant: "destructive",
      });
    },
  });

  // Update manager limit mutation
  const updateManagerLimitMutation = useMutation({
    mutationFn: async (maxManagers: number) => {
      await apiRequest("PATCH", `/api/admin/tenants/${tenant?._id || tenant?.id}/manager-limit`, {
        maxManagers
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      setShowManagerLimitDialog(false);
      toast({
        title: "Manager Limit Updated",
        description: `Manager limit set to ${newManagerLimit} for ${tenant.name}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update manager limit",
        variant: "destructive",
      });
    },
  });

  const handleResetPassword = () => {
    if (!tempPassword || tempPassword.length < 6) {
      toast({
        title: "Error",
        description: "Temporary password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    if (!passwordConfirmed) {
      toast({
        title: "Error",
        description: "Please confirm you have shared this password with the user",
        variant: "destructive",
      });
      return;
    }

    resetPasswordMutation.mutate({
      managerId: selectedManager._id || selectedManager.id,
      tempPassword
    });
  };

  const handleDeleteManager = (manager: any) => {
    deleteManagerMutation.mutate(manager._id || manager.id);
  };

  const handleToggleActivation = (manager: any) => {
    toggleActivationMutation.mutate({
      managerId: manager._id || manager.id,
      isActive: !manager.isActive
    });
  };

  const handleUpdateManagerLimit = () => {
    if (newManagerLimit < 0) {
      toast({
        title: "Error",
        description: "Manager limit cannot be negative",
        variant: "destructive",
      });
      return;
    }

    updateManagerLimitMutation.mutate(newManagerLimit);
  };

  if (!tenant) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Manager Control - {tenant.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowManagerLimitDialog(true)}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Set Limit ({tenant.maxManagers || 5})
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (managers as any[]).length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Managers</h3>
                <p className="text-gray-600">This client hasn't created any manager accounts yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Manager</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(managers as any[]).map((manager: any) => (
                    <TableRow key={manager._id || manager.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{manager.userId}</div>
                          <div className="text-sm text-gray-500">
                            Role: {manager.role}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={manager.isActive ? "default" : "destructive"}>
                          {manager.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {manager.lastLogin 
                          ? new Date(manager.lastLogin).toLocaleDateString()
                          : "Never"
                        }
                      </TableCell>
                      <TableCell>
                        {new Date(manager.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedManager(manager);
                              setShowResetDialog(true);
                            }}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActivation(manager)}
                            disabled={toggleActivationMutation.isPending}
                          >
                            <Ban className="w-4 h-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Manager</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to permanently delete manager "{manager.userId}"? 
                                  This action cannot be undone and will remove all their access.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteManager(manager)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete Manager
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Manager Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Manager: {selectedManager?.userId}</Label>
            </div>
            <div>
              <Label htmlFor="temp-password">Temporary Password</Label>
              <div className="relative">
                <Input
                  id="temp-password"
                  type={showPassword ? "text" : "password"}
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="Enter temporary password (min 6 chars)"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="password-confirmed"
                checked={passwordConfirmed}
                onCheckedChange={(checked) => setPasswordConfirmed(checked as boolean)}
              />
              <Label htmlFor="password-confirmed" className="text-sm">
                I have shared this password with the user
              </Label>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleResetPassword}
                disabled={resetPasswordMutation.isPending}
                className="flex-1"
              >
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowResetDialog(false);
                  setTempPassword("");
                  setPasswordConfirmed(false);
                  setSelectedManager(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manager Limit Dialog */}
      <Dialog open={showManagerLimitDialog} onOpenChange={setShowManagerLimitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Manager Limit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Client: {tenant.name}</Label>
            </div>
            <div>
              <Label htmlFor="manager-limit">Maximum Managers Allowed</Label>
              <Input
                id="manager-limit"
                type="number"
                min="0"
                value={newManagerLimit}
                onChange={(e) => setNewManagerLimit(Number(e.target.value))}
              />
            </div>
            <div className="text-sm text-gray-600">
              Current managers: {(managers as any[]).length} / {tenant.maxManagers || 5}
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleUpdateManagerLimit}
                disabled={updateManagerLimitMutation.isPending}
                className="flex-1"
              >
                {updateManagerLimitMutation.isPending ? "Updating..." : "Update Limit"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowManagerLimitDialog(false);
                  setNewManagerLimit(tenant.maxManagers || 5);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
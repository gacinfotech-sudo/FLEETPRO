import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Settings, Users, Car, UserCheck, Shield, Power, Trash2 } from "lucide-react";

const planSchema = z.object({
  subscriptionPlan: z.enum(["starter", "pro", "custom"]),
  limits: z.object({
    vehicles: z.number().min(1, "Vehicle limit must be at least 1"),
    drivers: z.number().min(1, "Driver limit must be at least 1"),
    managers: z.number().min(1, "Manager limit must be at least 1"),
  }),
});

type PlanFormData = z.infer<typeof planSchema>;

const PLAN_PRESETS = {
  starter: { vehicles: 6, drivers: 3, managers: 1 },
  pro: { vehicles: 40, drivers: 60, managers: 20 },
  custom: { vehicles: 1, drivers: 1, managers: 1 }
};

interface PlanManagementModalProps {
  tenant: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function PlanManagementModal({ tenant, isOpen, onClose }: PlanManagementModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  // Fetch current plan details
  const { data: planData, isLoading: planLoading } = useQuery({
    queryKey: [`/api/admin/tenants/${tenant?._id || tenant?.id}/plan`],
    enabled: isOpen && !!tenant,
  });

  // Fetch usage statistics
  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: [`/api/admin/tenants/${tenant?._id || tenant?.id}/usage`],
    enabled: isOpen && !!tenant,
  });

  const form = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      subscriptionPlan: "starter",
      limits: { vehicles: 6, drivers: 3, managers: 1 },
    },
  });

  // Update form when plan data loads
  useEffect(() => {
    if (planData) {
      form.reset({
        subscriptionPlan: (planData as any).subscriptionPlan || 'starter',
        limits: (planData as any).limits || { vehicles: 6, drivers: 3, managers: 1 },
      });
    }
  }, [planData, form]);

  const updatePlanMutation = useMutation({
    mutationFn: async (data: PlanFormData) => {
      const response = await apiRequest("PATCH", `/api/admin/tenants/${tenant._id || tenant.id}/plan`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/tenants/${tenant._id || tenant.id}/plan`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/tenants/${tenant._id || tenant.id}/usage`] });
      toast({
        title: "Success",
        description: "Plan updated successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update plan",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: PlanFormData) => {
    setIsLoading(true);
    try {
      await updatePlanMutation.mutateAsync(data);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlanChange = (newPlan: string) => {
    if (newPlan !== 'custom') {
      const preset = PLAN_PRESETS[newPlan as keyof typeof PLAN_PRESETS];
      form.setValue('limits', preset);
    }
  };

  if (!tenant) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Manage Plan - {tenant.businessName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Client Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Client Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Client Name</p>
                  <p className="text-base font-semibold">{tenant.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Business Name</p>
                  <p className="text-base font-semibold">{tenant.businessName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="text-base">{tenant.email || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <Badge variant={tenant.isActive ? "default" : "secondary"}>
                    {tenant.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Usage */}
          {usageData && (usageData as any).vehicles && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <Car className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Vehicles</p>
                      <p className="text-xl font-bold">
                        {(usageData as any).vehicles.current} / {(usageData as any).vehicles.limit}
                      </p>
                      <Badge variant={(usageData as any).vehicles.canAdd ? "default" : "destructive"}>
                        {(usageData as any).vehicles.canAdd ? "Can Add" : "Limit Reached"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <Users className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Drivers</p>
                      <p className="text-xl font-bold">
                        {(usageData as any).drivers.current} / {(usageData as any).drivers.limit}
                      </p>
                      <Badge variant={(usageData as any).drivers.canAdd ? "default" : "destructive"}>
                        {(usageData as any).drivers.canAdd ? "Can Add" : "Limit Reached"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                    <UserCheck className="h-8 w-8 text-purple-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Managers</p>
                      <p className="text-xl font-bold">
                        {(usageData as any).managers.current} / {(usageData as any).managers.limit}
                      </p>
                      <Badge variant={(usageData as any).managers.canAdd ? "default" : "destructive"}>
                        {(usageData as any).managers.canAdd ? "Can Add" : "Limit Reached"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Plan Management Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Update Subscription Plan</CardTitle>
            </CardHeader>
            <CardContent>
              {planLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="subscriptionPlan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plan Type</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              handlePlanChange(value);
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a plan" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="starter">
                                <div className="flex flex-col">
                                  <span className="font-medium">Starter</span>
                                  <span className="text-sm text-gray-500">6 vehicles, 3 drivers, 1 manager</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="pro">
                                <div className="flex flex-col">
                                  <span className="font-medium">Pro</span>
                                  <span className="text-sm text-gray-500">40 vehicles, 60 drivers, 20 managers</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="custom">
                                <div className="flex flex-col">
                                  <span className="font-medium">Custom</span>
                                  <span className="text-sm text-gray-500">Set custom limits</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Resource Limits */}
                    <div>
                      <h4 className="text-md font-medium text-gray-800 mb-3">Resource Limits</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="limits.vehicles"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Vehicle Limit</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  placeholder="Maximum vehicles"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                  disabled={form.watch('subscriptionPlan') !== 'custom'}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="limits.drivers"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Driver Limit</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  placeholder="Maximum drivers"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                  disabled={form.watch('subscriptionPlan') !== 'custom'}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="limits.managers"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Manager Limit</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  placeholder="Maximum managers"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                  disabled={form.watch('subscriptionPlan') !== 'custom'}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-4">
                      <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isLoading || updatePlanMutation.isPending}>
                        {isLoading || updatePlanMutation.isPending ? "Updating..." : "Update Plan"}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
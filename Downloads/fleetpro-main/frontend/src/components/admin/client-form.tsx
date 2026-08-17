import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  businessName: z.string().min(1, "Business name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean().default(true),
  userId: z.string().min(3, "User ID must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  subscriptionPlan: z.enum(["starter", "pro", "custom"]).default("starter"),
  limits: z.object({
    vehicles: z.number().min(1, "Vehicle limit must be at least 1"),
    drivers: z.number().min(1, "Driver limit must be at least 1"),
    managers: z.number().min(1, "Manager limit must be at least 1"),
  }),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientFormProps {
  client?: any;
  onSuccess: () => void;
}

// Plan presets
const PLAN_PRESETS = {
  starter: { vehicles: 6, drivers: 3, managers: 1 },
  pro: { vehicles: 40, drivers: 60, managers: 20 },
  custom: { vehicles: 1, drivers: 1, managers: 1 }
};

export default function ClientForm({ client, onSuccess }: ClientFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: client?.name || "",
      businessName: client?.businessName || "",
      email: client?.email || "",
      phone: client?.phone || "",
      address: client?.address || "",
      isActive: client?.isActive ?? true,
      userId: "",
      password: "",
      subscriptionPlan: client?.subscriptionPlan || "starter",
      limits: {
        vehicles: client?.limits?.vehicles || 6,
        drivers: client?.limits?.drivers || 3,
        managers: client?.limits?.managers || 1,
      },
    },
  });

  const createTenantMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      // First create the tenant with subscription plan
      const tenantResponse = await apiRequest("POST", "/api/admin/tenants", {
        name: data.name,
        businessName: data.businessName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        isActive: data.isActive,
        subscriptionPlan: data.subscriptionPlan,
        limits: data.limits,
      });
      
      const tenant = await tenantResponse.json();
      
      // Then create the user for this tenant
      await apiRequest("POST", "/api/admin/users", {
        userId: data.userId,
        password: data.password,
        role: "client",
        tenantId: tenant._id || tenant.id,
        isActive: true,
      });
      
      return tenant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "Client created successfully",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create client",
        variant: "destructive",
      });
    },
  });

  const updateTenantMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const response = await apiRequest("PUT", `/api/admin/tenants/${client.id}`, {
        name: data.name,
        businessName: data.businessName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        isActive: data.isActive,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      toast({
        title: "Success",
        description: "Client updated successfully",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update client",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: ClientFormData) => {
    setIsLoading(true);
    try {
      if (client) {
        await updateTenantMutation.mutateAsync(data);
      } else {
        await createTenantMutation.mutateAsync(data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter full name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="businessName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter business name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email (Optional)</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="Enter email address" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Enter phone number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Enter business address" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Subscription Plan Section */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Subscription Plan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="subscriptionPlan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan Type</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value !== 'custom') {
                        const preset = PLAN_PRESETS[value as keyof typeof PLAN_PRESETS];
                        form.setValue('limits', preset);
                      }
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
          </div>

          {/* Resource Limits */}
          <div className="mt-4">
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
        </div>

        {!client && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Login Credentials</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter user ID for login" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between">
              <FormLabel>Active Status</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={onSuccess}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : client ? "Update Client" : "Create Client"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

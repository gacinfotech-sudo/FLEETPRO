import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "../../hooks/use-auth";
import { Car, AlertTriangle, Shield } from "lucide-react";

const vehicleSchema = z.object({
  make: z.string().min(1, "Vehicle name is required"),
  model: z.string().optional(),
  year: z.number().min(1900, "Valid year is required").optional(),
  registrationNumber: z.string().optional(),
  vehicleType: z.enum(["hatchback", "sedan", "suv", "economy", "standard", "premium", "luxury", "coupe", "convertible"]).optional(),
  ratePerDay: z.number().min(0).optional(),
  ratePerKm: z.number().min(0).optional(),
  status: z.enum(["available", "on_trip", "maintenance"]).default("available"),
});

type VehicleFormData = z.infer<typeof vehicleSchema>;

interface VehicleFormProps {
  vehicle?: any;
  onSuccess: () => void;
}

export default function VehicleForm({ vehicle, onSuccess }: VehicleFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Get current vehicles count and plan info
  const { data: vehicles } = useQuery({
    queryKey: ["/api/vehicles"]
  });

  const currentVehicleCount = Array.isArray(vehicles) ? vehicles.length : 0;
  const planLimits = (user?.tenantId as any)?.limits;
  const subscriptionPlan = (user?.tenantId as any)?.subscriptionPlan;
  const vehicleLimit = planLimits?.vehicles || 0;
  const remainingSlots = Math.max(0, vehicleLimit - currentVehicleCount);

  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      make: vehicle?.make || "",
      model: vehicle?.model || "",
      year: vehicle?.year || undefined,
      registrationNumber: vehicle?.registrationNumber || "",
      vehicleType: vehicle?.vehicleType || undefined,
      ratePerDay: vehicle?.ratePerDay || undefined,
      ratePerKm: vehicle?.ratePerKm || vehicle?.pricePerKm || undefined,
      status: vehicle?.status || "available",
    },
  });

  const createVehicleMutation = useMutation({
    mutationFn: async (data: VehicleFormData) => {
      const response = await apiRequest("POST", "/api/vehicles", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({
        title: "Success",
        description: "Vehicle created successfully",
      });
      onSuccess();
    },
    onError: (error: any) => {
      // Enhanced error handling with better UI
      const errorMessage = error.message || "Failed to create vehicle";
      
      // Show different error styles based on error type
      if (errorMessage.includes("maximum") || errorMessage.includes("limit")) {
        toast({
          title: "🚫 Vehicle Limit Reached",
          description: errorMessage,
          variant: "destructive",
          duration: 5000,
        });
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  const updateVehicleMutation = useMutation({
    mutationFn: async (data: VehicleFormData) => {
      const vehicleId = vehicle._id || vehicle.id;
      const response = await apiRequest("PUT", `/api/vehicles/${vehicleId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({
        title: "Success",
        description: "Vehicle updated successfully",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update vehicle",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: VehicleFormData) => {
    if (vehicle) {
      await updateVehicleMutation.mutateAsync(data);
    } else {
      await createVehicleMutation.mutateAsync(data);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Plan Limit Notification */}
        {!vehicle && subscriptionPlan && (
          <Card className="border-l-4 border-l-blue-500 bg-blue-50/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Car className="w-4 h-4 text-blue-600" />
                    <h4 className="font-medium text-blue-900 capitalize">
                      {subscriptionPlan} Plan
                    </h4>
                  </div>
                  <p className="text-sm text-blue-700">
                    You can create up to <span className="font-semibold">{vehicleLimit} vehicles</span>.
                    Currently using <span className="font-semibold">{currentVehicleCount}</span>, 
                    <span className="ml-1 font-semibold text-green-600">
                      {remainingSlots} slots remaining
                    </span>.
                  </p>
                  {remainingSlots === 0 && (
                    <div className="mt-2 flex items-center gap-2 text-amber-700">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Vehicle limit reached. Contact admin to upgrade your plan.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="make"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vehicle Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Maruti, Honda" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Swift, City" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Year (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="2023" 
                    {...field} 
                    onChange={(e) => {
                      const value = e.target.value;
                      field.onChange(value ? parseInt(value) : undefined);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="registrationNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Registration Number (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., DL 01 AB 1234" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="vehicleType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vehicle Type (Optional)</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle type (optional)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="hatchback">Hatchback</SelectItem>
                    <SelectItem value="sedan">Sedan</SelectItem>
                    <SelectItem value="suv">SUV</SelectItem>
                    <SelectItem value="economy">Economy</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="luxury">Luxury</SelectItem>
                    <SelectItem value="coupe">Coupe</SelectItem>
                    <SelectItem value="convertible">Convertible</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ratePerDay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rate per Day (₹) (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="1500" 
                    {...field} 
                    onChange={(e) => {
                      const value = e.target.value;
                      field.onChange(value ? parseFloat(value) : undefined);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ratePerKm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rate per Km (₹) (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01"
                    placeholder="12.50" 
                    {...field} 
                    onChange={(e) => {
                      const value = e.target.value;
                      field.onChange(value ? parseFloat(value) : undefined);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="on_trip">On Trip</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={onSuccess}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={createVehicleMutation.isPending || updateVehicleMutation.isPending}
          >
            {(createVehicleMutation.isPending || updateVehicleMutation.isPending) 
              ? "Saving..." 
              : vehicle ? "Update Vehicle" : "Add Vehicle"
            }
          </Button>
        </div>
      </form>
    </Form>
  );
}

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { apiRequest } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "../../hooks/use-auth";
import { Users, AlertTriangle, Shield, ChevronDown, ChevronRight, FileText, Calendar, MapPin, User, CreditCard } from "lucide-react";

const driverSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  licenseNumber: z.string().optional(),
  experience: z.number().min(0, "Experience must be a positive number").optional(),
  rating: z.number().min(1).max(5).default(5),
  status: z.enum(["available", "on_duty", "inactive"]).default("available"),
  // Additional fields - UI only
  permanentAddress: z.string().optional(),
  currentAddress: z.string().optional(),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
  aadharNumber: z.string().optional(),
  panNumber: z.string().optional(),
  dateOfJoining: z.string().optional(),
});

type DriverFormData = z.infer<typeof driverSchema>;

interface DriverFormProps {
  driver?: any;
  onSuccess: () => void;
}

export default function DriverForm({ driver, onSuccess }: DriverFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isAdditionalDetailsOpen, setIsAdditionalDetailsOpen] = useState(false);

  // Get current drivers count and plan info
  const { data: drivers } = useQuery({
    queryKey: ["/api/drivers"]
  });

  const currentDriverCount = Array.isArray(drivers) ? drivers.length : 0;
  const planLimits = (user?.tenantId as any)?.limits;
  const subscriptionPlan = (user?.tenantId as any)?.subscriptionPlan;
  const driverLimit = planLimits?.drivers || 0;
  const remainingSlots = Math.max(0, driverLimit - currentDriverCount);

  const form = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      name: driver?.name || "",
      phone: driver?.phone || "",
      licenseNumber: driver?.licenseNumber || "",
      experience: driver?.experience || undefined,
      rating: driver?.rating || 5,
      status: driver?.status || "available",
      // Additional fields - UI only
      permanentAddress: driver?.permanentAddress || "",
      currentAddress: driver?.currentAddress || "",
      maritalStatus: driver?.maritalStatus || undefined,
      aadharNumber: driver?.aadharNumber || "",
      panNumber: driver?.panNumber || "",
      dateOfJoining: driver?.dateOfJoining || "",
    },
  });

  const createDriverMutation = useMutation({
    mutationFn: async (data: DriverFormData) => {
      const response = await apiRequest("POST", "/api/drivers", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({
        title: "Success",
        description: "Driver created successfully",
      });
      onSuccess();
    },
    onError: (error: any) => {
      // Enhanced error handling with better UI
      const errorMessage = error.message || "Failed to create driver";
      
      // Show different error styles based on error type
      if (errorMessage.includes("maximum") || errorMessage.includes("limit")) {
        toast({
          title: "🚫 Driver Limit Reached",
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

  const updateDriverMutation = useMutation({
    mutationFn: async (data: DriverFormData) => {
      const driverId = driver._id || driver.id;
      const response = await apiRequest("PUT", `/api/drivers/${driverId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({
        title: "Success",
        description: "Driver updated successfully",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update driver",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: DriverFormData) => {
    // Convert dateOfJoining to Date object if provided
    let processedData = { ...data };
    if (data.dateOfJoining) {
      processedData.dateOfJoining = data.dateOfJoining;
    }

    console.log('Driver form data being submitted:', processedData);

    if (driver) {
      await updateDriverMutation.mutateAsync(processedData);
    } else {
      await createDriverMutation.mutateAsync(processedData);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Plan Limit Notification */}
        {!driver && subscriptionPlan && (
          <Card className="border-l-4 border-l-green-500 bg-green-50/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
                  <Shield className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-green-600" />
                    <h4 className="font-medium text-green-900 capitalize">
                      {subscriptionPlan} Plan
                    </h4>
                  </div>
                  <p className="text-sm text-green-700">
                    You can create up to <span className="font-semibold">{driverLimit} drivers</span>.
                    Currently using <span className="font-semibold">{currentDriverCount}</span>, 
                    <span className="ml-1 font-semibold text-emerald-600">
                      {remainingSlots} slots remaining
                    </span>.
                  </p>
                  {remainingSlots === 0 && (
                    <div className="mt-2 flex items-center gap-2 text-amber-700">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Driver limit reached. Contact admin to upgrade your plan.
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
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter driver's full name" {...field} />
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
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input placeholder="Enter phone number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="licenseNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>License Number (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Enter license number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="experience"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Experience (Years) (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="Years of driving experience" 
                    {...field} 
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rating"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rating (1-5) (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="1" 
                    max="5" 
                    step="0.1"
                    placeholder="Driver rating (default: 5)" 
                    {...field} 
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 5)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select driver status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="on_duty">On Duty</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Additional Details Section */}
        <Card className="border-2 border-dashed border-gray-200 bg-gray-50/50">
          <Collapsible>
            <CollapsibleTrigger
              type="button"
              onClick={() => setIsAdditionalDetailsOpen(!isAdditionalDetailsOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-100/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">Additional Details</h3>
                  <p className="text-sm text-gray-600">Optional personal and document information</p>
                </div>
              </div>
              {isAdditionalDetailsOpen ? (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-500" />
              )}
            </CollapsibleTrigger>
            
            <CollapsibleContent isOpen={isAdditionalDetailsOpen}>
              <div className="px-4 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Address Section */}
                  <div className="md:col-span-2">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="w-4 h-4 text-gray-600" />
                      <h4 className="font-medium text-gray-900">Address Information</h4>
                    </div>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="permanentAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Permanent Address</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter permanent address"
                            className="min-h-[80px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currentAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Address (Temporary)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter current address"
                            className="min-h-[80px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Personal Information Section */}
                  <div className="md:col-span-2">
                    <div className="flex items-center gap-2 mb-3 mt-4">
                      <User className="w-4 h-4 text-gray-600" />
                      <h4 className="font-medium text-gray-900">Personal Information</h4>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="maritalStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marital Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select marital status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="single">Single</SelectItem>
                            <SelectItem value="married">Married</SelectItem>
                            <SelectItem value="divorced">Divorced</SelectItem>
                            <SelectItem value="widowed">Widowed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dateOfJoining"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Joining</FormLabel>
                        <FormControl>
                          <Input 
                            type="date"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Document Information Section */}
                  <div className="md:col-span-2">
                    <div className="flex items-center gap-2 mb-3 mt-4">
                      <CreditCard className="w-4 h-4 text-gray-600" />
                      <h4 className="font-medium text-gray-900">Document Information</h4>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="aadharNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aadhar Card Number</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter Aadhar card number"
                            maxLength={12}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="panNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PAN Card Number</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter PAN card number"
                            maxLength={10}
                            style={{ textTransform: 'uppercase' }}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />


                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={onSuccess}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={createDriverMutation.isPending || updateDriverMutation.isPending}
          >
            {(createDriverMutation.isPending || updateDriverMutation.isPending) 
              ? "Saving..." 
              : driver ? "Update Driver" : "Add Driver"
            }
          </Button>
        </div>
      </form>
    </Form>
  );
}

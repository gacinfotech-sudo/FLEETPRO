import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar, MapPin, Clock, Car, User, CreditCard, ArrowRight, ArrowLeft, Check, Phone, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const bookingSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().min(10, "Valid phone number is required"),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  vehicleId: z.number().min(1, "Please select a vehicle"),
  driverId: z.number().optional(),
  bookingType: z.enum(["self_drive", "with_driver"]),
  tripType: z.enum(["one_way", "round_trip", "local", "airport"]),
  pickupLocation: z.string().min(1, "Pickup location is required"),
  dropoffLocation: z.string().min(1, "Drop-off location is required"),
  pickupDate: z.string().min(1, "Pickup date is required"),
  pickupTime: z.string().min(1, "Pickup time is required"),
  returnDate: z.string().min(1, "Return date is required"),
  returnTime: z.string().min(1, "Return time is required"),
  amount: z.number().min(1, "Amount is required"),
  notes: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

interface BookingFormProps {
  onSuccess: () => void;
}

export default function BookingForm({ onSuccess }: BookingFormProps) {
  const [step, setStep] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const totalSteps = 4;

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      vehicleId: 0,
      bookingType: "self_drive",
      tripType: "one_way",
      pickupLocation: "",
      dropoffLocation: "",
      pickupDate: "",
      pickupTime: "",
      returnDate: "",
      returnTime: "",
      amount: 0,
      notes: "",
    },
  });

  const watchedValues = form.watch();

  // Fetch available vehicles when dates are selected
  const { data: availableVehicles = [] } = useQuery({
    queryKey: ["/api/vehicles/available", watchedValues.pickupDate, watchedValues.returnDate],
    queryFn: async () => {
      if (!watchedValues.pickupDate || !watchedValues.returnDate) return [];
      const response = await fetch(`/api/vehicles/available?pickupDate=${watchedValues.pickupDate}&returnDate=${watchedValues.returnDate}`);
      if (!response.ok) throw new Error('Failed to fetch available vehicles');
      return response.json();
    },
    enabled: !!(watchedValues.pickupDate && watchedValues.returnDate),
  });

  // Fetch available drivers when needed
  const { data: availableDrivers = [] } = useQuery({
    queryKey: ["/api/drivers/available", watchedValues.pickupDate, watchedValues.returnDate],
    queryFn: async () => {
      if (!watchedValues.pickupDate || !watchedValues.returnDate) return [];
      const response = await fetch(`/api/drivers/available?pickupDate=${watchedValues.pickupDate}&returnDate=${watchedValues.returnDate}`);
      if (!response.ok) throw new Error('Failed to fetch available drivers');
      return response.json();
    },
    enabled: !!(watchedValues.pickupDate && watchedValues.returnDate && watchedValues.bookingType === "with_driver"),
  });

  const createBookingMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      const response = await apiRequest("POST", "/api/bookings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Booking created successfully",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create booking",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: BookingFormData) => {
    await createBookingMutation.mutateAsync(data);
  };

  const handleDateSelection = () => {
    const pickup = form.getValues("pickupDate");
    const returnDate = form.getValues("returnDate");
    
    if (pickup && returnDate) {
      setStep(2);
    }
  };

  const handleVehicleSelection = (vehicleId: number) => {
    const vehicle = availableVehicles.find((v: any) => v.id === vehicleId);
    if (vehicle) {
      form.setValue("vehicleId", vehicleId);
      
      // Calculate amount based on dates and vehicle rate
      const pickupDate = new Date(watchedValues.pickupDate);
      const returnDate = new Date(watchedValues.returnDate);
      const days = Math.ceil((returnDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24));
      const amount = days * parseFloat(vehicle.ratePerDay);
      form.setValue("amount", amount);
      
      setStep(3);
    }
  };

  const stepConfig = [
    { number: 1, title: "Trip Details", icon: MapPin, color: "bg-blue-500" },
    { number: 2, title: "Vehicle & Service", icon: Car, color: "bg-green-500" },
    { number: 3, title: "Customer Info", icon: User, color: "bg-purple-500" },
    { number: 4, title: "Review & Pay", icon: CreditCard, color: "bg-orange-500" }
  ];

  const renderProgressBar = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Create New Booking</h2>
        <Badge variant="outline" className="text-sm">
          Step {step} of 4
        </Badge>
      </div>
      
      <div className="flex items-center justify-between">
        {stepConfig.map((config, index) => {
          const Icon = config.icon;
          const isActive = step === config.number;
          const isCompleted = step > config.number;
          
          return (
            <div key={config.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isCompleted
                      ? 'bg-green-500 border-green-500 text-white'
                      : isActive
                      ? `${config.color} border-transparent text-white shadow-lg scale-110`
                      : 'bg-gray-100 border-gray-300 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check size={20} />
                  ) : (
                    <Icon size={20} />
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                    {config.title}
                  </div>
                </div>
              </div>
              
              {index < stepConfig.length - 1 && (
                <div className="flex-1 mx-4">
                  <div
                    className={`h-1 rounded-full transition-all duration-300 ${
                      step > config.number ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Select Dates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="pickupDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pickup Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} min={new Date().toISOString().split('T')[0]} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="returnDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Return Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          min={watchedValues.pickupDate || new Date().toISOString().split('T')[0]} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <FormField
                  control={form.control}
                  name="pickupTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pickup Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="returnTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Return Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <FormField
                  control={form.control}
                  name="pickupLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From (Pickup Location)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Indore" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dropoffLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To (Drop-off Location)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Omkareshwar" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={handleDateSelection} disabled={!watchedValues.pickupDate || !watchedValues.returnDate || !watchedValues.pickupLocation || !watchedValues.dropoffLocation}>
                  Next: Select Vehicle
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Select Vehicle</CardTitle>
            </CardHeader>
            <CardContent>
              {availableVehicles.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No vehicles available for selected dates</p>
                  <Button variant="outline" onClick={() => setStep(1)} className="mt-4">
                    Change Dates
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {availableVehicles.map((vehicle: any) => (
                    <Card 
                      key={vehicle.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-blue-500"
                      onClick={() => handleVehicleSelection(vehicle.id)}
                    >
                      <CardContent className="p-4">
                        <div className="text-center">
                          <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                            <span className="text-blue-600 text-2xl">🚗</span>
                          </div>
                          <h3 className="font-semibold text-gray-900">{vehicle.make} {vehicle.model}</h3>
                          <p className="text-sm text-gray-600">{vehicle.registrationNumber}</p>
                          <div className="flex justify-between items-center mt-3">
                            <span className="text-lg font-bold text-gray-900">₹{vehicle.ratePerDay}/day</span>
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                              Available
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Step 3: Customer Info</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-4 sm:space-y-6">
                <FormField
                  control={form.control}
                  name="bookingType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Booking Type</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-6"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="self_drive" id="self_drive" />
                            <Label htmlFor="self_drive">Self Drive</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="with_driver" id="with_driver" />
                            <Label htmlFor="with_driver">With Driver</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tripType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trip Type</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="one_way" id="one_way" />
                            <Label htmlFor="one_way" className="text-sm">One Way</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="round_trip" id="round_trip" />
                            <Label htmlFor="round_trip" className="text-sm">Round Trip</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="local" id="local" />
                            <Label htmlFor="local" className="text-sm">Local</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="airport" id="airport" />
                            <Label htmlFor="airport" className="text-sm">Airport</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watchedValues.bookingType === "with_driver" && (
                  <FormField
                    control={form.control}
                    name="driverId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Driver</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a driver" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableDrivers.map((driver: any) => (
                              <SelectItem key={driver.id} value={driver.id.toString()}>
                                {driver.name} - {driver.licenseNumber}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Customer Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter customer name" {...field} className="h-10" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Customer Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter phone number" {...field} className="h-10" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="customerEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Customer Email (Optional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter email address" {...field} className="h-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Total Amount</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} className="h-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Notes (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Any additional notes" {...field} className="h-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-0 sm:justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="w-full sm:w-auto">
                    Back
                  </Button>
                  <Button 
                    onClick={form.handleSubmit(onSubmit)}
                    disabled={createBookingMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {createBookingMutation.isPending ? "Creating..." : "Create Booking"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <Form {...form}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Progress Steps */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-center overflow-x-auto pb-2">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-max px-4 sm:px-0">
              <div className="flex items-center">
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                  step >= 1 ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-600"
                }`}>
                  <span className="text-xs sm:text-sm font-medium">1</span>
                </div>
                <span className="ml-1 sm:ml-2 text-xs sm:text-sm font-medium text-gray-900 whitespace-nowrap">Date Selection</span>
              </div>
              <div className="w-8 sm:w-16 h-0.5 bg-gray-300"></div>
              <div className="flex items-center">
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                  step >= 2 ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-600"
                }`}>
                  <span className="text-xs sm:text-sm font-medium">2</span>
                </div>
                <span className="ml-1 sm:ml-2 text-xs sm:text-sm text-gray-600 whitespace-nowrap">Vehicle Selection</span>
              </div>
              <div className="w-8 sm:w-16 h-0.5 bg-gray-300"></div>
              <div className="flex items-center">
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                  step >= 3 ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-600"
                }`}>
                  <span className="text-xs sm:text-sm font-medium">3</span>
                </div>
                <span className="ml-1 sm:ml-2 text-xs sm:text-sm text-gray-600 whitespace-nowrap">Customer Info</span>
              </div>
            </div>
          </div>
        </div>

        {renderStep()}
      </div>
    </Form>
  );
}

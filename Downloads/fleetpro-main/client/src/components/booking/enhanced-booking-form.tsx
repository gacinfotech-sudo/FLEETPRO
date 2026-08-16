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
import { Calendar, MapPin, Clock, Car, User, CreditCard, ArrowRight, ArrowLeft, Check, Phone, Mail, IndianRupee, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import html2pdf from 'html2pdf.js';
import BookingConfirmationPDF from "./booking-confirmation-pdf";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const bookingSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().min(10, "Phone number must be at least 10 digits").max(15, "Phone number too long"),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  vehicleId: z.string().min(1, "Please select a vehicle"),
  driverId: z.string().optional(),
  bookingType: z.enum(["self_drive", "with_driver"]),
  tripType: z.enum(["one_way", "round_trip", "local", "airport"]),
  pickupLocation: z.string().min(1, "Pickup location is required"),
  dropoffLocation: z.string().min(1, "Drop-off location is required"),
  pickupDate: z.string().min(1, "Pickup date is required"),
  pickupTime: z.string().min(1, "Pickup time is required"),
  returnDate: z.string().min(1, "Return date is required"),
  returnTime: z.string().min(1, "Return time is required"),
  amount: z.number().min(1, "Amount is required"),
  totalKilometers: z.number().min(0).optional(),
  tollCharges: z.number().min(0, "Toll charges must be 0 or greater").optional(),
  parkingCharges: z.number().min(0, "Parking charges must be 0 or greater").optional(),
  petrolCharges: z.number().min(0, "Petrol charges must be 0 or greater").optional(),
  dieselCharges: z.number().min(0, "Diesel charges must be 0 or greater").optional(),
  cngCharges: z.number().min(0, "CNG charges must be 0 or greater").optional(),
  miscellaneousAmount: z.number().min(0, "Miscellaneous amount must be 0 or greater").optional(),
  miscellaneousDescription: z.string().optional(),
  pricingType: z.enum(["day", "km"]).optional(),
  notes: z.string().optional(),
  // Third-party driver fields
  useThirdPartyDriver: z.boolean().optional(),
  thirdPartyDriverName: z.string().optional(),
  thirdPartyDriverCharges: z.number().min(0, "Third-party driver charges must be 0 or greater").optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

interface EnhancedBookingFormProps {
  onSuccess: () => void;
}

export default function EnhancedBookingForm({ onSuccess }: EnhancedBookingFormProps) {
  const [step, setStep] = useState(1);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [selectedPricingType, setSelectedPricingType] = useState<"day" | "km" | "">("");
  const [createdBooking, setCreatedBooking] = useState<any>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [routeType, setRouteType] = useState<"custom" | "local" | "not_decided">("custom");
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const totalSteps = 4;

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    mode: "onChange",
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      vehicleId: "",
      driverId: "",
      bookingType: "self_drive",
      tripType: "one_way",
      pickupLocation: "",
      dropoffLocation: "",
      pickupDate: "",
      pickupTime: "",
      returnDate: "",
      returnTime: "",
      amount: 0,
      tollCharges: 0,
      parkingCharges: 0,
      petrolCharges: 0,
      dieselCharges: 0,
      cngCharges: 0,
      miscellaneousAmount: 0,
      miscellaneousDescription: "",
      pricingType: "day",
      notes: "",
    },
  });

  const watchedValues = form.watch();

  // Fetch available vehicles
  const { data: availableVehicles } = useQuery({
    queryKey: ["/api/vehicles/available", watchedValues.pickupDate, watchedValues.returnDate],
    queryFn: async () => {
      if (!watchedValues.pickupDate || !watchedValues.returnDate) return [];
      const response = await fetch(`/api/vehicles/available?pickupDate=${watchedValues.pickupDate}&returnDate=${watchedValues.returnDate}`);
      if (!response.ok) throw new Error('Failed to fetch vehicles');
      return response.json();
    },
    enabled: !!(watchedValues.pickupDate && watchedValues.returnDate),
  });

  // Fetch available drivers
  const { data: availableDrivers } = useQuery({
    queryKey: ["/api/drivers/available", watchedValues.pickupDate, watchedValues.returnDate],
    queryFn: async () => {
      if (!watchedValues.pickupDate || !watchedValues.returnDate) return [];
      const response = await fetch(`/api/drivers/available?pickupDate=${watchedValues.pickupDate}&returnDate=${watchedValues.returnDate}`);
      if (!response.ok) throw new Error('Failed to fetch drivers');
      return response.json();
    },
    enabled: !!(watchedValues.pickupDate && watchedValues.returnDate && watchedValues.bookingType === "with_driver"),
  });

  // Fetch business profile for logo
  const { data: businessProfile } = useQuery({
    queryKey: ['/api/auth/business-profile-for-documents'],
    queryFn: async () => {
      const response = await fetch('/api/auth/business-profile-for-documents', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch business profile');
      return response.json();
    }
  });

  const createBookingMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      // Calculate fuel cost (to be deducted)
      const totalFuelCost = (data.petrolCharges || 0) + (data.dieselCharges || 0) + (data.cngCharges || 0);
      
      // Calculate final total amount: base + toll + parking + misc - fuel
      // NOTE: Third-party driver charges are NOT deducted from the base amount
      // They are stored separately for revenue calculation
      const finalAmount = (data.amount || 0) + (data.tollCharges || 0) + (data.parkingCharges || 0) + (data.miscellaneousAmount || 0) - totalFuelCost;
      
      // Send data with the calculated final amount
      const bookingData = {
        ...data,
        amount: finalAmount,
        // Reset third-party driver fields to default values
        useThirdPartyDriver: false,
        thirdPartyDriverName: "",
        thirdPartyDriverCharges: 0,
      };
      
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(bookingData),
      });
      if (!response.ok) {
        let message = "Failed to create booking";
        try {
          const errorBody = await response.json();
          message = errorBody?.message || message;
          if (Array.isArray(errorBody?.errors) && errorBody.errors.length > 0) {
            const first = errorBody.errors[0];
            message = first?.message || message;
          }
        } catch {
          // Keep the safe fallback message when the server response is not JSON.
        }
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setCreatedBooking(result);
      setBookingConfirmed(true);
      toast({
        variant: "success",
        title: "Booking created successfully!",
        description: `Booking ID: ${result.bookingId}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create booking",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle download e-receipt - generates PDF and shows WhatsApp share modal
  const handleDownloadReceipt = async () => {
    await generateConfirmationPDF();
  };

  // Generate confirmation PDF and show WhatsApp share modal
  const generateConfirmationPDF = async () => {
    if (!createdBooking) return;

    const vehicleArray = Array.isArray(availableVehicles) ? availableVehicles : [];
    const selectedVehicle = vehicleArray.find((v: any) => (v._id || v.id) === createdBooking.vehicleId);

    const confirmationData = {
      customerName: createdBooking.customerName,
      pickupLocation: createdBooking.pickupLocation,
      dropoffLocation: createdBooking.dropoffLocation,
      pickupDate: createdBooking.pickupDate,
      pickupTime: createdBooking.pickupTime,
      returnDate: createdBooking.returnDate,
      returnTime: createdBooking.returnTime,
      vehicleName: selectedVehicle?.make || 'Vehicle',
      bookingType: createdBooking.bookingType,
      bookingId: createdBooking.bookingId,
      companyLogo: businessProfile?.businessDetails?.logoUrl,
    };

    // Create a temporary container for the confirmation PDF
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    document.body.appendChild(tempDiv);

    // Render the confirmation template
    const { createRoot } = await import('react-dom/client');
    const root = createRoot(tempDiv);
    
    return new Promise<void>((resolve) => {
      root.render(
        <BookingConfirmationPDF booking={confirmationData} />
      );

      // Wait for rendering to complete
      setTimeout(() => {
        const element = tempDiv.querySelector('#booking-confirmation-pdf');
        if (element) {
          const opt = {
            margin: 1,
            filename: `Booking_Confirmation_${createdBooking.bookingId}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
          };

          html2pdf().set(opt).from(element).save().then(() => {
            document.body.removeChild(tempDiv);
            setShowConfirmationModal(true);
            resolve();
          });
        } else {
          document.body.removeChild(tempDiv);
          setShowConfirmationModal(true);
          resolve();
        }
      }, 100);
    });
  };

  // Generate WhatsApp share link
  const generateWhatsAppLink = () => {
    if (!createdBooking) return "";

    const customerPhone = createdBooking.customerPhone.replace(/[^\d]/g, ''); // Remove non-digits
    const phoneNumber = customerPhone.startsWith('91') ? customerPhone : `91${customerPhone}`;
    
    const getRouteText = () => {
      if (createdBooking.dropoffLocation === 'Local') {
        return `${createdBooking.pickupLocation} → Local`;
      } else if (createdBooking.dropoffLocation === 'Not Decided Yet') {
        return `${createdBooking.pickupLocation} → Not Decided`;
      } else {
        return `${createdBooking.pickupLocation} → ${createdBooking.dropoffLocation}`;
      }
    };

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    };

    const message = `Hello ${createdBooking.customerName}, your booking from ${getRouteText()} on ${formatDate(createdBooking.pickupDate)} has been confirmed. Please find the confirmation attached.`;
    
    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  };

  const nextStep = () => {
    setStep(prev => Math.min(prev + 1, totalSteps));
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

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

  const handleVehicleAndPricingSelection = (vehicleId: string, pricingType: "day" | "km") => {
    const vehicleArray = Array.isArray(availableVehicles) ? availableVehicles : [];
    const vehicle = vehicleArray.find((v: any) => v._id === vehicleId || v.id === vehicleId);
    
    if (vehicle) {
      // Set the selected vehicle and pricing type
      setSelectedVehicleId(vehicleId);
      setSelectedPricingType(pricingType);
      form.setValue("vehicleId", vehicleId);
      form.setValue("pricingType", pricingType);
      
      // Calculate amount based on pricing type
      const pickupDate = new Date(watchedValues.pickupDate);
      const returnDate = new Date(watchedValues.returnDate);
      const days = Math.max(1, Math.ceil((returnDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      let amount = 0;
      let description = "";
      
      if (pricingType === "day") {
        const pricePerDay = vehicle.pricePerDay || vehicle.ratePerDay || 0;
        amount = days * parseFloat(pricePerDay);
        description = `₹${amount} for ${days} day${days > 1 ? 's' : ''} at ₹${pricePerDay}/day`;
      } else if (pricingType === "km") {
        const pricePerKm = vehicle.pricePerKm || 0;
        if (pricePerKm > 0) {
          // For km-based pricing, we'll set a base amount and allow user to adjust in final step
          amount = parseFloat(pricePerKm) * 100; // Default 100km estimate
          description = `₹${amount} estimated for 100km at ₹${pricePerKm}/km (adjustable in next step)`;
        } else {
          toast({
            title: "Rate per km not available",
            description: "This vehicle doesn't have per-kilometer pricing. Please choose 'By Day' option.",
            variant: "destructive"
          });
          return;
        }
      }
      
      form.setValue("amount", amount);
      
      toast({
        variant: "success",
        title: "Vehicle & pricing selected!",
        description: description,
      });
    }
  };

  // Reset selection when booking type changes
  const handleBookingTypeChange = (newBookingType: "self_drive" | "with_driver") => {
    setSelectedVehicleId("");
    setSelectedPricingType("");
    form.setValue("vehicleId", "");
    form.setValue("pricingType", "day");
    form.setValue("amount", 0);
  };

  const stepConfig = [
    { number: 1, title: "Trip Details", icon: MapPin, color: "bg-blue-500" },
    { number: 2, title: "Vehicle & Service", icon: Car, color: "bg-green-500" },
    { number: 3, title: "Customer Info", icon: User, color: "bg-purple-500" },
    { number: 4, title: "Review & Pay", icon: CreditCard, color: "bg-orange-500" }
  ];

  const renderProgressBar = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-6 mb-4 sm:mb-8">
      <div className="flex items-center justify-between mb-3 sm:mb-6">
        <h2 className="text-lg sm:text-2xl font-bold text-gray-900">Create New Booking</h2>
        <Badge variant="outline" className="text-xs sm:text-sm">
          Step {step} of {totalSteps}
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
                  className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isCompleted
                      ? 'bg-green-500 border-green-500 text-white'
                      : isActive
                      ? `${config.color} border-transparent text-white shadow-lg sm:scale-110`
                      : 'bg-gray-100 border-gray-300 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check size={16} className="sm:w-5 sm:h-5" />
                  ) : (
                    <Icon size={16} className="sm:w-5 sm:h-5" />
                  )}
                </div>
                <div className="mt-1 sm:mt-2 text-center">
                  <div className={`text-xs sm:text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                    <span className="hidden sm:inline">{config.title}</span>
                    <span className="sm:hidden">{config.title.split(' ')[0]}</span>
                  </div>
                </div>
              </div>
              
              {index < stepConfig.length - 1 && (
                <div className="flex-1 mx-2 sm:mx-4">
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
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center text-lg sm:text-xl">
                <MapPin className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                Trip Details & Schedule
              </CardTitle>
              <p className="text-blue-100 text-xs sm:text-sm">Tell us when and where you need to go</p>
            </CardHeader>
            <CardContent className="p-4 sm:p-8">
              {/* Date & Time Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-blue-500" />
                  When do you need the vehicle?
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="pickupDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center text-sm font-medium text-gray-700">
                            <Calendar className="w-4 h-4 mr-2" />
                            Pickup Date
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              min={new Date().toISOString().split('T')[0]}
                              className="h-12 border-2 border-gray-200 focus:border-blue-500 rounded-lg"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="pickupTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center text-sm font-medium text-gray-700">
                            <Clock className="w-4 h-4 mr-2" />
                            Pickup Time
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="time" 
                              {...field}
                              className="h-12 border-2 border-gray-200 focus:border-blue-500 rounded-lg"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="returnDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center text-sm font-medium text-gray-700">
                            <Calendar className="w-4 h-4 mr-2" />
                            Return Date
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              min={watchedValues.pickupDate || new Date().toISOString().split('T')[0]}
                              className="h-12 border-2 border-gray-200 focus:border-blue-500 rounded-lg"
                            />
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
                          <FormLabel className="flex items-center text-sm font-medium text-gray-700">
                            <Clock className="w-4 h-4 mr-2" />
                            Return Time
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="time" 
                              {...field}
                              className="h-12 border-2 border-gray-200 focus:border-blue-500 rounded-lg"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <Separator className="my-8" />

              {/* Location Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-green-500" />
                  Where are you traveling?
                </h3>
                
                {/* Route Type Selection */}
                <div className="mb-6">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setRouteType("custom");
                        form.setValue("dropoffLocation", "");
                        form.setValue("tripType", "one_way"); // Reset to default trip type for custom routes
                      }}
                      className={`px-4 py-2 rounded-lg border-2 font-medium transition-all duration-200 ${
                        routeType === "custom"
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      Custom Route
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRouteType("local");
                        form.setValue("dropoffLocation", "Local");
                        form.setValue("tripType", "local");
                      }}
                      className={`px-4 py-2 rounded-lg border-2 font-medium transition-all duration-200 ${
                        routeType === "local"
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      ✅ Local
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRouteType("not_decided");
                        form.setValue("dropoffLocation", "Not Decided Yet");
                        form.setValue("tripType", "airport"); // Using airport as the closest existing type for flexible trips
                      }}
                      className={`px-4 py-2 rounded-lg border-2 font-medium transition-all duration-200 ${
                        routeType === "not_decided"
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      ✅ Not Decided Yet
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="pickupLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-700">From (Pickup Location)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Indore Railway Station" 
                            {...field}
                            className="h-12 border-2 border-gray-200 focus:border-green-500 rounded-lg"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {routeType === "custom" && (
                    <FormField
                      control={form.control}
                      name="dropoffLocation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">To (Drop-off Location)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., Omkareshwar Temple" 
                              {...field}
                              className="h-12 border-2 border-gray-200 focus:border-green-500 rounded-lg"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {routeType !== "custom" && (
                    <div className="flex items-center justify-center h-12 bg-green-50 border-2 border-green-200 rounded-lg">
                      <span className="text-green-700 font-medium">
                        {routeType === "local" ? "📍 Local Trip" : "🤔 Destination Not Decided"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator className="my-8" />

              {/* Trip Type Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Choose your trip type</h3>
                <FormField
                  control={form.control}
                  name="tripType"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                          {[
                            { value: "one_way", label: "One Way", icon: "→", color: "blue" },
                            { value: "round_trip", label: "Round Trip", icon: "⟷", color: "green" },
                            { value: "local", label: "Local", icon: "📍", color: "purple" },
                            { value: "airport", label: "Airport", icon: "✈️", color: "orange" }
                          ].map((option) => (
                            <div
                              key={option.value}
                              onClick={() => field.onChange(option.value)}
                              className={`p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                                field.value === option.value
                                  ? 'border-blue-500 bg-blue-50 shadow-lg'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="text-center">
                                <div className="text-xl sm:text-2xl mb-1 sm:mb-2">{option.icon}</div>
                                <div className="font-medium text-xs sm:text-sm">{option.label}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end pt-4 sm:pt-6">
                <Button 
                  type="button" 
                  onClick={() => {
                    const dropoffValid = routeType !== "custom" || form.getValues("dropoffLocation");
                    const isValid = form.getValues("pickupDate") && 
                                   form.getValues("returnDate") && 
                                   form.getValues("pickupTime") && 
                                   form.getValues("returnTime") &&
                                   form.getValues("pickupLocation") &&
                                   dropoffValid &&
                                   form.getValues("tripType");
                    
                    if (isValid) {
                      handleDateSelection();
                    } else {
                      toast({
                        title: "Please fill all required fields",
                        description: "All date, time, location and trip type fields are required.",
                        variant: "destructive"
                      });
                    }
                  }}
                  className="w-full sm:w-auto px-4 sm:px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                  size="lg"
                >
                  <span className="sm:hidden">Continue</span>
                  <span className="hidden sm:inline">Continue to Vehicle Selection</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card className="bg-gradient-to-br from-green-50 to-white border-green-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center text-lg sm:text-xl">
                <Car className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                Select Vehicle & Service Type
              </CardTitle>
              <p className="text-green-100 text-xs sm:text-sm">Choose from our available fleet</p>
            </CardHeader>
            <CardContent className="p-4 sm:p-8">
              {/* Service Type Selection */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Service Type</h3>
                <FormField
                  control={form.control}
                  name="bookingType"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => {
                            field.onChange(value);
                            handleBookingTypeChange(value as "self_drive" | "with_driver");
                          }}
                          value={field.value}
                          className="grid grid-cols-1 md:grid-cols-2 gap-4"
                        >
                          <div
                            className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                              field.value === "self_drive" 
                                ? 'border-green-500 bg-green-50 shadow-lg' 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="self_drive" id="self_drive" />
                              <Label htmlFor="self_drive" className="flex-1 cursor-pointer">
                                <div className="font-medium">Self Drive</div>
                                <div className="text-sm text-gray-500">Drive the vehicle yourself</div>
                              </Label>
                            </div>
                          </div>
                          <div
                            className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                              field.value === "with_driver" 
                                ? 'border-green-500 bg-green-50 shadow-lg' 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="with_driver" id="with_driver" />
                              <Label htmlFor="with_driver" className="flex-1 cursor-pointer">
                                <div className="font-medium">With Driver</div>
                                <div className="text-sm text-gray-500">Professional driver included</div>
                              </Label>
                            </div>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator className="my-8" />

              {/* Vehicle Selection with Pricing Options */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Available Vehicles</h3>
                {(() => {
                  const vehicles = (availableVehicles as any[]) || [];
                  if (vehicles.length > 0) {
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {vehicles.map((vehicle: any) => {
                          const vehicleId = vehicle._id || vehicle.id;
                          const isSelected = selectedVehicleId === vehicleId;
                          
                          return (
                            <div
                              key={vehicleId}
                              className={`p-6 border-2 rounded-lg transition-all hover:shadow-lg ${
                                isSelected
                                  ? 'border-green-500 bg-green-50 shadow-lg'
                                  : 'border-gray-200 hover:border-green-300'
                              }`}
                            >
                              <div className="text-center mb-4">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <Car className="w-8 h-8 text-green-600" />
                                </div>
                                <h4 className="font-semibold text-lg">{vehicle.make} {vehicle.vehicleModel || vehicle.model || ''}</h4>
                                <p className="text-sm text-gray-600 mb-2">{vehicle.type || vehicle.vehicleType || 'Standard'}</p>
                                <Badge variant="outline" className="mb-3">
                                  {vehicle.licensePlate || vehicle.registrationNumber || 'No Reg'}
                                </Badge>
                              </div>

                              {/* Pricing Options */}
                              <div className="space-y-2">
                                <h5 className="text-sm font-medium text-gray-700 text-center mb-3">Choose Pricing Method</h5>
                                
                                {/* By Day Option */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleVehicleAndPricingSelection(vehicleId, "day");
                                  }}
                                  className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                                    isSelected && selectedPricingType === "day"
                                      ? 'border-green-500 bg-green-100 text-green-800'
                                      : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-medium text-sm">By Day</div>
                                      <div className="text-xs text-gray-600">
                                        ₹{vehicle.pricePerDay || vehicle.ratePerDay || 0}/day
                                      </div>
                                    </div>
                                    {isSelected && selectedPricingType === "day" && (
                                      <Check className="w-4 h-4 text-green-600" />
                                    )}
                                  </div>
                                </button>

                                {/* By Kilometer Option */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (vehicle.pricePerKm && vehicle.pricePerKm > 0) {
                                      handleVehicleAndPricingSelection(vehicleId, "km");
                                    }
                                  }}
                                  disabled={!vehicle.pricePerKm || vehicle.pricePerKm <= 0}
                                  className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                                    !vehicle.pricePerKm || vehicle.pricePerKm <= 0
                                      ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                                      : isSelected && selectedPricingType === "km"
                                      ? 'border-green-500 bg-green-100 text-green-800'
                                      : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-medium text-sm">By Kilometer</div>
                                      <div className="text-xs text-gray-600">
                                        {vehicle.pricePerKm && vehicle.pricePerKm > 0 
                                          ? `₹${vehicle.pricePerKm}/km`
                                          : 'Not available'
                                        }
                                      </div>
                                    </div>
                                    {isSelected && selectedPricingType === "km" && (
                                      <Check className="w-4 h-4 text-green-600" />
                                    )}
                                  </div>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  } else {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <Car className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No vehicles available for selected dates</p>
                      </div>
                    );
                  }
                })()}
              </div>

              {/* Driver Selection */}
              {watchedValues.bookingType === "with_driver" && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Driver Selection</h3>
                  
                  <FormField
                    control={form.control}
                    name="driverId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Driver (Optional)</FormLabel>
                        <FormControl>
                          <Select onValueChange={(value) => field.onChange(value)} value={field.value?.toString()}>
                            <SelectTrigger className="h-12">
                              <SelectValue placeholder="Auto-assign driver or select manually" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.isArray(availableDrivers) ? availableDrivers.map((driver: any) => (
                                <SelectItem key={driver._id || driver.id} value={driver._id || driver.id}>
                                  {driver.name} - {driver.phone}
                                </SelectItem>
                              )) : null}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 sm:pt-6">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={prevStep}
                  className="w-full sm:w-auto px-4 sm:px-6 py-3"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button 
                  type="button" 
                  onClick={() => {
                    if (selectedVehicleId && selectedPricingType) {
                      nextStep();
                    } else if (!selectedVehicleId) {
                      toast({
                        title: "Please select a vehicle",
                        description: "Choose a vehicle and pricing method to continue.",
                        variant: "destructive"
                      });
                    } else {
                      toast({
                        title: "Please select a pricing method",
                        description: "Choose either 'By Day' or 'By Kilometer' pricing to continue.",
                        variant: "destructive"
                      });
                    }
                  }}
                  className="w-full sm:w-auto px-4 sm:px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                  size="lg"
                >
                  <span className="sm:hidden">Continue</span>
                  <span className="hidden sm:inline">Continue to Customer Info</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center text-lg sm:text-xl">
                <User className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                Customer Information
              </CardTitle>
              <p className="text-purple-100 text-xs sm:text-sm">Enter customer details for the booking</p>
            </CardHeader>
            <CardContent className="p-4 sm:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center text-sm font-medium text-gray-700">
                        <User className="w-4 h-4 mr-2" />
                        Customer Name
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter full name" 
                          {...field} 
                          className="h-12 border-2 border-gray-200 focus:border-purple-500 rounded-lg"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <FormField
                    control={form.control}
                    name="customerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center text-sm font-medium text-gray-700">
                          <Phone className="w-4 h-4 mr-2" />
                          Phone Number
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="tel"
                            placeholder="Enter phone number (e.g., 9876543210)" 
                            value={field.value || ""}
                            name="customerPhone"
                            onBlur={field.onBlur}
                            className="h-12 border-2 border-gray-200 focus:border-purple-500 rounded-lg"
                            onChange={(e) => {
                              // Allow only numbers and basic formatting
                              const numericValue = e.target.value.replace(/[^\d]/g, '');
                              field.onChange(numericValue);
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
                  name="customerEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center text-sm font-medium text-gray-700">
                        <Mail className="w-4 h-4 mr-2" />
                        Email (Optional)
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter email address" 
                          type="email"
                          {...field} 
                          className="h-12 border-2 border-gray-200 focus:border-purple-500 rounded-lg"
                        />
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
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Special Notes (Optional)
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Any special requirements" 
                          {...field} 
                          className="h-12 border-2 border-gray-200 focus:border-purple-500 rounded-lg"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 sm:pt-8">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={prevStep}
                  className="w-full sm:w-auto px-4 sm:px-6 py-3"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button 
                  type="button" 
                  onClick={() => {
                    if (watchedValues.customerName && watchedValues.customerPhone) {
                      nextStep();
                    } else {
                      toast({
                        title: "Please fill required fields",
                        description: "Customer name and phone are required.",
                        variant: "destructive"
                      });
                    }
                  }}
                  className="w-full sm:w-auto px-4 sm:px-8 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                  size="lg"
                >
                  <span className="sm:hidden">Review</span>
                  <span className="hidden sm:inline">Review Booking</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 4:
        const vehicleArray = Array.isArray(availableVehicles) ? availableVehicles : [];
        const selectedVehicle = vehicleArray.find((v: any) => (v._id || v.id) === watchedValues.vehicleId);
        
        // If booking is confirmed, show success state with download receipt option
        if (bookingConfirmed && createdBooking) {
          return (
            <Card className="bg-gradient-to-br from-green-50 to-white border-green-200 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center text-lg sm:text-xl">
                  <Check className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                  Booking Confirmed Successfully!
                </CardTitle>
                <p className="text-green-100 text-xs sm:text-sm">Booking ID: {createdBooking.bookingId}</p>
              </CardHeader>
              <CardContent className="p-4 sm:p-8">
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Your booking has been confirmed!</h3>
                  <p className="text-gray-600 mb-6">
                    Booking ID: <span className="font-semibold text-green-600">{createdBooking.bookingId}</span>
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
                    <Button
                      type="button"
                      onClick={handleDownloadReceipt}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3"
                      size="lg"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download E-Receipt
                    </Button>
                    
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        form.reset();
                        setStep(1);
                        setSelectedVehicleId("");
                        setSelectedPricingType("");
                        setCreatedBooking(null);
                        setBookingConfirmed(false);
                        setRouteType("custom");
                        onSuccess();
                      }}
                      className="px-6 py-3"
                      size="lg"
                    >
                      Create New Booking
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }
        
        // Initial confirmation state - show review and confirm booking
        return (
          <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center text-lg sm:text-xl">
                <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                Review & Confirm Booking
              </CardTitle>
              <p className="text-orange-100 text-xs sm:text-sm">Review all details before confirming</p>
            </CardHeader>
            <CardContent className="p-4 sm:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Trip Details */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Trip Details</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">From:</span>
                        <span className="font-medium">{watchedValues.pickupLocation}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">To:</span>
                        <span className="font-medium">{watchedValues.dropoffLocation}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pickup:</span>
                        <span className="font-medium">{watchedValues.pickupDate} at {watchedValues.pickupTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Return:</span>
                        <span className="font-medium">{watchedValues.returnDate} at {watchedValues.returnTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Trip Type:</span>
                        <Badge variant="outline">
                          {watchedValues.tripType === "round_trip" ? "Round Trip" :
                           watchedValues.tripType === "local" ? "Local" :
                           watchedValues.tripType === "airport" && watchedValues.dropoffLocation === "Not Decided Yet" ? "Not Decided" :
                           watchedValues.tripType === "airport" ? "Airport" :
                           watchedValues.dropoffLocation === "Local" ? "Local" :
                           watchedValues.dropoffLocation === "Not Decided Yet" ? "Not Decided" :
                           watchedValues.tripType === "one_way" ? "One Way" : "One Way"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Vehicle & Service</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Vehicle:</span>
                        <span className="font-medium">{selectedVehicle?.make} {selectedVehicle?.vehicleModel || selectedVehicle?.model || ''}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Type:</span>
                        <span className="font-medium">{selectedVehicle?.type || selectedVehicle?.vehicleType || 'Standard'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Service:</span>
                        <Badge variant="outline">{watchedValues.bookingType.replace('_', ' ')}</Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Customer Details</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Name:</span>
                        <span className="font-medium">{watchedValues.customerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Phone:</span>
                        <span className="font-medium">{watchedValues.customerPhone}</span>
                      </div>
                      {watchedValues.customerEmail && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Email:</span>
                          <span className="font-medium">{watchedValues.customerEmail}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column - Amount */}
                <div>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Booking Summary</h3>
                    <div className="space-y-3">
                      {/* Show pricing details based on selected pricing type */}
                      {selectedPricingType === "day" ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span>Rate per day:</span>
                            <span>₹{selectedVehicle?.pricePerDay || selectedVehicle?.ratePerDay || 0}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Duration:</span>
                            <span>{Math.ceil((new Date(watchedValues.returnDate).getTime() - new Date(watchedValues.pickupDate).getTime()) / (1000 * 60 * 60 * 24))} days</span>
                          </div>
                        </>
                      ) : selectedPricingType === "km" ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span>Rate per km:</span>
                            <span>₹{selectedVehicle?.pricePerKm || 0}</span>
                          </div>
                          {/* Editable Total Kilometers field for Per Km pricing */}
                          <div className="mb-4">
                            <FormField
                              control={form.control}
                              name="totalKilometers"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium text-gray-700">Total Kilometers</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      placeholder="Enter total kilometers"
                                      value={field.value || 0}
                                      onChange={(e) => {
                                        const km = parseFloat(e.target.value) || 0;
                                        field.onChange(km);
                                        // Auto-calculate base amount when kilometers change
                                        const rate = selectedVehicle?.pricePerKm || 0;
                                        const newAmount = km * rate;
                                        form.setValue("amount", newAmount);
                                      }}
                                      className="h-10 border border-gray-300 focus:border-orange-500 rounded"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between text-sm">
                            <span>Rate per day:</span>
                            <span>₹{selectedVehicle?.pricePerDay || selectedVehicle?.ratePerDay || 0}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Duration:</span>
                            <span>{Math.ceil((new Date(watchedValues.returnDate).getTime() - new Date(watchedValues.pickupDate).getTime()) / (1000 * 60 * 60 * 24))} days</span>
                          </div>
                        </>
                      )}
                      
                      {/* Editable Base Amount - Always editable regardless of pricing type */}
                      <div className="mb-4">
                        <FormField
                          control={form.control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-gray-700">Final Base Amount (Editable)</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                                  <Input 
                                    type="number" 
                                    placeholder="Enter final amount"
                                    value={field.value || 0}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    className="h-12 pl-10 text-lg font-medium border-2 border-orange-300 focus:border-orange-500 rounded-lg"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {/* Additional Charges Section */}
                      <div className="mt-4">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <FormField
                            control={form.control}
                            name="tollCharges"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-gray-600">Toll Charges</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    placeholder="0"
                                    value={field.value || 0}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    className="h-10 text-sm border border-gray-300 focus:border-orange-500 rounded"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="parkingCharges"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-gray-600">Parking Charges</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    placeholder="0"
                                    value={field.value || 0}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    className="h-10 text-sm border border-gray-300 focus:border-orange-500 rounded"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        {/* Fuel Charges Section */}
                        <div className="space-y-4 p-4 bg-red-50 rounded-lg">
                          <h4 className="font-semibold text-red-800 flex items-center">
                            <span className="mr-2">⛽</span>
                            Fuel Charges (To be deducted from final amount)
                          </h4>
                          <div className="grid grid-cols-3 gap-4">
                            <FormField
                              control={form.control}
                              name="petrolCharges"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium text-red-700">Petrol (₹)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number" 
                                      placeholder="0"
                                      value={field.value || 0}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      className="h-10 text-sm border border-red-300 focus:border-red-500 rounded"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="dieselCharges"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium text-red-700">Diesel (₹)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number" 
                                      placeholder="0"
                                      value={field.value || 0}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      className="h-10 text-sm border border-red-300 focus:border-red-500 rounded"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="cngCharges"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium text-red-700">CNG (₹)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number" 
                                      placeholder="0"
                                      value={field.value || 0}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      className="h-10 text-sm border border-red-300 focus:border-red-500 rounded"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        
                        {/* Miscellaneous Expenses Section */}
                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                          <h4 className="font-semibold text-gray-800">Miscellaneous Expenses</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="miscellaneousAmount"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">Amount (₹)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number" 
                                      placeholder="0"
                                      value={field.value || 0}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      className="h-10 text-sm border border-gray-300 focus:border-orange-500 rounded"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="miscellaneousDescription"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">Description</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="e.g., cleaning charges, late return fee, damage cost"
                                      {...field}
                                      className="h-20 text-sm border border-gray-300 focus:border-orange-500 rounded resize-none"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        
                        {/* Summary of all charges */}
                        <div className="space-y-2 text-sm">
                          {/* Base amount display */}
                          <div className="flex justify-between">
                            <span>Base amount:</span>
                            <span>₹{watchedValues.amount || 0}</span>
                          </div>
                          
                          {/* Additional charges */}
                          {watchedValues.tollCharges && watchedValues.tollCharges > 0 && (
                            <div className="flex justify-between">
                              <span>Toll charges:</span>
                              <span>₹{watchedValues.tollCharges || 0}</span>
                            </div>
                          )}
                          {watchedValues.parkingCharges && watchedValues.parkingCharges > 0 && (
                            <div className="flex justify-between">
                              <span>Parking charges:</span>
                              <span>₹{watchedValues.parkingCharges || 0}</span>
                            </div>
                          )}
                          {watchedValues.miscellaneousAmount && watchedValues.miscellaneousAmount > 0 && (
                            <div className="flex justify-between">
                              <span>Miscellaneous expenses:</span>
                              <span>₹{watchedValues.miscellaneousAmount || 0}</span>
                            </div>
                          )}
                          {watchedValues.miscellaneousDescription && watchedValues.miscellaneousAmount && watchedValues.miscellaneousAmount > 0 && (
                            <div className="text-xs text-gray-600 italic ml-4">
                              {watchedValues.miscellaneousDescription}
                            </div>
                          )}
                          


                          {/* Fuel charges (deductions) */}
                          {((watchedValues.petrolCharges && watchedValues.petrolCharges > 0) || (watchedValues.dieselCharges && watchedValues.dieselCharges > 0) || (watchedValues.cngCharges && watchedValues.cngCharges > 0)) && (
                            <div className="border-t pt-2">
                              <div className="text-red-600 font-medium">Fuel Charges (Deductions):</div>
                              {watchedValues.petrolCharges && watchedValues.petrolCharges > 0 && (
                                <div className="flex justify-between text-red-600">
                                  <span>- Petrol:</span>
                                  <span>₹{watchedValues.petrolCharges || 0}</span>
                                </div>
                              )}
                              {watchedValues.dieselCharges && watchedValues.dieselCharges > 0 && (
                                <div className="flex justify-between text-red-600">
                                  <span>- Diesel:</span>
                                  <span>₹{watchedValues.dieselCharges || 0}</span>
                                </div>
                              )}
                              {watchedValues.cngCharges && watchedValues.cngCharges > 0 && (
                                <div className="flex justify-between text-red-600">
                                  <span>- CNG:</span>
                                  <span>₹{watchedValues.cngCharges || 0}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex justify-between text-lg font-bold">
                          <span>Final Total:</span>
                          <span className="text-green-600">
                            ₹{(watchedValues.amount || 0) + (watchedValues.tollCharges || 0) + (watchedValues.parkingCharges || 0) + (watchedValues.miscellaneousAmount || 0) - (watchedValues.petrolCharges || 0) - (watchedValues.dieselCharges || 0) - (watchedValues.cngCharges || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 sm:pt-8">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={prevStep}
                  disabled={createBookingMutation.isPending}
                  className="w-full sm:w-auto px-4 sm:px-6 py-3"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                
                <Button 
                  type="submit"
                  disabled={createBookingMutation.isPending}
                  className="w-full sm:w-auto px-4 sm:px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                  size="lg"
                >
                  {createBookingMutation.isPending ? "Creating..." : "Confirm Booking"}
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-2 sm:p-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" key={`booking-form-${step}`}>
          {renderProgressBar()}
          {renderStep()}
        </form>
      </Form>

      {/* WhatsApp Share Modal */}
      <Dialog open={showConfirmationModal} onOpenChange={setShowConfirmationModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-center text-green-600">
              Booking Confirmed! 🎉
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-gray-600 mb-4">
              Your e-receipt has been downloaded successfully.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Would you like to send the confirmation to your customer via WhatsApp?
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => {
                  window.open(generateWhatsAppLink(), '_blank');
                  setShowConfirmationModal(false);
                }}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                Share via WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowConfirmationModal(false)}
              >
                Skip
              </Button>
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  form.reset();
                  setStep(1);
                  setSelectedVehicleId("");
                  setSelectedPricingType("");
                  setCreatedBooking(null);
                  setShowConfirmationModal(false);
                  setRouteType("custom");
                  onSuccess();
                }}
                className="w-full"
              >
                Create New Booking
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import html2pdf from 'html2pdf.js';
import { X, FileText, Download, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InvoiceGeneratorProps {
  booking: any;
  isOpen: boolean;
  onClose: () => void;
}

interface InvoiceData {
  // Trip Details
  fromLocation: string;
  toLocation: string;
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
  tripType: string;
  tape: string;
  pickupType: string;
  
  // Vehicle & Service
  vehicleName: string;
  vehicleType: string;
  serviceType: string;
  customerName: string;
  customerMobile: string;
  customerEmail: string;
  
  // Charges
  baseFare: number;
  parkingCharges: number;
  tollCharges: number;
  lateDropFee: number;
  miscellaneous: number;
  carDamageCharges: number;
  extraKilometerCharges: number;
  fuelCharges: number;
  discount: number;
  nightHaltCharges: number;
  driverFoodCharges: number;
  pickAndDropCharges: number;
  paymentMode: string;
  
  // Others
  invoiceDate: string;
  invoiceNumber: string;
  
  // Display Controls
  showGST: boolean;
  showSignature: boolean;
  termsAndConditions: string;
}

export default function InvoiceGenerator({ booking, isOpen, onClose }: InvoiceGeneratorProps) {
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const { toast } = useToast();
  
  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    // Trip Details
    fromLocation: "",
    toLocation: "",
    pickupDate: "",
    pickupTime: "",
    returnDate: "",
    returnTime: "",
    tripType: "",
    tape: "",
    pickupType: "",
    
    // Vehicle & Service
    vehicleName: "",
    vehicleType: "",
    serviceType: "",
    customerName: "",
    customerMobile: "",
    customerEmail: "",
    
    // Charges
    baseFare: 0,
    parkingCharges: 0,
    tollCharges: 0,
    lateDropFee: 0,
    miscellaneous: 0,
    carDamageCharges: 0,
    extraKilometerCharges: 0,
    fuelCharges: 0,
    discount: 0,
    nightHaltCharges: 0,
    driverFoodCharges: 0,
    pickAndDropCharges: 0,
    paymentMode: "UPI",
    
    // Others
    invoiceDate: new Date().toISOString().split('T')[0],
    invoiceNumber: "",
    
    // Display Controls
    showGST: false,
    showSignature: true,
    termsAndConditions: "• Payment due within 7 days\n• Late return incurs ₹500/hr fee\n• Vehicle must be returned with full fuel tank"
  });

  // Fetch business profile for documents (includes inherited data for managers)
  const { data: businessProfile } = useQuery({
    queryKey: ['/api/auth/business-profile-for-documents'],
    queryFn: async () => {
      const response = await fetch('/api/auth/business-profile-for-documents', {
        credentials: 'include'
      });
      if (!response.ok) {
        if (response.status === 404) return { businessDetails: null };
        throw new Error('Failed to fetch business profile');
      }
      return response.json();
    },
    enabled: isOpen
  });

  // Check if business profile is complete
  const isBusinessProfileComplete = businessProfile?.businessDetails && 
    businessProfile.businessDetails.businessName &&
    businessProfile.businessDetails.ownerName &&
    businessProfile.businessDetails.businessAddress &&
    businessProfile.businessDetails.businessEmail &&
    businessProfile.businessDetails.businessPhone;

  // Fetch vehicles and drivers data
  const { data: vehicles } = useQuery({
    queryKey: ["/api/vehicles"],
    enabled: isOpen,
  });

  const { data: drivers } = useQuery({
    queryKey: ["/api/drivers"],
    enabled: isOpen,
  });

  // Prefill data when booking changes
  useEffect(() => {
    if (booking && isOpen) {
      const vehicleArray = Array.isArray(vehicles) ? vehicles : [];
      const selectedVehicle = vehicleArray.find((v: any) => (v._id || v.id) === booking.vehicleId);
      
      const driverArray = Array.isArray(drivers) ? drivers : [];
      const selectedDriver = driverArray.find((d: any) => (d._id || d.id) === booking.driverId);
      
      // Generate invoice number
      const bookingDate = new Date(booking.pickupDate);
      const invoiceNumber = `INV-${bookingDate.getFullYear()}${String(bookingDate.getMonth() + 1).padStart(2, '0')}${String(bookingDate.getDate()).padStart(2, '0')}/${booking.bookingId || booking._id}`;
      
      setInvoiceData({
        // Trip Details
        fromLocation: booking.pickupLocation || "",
        toLocation: booking.dropoffLocation || "",
        pickupDate: booking.pickupDate || "",
        pickupTime: booking.pickupTime || "",
        returnDate: booking.returnDate || "",
        returnTime: booking.returnTime || "",
        tripType: booking.tripType === "round_trip" ? "Round Trip" :
                 booking.tripType === "local" ? "Local" :
                 booking.tripType === "airport" && booking.dropoffLocation === "Not Decided Yet" ? "Not Decided" :
                 booking.tripType === "airport" ? "Airport" :
                 booking.dropoffLocation === "Local" ? "Local" :
                 booking.dropoffLocation === "Not Decided Yet" ? "Not Decided" :
                 booking.tripType === "one_way" ? "One Way" : "One Way",
        tape: "",
        pickupType: booking.bookingType === "self_drive" ? "Self Drive" : "With Driver",
        
        // Vehicle & Service
        vehicleName: selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model || selectedVehicle.vehicleModel || ''}`.trim() : "",
        vehicleType: selectedVehicle?.type || selectedVehicle?.vehicleType || "Economy",
        serviceType: booking.bookingType === "self_drive" ? "Self Drive" : "With Driver",
        customerName: booking.customerName || "",
        customerMobile: booking.customerPhone || "",
        customerEmail: booking.customerEmail || "",
        
        // Charges - prefill with booking data but allow editing
        baseFare: booking.amount || booking.totalAmount || 0,
        parkingCharges: booking.parkingCharges || 0,
        tollCharges: booking.tollCharges || 0,
        lateDropFee: 0,
        miscellaneous: booking.miscellaneousAmount || 0,
        carDamageCharges: 0,
        extraKilometerCharges: 0,
        fuelCharges: 0,
        nightHaltCharges: 0,
        driverFoodCharges: 0,
        pickAndDropCharges: 0,
        discount: 0,
        paymentMode: "UPI",
        
        // Others
        invoiceDate: new Date().toISOString().split('T')[0],
        invoiceNumber: invoiceNumber,
        
        // Display Controls
        showGST: false,
        showSignature: true,
        termsAndConditions: "• Payment due within 7 days\n• Late return incurs ₹500/hr fee\n• Vehicle must be returned with full fuel tank"
      });
    }
  }, [booking, isOpen, vehicles, drivers]);

  const handleInputChange = (field: keyof InvoiceData, value: string | number) => {
    setInvoiceData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculateTotal = () => {
    return invoiceData.baseFare + 
           invoiceData.parkingCharges + 
           invoiceData.tollCharges + 
           invoiceData.lateDropFee + 
           invoiceData.miscellaneous + 
           invoiceData.carDamageCharges + 
           invoiceData.extraKilometerCharges + 
           invoiceData.fuelCharges + 
           invoiceData.nightHaltCharges + 
           invoiceData.driverFoodCharges + 
           invoiceData.pickAndDropCharges - 
           invoiceData.discount;
  };

  const generateInvoicePDF = async () => {
    // Validate business profile completion before generating PDF
    if (!isBusinessProfileComplete) {
      toast({
        variant: "destructive",
        title: "Business Profile Incomplete",
        description: "Please complete your business profile in the Profile section before generating invoices. Business name, owner name, address, email, and phone are required.",
      });
      return;
    }

    const element = document.getElementById('invoice-pdf-content');
    if (element) {
      const opt = {
        margin: 0.5,
        filename: `Invoice_${invoiceData.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();
    }
  };

  const generateInvoiceAndShare = async () => {
    await generateInvoicePDF();
    setShowWhatsAppModal(true);
    toast({
      variant: "success",
      title: "Invoice Downloaded!",
      description: "Invoice PDF has been downloaded successfully.",
    });
  };

  // Generate WhatsApp share link
  const generateWhatsAppLink = () => {
    if (!invoiceData.customerMobile) return "";

    const customerPhone = invoiceData.customerMobile.replace(/[^\d]/g, ''); // Remove non-digits
    const formattedPhone = customerPhone.startsWith('91') ? customerPhone : `91${customerPhone}`;
    
    const getRouteDisplay = () => {
      if (invoiceData.toLocation === 'Local') {
        return `${invoiceData.fromLocation} → Local`;
      } else if (invoiceData.toLocation === 'Not Decided Yet') {
        return `${invoiceData.fromLocation} → Not Decided`;
      } else {
        return `${invoiceData.fromLocation} → ${invoiceData.toLocation}`;
      }
    };

    const message = `Dear ${invoiceData.customerName},

Your invoice for the trip is ready!

📄 *Invoice Details:*
Invoice No: ${invoiceData.invoiceNumber}
Date: ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}

🚗 *Trip Details:*
Route: ${getRouteDisplay()}
Vehicle: ${invoiceData.vehicleName}
Service: ${invoiceData.serviceType}
Travel Date: ${new Date(invoiceData.pickupDate).toLocaleDateString('en-IN')}

💰 *Amount:*
Total Payable: ₹${calculateTotal().toLocaleString()}
Payment Mode: ${invoiceData.paymentMode}

Thank you for choosing our service!

Best regards,
FleetPro Team`;

    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generate Invoice - {booking?.bookingId}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Editable Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Trip Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fromLocation">From</Label>
                  <Input
                    id="fromLocation"
                    value={invoiceData.fromLocation}
                    onChange={(e) => handleInputChange('fromLocation', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="toLocation">To</Label>
                  <Input
                    id="toLocation"
                    value={invoiceData.toLocation}
                    onChange={(e) => handleInputChange('toLocation', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="pickupDate">Pickup Date</Label>
                  <Input
                    id="pickupDate"
                    type="date"
                    value={invoiceData.pickupDate}
                    onChange={(e) => handleInputChange('pickupDate', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="pickupTime">Pickup Time</Label>
                  <Input
                    id="pickupTime"
                    type="time"
                    value={invoiceData.pickupTime}
                    onChange={(e) => handleInputChange('pickupTime', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="returnDate">Return Date</Label>
                  <Input
                    id="returnDate"
                    type="date"
                    value={invoiceData.returnDate}
                    onChange={(e) => handleInputChange('returnDate', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="returnTime">Return Time</Label>
                  <Input
                    id="returnTime"
                    type="time"
                    value={invoiceData.returnTime}
                    onChange={(e) => handleInputChange('returnTime', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="tripType">Trip Type</Label>
                  <Select value={invoiceData.tripType} onValueChange={(value) => handleInputChange('tripType', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="One Way">One Way</SelectItem>
                      <SelectItem value="Round Trip">Round Trip</SelectItem>
                      <SelectItem value="Local">Local</SelectItem>
                      <SelectItem value="Airport">Airport</SelectItem>
                      <SelectItem value="Not Decided">Not Decided</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="tape">Tape (Optional)</Label>
                  <Input
                    id="tape"
                    value={invoiceData.tape}
                    onChange={(e) => handleInputChange('tape', e.target.value)}
                    placeholder="E.g., E3"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Vehicle & Service</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vehicleName">Vehicle Name</Label>
                  <Input
                    id="vehicleName"
                    value={invoiceData.vehicleName}
                    onChange={(e) => handleInputChange('vehicleName', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="vehicleType">Vehicle Type</Label>
                  <Select value={invoiceData.vehicleType} onValueChange={(value) => handleInputChange('vehicleType', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Economy">Economy</SelectItem>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Premium">Premium</SelectItem>
                      <SelectItem value="Luxury">Luxury</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="serviceType">Service Type</Label>
                  <Select value={invoiceData.serviceType} onValueChange={(value) => handleInputChange('serviceType', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Self Drive">Self Drive</SelectItem>
                      <SelectItem value="With Driver">With Driver</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="customerName">Customer Name</Label>
                  <Input
                    id="customerName"
                    value={invoiceData.customerName}
                    onChange={(e) => handleInputChange('customerName', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="customerMobile">Customer Mobile</Label>
                  <Input
                    id="customerMobile"
                    value={invoiceData.customerMobile}
                    onChange={(e) => handleInputChange('customerMobile', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="customerEmail">Customer Email</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={invoiceData.customerEmail}
                    onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Charges</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="baseFare">Base Fare (₹)</Label>
                  <Input
                    id="baseFare"
                    type="number"
                    value={invoiceData.baseFare}
                    onChange={(e) => handleInputChange('baseFare', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="parkingCharges">Parking Charges (₹)</Label>
                  <Input
                    id="parkingCharges"
                    type="number"
                    value={invoiceData.parkingCharges}
                    onChange={(e) => handleInputChange('parkingCharges', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="tollCharges">Toll Charges (₹)</Label>
                  <Input
                    id="tollCharges"
                    type="number"
                    value={invoiceData.tollCharges}
                    onChange={(e) => handleInputChange('tollCharges', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="lateDropFee">Late Drop Fee (₹)</Label>
                  <Input
                    id="lateDropFee"
                    type="number"
                    value={invoiceData.lateDropFee}
                    onChange={(e) => handleInputChange('lateDropFee', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="miscellaneous">Miscellaneous (₹)</Label>
                  <Input
                    id="miscellaneous"
                    type="number"
                    value={invoiceData.miscellaneous}
                    onChange={(e) => handleInputChange('miscellaneous', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="carDamageCharges">Car Damage Charges (₹)</Label>
                  <Input
                    id="carDamageCharges"
                    type="number"
                    value={invoiceData.carDamageCharges}
                    onChange={(e) => handleInputChange('carDamageCharges', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="extraKilometerCharges">Extra Kilometer Charges (₹)</Label>
                  <Input
                    id="extraKilometerCharges"
                    type="number"
                    value={invoiceData.extraKilometerCharges}
                    onChange={(e) => handleInputChange('extraKilometerCharges', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="fuelCharges">Fuel Charges (₹)</Label>
                  <Input
                    id="fuelCharges"
                    type="number"
                    value={invoiceData.fuelCharges}
                    onChange={(e) => handleInputChange('fuelCharges', parseFloat(e.target.value) || 0)}
                    placeholder="Can be negative"
                  />
                </div>
                <div>
                  <Label htmlFor="discount">Discount (₹)</Label>
                  <Input
                    id="discount"
                    type="number"
                    value={invoiceData.discount}
                    onChange={(e) => handleInputChange('discount', parseFloat(e.target.value) || 0)}
                    placeholder="Can be negative"
                  />
                </div>
                <div>
                  <Label htmlFor="nightHaltCharges">Night Halt Charges (₹)</Label>
                  <Input
                    id="nightHaltCharges"
                    type="number"
                    value={invoiceData.nightHaltCharges}
                    onChange={(e) => handleInputChange('nightHaltCharges', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="driverFoodCharges">Driver Food Charges (₹)</Label>
                  <Input
                    id="driverFoodCharges"
                    type="number"
                    value={invoiceData.driverFoodCharges}
                    onChange={(e) => handleInputChange('driverFoodCharges', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="pickAndDropCharges">Pick and Drop Charges (₹)</Label>
                  <Input
                    id="pickAndDropCharges"
                    type="number"
                    value={invoiceData.pickAndDropCharges}
                    onChange={(e) => handleInputChange('pickAndDropCharges', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="paymentMode">Payment Mode</Label>
                  <Select value={invoiceData.paymentMode} onValueChange={(value) => handleInputChange('paymentMode', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invoiceDate">Invoice Date</Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    value={invoiceData.invoiceDate}
                    onChange={(e) => handleInputChange('invoiceDate', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="invoiceNumber">Invoice Number</Label>
                  <Input
                    id="invoiceNumber"
                    value={invoiceData.invoiceNumber}
                    onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Business Profile Status */}
            {!isBusinessProfileComplete && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <span className="text-yellow-600 mt-0.5">⚠️</span>
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Business Profile Required</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Complete your business profile in the Profile section to generate professional invoices. 
                      Business name, owner name, address, email, and phone are required.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={generateInvoicePDF} 
                variant="outline" 
                className="flex-1"
                disabled={!isBusinessProfileComplete}
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button 
                onClick={generateInvoiceAndShare} 
                className="flex-1 bg-green-500 hover:bg-green-600"
                disabled={!isBusinessProfileComplete}
              >
                <Download className="w-4 h-4 mr-2" />
                Download & Share
              </Button>
              <Button variant="outline" onClick={onClose}>
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
            </div>
          </div>

          {/* Right Column - Invoice Preview */}
          <div className="lg:sticky lg:top-0 lg:max-h-[80vh] lg:overflow-y-auto">
            <div id="invoice-pdf-content" className="bg-white p-8 border rounded-lg shadow-sm">
              {/* Header */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="w-20 h-20 mb-4 flex items-center justify-center overflow-hidden">
                    {businessProfile?.businessDetails?.logoUrl ? (
                      <img 
                        src={businessProfile.businessDetails.logoUrl} 
                        alt="Company Logo" 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-black text-white flex items-center justify-center">
                        <span className="text-2xl font-bold">△</span>
                      </div>
                    )}
                  </div>
                  <h1 className="text-xl font-bold">
                    {businessProfile?.businessDetails?.businessName || "COMPANY NAME"}
                  </h1>
                  <p className="text-sm text-gray-600">
                    {businessProfile?.businessDetails?.businessAddress || "125 Business Ave, Greenville, RSA 12345"}
                  </p>
                  <p className="text-sm text-gray-600">
                    {businessProfile?.businessDetails?.businessPhone || "+30.Gij 1234 5378"}
                  </p>
                  <p className="text-sm text-gray-600">
                    {businessProfile?.businessDetails?.businessEmail || "info@eriail.com"}
                  </p>
                  <p className="text-sm text-gray-600">
                    GST: {businessProfile?.businessDetails?.gstNumber || "#XXAAA0000A1"}
                  </p>
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-right">INVOICE</h1>
                </div>
              </div>

              <Separator className="mb-6" />

              {/* Trip Details */}
              <div className="mb-6">
                <h2 className="text-lg font-bold mb-4">TRIP DETAILS</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <div><span className="font-medium">From:</span> {invoiceData.fromLocation}</div>
                  <div><span className="font-medium">Tape:</span> {invoiceData.tape}</div>
                  <div><span className="font-medium">To:</span> {invoiceData.toLocation}</div>
                  <div><span className="font-medium">Pickup:</span> {invoiceData.pickupType}</div>
                  <div><span className="font-medium">Pickup:</span> {invoiceData.pickupDate} at {invoiceData.pickupTime}</div>
                  <div><span className="font-medium">Return:</span> {invoiceData.tripType}</div>
                  <div><span className="font-medium">Trip Type:</span> {invoiceData.returnDate} at {invoiceData.returnTime}</div>
                  <div></div>
                </div>
              </div>

              <Separator className="mb-6" />

              {/* Vehicle & Service */}
              <div className="mb-6">
                <h2 className="text-lg font-bold mb-4">VEHICLE & SERVICE</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <div><span className="font-medium">Vehicle:</span> {invoiceData.vehicleName}</div>
                  <div><span className="font-medium">Type:</span> {invoiceData.vehicleType}</div>
                  <div><span className="font-medium">Service:</span> {invoiceData.serviceType}</div>
                  <div></div>
                </div>
              </div>

              <Separator className="mb-6" />

              {/* Customer Details */}
              <div className="mb-6">
                <h2 className="text-lg font-bold mb-4">CUSTOMER DETAILS</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <div><span className="font-medium">Name:</span> {invoiceData.customerName}</div>
                  <div><span className="font-medium">Email:</span> {invoiceData.customerEmail}</div>
                  <div><span className="font-medium">Mobile:</span> {invoiceData.customerMobile}</div>
                  <div></div>
                </div>
              </div>

              {/* Charges Table */}
              <div className="mb-6">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <div className="flex justify-between font-bold border-b pb-2 mb-2">
                      <span>DESCRIPTION</span>
                      <span>AMOUNT</span>
                    </div>
                    
                    {invoiceData.baseFare > 0 && (
                      <div className="flex justify-between py-1">
                        <span>Base Fare</span>
                        <span>₹{invoiceData.baseFare.toLocaleString()}</span>
                      </div>
                    )}
                    {invoiceData.parkingCharges > 0 && (
                      <div className="flex justify-between py-1">
                        <span>Parking Charges</span>
                        <span>₹{invoiceData.parkingCharges.toLocaleString()}</span>
                      </div>
                    )}
                    {invoiceData.tollCharges > 0 && (
                      <div className="flex justify-between py-1">
                        <span>Toll Charges</span>
                        <span>₹{invoiceData.tollCharges.toLocaleString()}</span>
                      </div>
                    )}
                    {invoiceData.lateDropFee > 0 && (
                      <div className="flex justify-between py-1">
                        <span>Late Drop Fee</span>
                        <span>₹{invoiceData.lateDropFee.toLocaleString()}</span>
                      </div>
                    )}
                    {invoiceData.miscellaneous > 0 && (
                      <div className="flex justify-between py-1">
                        <span>Miscellaneous</span>
                        <span>₹{invoiceData.miscellaneous.toLocaleString()}</span>
                      </div>
                    )}
                    {invoiceData.carDamageCharges > 0 && (
                      <div className="flex justify-between py-1">
                        <span>Car Damage Charges</span>
                        <span>₹{invoiceData.carDamageCharges.toLocaleString()}</span>
                      </div>
                    )}
                    {invoiceData.extraKilometerCharges > 0 && (
                      <div className="flex justify-between py-1">
                        <span>Extra Kilometer Charges</span>
                        <span>₹{invoiceData.extraKilometerCharges.toLocaleString()}</span>
                      </div>
                    )}
                    {invoiceData.fuelCharges !== 0 && (
                      <div className="flex justify-between py-1">
                        <span>Fuel Charges</span>
                        <span>{invoiceData.fuelCharges < 0 ? '-' : ''}₹{Math.abs(invoiceData.fuelCharges).toLocaleString()}</span>
                      </div>
                    )}
                    {invoiceData.discount !== 0 && (
                      <div className="flex justify-between py-1">
                        <span>Discount</span>
                        <span>{invoiceData.discount < 0 ? '-' : ''}₹{Math.abs(invoiceData.discount).toLocaleString()}</span>
                      </div>
                    )}
                    {invoiceData.nightHaltCharges > 0 && (
                      <div className="flex justify-between py-1">
                        <span>Night Halt Charges</span>
                        <span>₹{invoiceData.nightHaltCharges.toLocaleString()}</span>
                      </div>
                    )}
                    {invoiceData.driverFoodCharges > 0 && (
                      <div className="flex justify-between py-1">
                        <span>Driver Food Charges</span>
                        <span>₹{invoiceData.driverFoodCharges.toLocaleString()}</span>
                      </div>
                    )}
                    {invoiceData.pickAndDropCharges > 0 && (
                      <div className="flex justify-between py-1">
                        <span>Pick and Drop Charges</span>
                        <span>₹{invoiceData.pickAndDropCharges.toLocaleString()}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                      <span>TOTAL PAYABLE</span>
                      <span>₹{calculateTotal().toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="space-y-4">
                      <div>
                        <span className="font-medium">Payment Mode:</span>
                        <div className="text-right">{invoiceData.paymentMode}</div>
                      </div>
                      <div>
                        <span className="font-medium">Invoice Date:</span>
                        <div className="text-right">{new Date(invoiceData.invoiceDate).toLocaleDateString('en-GB')}</div>
                      </div>
                      <div>
                        <span className="font-medium">Invoice No.:</span>
                        <div className="text-right">{invoiceData.invoiceNumber}</div>
                      </div>
                      
                      <div className="mt-8 text-center">
                        <p className="italic text-lg mb-4">Authorized Signature</p>
                        
                        {/* QR Code Placeholder */}
                        <div className="w-20 h-20 border-2 border-black mx-auto flex items-center justify-center">
                          <div className="text-xs text-center">QR<br/>CODE</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="mb-6" />

              {/* Terms & Conditions */}
              <div>
                <h2 className="text-lg font-bold mb-4">Terms & Conditions</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p>• Payment due within 7 days</p>
                    <p>• Late return incurs ₹500/hr fee</p>
                  </div>
                  <div>
                    <p>• Late return incurs ₹500/hr fee</p>
                    <p>• Vehicle must be returned with full fuel tank</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* WhatsApp Share Modal */}
      <Dialog open={showWhatsAppModal} onOpenChange={setShowWhatsAppModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-center text-green-600">
              Invoice Downloaded! 📄
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-gray-600 mb-4">
              Your invoice has been downloaded successfully.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Would you like to send the invoice details to your customer via WhatsApp?
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => {
                  window.open(generateWhatsAppLink(), '_blank');
                  setShowWhatsAppModal(false);
                }}
                className="bg-green-500 hover:bg-green-600 text-white"
                disabled={!invoiceData.customerMobile}
              >
                Share via WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowWhatsAppModal(false)}
              >
                Skip
              </Button>
            </div>
            {!invoiceData.customerMobile && (
              <p className="text-xs text-red-500 mt-2">
                Please add customer mobile number to enable WhatsApp sharing
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
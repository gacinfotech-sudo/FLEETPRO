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
import { Checkbox } from "@/components/ui/checkbox";
import html2pdf from 'html2pdf.js';
import { X, FileText, Download, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EnhancedInvoiceGeneratorProps {
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

export default function EnhancedInvoiceGenerator({ booking, isOpen, onClose }: EnhancedInvoiceGeneratorProps) {
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

  // Fetch business profile data for documents (includes inherited data for managers)
  const { data: businessProfile } = useQuery({
    queryKey: ['/api/auth/business-profile-for-documents'],
    queryFn: async () => {
      const response = await fetch('http://localhost:5050/api/auth/business-profile-for-documents', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch business profile');
      return response.json();
    },
    enabled: isOpen
  });

  // Fetch vehicles and drivers data
  const { data: vehicles } = useQuery({
    queryKey: ['/api/vehicles'],
    enabled: isOpen
  });

  const { data: drivers } = useQuery({
    queryKey: ['/api/drivers'],
    enabled: isOpen
  });

  // Populate invoice data when booking changes
  useEffect(() => {
    if (booking && isOpen) {
      const vehicleArray = Array.isArray(vehicles) ? vehicles : [];
      const selectedVehicle = vehicleArray.find((v: any) => (v._id || v.id) === booking.vehicleId);
      
      const driverArray = Array.isArray(drivers) ? drivers : [];
      const selectedDriver = driverArray.find((d: any) => (d._id || d.id) === booking.driverId);
      
      // Generate invoice number
      const bookingDate = new Date(booking.pickupDate);
      const invoiceNumber = `INV-${bookingDate.getFullYear()}${String(bookingDate.getMonth() + 1).padStart(2, '0')}${String(bookingDate.getDate()).padStart(2, '0')}/${booking.bookingId || booking._id}`;
      
      setInvoiceData(prev => ({
        ...prev,
        // Trip Details
        fromLocation: booking.pickupLocation || "",
        toLocation: booking.dropoffLocation || "",
        pickupDate: booking.pickupDate || "",
        pickupTime: booking.pickupTime || "",
        returnDate: booking.returnDate || "",
        returnTime: booking.returnTime || "",
        tripType: booking.tripType === "round_trip" ? "Round Trip" :
                 booking.tripType === "local" ? "Local" :
                 booking.dropoffLocation === "Local" ? "Local" :
                 booking.dropoffLocation === "Not Decided Yet" ? "Not Decided" :
                 "One Way",
        pickupType: booking.bookingType === "self_drive" ? "Self Drive" : "With Driver",
        
        // Vehicle & Service
        vehicleName: selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model || selectedVehicle.vehicleModel || ''}`.trim() : "",
        vehicleType: selectedVehicle?.type || selectedVehicle?.vehicleType || "Economy",
        serviceType: booking.bookingType === "self_drive" ? "Self Drive" : "With Driver",
        customerName: booking.customerName || "",
        customerMobile: booking.customerPhone || "",
        customerEmail: booking.customerEmail || "",
        
        // Charges - prefill with booking data
        baseFare: booking.amount || booking.totalAmount || 0,
        parkingCharges: booking.parkingCharges || 0,
        tollCharges: booking.tollCharges || 0,
        miscellaneous: booking.miscellaneousAmount || 0,
        
        // Others
        invoiceNumber: invoiceNumber,
        showGST: businessProfile?.businessDetails?.gstNumber ? true : false
      }));
    }
  }, [booking, isOpen, vehicles, drivers, businessProfile]);

  // Calculate total amount
  const calculateTotal = () => {
    const charges = [
      invoiceData.baseFare,
      invoiceData.parkingCharges,
      invoiceData.tollCharges,
      invoiceData.lateDropFee,
      invoiceData.miscellaneous,
      invoiceData.carDamageCharges,
      invoiceData.extraKilometerCharges,
      invoiceData.fuelCharges,
      invoiceData.nightHaltCharges,
      invoiceData.driverFoodCharges,
      invoiceData.pickAndDropCharges
    ];
    
    const totalBeforeDiscount = charges.reduce((sum, charge) => sum + (charge || 0), 0);
    return Math.max(0, totalBeforeDiscount - (invoiceData.discount || 0));
  };

  // Generate and download PDF
  const downloadPDF = async () => {
    const element = document.getElementById('invoice-preview');
    if (!element) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Invoice preview not found"
      });
      return;
    }

    const options = {
      margin: 0.5,
      filename: `${invoiceData.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(options).from(element).save();
      
      toast({
        title: "Success",
        description: "Invoice PDF downloaded successfully!"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate PDF"
      });
    }
  };

  // Download and share functionality
  const downloadAndShare = async () => {
    await downloadPDF();
    setShowWhatsAppModal(true);
  };

  // WhatsApp share modal
  const WhatsAppShareModal = () => {
    const [phoneNumber, setPhoneNumber] = useState(invoiceData.customerMobile);
    
    const shareToWhatsApp = () => {
      const message = `Hi ${invoiceData.customerName},

Your booking invoice is ready!

*Invoice Details:*
📄 Invoice No: ${invoiceData.invoiceNumber}
📅 Date: ${new Date(invoiceData.invoiceDate).toLocaleDateString()}
🚗 Vehicle: ${invoiceData.vehicleName}
🛣️ Trip: ${invoiceData.fromLocation} to ${invoiceData.toLocation}
💰 Total Amount: ₹${calculateTotal().toLocaleString()}

Thank you for choosing our service!

Best regards,
${businessProfile?.businessDetails?.businessName || 'FleetPro'}`;

      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/91${phoneNumber.replace(/\D/g, '')}?text=${encodedMessage}`;
      window.open(whatsappUrl, '_blank');
      
      setShowWhatsAppModal(false);
      toast({
        title: "Success",
        description: "WhatsApp opened with invoice details!"
      });
    };

    return (
      <Dialog open={showWhatsAppModal} onOpenChange={setShowWhatsAppModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              <span>Share on WhatsApp</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="whatsapp-phone">Customer Phone Number</Label>
              <Input
                id="whatsapp-phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Enter phone number"
                className="mt-1"
              />
            </div>
            <div className="flex space-x-2">
              <Button onClick={shareToWhatsApp} className="flex-1 bg-green-600 hover:bg-green-700">
                <MessageCircle className="w-4 h-4 mr-2" />
                Share Invoice
              </Button>
              <Button variant="outline" onClick={() => setShowWhatsAppModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-7xl max-h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>Generate Invoice</span>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 overflow-hidden">
            {/* Left Panel - Editable Form */}
            <div className="space-y-4 overflow-y-auto pr-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Invoice Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="invoiceDate">Invoice Date</Label>
                      <Input
                        id="invoiceDate"
                        type="date"
                        value={invoiceData.invoiceDate}
                        onChange={(e) => setInvoiceData({...invoiceData, invoiceDate: e.target.value})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="invoiceNumber">Invoice Number</Label>
                      <Input
                        id="invoiceNumber"
                        value={invoiceData.invoiceNumber}
                        onChange={(e) => setInvoiceData({...invoiceData, invoiceNumber: e.target.value})}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="paymentMode">Payment Mode</Label>
                    <Select value={invoiceData.paymentMode} onValueChange={(value) => setInvoiceData({...invoiceData, paymentMode: value})}>
                      <SelectTrigger className="mt-1">
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

              {/* Charges Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Charges</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="baseFare">Base Fare (₹)</Label>
                      <Input
                        id="baseFare"
                        type="number"
                        value={invoiceData.baseFare}
                        onChange={(e) => setInvoiceData({...invoiceData, baseFare: Number(e.target.value)})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="parkingCharges">Parking Charges (₹)</Label>
                      <Input
                        id="parkingCharges"
                        type="number"
                        value={invoiceData.parkingCharges}
                        onChange={(e) => setInvoiceData({...invoiceData, parkingCharges: Number(e.target.value)})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tollCharges">Toll Charges (₹)</Label>
                      <Input
                        id="tollCharges"
                        type="number"
                        value={invoiceData.tollCharges}
                        onChange={(e) => setInvoiceData({...invoiceData, tollCharges: Number(e.target.value)})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lateDropFee">Late Drop Fee (₹)</Label>
                      <Input
                        id="lateDropFee"
                        type="number"
                        value={invoiceData.lateDropFee}
                        onChange={(e) => setInvoiceData({...invoiceData, lateDropFee: Number(e.target.value)})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="miscellaneous">Miscellaneous (₹)</Label>
                      <Input
                        id="miscellaneous"
                        type="number"
                        value={invoiceData.miscellaneous}
                        onChange={(e) => setInvoiceData({...invoiceData, miscellaneous: Number(e.target.value)})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="carDamageCharges">Car Damage Charges (₹)</Label>
                      <Input
                        id="carDamageCharges"
                        type="number"
                        value={invoiceData.carDamageCharges}
                        onChange={(e) => setInvoiceData({...invoiceData, carDamageCharges: Number(e.target.value)})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="extraKilometerCharges">Extra Kilometer Charges (₹)</Label>
                      <Input
                        id="extraKilometerCharges"
                        type="number"
                        value={invoiceData.extraKilometerCharges}
                        onChange={(e) => setInvoiceData({...invoiceData, extraKilometerCharges: Number(e.target.value)})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fuelCharges">Fuel Charges (₹)</Label>
                      <Input
                        id="fuelCharges"
                        type="number"
                        value={invoiceData.fuelCharges}
                        onChange={(e) => setInvoiceData({...invoiceData, fuelCharges: Number(e.target.value)})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="discount">Discount (₹)</Label>
                      <Input
                        id="discount"
                        type="number"
                        value={invoiceData.discount}
                        onChange={(e) => setInvoiceData({...invoiceData, discount: Number(e.target.value)})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="nightHaltCharges">Night Halt Charges (₹)</Label>
                      <Input
                        id="nightHaltCharges"
                        type="number"
                        value={invoiceData.nightHaltCharges}
                        onChange={(e) => setInvoiceData({...invoiceData, nightHaltCharges: Number(e.target.value)})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="driverFoodCharges">Driver Food Charges (₹)</Label>
                      <Input
                        id="driverFoodCharges"
                        type="number"
                        value={invoiceData.driverFoodCharges}
                        onChange={(e) => setInvoiceData({...invoiceData, driverFoodCharges: Number(e.target.value)})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="pickAndDropCharges">Pick and Drop Charges (₹)</Label>
                      <Input
                        id="pickAndDropCharges"
                        type="number"
                        value={invoiceData.pickAndDropCharges}
                        onChange={(e) => setInvoiceData({...invoiceData, pickAndDropCharges: Number(e.target.value)})}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Display Options */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Display Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showGST"
                      checked={invoiceData.showGST}
                      onCheckedChange={(checked) => setInvoiceData({...invoiceData, showGST: checked as boolean})}
                    />
                    <Label htmlFor="showGST" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Show GST Number
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showSignature"
                      checked={invoiceData.showSignature}
                      onCheckedChange={(checked) => setInvoiceData({...invoiceData, showSignature: checked as boolean})}
                    />
                    <Label htmlFor="showSignature" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Show Authorized Signature
                    </Label>
                  </div>
                  
                  <div>
                    <Label htmlFor="termsAndConditions">Terms & Conditions</Label>
                    <Textarea
                      id="termsAndConditions"
                      value={invoiceData.termsAndConditions}
                      onChange={(e) => setInvoiceData({...invoiceData, termsAndConditions: e.target.value})}
                      placeholder="Enter terms and conditions..."
                      rows={4}
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel - Live Preview */}
            <div className="overflow-y-auto">
              <div id="invoice-preview" className="bg-white p-6 shadow-lg" style={{ minHeight: '297mm' }}>
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center space-x-4">
                    {businessProfile?.businessDetails?.logoUrl && (
                      <img 
                        src={businessProfile.businessDetails.logoUrl} 
                        alt="Company Logo" 
                        className="w-16 h-16 object-contain"
                      />
                    )}
                    <div>
                      <h1 className="text-xl font-bold text-gray-900">
                        {businessProfile?.businessDetails?.businessName || 'Company Name'}
                      </h1>
                      <p className="text-sm text-gray-600">
                        {businessProfile?.businessDetails?.businessAddress || 'Business Address'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {businessProfile?.businessDetails?.businessPhone || 'Phone Number'}
                      </p>
                      {invoiceData.showGST && (
                        <p className="text-sm text-gray-600">
                          GST: {businessProfile?.businessDetails?.gstNumber || 'Not Registered'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <h1 className="text-2xl font-bold text-gray-900">INVOICE</h1>
                  </div>
                </div>

                {/* Trip Details */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">TRIP DETAILS</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><span className="font-medium">From:</span> {invoiceData.fromLocation}</p>
                      <p><span className="font-medium">To:</span> {invoiceData.toLocation}</p>
                      <p><span className="font-medium">Pickup:</span> {invoiceData.pickupDate} at {invoiceData.pickupTime}</p>
                    </div>
                    <div>
                      <p><span className="font-medium">Type:</span> {invoiceData.tripType}</p>
                      <p><span className="font-medium">Service:</span> {invoiceData.pickupType}</p>
                      <p><span className="font-medium">Return:</span> {invoiceData.returnDate}</p>
                    </div>
                  </div>
                </div>

                {/* Vehicle & Service */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">VEHICLE & SERVICE</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><span className="font-medium">Vehicle:</span> {invoiceData.vehicleName}</p>
                      <p><span className="font-medium">Type:</span> {invoiceData.vehicleType}</p>
                      <p><span className="font-medium">Service:</span> {invoiceData.serviceType}</p>
                    </div>
                    <div>
                      {/* Empty column for proper spacing */}
                    </div>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">CUSTOMER DETAILS</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><span className="font-medium">Name:</span> {invoiceData.customerName}</p>
                      <p><span className="font-medium">Email:</span> {invoiceData.customerEmail}</p>
                    </div>
                    <div>
                      <p><span className="font-medium">Mobile:</span> {invoiceData.customerMobile}</p>
                    </div>
                  </div>
                </div>

                {/* Charges Table */}
                <div className="mb-6">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left">DESCRIPTION</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceData.baseFare > 0 && (
                        <tr>
                          <td className="border border-gray-300 px-4 py-2">Base Fare</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">₹{invoiceData.baseFare.toLocaleString()}</td>
                        </tr>
                      )}
                      {invoiceData.parkingCharges > 0 && (
                        <tr>
                          <td className="border border-gray-300 px-4 py-2">Parking Charges</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">₹{invoiceData.parkingCharges.toLocaleString()}</td>
                        </tr>
                      )}
                      {invoiceData.tollCharges > 0 && (
                        <tr>
                          <td className="border border-gray-300 px-4 py-2">Toll Charges</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">₹{invoiceData.tollCharges.toLocaleString()}</td>
                        </tr>
                      )}
                      {invoiceData.lateDropFee > 0 && (
                        <tr>
                          <td className="border border-gray-300 px-4 py-2">Late Drop Fee</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">₹{invoiceData.lateDropFee.toLocaleString()}</td>
                        </tr>
                      )}
                      {invoiceData.miscellaneous > 0 && (
                        <tr>
                          <td className="border border-gray-300 px-4 py-2">Miscellaneous</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">₹{invoiceData.miscellaneous.toLocaleString()}</td>
                        </tr>
                      )}
                      {invoiceData.carDamageCharges > 0 && (
                        <tr>
                          <td className="border border-gray-300 px-4 py-2">Car Damage Charges</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">₹{invoiceData.carDamageCharges.toLocaleString()}</td>
                        </tr>
                      )}
                      {invoiceData.extraKilometerCharges > 0 && (
                        <tr>
                          <td className="border border-gray-300 px-4 py-2">Extra Kilometer Charges</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">₹{invoiceData.extraKilometerCharges.toLocaleString()}</td>
                        </tr>
                      )}
                      {invoiceData.fuelCharges > 0 && (
                        <tr>
                          <td className="border border-gray-300 px-4 py-2">Fuel Charges</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">₹{invoiceData.fuelCharges.toLocaleString()}</td>
                        </tr>
                      )}
                      {invoiceData.nightHaltCharges > 0 && (
                        <tr>
                          <td className="border border-gray-300 px-4 py-2">Night Halt Charges</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">₹{invoiceData.nightHaltCharges.toLocaleString()}</td>
                        </tr>
                      )}
                      {invoiceData.driverFoodCharges > 0 && (
                        <tr>
                          <td className="border border-gray-300 px-4 py-2">Driver Food Charges</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">₹{invoiceData.driverFoodCharges.toLocaleString()}</td>
                        </tr>
                      )}
                      {invoiceData.pickAndDropCharges > 0 && (
                        <tr>
                          <td className="border border-gray-300 px-4 py-2">Pick and Drop Charges</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">₹{invoiceData.pickAndDropCharges.toLocaleString()}</td>
                        </tr>
                      )}
                      {invoiceData.discount > 0 && (
                        <tr>
                          <td className="border border-gray-300 px-4 py-2">Discount</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">-₹{invoiceData.discount.toLocaleString()}</td>
                        </tr>
                      )}
                      <tr className="bg-gray-100 font-bold">
                        <td className="border border-gray-300 px-4 py-2">TOTAL PAYABLE</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">₹{calculateTotal().toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Payment Mode and Invoice Details */}
                <div className="mb-6 text-right">
                  <p className="text-sm mb-2"><span className="font-medium">Payment Mode:</span> {invoiceData.paymentMode}</p>
                  <p className="text-sm mb-2"><span className="font-medium">Invoice Date:</span> {new Date(invoiceData.invoiceDate).toLocaleDateString()}</p>
                  <p className="text-sm mb-4"><span className="font-medium">Invoice No.:</span> {invoiceData.invoiceNumber}</p>
                  
                  {invoiceData.showSignature && (
                    <div className="text-center mt-4">
                      <p className="text-sm font-medium mb-2">Authorized Signature</p>
                      {businessProfile?.businessDetails?.signatureUrl ? (
                        <div className="inline-block border-b-2 border-gray-400 min-w-[120px] pb-1">
                          <img 
                            src={businessProfile.businessDetails.signatureUrl} 
                            alt="Authorized Signature" 
                            className="w-32 h-16 object-contain mx-auto"
                            onError={(e) => {
                              console.error('Signature image failed to load:', businessProfile.businessDetails.signatureUrl);
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-32 h-16 border border-dashed border-gray-400 mx-auto flex items-center justify-center">
                          <span className="text-xs text-gray-500">No Signature</span>
                        </div>
                      )}
                      <p className="text-xs text-gray-600 mt-1">{businessProfile?.businessDetails?.businessName || 'Company Name'}</p>
                    </div>
                  )}
                </div>

                {/* Terms & Conditions */}
                {invoiceData.termsAndConditions && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-3">Terms & Conditions</h3>
                    <div className="text-sm text-gray-700 whitespace-pre-line">
                      {invoiceData.termsAndConditions}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons - Fixed at Bottom */}
          <div className="flex-shrink-0 flex justify-start items-start pt-4 mt-4 border-t bg-white">
            <div className="flex flex-col space-y-2">
              <Button onClick={downloadPDF} variant="outline" className="w-40">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button onClick={downloadAndShare} className="bg-green-600 hover:bg-green-700 w-40">
                <MessageCircle className="w-4 h-4 mr-2" />
                Download & Share
              </Button>
            </div>
            <Button variant="outline" onClick={onClose} className="ml-auto">
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <WhatsAppShareModal />
    </>
  );
}
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface BookingHistoryPDFProps {
  bookings: any[];
  vehicles: any[];
  drivers?: any[];
}

export default function BookingHistoryPDF({ bookings, vehicles, drivers = [] }: BookingHistoryPDFProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generatePDF = async () => {
    setIsGenerating(true);
    
    try {
      // Fetch business profile for header information (includes inherited data for managers)
      let businessProfile = null;
      try {
        const profileResponse = await fetch('http://localhost:5050/api/auth/business-profile-for-documents', {
          credentials: 'include'
        });
        if (profileResponse.ok) {
          businessProfile = await profileResponse.json();
        }
      } catch (error) {
        console.warn('Could not fetch business profile:', error);
      }
      
      
      const doc = new jsPDF('landscape'); // Change to landscape orientation for horizontal layout
      const currentDate = new Date().toLocaleDateString();
      
      // Helper function to load and add logo image
      const loadLogoImage = async (): Promise<string | null> => {
        if (!businessProfile?.businessDetails?.logoUrl) {
          return null;
        }
        
        try {
          const logoUrl = businessProfile.businessDetails.logoUrl;
          const fullUrl = logoUrl.startsWith('http') ? logoUrl : `${window.location.origin}${logoUrl}`;
          
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                
                if (ctx) {
                  ctx.drawImage(img, 0, 0);
                  const dataURL = canvas.toDataURL('image/jpeg', 0.8);
                  resolve(dataURL);
                } else {
                  reject(new Error('Canvas context not available'));
                }
              } catch (error) {
                reject(error);
              }
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = fullUrl;
          });
        } catch (error) {
          console.warn('Logo loading error:', error);
          return null;
        }
      };
      
      // Load logo image with fallback
      let logoImageData = null;
      try {
        logoImageData = await loadLogoImage();
      } catch (error) {
        console.warn('Logo loading failed, continuing without logo:', error);
      }
    
    // Function to draw header with company branding
    const drawHeader = (pageNumber: number) => {
      const pageWidth = doc.internal.pageSize.width;
      
      // Clean white header background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      // Header border line
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(2);
      doc.line(15, 33, pageWidth - 15, 33);
      
      // Company logo area (left side)
      if (logoImageData) {
        try {
          // Add the actual logo image
          doc.addImage(logoImageData, 'JPEG', 15, 5, 25, 25);
        } catch (error) {
          // Fallback to placeholder
          doc.setFillColor(248, 250, 252);
          doc.rect(15, 5, 25, 25, 'F');
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.5);
          doc.rect(15, 5, 25, 25, 'S');
          doc.setFontSize(8);
          doc.setTextColor(37, 99, 235);
          doc.text('LOGO', 22, 20);
        }
      } else {
        // Show placeholder when no logo
        doc.setFillColor(248, 250, 252);
        doc.rect(15, 5, 25, 25, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.rect(15, 5, 25, 25, 'S');
        doc.setFontSize(8);
        doc.setTextColor(37, 99, 235);
        doc.text('LOGO', 22, 20);
      }
      
      // Company name and address (right side) - using actual business profile data
      doc.setFontSize(16);
      doc.setTextColor(37, 99, 235);
      const companyName = businessProfile?.businessDetails?.businessName || 'Company Name';
      doc.text(companyName, pageWidth - 150, 15);
      
      if (businessProfile?.businessDetails?.businessAddress) {
        doc.setFontSize(10);
        doc.setTextColor(100);
        // Split address into multiple lines if too long
        const addressLines = doc.splitTextToSize(businessProfile.businessDetails.businessAddress, 140);
        addressLines.forEach((line: string, index: number) => {
          doc.text(line, pageWidth - 150, 25 + (index * 5));
        });
      }
    };
    
    // Draw initial header
    drawHeader(1);
    
    // Summary Section with Horizontal Layout
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
    const totalRevenue = bookings
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
    
    // Page title
    doc.setFontSize(16);
    doc.setTextColor(37, 99, 235);
    doc.text('Booking History Report', 20, 50);
    
    // Summary boxes with horizontal layout (4 boxes in a row)
    const summaryY = 55;
    const boxHeight = 15;
    const boxWidth = 60;
    const spacing = 70;
    
    // Total Bookings Box
    doc.setFillColor(248, 250, 252);
    doc.rect(20, summaryY, boxWidth, boxHeight, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.rect(20, summaryY, boxWidth, boxHeight, 'S');
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text('Total Bookings', 22, summaryY + 6);
    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text(totalBookings.toString(), 22, summaryY + 12);
    
    // Completed Bookings Box
    doc.setFillColor(240, 253, 244);
    doc.rect(20 + spacing, summaryY, boxWidth, boxHeight, 'F');
    doc.rect(20 + spacing, summaryY, boxWidth, boxHeight, 'S');
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text('Completed', 22 + spacing, summaryY + 6);
    doc.setFontSize(14);
    doc.setTextColor(34, 197, 94);
    doc.text(completedBookings.toString(), 22 + spacing, summaryY + 12);
    
    // Confirmed Bookings Box
    doc.setFillColor(254, 249, 195);
    doc.rect(20 + spacing * 2, summaryY, boxWidth, boxHeight, 'F');
    doc.rect(20 + spacing * 2, summaryY, boxWidth, boxHeight, 'S');
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text('Confirmed', 22 + spacing * 2, summaryY + 6);
    doc.setFontSize(14);
    doc.setTextColor(245, 158, 11);
    doc.text(confirmedBookings.toString(), 22 + spacing * 2, summaryY + 12);
    
    // Total Revenue Box
    doc.setFillColor(240, 253, 244);
    doc.rect(20 + spacing * 3, summaryY, boxWidth, boxHeight, 'F');
    doc.rect(20 + spacing * 3, summaryY, boxWidth, boxHeight, 'S');
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text('Total Revenue', 22 + spacing * 3, summaryY + 6);
    doc.setFontSize(12);
    doc.setTextColor(34, 197, 94);
    doc.text(`₹${totalRevenue.toLocaleString('en-IN')}`, 22 + spacing * 3, summaryY + 12);
    
    // Prepare table data with safe parsing
    const tableData = bookings.map(booking => {
      try {
        const vehicle = vehicles.find(v => v.id === booking.vehicleId);
        const driver = drivers.find(d => d.id === booking.driverId);
        
        const tripTypeDisplay = booking.tripType === "round_trip" ? "Round Trip" :
                               booking.tripType === "local" ? "Local" :
                               booking.tripType === "airport" && booking.dropoffLocation === "Not Decided Yet" ? "Not Decided" :
                               booking.tripType === "airport" ? "Airport" :
                               booking.dropoffLocation === "Local" ? "Local" :
                               booking.dropoffLocation === "Not Decided Yet" ? "Not Decided" :
                               booking.tripType === "one_way" ? "One Way" : "One Way";
        
        return [
          booking.bookingId || 'N/A',
          booking.customerName || 'N/A',
          booking.customerPhone ? booking.customerPhone.toString().replace(/(\d{5})(\d{5})/, '$1-$2') : 'N/A',
          vehicle ? `${vehicle.make || ''} ${vehicle.model || ''}`.trim() : 'N/A',
          vehicle?.registrationNumber || 'N/A',
          `${booking.pickupLocation || 'Not specified'} to ${booking.dropoffLocation || 'Not specified'}`,
          `${booking.bookingType === 'self_drive' ? 'Self Drive' : 'With Driver'} (${tripTypeDisplay})`,
          driver?.name || (booking.bookingType === 'self_drive' ? 'N/A' : 'Not Assigned'),
          `${booking.pickupDate ? new Date(booking.pickupDate).toLocaleDateString() : 'N/A'} ${booking.pickupTime || ''}`,
          `${booking.returnDate ? new Date(booking.returnDate).toLocaleDateString() : 'N/A'} ${booking.returnTime || ''}`,
          booking.amount ? `₹${parseFloat(booking.amount).toLocaleString('en-IN')}` : '₹0',
          booking.status ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1) : 'N/A',
          booking.createdBy?.userId || 'System',
          booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : 'N/A'
        ];
      } catch (error) {
        console.warn('Error processing booking data:', error, booking);
        return [
          booking.bookingId || 'N/A',
          booking.customerName || 'N/A',
          'N/A',
          'N/A',
          'N/A',
          'N/A',
          'N/A',
          'N/A',
          'N/A',
          'N/A',
          '₹0',
          'N/A',
          'System',
          'N/A'
        ];
      }
    });
    
    // Table headers
    const headers = [
      'Booking ID',
      'Customer',
      'Phone',
      'Vehicle',
      'Registration',
      'Route',
      'Type',
      'Driver',
      'Pickup',
      'Return',
      'Amount',
      'Status',
      'Created By',
      'Created At'
    ];
    
    // Generate table with horizontal layout optimization
    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 80,
      theme: 'grid',
      headStyles: {
        fillColor: [37, 99, 235], // Professional blue
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 3
      },
      bodyStyles: {
        fontSize: 8,
        textColor: 60,
        cellPadding: 2,
        lineColor: [200, 200, 200],
        lineWidth: 0.5
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center' }, // Booking ID
        1: { cellWidth: 22, halign: 'left' }, // Customer
        2: { cellWidth: 20, halign: 'center', overflow: 'hidden' }, // Phone - prevent wrapping
        3: { cellWidth: 22, halign: 'left' }, // Vehicle
        4: { cellWidth: 18, halign: 'center' }, // Registration
        5: { cellWidth: 25, halign: 'left' }, // Route
        6: { cellWidth: 16, halign: 'center' }, // Type
        7: { cellWidth: 18, halign: 'left' }, // Driver
        8: { cellWidth: 22, halign: 'center' }, // Pickup
        9: { cellWidth: 22, halign: 'center' }, // Return
        10: { cellWidth: 16, halign: 'right' }, // Amount
        11: { cellWidth: 14, halign: 'center' }, // Status
        12: { cellWidth: 18, halign: 'center' }, // Created By
        13: { cellWidth: 16, halign: 'center' } // Created At
      },
      styles: {
        overflow: 'linebreak',
        cellPadding: 2,
        fontSize: 8,
        lineColor: [200, 200, 200],
        lineWidth: 0.5
      },
      margin: { left: 15, right: 15 },
      didDrawPage: (data) => {
        // Draw header for each page
        if (data.pageNumber > 1) {
          drawHeader(data.pageNumber);
        }
        
        // Professional Footer for landscape layout
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;
        const pageCount = doc.getNumberOfPages();
        
        // Footer background
        doc.setFillColor(248, 250, 252);
        doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
        
        // Footer line
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(15, pageHeight - 18, pageWidth - 15, pageHeight - 18);
        
        // Company info (left side)
        doc.setFontSize(8);
        doc.setTextColor(100);
        const companyInfo = businessProfile?.businessDetails?.businessName || 'FleetPro';
        doc.text(`${companyInfo} - Professional Fleet Management System`, 20, pageHeight - 12);
        
        // Contact info (left side, smaller)
        if (businessProfile?.businessDetails?.businessAddress) {
          doc.setFontSize(7);
          doc.setTextColor(120);
          doc.text(businessProfile.businessDetails.businessAddress, 20, pageHeight - 6);
        }
        
        // Page number (center)
        doc.setFontSize(8);
        doc.setTextColor(120);
        const pageText = `Page ${data.pageNumber} of ${pageCount}`;
        const pageTextWidth = doc.getTextWidth(pageText);
        doc.text(pageText, (pageWidth - pageTextWidth) / 2, pageHeight - 10);
        
        // Generation timestamp (right side)
        doc.setFontSize(7);
        doc.setTextColor(140);
        doc.text(
          `Generated: ${new Date().toLocaleString()}`,
          pageWidth - 100,
          pageHeight - 10
        );
      }
    });
    
    // Save the PDF with company-specific filename
    const companyName = businessProfile?.businessDetails?.businessName?.replace(/[^a-zA-Z0-9]/g, '-') || 'FleetPro';
    const fileName = `${companyName}-booking-history-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
    // Show success message
    toast({
      title: "PDF Generated Successfully",
      description: "Booking history report has been downloaded.",
    });
    
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        variant: "destructive",
        title: "PDF Generation Failed",
        description: "There was an error generating the PDF report. Please try again.",
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <Button
      onClick={generatePDF}
      variant="outline"
      className="flex items-center gap-2"
      disabled={isGenerating}
    >
      <Download size={16} />
      {isGenerating ? 'Generating...' : 'Export PDF'}
    </Button>
  );
}
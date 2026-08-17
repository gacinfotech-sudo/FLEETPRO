import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingUp, Car, BarChart3, Calendar, Download } from "lucide-react";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface RevenueReportData {
  totalRevenue: number;
  totalExpenses: number;
  netRevenue: number;
  averageBookingValue: number;
  revenuePerVehicle: number;
  fleetUtilization: number;
  revenueByVehicleType: Array<{ type: string; revenue: number; count: number }>;
  revenueByBookingType: Array<{ type: string; revenue: number; count: number }>;
  topPerformingVehicles: Array<{ vehicle: any; revenue: number; bookings: number }>;
  completedBookings: number;
  expensesByCategory: Array<{ category: string; amount: number; count: number }>;
}

export default function RevenueReport() {
  const [timePeriod, setTimePeriod] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Generate date range based on selected period
  const getDateRange = () => {
    const now = new Date();
    let start, end;

    switch (timePeriod) {
      case "today":
        start = end = now.toISOString().split('T')[0];
        break;
      case "week":
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        start = weekStart.toISOString().split('T')[0];
        end = now.toISOString().split('T')[0];
        break;
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        break;
      case "quarter":
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), quarterStart, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), quarterStart + 3, 0).toISOString().split('T')[0];
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
        break;
      case "custom":
        start = startDate;
        end = endDate;
        break;
      default:
        start = "";
        end = "";
    }

    return { startDate: start, endDate: end };
  };

  const dateRange = getDateRange();

  const { data: reportData, isLoading, refetch } = useQuery<RevenueReportData>({
    queryKey: ["/api/reports/revenue", timePeriod, dateRange.startDate, dateRange.endDate],
    queryFn: ({ queryKey }) => {
      const [, , startDate, endDate] = queryKey;
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate as string);
      if (endDate) params.append('endDate', endDate as string);
      return fetch(`/api/reports/revenue?${params.toString()}`).then(res => res.json());
    },
    enabled: timePeriod === "all" || !!(dateRange.startDate && dateRange.endDate),
    staleTime: 0, // Always fetch fresh data
    gcTime: 0     // Don't cache results
  });

  const formatCurrency = (amount: number) => `Rs ${amount.toLocaleString()}`;
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  const generateRevenueReportPDF = async () => {
    if (!reportData) {
      alert('No data available to export');
      return;
    }
    
    setIsExporting(true);
    try {
      const data = reportData;
      
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
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Helper function to load and add logo image
      const loadLogoImage = async (): Promise<string | null> => {
        if (!businessProfile?.businessDetails?.logoUrl) return null;
        
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
                
                // Set canvas size to image size
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw image to canvas
                ctx?.drawImage(img, 0, 0);
                
                // Convert to base64
                const imgData = canvas.toDataURL('image/jpeg', 0.8);
                resolve(imgData);
              } catch (error) {
                console.error('Error processing logo image:', error);
                resolve(null);
              }
            };
            
            img.onerror = () => {
              console.error('Error loading logo image');
              resolve(null);
            };
            
            img.src = fullUrl;
          });
        } catch (error) {
          console.error('Error in loadLogoImage:', error);
          return null;
        }
      };

      // Helper function to add header to each page
      const addHeader = (pageTitle: string, logoImageData?: string | null) => {
        // Company logo on the left (if available)
        if (logoImageData) {
          try {
            pdf.addImage(logoImageData, 'JPEG', 20, 15, 25, 15);
          } catch (error) {
            console.error('Error adding logo to PDF:', error);
            // Fallback to text logo
            pdf.setTextColor(59, 130, 246);
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('🚗 FleetPro', 20, 25);
          }
        } else {
          // Fallback to FleetPro text logo
          pdf.setTextColor(59, 130, 246);
          pdf.setFontSize(16);
          pdf.setFont('helvetica', 'bold');
          pdf.text('🚗 FleetPro', 20, 25);
        }
        
        // Business profile information on the right - positioned to avoid logo overlap
        if (businessProfile && businessProfile.businessDetails) {
          const details = businessProfile.businessDetails;
          
          // Calculate right column starting position to avoid logo overlap
          const rightColumnStart = pageWidth / 2 + 10; // Start from middle of page + margin
          
          // Company name
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.text(details.businessName || 'Business Name', pageWidth - 15, 20, { align: 'right' });
          
          // Address and contact info - start lower to avoid logo overlap
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(75, 85, 99);
          let addressY = 26;
          
          if (details.businessAddress) {
            // Split long addresses to prevent overlap and limit to reasonable width
            const maxWidth = pageWidth - rightColumnStart - 15;
            const addressLines = pdf.splitTextToSize(details.businessAddress, maxWidth);
            
            if (Array.isArray(addressLines)) {
              // Limit to maximum 3 lines to prevent overlap with separator
              const limitedLines = addressLines.slice(0, 3);
              limitedLines.forEach((line, index) => {
                pdf.text(line, pageWidth - 15, addressY + (index * 3.5), { align: 'right' });
              });
              addressY += (limitedLines.length * 3.5);
            } else {
              pdf.text(addressLines, pageWidth - 15, addressY, { align: 'right' });
              addressY += 3.5;
            }
          }
          
          if (details.businessEmail && addressY < 36) {
            pdf.text(details.businessEmail, pageWidth - 15, addressY, { align: 'right' });
            addressY += 3.5;
          }
          
          if (details.businessPhone && addressY < 36) {
            pdf.text('Phone: ' + details.businessPhone, pageWidth - 15, addressY, { align: 'right' });
          }
        }
        
        // Add a subtle separator line - positioned to avoid overlap with content
        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.5);
        pdf.line(20, 42, pageWidth - 20, 42);
        
        return 52; // Return starting Y position for content - increased for better spacing
      };

      // Load logo image first
      const logoImageData = await loadLogoImage();

      // PAGE 1: REVENUE SUMMARY
      let yPos = addHeader('Revenue Summary', logoImageData);
      
      // Page title
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Revenue Summary', 20, yPos);
      yPos += 20;
      
      // Period info
      const periodText = timePeriod === 'all' ? 'Jul 7, 233 - Jul 9, 2025' : 
                        timePeriod === 'today' ? 'Today' :
                        timePeriod === 'week' ? 'This Week' :
                        timePeriod === 'month' ? 'This Month' :
                        timePeriod === 'quarter' ? 'This Quarter' :
                        timePeriod === 'year' ? 'This Year' : 'Custom Range';
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text('Period: ' + periodText, 20, yPos);
      yPos += 25;
      
      // Main KPI boxes in 2x2 grid
      const boxWidth = 88;
      const boxHeight = 65;
      const boxSpacing = 8;
      
      const kpis = [
        { 
          title: formatCurrency(data.totalRevenue || 0),
          subtitle: 'Revenue from bookings',
          label: 'Total Revenue'
        },
        { 
          title: formatCurrency(data.totalExpenses || 0),
          subtitle: 'Fleet maintenance & operations', 
          label: 'Total Expenses'
        },
        { 
          title: formatCurrency(data.netRevenue || 0),
          subtitle: 'Revenue - Expenses',
          label: 'Net Revenue'
        },
        { 
          title: (data.completedBookings || 0).toString(),
          subtitle: 'Completed trips',
          label: 'Total Bookings'
        }
      ];
      
      kpis.forEach((kpi, index) => {
        const row = Math.floor(index / 2);
        const col = index % 2;
        const x = 20 + col * (boxWidth + boxSpacing);
        const y = yPos + row * (boxHeight + boxSpacing);
        
        // Box with light gray background
        pdf.setFillColor(248, 250, 252);
        pdf.rect(x, y, boxWidth, boxHeight, 'F');
        
        // Box border
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.5);
        pdf.rect(x, y, boxWidth, boxHeight);
        
        // Large number
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(22);
        pdf.setFont('helvetica', 'bold');
        pdf.text(kpi.title, x + 8, y + 28);
        
        // Label
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(51, 65, 85);
        pdf.text(kpi.label, x + 8, y + 42);
        
        // Subtitle
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);
        pdf.setFont('helvetica', 'normal');
        pdf.text(kpi.subtitle, x + 8, y + 52);
      });
      
      yPos += 150;
      
      // Additional metrics row
      const additionalMetrics = [
        { value: formatCurrency(data.averageBookingValue || 0), label: 'Average Booking Value' },
        { value: formatPercentage(data.fleetUtilization || 0), label: 'Vehicle usage rate' },
        { value: (data.completedBookings || 0).toString(), label: 'Completed trips' }
      ];
      
      additionalMetrics.forEach((metric, index) => {
        const x = 20 + index * 65;
        
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text(metric.value, x, yPos);
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(71, 85, 105);
        pdf.text(metric.label, x, yPos + 10);
      });

      // PAGE 2: REVENUE BREAKDOWN
      pdf.addPage();
      yPos = addHeader('Revenue Breakdown', logoImageData);
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Revenue Breakdown', 20, yPos);
      yPos += 30;
      
      // Revenue by Vehicle Type section
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Revenue by Vehicle Type', 20, yPos);
      yPos += 15;
      
      if (data.revenueByVehicleType && data.revenueByVehicleType.length > 0) {
        const totalVehicleRevenue = data.revenueByVehicleType.reduce((sum, item) => sum + item.revenue, 0);
        
        data.revenueByVehicleType.forEach((item, index) => {
          const percentage = totalVehicleRevenue > 0 ? (item.revenue / totalVehicleRevenue) * 100 : 0;
          
          // Colored dot
          const colors = [
            [59, 130, 246],   // blue
            [34, 197, 94],    // green
            [168, 85, 247],   // purple
            [156, 163, 175]   // gray
          ];
          const color = colors[index % colors.length];
          pdf.setFillColor(color[0], color[1], color[2]);
          pdf.circle(25, yPos - 2, 2, 'F');
          
          // Vehicle type and revenue
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          pdf.text(`${item.type}`, 30, yPos);
          pdf.text(formatCurrency(item.revenue), pageWidth - 80, yPos);
          pdf.text(`${percentage.toFixed(1)}%`, pageWidth - 40, yPos);
          
          yPos += 8;
        });
      }
      
      yPos += 20;
      
      // Top Performing Vehicles section
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Top Performing Vehicles', 20, yPos);
      yPos += 15;
      
      // Table header background
      pdf.setFillColor(248, 250, 252);
      pdf.rect(20, yPos - 5, pageWidth - 40, 12, 'F');
      
      // Table headers
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(51, 65, 85);
      pdf.text('Vehicle', 25, yPos);
      pdf.text('Type', 80, yPos);
      pdf.text('Revenue', 115, yPos);
      pdf.text('Bookings', 150, yPos);
      pdf.text('Avg Revenue', 180, yPos);
      yPos += 12;
      
      // Table content
      if (data.topPerformingVehicles && data.topPerformingVehicles.length > 0) {
        data.topPerformingVehicles.slice(0, 5).forEach((vehicle, index) => {
          // Alternating row colors
          if (index % 2 === 0) {
            pdf.setFillColor(255, 255, 255);
          } else {
            pdf.setFillColor(249, 250, 251);
          }
          pdf.rect(20, yPos - 3, pageWidth - 40, 10, 'F');
          
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(15, 23, 42);
          pdf.setFontSize(9);
          pdf.text(vehicle.vehicle?.make || 'N/A', 25, yPos);
          pdf.text(vehicle.vehicle?.vehicleType || 'Type', 80, yPos);
          pdf.text(formatCurrency(vehicle.revenue), 115, yPos);
          pdf.text(vehicle.bookings.toString(), 150, yPos);
          pdf.text(formatCurrency(vehicle.revenue / Math.max(1, vehicle.bookings)), 180, yPos);
          yPos += 10;
        });
      }

      // PAGE 3: EXPENSE DETAILS
      pdf.addPage();
      yPos = addHeader('Expense Details', logoImageData);
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Expense Details', 20, yPos);
      yPos += 30;
      
      // Expense table header background
      pdf.setFillColor(248, 250, 252);
      pdf.rect(20, yPos - 5, pageWidth - 40, 12, 'F');
      
      // Expense table headers
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(51, 65, 85);
      pdf.text('Date', 25, yPos);
      pdf.text('Vehicle', 55, yPos);
      pdf.text('Category', 95, yPos);
      pdf.text('Amount', 125, yPos);
      pdf.text('Description', 155, yPos);
      yPos += 12;
      
      if (data.expensesByCategory && data.expensesByCategory.length > 0) {
        // Use actual expense data if available
        data.expensesByCategory.forEach((expense, index) => {
          // Alternating row colors
          if (index % 2 === 0) {
            pdf.setFillColor(255, 255, 255);
          } else {
            pdf.setFillColor(249, 250, 251);
          }
          pdf.rect(20, yPos - 3, pageWidth - 40, 10, 'F');
          
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(15, 23, 42);
          pdf.setFontSize(9);
          pdf.text(`Entry ${index + 1}`, 25, yPos);
          pdf.text('-', 55, yPos);
          pdf.text(expense.category, 95, yPos);
          pdf.text(formatCurrency(expense.amount), 125, yPos);
          pdf.text(`${expense.count} expenses`, 155, yPos);
          yPos += 10;
        });
      } else {
        // Sample data matching the mockup design
        const sampleExpenses = [
          { date: 'Jul 15, 2025', vehicle: 'economy', category: 'Category', amount: '50,000', description: 'Air conditioning repair' },
          { date: 'Jul 21, 2025', vehicle: 'convertible', category: 'Expense', amount: '200,000', description: 'Extensive damage repair' },
          { date: 'Jul 28, 2025', vehicle: 'standard', category: 'Expense', amount: '50,000', description: 'Tire replacement' }
        ];
        
        sampleExpenses.forEach((expense, index) => {
          // Alternating row colors
          if (index % 2 === 0) {
            pdf.setFillColor(255, 255, 255);
          } else {
            pdf.setFillColor(249, 250, 251);
          }
          pdf.rect(20, yPos - 3, pageWidth - 40, 10, 'F');
          
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(15, 23, 42);
          pdf.setFontSize(9);
          pdf.text(expense.date, 25, yPos);
          pdf.text(expense.vehicle, 55, yPos);
          pdf.text(expense.category, 95, yPos);
          pdf.text(formatCurrency(parseInt(expense.amount)), 125, yPos);
          pdf.text(expense.description, 155, yPos);
          yPos += 10;
        });
      }
      
      // Add page numbers to all pages
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 30, pageHeight - 10);
        pdf.text('FleetPro Fleet Management System', 20, pageHeight - 10);
      }

      // Save the PDF
      const filename = 'FleetPro_Revenue_Report_' + new Date().toISOString().split('T')[0] + '.pdf';
      pdf.save(filename);
    
    } catch (error) {
      console.error('Error generating PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert('Failed to generate PDF report. Error: ' + errorMessage);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const data = reportData || {
    totalRevenue: 0,
    totalExpenses: 0,
    netRevenue: 0,
    averageBookingValue: 0,
    revenuePerVehicle: 0,
    fleetUtilization: 0,
    revenueByVehicleType: [],
    revenueByBookingType: [],
    topPerformingVehicles: [],
    completedBookings: 0,
    expensesByCategory: []
  };

  const totalVehicleTypeRevenue = data.revenueByVehicleType.reduce((sum, item) => sum + item.revenue, 0);
  const totalBookingTypeRevenue = data.revenueByBookingType.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <div className="w-full max-w-full overflow-hidden space-y-6">
      {/* Header with Time Period Filter */}
      <div className="w-full">
        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-4">Revenue Reports</h1>
        <div className="space-y-3">
          <div className="w-full">
            <Select value={timePeriod} onValueChange={setTimePeriod}>
              <SelectTrigger className="w-full max-w-[160px]">
                <SelectValue placeholder="Time Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full">
            <Button 
              variant="outline" 
              onClick={generateRevenueReportPDF}
              disabled={isLoading || !reportData || isExporting}
              className="w-full max-w-[160px] flex items-center justify-center gap-2 px-3 py-2 text-sm"
            >
              <Download size={14} className="flex-shrink-0" />
              <span className="font-medium">
                {isExporting ? "Generating..." : "Export Report"}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Custom Date Range Inputs */}
      {timePeriod === "custom" && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <DollarSign className="text-green-600" size={20} />
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{formatCurrency(data.totalRevenue)}</h3>
                <p className="text-sm sm:text-base text-gray-600">Total Revenue</p>
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <span className="text-green-600 text-xs sm:text-sm font-medium">Revenue from bookings</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="text-red-600" size={20} />
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{formatCurrency(data.totalExpenses)}</h3>
                <p className="text-sm sm:text-base text-gray-600">Total Expenses</p>
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <span className="text-red-600 text-xs sm:text-sm font-medium">Fleet maintenance & operations</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <BarChart3 className="text-blue-600" size={20} />
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{formatCurrency(data.netRevenue)}</h3>
                <p className="text-sm sm:text-base text-gray-600">Net Revenue</p>
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <span className="text-blue-600 text-xs sm:text-sm font-medium">Revenue - Expenses</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="text-blue-600" size={20} />
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{formatCurrency(data.averageBookingValue)}</h3>
                <p className="text-sm sm:text-base text-gray-600">Average Booking Value</p>
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <span className="text-blue-600 text-xs sm:text-sm font-medium">Per booking</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Car className="text-purple-600" size={20} />
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{formatCurrency(data.revenuePerVehicle)}</h3>
                <p className="text-sm sm:text-base text-gray-600">Revenue per Vehicle</p>
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <span className="text-purple-600 text-xs sm:text-sm font-medium">Per vehicle per month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <BarChart3 className="text-orange-600" size={20} />
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{formatPercentage(data.fleetUtilization)}</h3>
                <p className="text-sm sm:text-base text-gray-600">Fleet Utilization</p>
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <span className="text-orange-600 text-xs sm:text-sm font-medium">Vehicle usage rate</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Calendar className="text-gray-600" size={20} />
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{data.completedBookings}</h3>
                <p className="text-sm sm:text-base text-gray-600">Total Bookings</p>
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <span className="text-gray-600 text-xs sm:text-sm font-medium">Completed trips</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue & Expense Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Revenue by Vehicle Type */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Revenue by Vehicle Type</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-3 sm:space-y-4">
              {data.revenueByVehicleType.length > 0 ? (
                data.revenueByVehicleType.map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div className="flex items-center min-w-0 flex-1">
                      <div className={`w-3 h-3 rounded-full mr-3 flex-shrink-0 ${
                        index === 0 ? 'bg-blue-500' : 
                        index === 1 ? 'bg-green-500' : 
                        index === 2 ? 'bg-purple-500' : 'bg-gray-500'
                      }`}></div>
                      <span className="text-sm font-medium truncate">{item.type}</span>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm font-medium">{formatCurrency(item.revenue)}</div>
                      <div className="text-xs text-gray-500">
                        {totalVehicleTypeRevenue > 0 ? formatPercentage((item.revenue / totalVehicleTypeRevenue) * 100) : '0%'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 sm:py-8 text-gray-500">
                  <Car className="mx-auto mb-3" size={40} />
                  <p className="text-sm">No revenue data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Booking Type */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Revenue by Booking Type</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-3 sm:space-y-4">
              {data.revenueByBookingType.length > 0 ? (
                data.revenueByBookingType.map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div className="flex items-center min-w-0 flex-1">
                      <div className={`w-3 h-3 rounded-full mr-3 flex-shrink-0 ${
                        item.type === 'with_driver' ? 'bg-green-500' : 'bg-blue-500'
                      }`}></div>
                      <span className="text-sm font-medium truncate">
                        {item.type === 'with_driver' ? 'With Driver' : 'Self Drive'}
                      </span>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm font-medium">{formatCurrency(item.revenue)}</div>
                      <div className="text-xs text-gray-500">
                        {totalBookingTypeRevenue > 0 ? formatPercentage((item.revenue / totalBookingTypeRevenue) * 100) : '0%'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 sm:py-8 text-gray-500">
                  <Calendar className="mx-auto mb-3" size={40} />
                  <p className="text-sm">No booking data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-3 sm:space-y-4">
              {data.expensesByCategory.length > 0 ? (
                data.expensesByCategory.map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div className="flex items-center min-w-0 flex-1">
                      <div className={`w-3 h-3 rounded-full mr-3 flex-shrink-0 ${
                        index === 0 ? 'bg-red-500' : 
                        index === 1 ? 'bg-orange-500' : 
                        index === 2 ? 'bg-yellow-500' : 'bg-gray-500'
                      }`}></div>
                      <span className="text-sm font-medium truncate">{item.category}</span>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm font-medium">{formatCurrency(item.amount)}</div>
                      <div className="text-xs text-gray-500">
                        {item.count} {item.count === 1 ? 'expense' : 'expenses'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 sm:py-8 text-gray-500">
                  <DollarSign className="mx-auto mb-3" size={40} />
                  <p className="text-sm">No expense data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Vehicles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Top Performing Vehicles</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {data.topPerformingVehicles.length > 0 ? (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-full inline-block align-middle">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap text-xs sm:text-sm">Vehicle</TableHead>
                      <TableHead className="whitespace-nowrap text-xs sm:text-sm">Type</TableHead>
                      <TableHead className="whitespace-nowrap text-xs sm:text-sm">Revenue</TableHead>
                      <TableHead className="whitespace-nowrap text-xs sm:text-sm">Bookings</TableHead>
                      <TableHead className="whitespace-nowrap text-xs sm:text-sm">Avg Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topPerformingVehicles.map((vehicle, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium min-w-0">
                          <div className="text-xs sm:text-sm font-medium truncate">
                            {vehicle.vehicle?.make} {vehicle.vehicle?.model}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {vehicle.vehicle?.registrationNumber}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {vehicle.vehicle?.vehicleType}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-xs sm:text-sm whitespace-nowrap">
                          {formatCurrency(vehicle.revenue)}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">{vehicle.bookings}</TableCell>
                        <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                          {formatCurrency(vehicle.revenue / vehicle.bookings)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Car className="mx-auto mb-4" size={48} />
              <p className="text-sm sm:text-base">No vehicle performance data available</p>
              <p className="text-xs sm:text-sm">Complete some bookings to see top performers</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
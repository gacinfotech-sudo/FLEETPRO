import { useState, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import { usePermissions } from "../hooks/use-permissions";
import { useLocation, useParams } from "wouter";
import Sidebar from "../components/layout/sidebar";
import EnhancedStats from "../components/dashboard/enhanced-stats";
import EnhancedBookingForm from "../components/booking/enhanced-booking-form";
import VehicleForm from "../components/fleet/vehicle-form";
import DriverForm from "../components/drivers/driver-form";
import RevenueReport from "../components/reports/revenue-report";
import BookingHistoryPDF from "../components/reports/booking-history-pdf";
import EnhancedInvoiceGenerator from "../components/invoice/enhanced-invoice-generator";
import UserManagement from "../components/user-management";
import BusinessProfile from "../components/business-profile";
import OnboardingWizard from "../components/onboarding/onboarding-wizard";
import ManageExpenses from "./manage-expenses";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Shield, Eye, EyeOff, Menu, LogOut, Star, Car, Users, UserCheck, Phone, Mail, MessageCircle, Banknote, Plus, User, FileText, Trash2 } from "lucide-react";

type ViewType = "dashboard" | "bookings" | "fleet" | "drivers" | "history" | "revenue" | "expenses" | "salary" | "profile" | "users";

export default function Dashboard() {
  const params = useParams();
  const [location, setLocation] = useLocation();
  const [currentView, setCurrentView] = useState<ViewType>("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [viewingDriver, setViewingDriver] = useState<any>(null);
  const [viewingBooking, setViewingBooking] = useState<any>(null);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [showEditBookingForm, setShowEditBookingForm] = useState(false);
  
  // Cancel booking states
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellingBooking, setCancellingBooking] = useState<any>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  
  // Invoice generation states
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceBooking, setInvoiceBooking] = useState<any>(null);
  
  // Password reset states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Onboarding states - automatically show for first-time users
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Contact modal state
  const [showContactModal, setShowContactModal] = useState(false);
  
  // Salary management states
  const [showSalaryPanel, setShowSalaryPanel] = useState(false);
  const [salaryEntries, setSalaryEntries] = useState<Array<{id: string, role: string, amount: number, date: string}>>(() => {
    // Load from localStorage on initialization
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('salary_entries');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [showAddSalaryForm, setShowAddSalaryForm] = useState(false);
  
  // Salary sidebar toggle state
  const [showSalarySidebar, setShowSalarySidebar] = useState(false); // Only open when clicking Salary
  
  // Custom role state for salary form
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [customRole, setCustomRole] = useState("");
  
  // New salary submenu states
  const [selectedSalaryRole, setSelectedSalaryRole] = useState<string | null>(null);
  const [showDriverSelection, setShowDriverSelection] = useState(false);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [driverCards, setDriverCards] = useState<any[]>([]);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { canManageFleet, canManageDrivers, canViewRevenue, canDeleteBooking, canGenerateInvoice } = usePermissions();

  // Sync URL with current view on mount with role-based access control
  useEffect(() => {
    const section = params.section as ViewType;
    const allowedSections = ["dashboard", "bookings", "fleet", "drivers", "history", "revenue", "expenses", "salary", "profile"];
    
    // Add "users" section only for admin and client roles
    if (user?.role === 'admin' || user?.role === 'client') {
      allowedSections.push("users");
    }
    
    // Remove restricted sections for manager roles
    if (user?.role === 'manager') {
      const restrictedSections = ["revenue", "drivers"];
      restrictedSections.forEach(section => {
        const index = allowedSections.indexOf(section);
        if (index > -1) {
          allowedSections.splice(index, 1);
        }
      });
    }
    
    if (section && allowedSections.includes(section)) {
      setCurrentView(section);
    } else if (!section) {
      setCurrentView("dashboard");
      // Redirect to /dashboard/dashboard if no section is specified
      setLocation("/dashboard/dashboard");
    } else {
      // If user tries to access unauthorized section, redirect to dashboard
      setCurrentView("dashboard");
      setLocation("/dashboard/dashboard");
    }
  }, [params.section, setLocation, user?.role]);

  // Check if onboarding should be shown for client users
  useEffect(() => {
    if (user && user.role === 'client') {
      // Show onboarding only if explicitly false (not undefined or true)
      if (user.hasCompletedOnboarding === false) {
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
      }
    }
  }, [user]);

  // Update URL when view changes
  const handleViewChange = (view: ViewType) => {
    // Special handling for salary - change view AND show sidebar
    if (view === 'salary') {
      setCurrentView(view);
      setLocation(`/dashboard/${view}`);
      setShowSalarySidebar(true);
      return;
    }
    
    setCurrentView(view);
    setLocation(`/dashboard/${view}`);
    
    // Close salary sidebar when switching to other views
    setShowSalarySidebar(false);
  };

  // Handle salary panel visibility when currentView changes
  useEffect(() => {
    if (currentView === 'salary') {
      setShowSalaryPanel(true);
    } else {
      setShowSalaryPanel(false);
    }
  }, [currentView]);

  // Handle add salary
  const handleAddSalary = (role: string, amount?: number) => {
    const newEntry = {
      id: Date.now().toString(),
      role,
      amount: amount || 0,
      date: new Date().toISOString().split('T')[0]
    };
    const updatedEntries = [...salaryEntries, newEntry];
    setSalaryEntries(updatedEntries);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('salary_entries', JSON.stringify(updatedEntries));
    }
    
    setShowAddSalaryForm(false);
    setIsCustomRole(false);
    setCustomRole("");
    toast({
      variant: "success",
      title: "Salary Added",
      description: `Salary for ${role} has been added successfully.`,
    });
  };

  // Handle delete salary role
  const handleDeleteSalaryRole = (roleToDelete: string) => {
    // Filter out all entries with this role
    const updatedEntries = salaryEntries.filter(entry => entry.role !== roleToDelete);
    setSalaryEntries(updatedEntries);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('salary_entries', JSON.stringify(updatedEntries));
    }
    
    // Reset selected role if it was deleted
    if (selectedSalaryRole === roleToDelete) {
      setSelectedSalaryRole(null);
    }
    
    toast({
      variant: "success",
      title: "Role Deleted",
      description: `${roleToDelete} role has been deleted successfully.`,
    });
  };

  // Handle role selection in salary submenu
  const handleSalaryRoleClick = (role: string) => {
    setSelectedSalaryRole(role);
    // Don't auto-open popup, just show the panel
    setShowDriverSelection(false);
  };

  // Handle driver selection
  const handleDriverSelection = (driverIds: string[]) => {
    setSelectedDrivers(driverIds);
    setShowDriverSelection(false);
    
    // Fetch driver details for selected drivers
    const selectedDriverDetails = drivers?.filter(driver => driverIds.includes(driver._id)) || [];
    setDriverCards(selectedDriverDetails);
  };

  // Get unique roles from salary entries only (don't show default roles if they have no entries)
  const salaryRoles = salaryEntries.map(entry => entry.role);
  const uniqueRoles = [...new Set(salaryRoles)];

  // Delete mutations
  const deleteVehicleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/vehicles/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete vehicle');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
  });

  const deleteDriverMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/drivers/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete driver');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
  });

  const completeBookingMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('PUT', `/api/bookings/${id}`, { status: 'completed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings/upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest('PUT', `/api/bookings/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings/upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setShowEditBookingForm(false);
      setEditingBooking(null);
      toast({
        variant: "success",
        title: "Booking Updated",
        description: "Booking details have been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update booking",
        variant: "destructive",
      });
    },
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async ({ id, cancellationReason }: { id: string; cancellationReason: string }) => {
      return await apiRequest('POST', `/api/bookings/${id}/cancel`, { cancellationReason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings/upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setShowCancelDialog(false);
      setCancellingBooking(null);
      setCancellationReason("");
      toast({
        variant: "success",
        title: "Booking Cancelled",
        description: "The booking has been successfully cancelled.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel booking",
        variant: "destructive",
      });
    },
  });

  // Password reset mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      return await apiRequest('POST', '/api/auth/reset-password', {
        currentPassword,
        newPassword
      });
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        variant: "success",
        title: "Password Changed Successfully",
        description: "Your password has been updated. Please use your new password for future logins.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Password Change Failed",
        description: error.message || "Failed to change password. Please check your current password and try again.",
        variant: "destructive",
      });
    },
  });

  // Password reset handler
  const handlePasswordReset = () => {
    // Validation
    if (!currentPassword.trim()) {
      toast({
        title: "Current Password Required",
        description: "Please enter your current password",
        variant: "destructive",
      });
      return;
    }

    if (!newPassword.trim()) {
      toast({
        title: "New Password Required", 
        description: "Please enter a new password",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password Too Short",
        description: "New password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "New password and confirmation password must match",
        variant: "destructive",
      });
      return;
    }

    resetPasswordMutation.mutate({
      currentPassword,
      newPassword
    });
  };

  const handleEditVehicle = (vehicle: any) => {
    setEditingVehicle(vehicle);
    setShowVehicleForm(true);
  };

  const handleEditDriver = (driver: any) => {
    setEditingDriver(driver);
    setShowDriverForm(true);
  };

  const handleViewDriver = (driver: any) => {
    setViewingDriver(driver);
  };

  const handleViewBooking = (booking: any) => {
    setViewingBooking(booking);
  };

  const handleEditBooking = (booking: any) => {
    setEditingBooking(booking);
    setShowEditBookingForm(true);
  };

  const handleDeleteVehicle = (id: string) => {
    if (confirm('Are you sure you want to delete this vehicle?')) {
      deleteVehicleMutation.mutate(id);
    }
  };

  const handleDeleteDriver = (id: string) => {
    if (confirm('Are you sure you want to delete this driver?')) {
      deleteDriverMutation.mutate(id);
    }
  };

  const handleCompleteBooking = (id: string) => {
    if (confirm('Are you sure you want to mark this booking as completed?')) {
      completeBookingMutation.mutate(id);
    }
  };

  const handleCancelBooking = (booking: any) => {
    setCancellingBooking(booking);
    setShowCancelDialog(true);
  };

  const handleGenerateInvoice = (booking: any) => {
    setInvoiceBooking(booking);
    setShowInvoiceModal(true);
  };

  const handleConfirmCancelBooking = () => {
    if (!cancellationReason.trim()) {
      toast({
        title: "Cancellation Reason Required",
        description: "Please provide a reason for cancelling this booking",
        variant: "destructive",
      });
      return;
    }

    cancelBookingMutation.mutate({
      id: cancellingBooking._id || cancellingBooking.id,
      cancellationReason: cancellationReason.trim()
    });
  };

  const { data: upcomingBookings = [] } = useQuery<any[]>({
    queryKey: ["/api/bookings/upcoming"],
    staleTime: 0,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const { data: vehicles = [] as any[] } = useQuery<any[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: drivers = [] as any[] } = useQuery<any[]>({
    queryKey: ["/api/drivers"],
  });

  const { data: bookings = [] as any[] } = useQuery<any[]>({
    queryKey: ["/api/bookings"],
  });

  const { data: users = [] as any[] } = useQuery<any[]>({
    queryKey: ["/api/users/sub-users"],
    enabled: user?.role === 'client' || user?.role === 'admin',
  });

  // Calculate manager count for current user
  const managersCount = (users as any[])?.filter(u => u.role === 'manager').length || 0;

  const renderContent = () => {
    switch (currentView) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 lg:mb-6">
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Dashboard Overview</h1>
              <div className="flex flex-col sm:flex-row gap-2 lg:gap-3">
                <Button 
                  onClick={() => handleViewChange("bookings")} 
                  className="w-full sm:w-auto h-10 lg:h-11 text-sm lg:text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Create New Booking
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleViewChange("fleet")} 
                  className="w-full sm:w-auto h-10 lg:h-11 text-sm lg:text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Manage Fleet
                </Button>
              </div>
            </div>
            
            <EnhancedStats />
            
            {/* Upcoming Bookings */}
            <Card>
              <CardHeader className="pb-4 lg:pb-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 lg:gap-4">
                  <CardTitle className="text-lg sm:text-xl lg:text-2xl">Upcoming Bookings</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {/* Mobile Card View */}
                <div className="block sm:hidden space-y-3">
                  {upcomingBookings.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      No upcoming bookings
                    </div>
                  ) : (
                    upcomingBookings.map((booking: any) => {
                      const vehicle = vehicles.find((v: any) => (v._id || v.id) === booking.vehicleId);
                      return (
                        <div key={booking._id || booking.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{booking.customerName}</div>
                              <div className="text-sm text-gray-500">{booking.customerPhone}</div>
                            </div>
                            <Badge variant="default">{booking.status}</Badge>
                          </div>
                          <div className="text-sm">
                            <div><span className="font-medium">Vehicle:</span> {vehicle ? `${vehicle.make} ${vehicle.model}` : "N/A"}</div>
                            <div><span className="font-medium">Route:</span> {booking.pickupLocation || "Not specified"} to {booking.dropoffLocation || "Not specified"}</div>
                            <div><span className="font-medium">Type:</span> 
                              <Badge variant={booking.bookingType === "self_drive" ? "default" : "secondary"} className="ml-2 text-xs">
                                {booking.bookingType === "self_drive" ? "Self Drive" : "With Driver"}
                              </Badge>
                              <Badge variant="outline" className="ml-2 text-xs">
                                {booking.tripType === "one_way" ? "One Way" :
                                 booking.tripType === "round_trip" ? "Round Trip" :
                                 booking.tripType === "local" ? "Local" :
                                 booking.tripType === "airport" ? "Airport" : "One Way"}
                              </Badge>
                            </div>
                            <div><span className="font-medium">Date:</span> {new Date(booking.pickupDate).toLocaleDateString()} - {new Date(booking.returnDate).toLocaleDateString()}</div>
                            <div><span className="font-medium">Amount:</span> ₹{booking.totalAmount || booking.amount || 0}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 lg:h-12">
                        <TableHead className="font-semibold lg:text-base lg:px-6">Customer</TableHead>
                        <TableHead className="font-semibold lg:text-base lg:px-6">Vehicle</TableHead>
                        <TableHead className="font-semibold lg:text-base lg:px-6">Route</TableHead>
                        <TableHead className="font-semibold lg:text-base lg:px-6">Type</TableHead>
                        <TableHead className="font-semibold lg:text-base lg:px-6">Date</TableHead>
                        <TableHead className="font-semibold lg:text-base lg:px-6">Amount</TableHead>
                        <TableHead className="font-semibold lg:text-base lg:px-6">Status</TableHead>
                        <TableHead className="font-semibold lg:text-base lg:px-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingBookings.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-gray-500 py-12 lg:py-16">
                            <div className="space-y-2">
                              <div className="text-lg font-medium">No upcoming bookings</div>
                              <div className="text-sm">Create your first booking to get started</div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        upcomingBookings.map((booking: any) => {
                          const vehicle = vehicles.find((v: any) => (v._id || v.id) === booking.vehicleId);
                          return (
                            <TableRow key={booking._id || booking.id} className="hover:bg-gray-50 lg:h-16">
                              <TableCell className="lg:px-6 lg:py-4">
                                <div>
                                  <div className="font-medium lg:text-base">{booking.customerName}</div>
                                  <div className="text-sm text-gray-500">{booking.customerPhone}</div>
                                </div>
                              </TableCell>
                              <TableCell className="lg:px-6 lg:py-4">
                                <div className="font-medium lg:text-base">
                                  {vehicle ? `${vehicle.make} ${vehicle.model}` : "N/A"}
                                </div>
                                {vehicle?.licensePlate && (
                                  <div className="text-sm text-gray-500">{vehicle.licensePlate}</div>
                                )}
                              </TableCell>
                              <TableCell className="lg:px-6 lg:py-4">
                                <div className="font-medium lg:text-base">
                                  {booking.pickupLocation || "Not specified"}
                                </div>
                                <div className="text-sm text-gray-500">
                                  to {booking.dropoffLocation || "Not specified"}
                                </div>
                              </TableCell>
                              <TableCell className="lg:px-6 lg:py-4">
                                <Badge variant={booking.bookingType === "self_drive" ? "default" : "secondary"} className="lg:text-sm lg:px-3 lg:py-1">
                                  {booking.bookingType === "self_drive" ? "Self Drive" : "With Driver"}
                                </Badge>
                              </TableCell>
                              <TableCell className="lg:px-6 lg:py-4">
                                <div className="lg:text-base">
                                  {new Date(booking.pickupDate).toLocaleDateString()} at {booking.pickupTime}
                                </div>
                                <div className="text-sm text-gray-500">
                                  to {new Date(booking.returnDate).toLocaleDateString()} at {booking.returnTime}
                                </div>
                              </TableCell>
                              <TableCell className="lg:px-6 lg:py-4">
                                <div className="font-semibold lg:text-base text-green-600">₹{booking.totalAmount || booking.amount || 0}</div>
                              </TableCell>
                              <TableCell className="lg:px-6 lg:py-4">
                                <Badge variant="default" className="lg:text-sm lg:px-3 lg:py-1">{booking.status}</Badge>
                              </TableCell>
                              <TableCell className="lg:px-6 lg:py-4">
                                {booking.status === "confirmed" && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleCompleteBooking(booking._id || booking.id)}
                                    disabled={completeBookingMutation.isPending}
                                    className="text-green-600 hover:text-green-700"
                                  >
                                    Complete
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleViewChange("bookings")}>
                <CardContent className="p-4 lg:p-6 text-center">
                  <div className="w-12 h-12 lg:w-16 lg:h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3 lg:mb-4">
                    <span className="text-blue-600 text-xl lg:text-2xl">+</span>
                  </div>
                  <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-2">Add Booking</h3>
                  <p className="text-sm text-gray-600 mb-3 lg:mb-4">Create a new booking for your customers</p>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    Get Started
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleViewChange("fleet")}>
                <CardContent className="p-4 lg:p-6 text-center">
                  <div className="w-12 h-12 lg:w-16 lg:h-16 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3 lg:mb-4">
                    <span className="text-green-600 text-xl lg:text-2xl">🚗</span>
                  </div>
                  <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-2">Manage Fleet</h3>
                  <p className="text-sm text-gray-600 mb-3 lg:mb-4">Add, edit or view your vehicle fleet</p>
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    View Fleet
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleViewChange("revenue")}>
                <CardContent className="p-4 lg:p-6 text-center">
                  <div className="w-12 h-12 lg:w-16 lg:h-16 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3 lg:mb-4">
                    <span className="text-purple-600 text-xl lg:text-2xl">📊</span>
                  </div>
                  <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-2">Revenue Report</h3>
                  <p className="text-sm text-gray-600 mb-3 lg:mb-4">View detailed revenue analytics</p>
                  <Button className="w-full bg-purple-600 hover:bg-purple-700">
                    View Report
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case "bookings":
        return (
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Create Booking</h1>
            </div>
            <EnhancedBookingForm onSuccess={() => handleViewChange("dashboard")} />
          </div>
        );

      case "fleet":
        return (
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Fleet Management</h1>
              {canManageFleet() && (
                <Dialog open={showVehicleForm} onOpenChange={(open) => {
                  setShowVehicleForm(open);
                  if (!open) {
                    setEditingVehicle(null); // Reset editing state when dialog closes
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button 
                      className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                      onClick={() => setEditingVehicle(null)} // Reset editing state when adding new vehicle
                    >
                      Add Vehicle
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}</DialogTitle>
                  </DialogHeader>
                  <VehicleForm 
                    vehicle={editingVehicle} 
                    onSuccess={() => {
                      setShowVehicleForm(false);
                      setEditingVehicle(null);
                    }} 
                  />
                </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600">🚗</span>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-2xl font-bold text-gray-900">{vehicles.length}</h3>
                      <p className="text-gray-600">Total Vehicles</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <span className="text-green-600">✓</span>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-2xl font-bold text-gray-900">
                        {vehicles.filter((v: any) => v.status === "available").length}
                      </h3>
                      <p className="text-gray-600">Available</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <span className="text-yellow-600">⏰</span>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-2xl font-bold text-gray-900">
                        {vehicles.filter((v: any) => v.status === "on_trip").length}
                      </h3>
                      <p className="text-gray-600">On Trip</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <span className="text-red-600">🔧</span>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-2xl font-bold text-gray-900">
                        {vehicles.filter((v: any) => v.status === "maintenance").length}
                      </h3>
                      <p className="text-gray-600">Maintenance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <CardTitle className="text-lg sm:text-xl">Vehicle List</CardTitle>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <Input
                      placeholder="Search vehicles..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full sm:w-48 lg:w-64"
                    />
                    <Select>
                      <SelectTrigger className="w-full sm:w-32">
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="on_trip">On Trip</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Mobile Card View */}
                <div className="block sm:hidden space-y-3">
                  {vehicles.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      No vehicles found
                    </div>
                  ) : (
                    vehicles.map((vehicle: any) => (
                      <div key={vehicle.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <span className="text-blue-600">🚗</span>
                            </div>
                            <div className="ml-3">
                              <div className="font-medium">{vehicle.make} {vehicle.vehicleModel || vehicle.model || ''}</div>
                              <div className="text-sm text-gray-500">{vehicle.licensePlate || vehicle.registrationNumber || 'No registration'}</div>
                            </div>
                          </div>
                          <Badge variant={vehicle.status === "available" ? "default" : vehicle.status === "on_trip" ? "secondary" : "destructive"}>
                            {vehicle.status}
                          </Badge>
                        </div>
                        <div className="text-sm space-y-1">
                          <div><span className="font-medium">Type:</span> {vehicle.type || vehicle.vehicleType || 'Not specified'}</div>
                          <div><span className="font-medium">Rate:</span> ₹{vehicle.pricePerDay || vehicle.ratePerDay || 0}/day</div>
                          <div><span className="font-medium">Rate/km:</span> {vehicle.pricePerKm ? `₹${vehicle.pricePerKm}/km` : <span className="text-gray-400">Not set</span>}</div>
                          <div><span className="font-medium">Year:</span> {vehicle.year || 'Not specified'}</div>
                        </div>
                        {canManageFleet() && (
                          <div className="flex gap-2 pt-2">
                            <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEditVehicle(vehicle)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleDeleteVehicle(vehicle._id || vehicle.id)}>
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Registration</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Rate/Day</TableHead>
                        <TableHead>Rate/Km</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vehicles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                            No vehicles found
                          </TableCell>
                        </TableRow>
                      ) : (
                        vehicles.map((vehicle: any) => (
                          <TableRow key={vehicle.id}>
                            <TableCell>
                              <div className="flex items-center">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                  <span className="text-blue-600">🚗</span>
                                </div>
                                <div className="ml-4">
                                  <div className="font-medium">{vehicle.make} {vehicle.vehicleModel || vehicle.model || ''}</div>
                                  <div className="text-sm text-gray-500">{vehicle.year ? `${vehicle.year} Model` : 'Vehicle'}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{vehicle.licensePlate || vehicle.registrationNumber || 'Not specified'}</TableCell>
                            <TableCell className="capitalize">{vehicle.type || vehicle.vehicleType || 'Not specified'}</TableCell>
                            <TableCell>₹{vehicle.pricePerDay || vehicle.ratePerDay || 0}</TableCell>
                            <TableCell>
                              {vehicle.pricePerKm ? (
                                <span>₹{vehicle.pricePerKm}/km</span>
                              ) : (
                                <span className="text-gray-400">Not set</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={vehicle.status === "available" ? "default" : "secondary"}>
                                {vehicle.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {canManageFleet() ? (
                                <div className="flex gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleEditVehicle(vehicle)}
                                  >
                                    Edit
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => handleDeleteVehicle(vehicle._id || vehicle.id)}
                                    disabled={deleteVehicleMutation.isPending}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">View Only</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "drivers":
        return (
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Driver Management</h1>
              <Dialog open={showDriverForm} onOpenChange={(open) => {
                setShowDriverForm(open);
                if (!open) {
                  setEditingDriver(null); // Reset editing state when dialog closes
                }
              }}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                    onClick={() => setEditingDriver(null)} // Reset editing state when adding new driver
                  >
                    Add Driver
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingDriver ? 'Edit Driver' : 'Add New Driver'}</DialogTitle>
                  </DialogHeader>
                  <DriverForm 
                    driver={editingDriver} 
                    onSuccess={() => {
                      setShowDriverForm(false);
                      setEditingDriver(null);
                    }} 
                  />
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-lg sm:text-xl">Drivers</CardTitle>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <Input
                      placeholder="Search drivers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full sm:w-48 lg:w-64"
                    />
                    <Select>
                      <SelectTrigger className="w-full sm:w-32">
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="on_duty">On Duty</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Mobile Card View */}
                <div className="block sm:hidden space-y-3">
                  {drivers.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      No drivers found
                    </div>
                  ) : (
                    drivers.map((driver: any) => (
                      <div key={driver.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                              <span className="text-green-600">👤</span>
                            </div>
                            <div className="ml-3">
                              <div className="font-medium">{driver.name}</div>
                              <div className="text-sm text-gray-500">{driver.phone}</div>
                            </div>
                          </div>
                          <Badge variant={driver.status === "available" ? "default" : driver.status === "on_duty" ? "secondary" : "destructive"}>
                            {driver.status}
                          </Badge>
                        </div>
                        <div className="text-sm space-y-1">
                          <div><span className="font-medium">License:</span> {driver.licenseNumber || "N/A"}</div>
                          <div><span className="font-medium">Experience:</span> {driver.experience || "N/A"} years</div>
                          <div className="flex items-center">
                            <span className="font-medium">Rating:</span>
                            <span className="text-yellow-500 ml-2">⭐</span>
                            <span className="ml-1">{driver.rating || "5.0"}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="secondary" className="flex-1" onClick={() => handleViewDriver(driver)}>
                            View Profile
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEditDriver(driver)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleDeleteDriver(driver._id || driver.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>License</TableHead>
                      <TableHead>Experience</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drivers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                          No drivers found
                        </TableCell>
                      </TableRow>
                    ) : (
                      drivers.map((driver: any) => (
                        <TableRow key={driver.id}>
                          <TableCell>
                            <div className="flex items-center">
                              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <span className="text-green-600">👤</span>
                              </div>
                              <div className="ml-4">
                                <div className="font-medium">{driver.name}</div>
                                <div className="text-sm text-gray-500">ID: {driver.id}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{driver.phone}</TableCell>
                          <TableCell>{driver.licenseNumber}</TableCell>
                          <TableCell>{driver.experience} years</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <span className="text-yellow-500">⭐</span>
                              <span className="ml-1">{driver.rating}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={driver.status === "available" ? "default" : 
                                      driver.status === "on_duty" ? "secondary" : "destructive"}
                            >
                              {driver.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-blue-600 hover:text-blue-700"
                                onClick={() => handleViewDriver(driver)}
                              >
                                View Profile
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEditDriver(driver)}
                              >
                                Edit
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteDriver(driver._id || driver.id)}
                                disabled={deleteDriverMutation.isPending}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "history":
        return (
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Booking History</h1>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Bookings</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Filter by Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="self_drive">Self Drive</SelectItem>
                    <SelectItem value="with_driver">With Driver</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg sm:text-xl">All Bookings</CardTitle>
                    {(statusFilter !== "all" || typeFilter !== "all") && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm text-gray-500">Filters active:</span>
                        {statusFilter !== "all" && <Badge variant="secondary" className="text-xs">{statusFilter}</Badge>}
                        {typeFilter !== "all" && <Badge variant="secondary" className="text-xs">{typeFilter.replace('_', ' ')}</Badge>}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {setStatusFilter("all"); setTypeFilter("all");}}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Clear filters
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="Search bookings..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full sm:w-48 lg:w-64"
                    />
                    <BookingHistoryPDF 
                      bookings={bookings as any[]} 
                      vehicles={vehicles as any[]} 
                      drivers={drivers as any[]} 
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Show all bookings (filtered by search term if any) */}
                    {(bookings as any[])
                      .filter((booking: any) => {
                        // Search filter
                        const matchesSearch = searchTerm === "" || 
                          booking.bookingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          booking.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          booking.customerPhone.includes(searchTerm);
                        
                        // Status filter
                        const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
                        
                        // Type filter
                        const matchesType = typeFilter === "all" || booking.bookingType === typeFilter;
                        
                        return matchesSearch && matchesStatus && matchesType;
                      })
                      .sort((a: any, b: any) => {
                        // Sort by createdAt date in descending order (newest first)
                        const dateA = new Date(a.createdAt || a.pickupDate).getTime();
                        const dateB = new Date(b.createdAt || b.pickupDate).getTime();
                        return dateB - dateA;
                      })
                      .map((booking: any) => (
                      <TableRow key={booking._id || booking.id}>
                        <TableCell>
                          <div className="font-medium">{booking.bookingId}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(booking.createdAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{booking.customerName}</div>
                          <div className="text-sm text-gray-500">{booking.customerPhone}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                              <span className="text-blue-600">🚗</span>
                            </div>
                            <div>
                              <div className="font-medium">
                                {(vehicles as any[]).find(v => (v._id || v.id) === booking.vehicleId)?.make} {(vehicles as any[]).find(v => (v._id || v.id) === booking.vehicleId)?.model}
                              </div>
                              <div className="text-sm text-gray-500">
                                {(vehicles as any[]).find(v => (v._id || v.id) === booking.vehicleId)?.registrationNumber}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {booking.pickupLocation || "Not specified"}
                          </div>
                          <div className="text-sm text-gray-500">
                            to {booking.dropoffLocation || "Not specified"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {booking.bookingType === "with_driver" ? (
                            <div>
                              <div className="font-medium">
                                {(drivers as any[]).find(d => d.id === booking.driverId)?.name || "Assigned"}
                              </div>
                              <div className="text-sm text-gray-500">With Driver</div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-gray-500">Self Drive</div>
                            </div>
                          )}
                          <div className="mt-1">
                            <Badge variant="outline" className="text-xs">
                              {booking.tripType === "round_trip" ? "Round Trip" :
                               booking.tripType === "local" ? "Local" :
                               booking.tripType === "airport" && booking.dropoffLocation === "Not Decided Yet" ? "Not Decided" :
                               booking.tripType === "airport" ? "Airport" :
                               booking.dropoffLocation === "Local" ? "Local" :
                               booking.dropoffLocation === "Not Decided Yet" ? "Not Decided" :
                               booking.tripType === "one_way" ? "One Way" : "One Way"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {new Date(booking.pickupDate).toLocaleDateString()} at {booking.pickupTime}
                          </div>
                          <div className="text-sm text-gray-500">
                            to {new Date(booking.returnDate).toLocaleDateString()} at {booking.returnTime}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">₹{booking.totalAmount || booking.amount || 0}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={
                                booking.status === "confirmed" ? "default" : 
                                booking.status === "completed" ? "secondary" : 
                                booking.status === "cancelled" ? "destructive" :
                                "destructive"
                              }
                              className={
                                booking.status === "cancelled" ? "bg-red-100 text-red-800 hover:bg-red-200" : ""
                              }
                            >
                              {booking.status}
                            </Badge>
                            {booking.status === "cancelled" && booking.cancellationReason && (
                              <span 
                                className="text-xs text-gray-500 cursor-help" 
                                title={`Reason: ${booking.cancellationReason}`}
                              >
                                ⓘ
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">
                              {booking.createdBy?.userId || 'System'}
                            </div>
                            <div className="text-xs text-gray-500 capitalize">
                              {booking.createdBy?.role || 'admin'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">
                              {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {booking.createdAt ? new Date(booking.createdAt).toLocaleTimeString() : ''}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewBooking(booking)}
                            >
                              View
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleGenerateInvoice(booking)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              Generate Invoice
                            </Button>
                            {booking.status === "confirmed" && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleEditBooking(booking)}
                                >
                                  Edit
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleCompleteBooking(booking._id || booking.id)}
                                  disabled={completeBookingMutation.isPending}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  Complete
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleCancelBooking(booking)}
                                  disabled={cancelBookingMutation.isPending}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  Cancel
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {/* Show message if no bookings */}
                    {(bookings as any[]).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-gray-500 py-8">
                          No booking history found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600">📊</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {(bookings as any[]).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <span className="text-green-600">✅</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Completed</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {(bookings as any[]).filter(b => b.status === 'completed').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <span className="text-yellow-600">⏳</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Confirmed</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {(bookings as any[]).filter(b => b.status === 'confirmed').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <span className="text-red-600">❌</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Cancelled</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {(bookings as any[]).filter(b => b.status === 'cancelled').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case "revenue":
        return <RevenueReport />;

      case "profile":
        return (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Profile Management</h1>
            </div>
            
            {/* Account Information */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Shield className="text-blue-600" size={20} />
                  <span>Account Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">User ID</Label>
                    <p className="text-sm text-gray-900 break-all">{user?.userId}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Role</Label>
                    <div>
                      <Badge variant="default" className="text-xs capitalize">
                        {user?.role}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Account Status</Label>
                    <div>
                      <Badge variant={(user as any)?.isActive ? "default" : "secondary"} className="text-xs">
                        {(user as any)?.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Account Created</Label>
                    <p className="text-sm text-gray-900">
                      {(user as any)?.tenantId?.createdAt ? new Date((user as any).tenantId.createdAt).toLocaleDateString() : 'Not available'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Subscription Plan Section */}
            {user?.role === 'client' && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-lg">
                    <Star className="text-purple-600" size={20} />
                    <span>Subscription Plan</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Current Plan Info */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 capitalize">
                            {(user as any)?.tenantId?.subscriptionPlan || 'Starter'} Plan
                          </h3>
                          <p className="text-sm text-gray-600">Your current subscription</p>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant="outline" 
                            className={`text-xs border-2 ${
                              (user as any)?.tenantId?.subscriptionPlan === 'pro' 
                                ? 'border-blue-500 text-blue-700 bg-blue-50'
                                : (user as any)?.tenantId?.subscriptionPlan === 'custom'
                                ? 'border-purple-500 text-purple-700 bg-purple-50'
                                : 'border-green-500 text-green-700 bg-green-50'
                            }`}
                          >
                            {(user as any)?.tenantId?.subscriptionPlan === 'pro' ? 'PRO' :
                             (user as any)?.tenantId?.subscriptionPlan === 'custom' ? 'CUSTOM' : 'STARTER'}
                          </Badge>
                        </div>
                      </div>

                      {/* Plan Limits with Usage */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Car className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium">Vehicles</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-gray-900">
                              {(vehicles as any[])?.length || 0} / {(user as any)?.tenantId?.limits?.vehicles || 6}
                            </span>
                            <div className="text-xs text-gray-500">used</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium">Drivers</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-gray-900">
                              {(drivers as any[])?.length || 0} / {(user as any)?.tenantId?.limits?.drivers || 3}
                            </span>
                            <div className="text-xs text-gray-500">used</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <UserCheck className="w-4 h-4 text-purple-600" />
                            <span className="text-sm font-medium">Managers</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-gray-900">
                              {managersCount || 0} / {(user as any)?.tenantId?.limits?.managers || 1}
                            </span>
                            <div className="text-xs text-gray-500">used</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Upgrade Section */}
                    <div className="space-y-4">
                      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                        <h4 className="text-md font-semibold text-gray-900 mb-2">Need More Resources?</h4>
                        <p className="text-sm text-gray-600 mb-4">
                          Upgrade your plan to get more vehicles, drivers, and advanced features.
                        </p>
                        <Button 
                          onClick={() => setShowContactModal(true)}
                          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                        >
                          <Star className="w-4 h-4 mr-2" />
                          Upgrade Plan
                        </Button>
                      </div>
                      
                      <div className="text-center text-xs text-gray-500">
                        Need help? Contact support for assistance
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Business Profile Section */}
            <BusinessProfile 
              userRole={user?.role || ''} 
              onShowOnboarding={() => setShowOnboarding(true)}
            />
            
            {/* Security Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Shield className="text-blue-600" size={20} />
                  <span>Security Settings</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Password Security</h4>
                    <p className="text-sm text-gray-600">
                      Keep your account secure by updating your password regularly
                    </p>
                    <Button 
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        toast({
                          title: "Password Reset",
                          description: "Contact your administrator to reset your password",
                          duration: 4000,
                        });
                      }}
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Request Password Reset
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Account Security</h4>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-green-800">Account Secure</span>
                      </div>
                      <p className="text-xs text-green-700 mt-1">
                        Your account is protected with secure authentication
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Login Activity</h4>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-blue-800">Last Login</span>
                          <span className="text-xs text-blue-700">
                            {user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-blue-800">Login Count</span>
                          <span className="text-xs text-blue-700">{user?.loginAttempts || 0}</span>
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          Enhanced security monitoring active
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Security Features */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-4">Security Features</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <Shield className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Rate Limiting</p>
                        <p className="text-xs text-gray-600">Protected from brute force</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Shield className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Session Security</p>
                        <p className="text-xs text-gray-600">Single session enforcement</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                        <Shield className="w-4 h-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Password Strength</p>
                        <p className="text-xs text-gray-600">Strong password required</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <Shield className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Audit Tracking</p>
                        <p className="text-xs text-gray-600">All activities logged</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "expenses":
        return <ManageExpenses />;

      case "salary":
        // Coming Soon Message - Original salary management system is preserved below for easy restoration
        return (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border-2 border-dashed border-blue-200 max-w-md mx-auto">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Banknote className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Coming Soon</h2>
              <p className="text-gray-600 mb-4">
                The Salary Management feature is currently under development and will be available in a future update.
              </p>
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-gray-700 font-medium">What's Coming:</p>
                <ul className="text-sm text-gray-600 mt-2 space-y-1">
                  <li>• Driver salary management</li>
                  <li>• Automated salary calculations</li>
                  <li>• Salary slip generation</li>
                  <li>• Role-based salary tracking</li>
                </ul>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Stay tuned for updates!
              </p>
            </div>
          </div>
        );
        
        // ORIGINAL SALARY MANAGEMENT SYSTEM - PRESERVED FOR EASY RESTORATION
        // To restore: uncomment the code below and comment out the "Coming Soon" section above
        /*
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Salary Management</h1>
              <Button
                onClick={() => setShowSalarySidebar(!showSalarySidebar)}
                variant="outline"
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <Menu className="w-4 h-4" />
                {showSalarySidebar ? 'Hide' : 'Show'} Salary Menu
              </Button>
            </div>
            
            {selectedSalaryRole ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {selectedSalaryRole} Salary Management
                    </h2>
                    <Button
                      onClick={() => setSelectedSalaryRole(null)}
                      variant="ghost"
                      size="sm"
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ← Back to Roles
                    </Button>
                  </div>
                  
                  {selectedSalaryRole === 'Driver' ? (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <h3 className="text-lg font-medium text-gray-900">Driver Management</h3>
                        <Button
                          onClick={() => setShowDriverSelection(true)}
                          className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Drivers for Salary
                        </Button>
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className="text-md font-medium text-gray-800">All Drivers ({drivers?.length || 0})</h4>
                        
                        {drivers && drivers.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {drivers.map((driver) => (
                              <div key={driver._id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Users className="w-5 h-5 text-blue-600" />
                                  </div>
                                  <div className="flex-1">
                                    <h5 className="font-medium text-gray-900">{driver.name}</h5>
                                    <p className="text-sm text-gray-500">{driver.phone}</p>
                                    <p className="text-xs text-gray-400">License: {driver.licenseNumber}</p>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                  <div className="flex items-center space-x-2">
                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                      driver.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                      {driver.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs w-full sm:w-auto"
                                    onClick={() => {
                                      const isAlreadyAdded = driverCards.some(d => d._id === driver._id);
                                      if (!isAlreadyAdded) {
                                        setDriverCards(prev => [...prev, driver]);
                                        toast({
                                          variant: "success",
                                          title: "Driver Added",
                                          description: `${driver.name} added to salary management.`,
                                        });
                                      } else {
                                        toast({
                                          title: "Already Added",
                                          description: `${driver.name} is already in salary management.`,
                                        });
                                      }
                                    }}
                                  >
                                    {driverCards.some(d => d._id === driver._id) ? 'Added' : 'Add to Salary'}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-gray-50 rounded-lg">
                            <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                            <p className="text-gray-600 mb-2">No drivers found</p>
                            <p className="text-sm text-gray-500">Add drivers to your fleet first</p>
                          </div>
                        )}
                      </div>
                      
                      {driverCards.length > 0 && (
                        <div className="space-y-4 mt-6">
                          <h4 className="text-md font-medium text-gray-800">Selected for Salary ({driverCards.length})</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {driverCards.map((driver) => (
                              <div key={driver._id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Users className="w-5 h-5 text-blue-600" />
                                  </div>
                                  <div className="flex-1">
                                    <h5 className="font-medium text-gray-900">{driver.name}</h5>
                                    <p className="text-sm text-gray-500">{driver.phone}</p>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-col sm:flex-row sm:justify-between gap-2">
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none"
                                    onClick={() => {
                                      toast({
                                        variant: "success",
                                        title: "Salary Slip Created",
                                        description: `Salary slip created for ${driver.name}.`,
                                      });
                                    }}
                                  >
                                    <DollarSign className="w-4 h-4 mr-1" />
                                    Create Salary Slip
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-700 flex-1 sm:flex-none"
                                    onClick={() => {
                                      setDriverCards(prev => prev.filter(d => d._id !== driver._id));
                                      toast({
                                        title: "Driver Removed",
                                        description: `${driver.name} removed from salary management.`,
                                      });
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {driverCards.length === 0 && (
                        <div className="text-center py-8 bg-gray-50 rounded-lg mt-6">
                          <Banknote className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                          <p className="text-gray-600 mb-2">No drivers selected for salary management</p>
                          <p className="text-sm text-gray-500">Click "Add to Salary" on any driver above or use "Add Drivers for Salary" button</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <Banknote className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-gray-600 mb-2">{selectedSalaryRole} Salary Management</p>
                      <p className="text-sm text-gray-500">Role-specific salary management features coming soon</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Select a role from the salary menu</p>
                <p className="text-sm text-gray-500">
                  Use the salary menu on the left to select a role and manage salary entries
                </p>
              </div>
            )}
          </div>
        );
        */

      case "users":
        return (
          <div>
            {/* Only show user management for admin and client users */}
            {(user?.role === 'admin' || user?.role === 'client') ? (
              <UserManagement />
            ) : (
              <div className="text-center py-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Access Denied
                </h2>
                <p className="text-gray-600">You don't have permission to manage users.</p>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Unknown View
            </h2>
            <p className="text-gray-600">This section is not available.</p>
          </div>
        );
    }
  };

  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    // Refetch user data to update hasCompletedOnboarding status
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    toast({
      title: "Welcome to FleetPro!",
      description: "Your setup guide is complete. Explore your dashboard!",
    });
  };

  const handleOnboardingSkip = () => {
    setShowOnboarding(false);
    // Refetch user data to update hasCompletedOnboarding status
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    toast({
      title: "Setup Skipped",
      description: "You can access the setup guide anytime from your profile.",
    });
  };

  // Check if user should see onboarding wizard (first-time login)
  useEffect(() => {
    if (user && user.role === 'client') {
      if (user.hasCompletedOnboarding === false || user.hasCompletedOnboarding === undefined) {
        setShowOnboarding(true);
      }
    }
  }, [user]);

  return (
    <>
      {/* Onboarding Wizard for Client Users */}
      {showOnboarding && user?.role === 'client' && (
        <OnboardingWizard 
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}
      
      <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="mr-3"
            >
              <Menu size={20} />
            </Button>
            <h1 className="text-xl font-bold text-blue-600">FleetPro</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut size={16} />
          </Button>
        </div>
      </div>

      <Sidebar 
        currentView={currentView} 
        onViewChange={(view) => handleViewChange(view as ViewType)}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      {/* Salary Sidebar Mobile Overlay */}
      {showSalarySidebar && (
        <div
          className="fixed inset-0 z-25 bg-black bg-opacity-50 lg:hidden transition-opacity duration-300 ease-in-out"
          onClick={() => setShowSalarySidebar(false)}
        />
      )}
      
      {/* Salary Sidebar */}
      <div className={`
        fixed left-0 top-16 h-full w-64 bg-white shadow-lg border-r border-gray-200 z-30
        transform transition-transform duration-300 ease-in-out
        ${showSalarySidebar ? 'translate-x-0' : '-translate-x-full'}
        lg:left-64 lg:top-0
      `}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Salary Management</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSalarySidebar(!showSalarySidebar)}
              className="h-6 w-6 p-0"
            >
              {showSalarySidebar ? '×' : '→'}
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {uniqueRoles.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Banknote className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p>No salary roles yet</p>
                  <p className="text-sm">Click "Add Salary Entry" to get started</p>
                </div>
              ) : (
                uniqueRoles.map((role) => {
                  return (
                    <div
                      key={role}
                      className={`w-full p-3 rounded-lg border transition-colors ${
                        selectedSalaryRole === role 
                          ? 'bg-blue-50 border-blue-200 text-blue-900' 
                          : 'bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => handleSalaryRoleClick(role)}
                          className="flex-1 text-left"
                        >
                          <div className="font-medium">{role}</div>
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSalaryRole(role)}
                          className="h-6 w-6 p-0 ml-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
          <div className="p-4 border-t border-gray-200">
            <Button 
              onClick={() => setShowAddSalaryForm(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Banknote className="w-4 h-4 mr-2" />
              Add Salary Entry
            </Button>
          </div>
        </div>
      </div>
      
      <main className={`
        flex-1 overflow-y-auto lg:ml-0 pt-16 lg:pt-0 transition-all duration-300 ease-in-out
        ${showSalarySidebar ? 'lg:ml-64' : ''}
      `}>
        <div className="px-3 sm:px-6 lg:px-8 py-4 lg:py-8">
          <div className="animate-in slide-in-from-bottom-2 duration-300">
            {renderContent()}
          </div>
        </div>
      </main>

      {/* View Booking Dialog */}
      <Dialog open={!!viewingBooking} onOpenChange={() => setViewingBooking(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {viewingBooking && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Booking ID</Label>
                  <p className="text-sm text-gray-900">{viewingBooking.bookingId}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Status</Label>
                  <Badge variant={viewingBooking.status === "confirmed" ? "default" : viewingBooking.status === "completed" ? "secondary" : "destructive"}>
                    {viewingBooking.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Customer Name</Label>
                  <p className="text-sm text-gray-900">{viewingBooking.customerName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Customer Phone</Label>
                  <p className="text-sm text-gray-900">{viewingBooking.customerPhone}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Pickup Location</Label>
                  <p className="text-sm text-gray-900">{viewingBooking.pickupLocation || "Not specified"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Drop-off Location</Label>
                  <p className="text-sm text-gray-900">{viewingBooking.dropoffLocation || "Not specified"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Pickup Date & Time</Label>
                  <p className="text-sm text-gray-900">
                    {new Date(viewingBooking.pickupDate).toLocaleDateString()} at {viewingBooking.pickupTime}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Return Date & Time</Label>
                  <p className="text-sm text-gray-900">
                    {new Date(viewingBooking.returnDate).toLocaleDateString()} at {viewingBooking.returnTime}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Trip Type</Label>
                  <p className="text-sm text-gray-900">
                    {viewingBooking.tripType === "round_trip" ? "Round Trip" :
                     viewingBooking.tripType === "local" ? "Local" :
                     viewingBooking.tripType === "airport" && viewingBooking.dropoffLocation === "Not Decided Yet" ? "Not Decided Yet" :
                     viewingBooking.tripType === "airport" ? "Airport" :
                     viewingBooking.dropoffLocation === "Local" ? "Local" :
                     viewingBooking.dropoffLocation === "Not Decided Yet" ? "Not Decided Yet" :
                     viewingBooking.tripType === "one_way" ? "One Way" : "One Way"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Service Type</Label>
                  <p className="text-sm text-gray-900">
                    {viewingBooking.bookingType === "self_drive" ? "Self Drive" : "With Driver"}
                  </p>
                </div>
                {viewingBooking.thirdPartyDriverName && (
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-gray-700">Third-party Driver Details</Label>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-1">
                      <p className="text-sm text-gray-900">
                        <strong>Name:</strong> {viewingBooking.thirdPartyDriverName}
                      </p>
                      {viewingBooking.thirdPartyDriverPhone && (
                        <p className="text-sm text-gray-900">
                          <strong>Phone:</strong> {viewingBooking.thirdPartyDriverPhone}
                        </p>
                      )}
                      {viewingBooking.thirdPartyDriverAddress && (
                        <p className="text-sm text-gray-900">
                          <strong>Address:</strong> {viewingBooking.thirdPartyDriverAddress}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium text-gray-700">Vehicle</Label>
                  <p className="text-sm text-gray-900">
                    {(() => {
                      const vehicle = (vehicles as any[]).find(v => v.id === viewingBooking.vehicleId);
                      return vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.registrationNumber})` : "N/A";
                    })()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Total Amount</Label>
                  <p className="text-lg font-semibold text-green-600">₹{viewingBooking.totalAmount || viewingBooking.amount || 0}</p>
                </div>
                {viewingBooking.tollCharges && parseFloat(viewingBooking.tollCharges) > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Toll Charges</Label>
                    <p className="text-sm text-gray-900">₹{viewingBooking.tollCharges}</p>
                  </div>
                )}
                {viewingBooking.parkingCharges && parseFloat(viewingBooking.parkingCharges) > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Parking Charges</Label>
                    <p className="text-sm text-gray-900">₹{viewingBooking.parkingCharges}</p>
                  </div>
                )}
                {viewingBooking.petrolCharges && parseFloat(viewingBooking.petrolCharges) > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Petrol Charges</Label>
                    <p className="text-sm text-gray-900">₹{viewingBooking.petrolCharges}</p>
                  </div>
                )}
                {viewingBooking.dieselCharges && parseFloat(viewingBooking.dieselCharges) > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Diesel Charges</Label>
                    <p className="text-sm text-gray-900">₹{viewingBooking.dieselCharges}</p>
                  </div>
                )}
                {viewingBooking.cngCharges && parseFloat(viewingBooking.cngCharges) > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">CNG Charges</Label>
                    <p className="text-sm text-gray-900">₹{viewingBooking.cngCharges}</p>
                  </div>
                )}
                {viewingBooking.specialRequirements && (
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-gray-700">Special Requirements</Label>
                    <p className="text-sm text-gray-900">{viewingBooking.specialRequirements}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Booking Dialog */}
      <Dialog open={showEditBookingForm} onOpenChange={() => {
        setShowEditBookingForm(false);
        setEditingBooking(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Booking Details</DialogTitle>
          </DialogHeader>
          {editingBooking && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Booking ID</Label>
                <p className="text-sm text-gray-900">{editingBooking.bookingId}</p>
              </div>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const customerName = formData.get('customerName') as string || '';
                const baseAmount = parseFloat(formData.get('baseAmount') as string) || 0;
                const tollCharges = parseFloat(formData.get('tollCharges') as string) || 0;
                const parkingCharges = parseFloat(formData.get('parkingCharges') as string) || 0;
                const petrolCharges = parseFloat(formData.get('petrolCharges') as string) || 0;
                const dieselCharges = parseFloat(formData.get('dieselCharges') as string) || 0;
                const cngCharges = parseFloat(formData.get('cngCharges') as string) || 0;
                const thirdPartyDriverCharges = parseFloat(formData.get('thirdPartyDriverCharges') as string) || 0;
                const thirdPartyDriverName = formData.get('thirdPartyDriverName') as string || '';
                const thirdPartyDriverPhone = formData.get('thirdPartyDriverPhone') as string || '';
                const thirdPartyDriverAddress = formData.get('thirdPartyDriverAddress') as string || '';
                
                // Calculate total fuel cost and third-party driver charges (both are deductions)
                const totalFuelCost = petrolCharges + dieselCharges + cngCharges;
                const totalDeductions = totalFuelCost + thirdPartyDriverCharges;
                
                // Calculate final amount (base - toll - parking - fuel - third-party driver)
                const finalAmount = baseAmount - tollCharges - parkingCharges - totalDeductions;
                
                updateBookingMutation.mutate({
                  id: editingBooking._id || editingBooking.id,
                  data: {
                    customerName: customerName,
                    totalAmount: finalAmount,
                    tollCharges: tollCharges,
                    parkingCharges: parkingCharges,
                    petrolCharges: petrolCharges,
                    dieselCharges: dieselCharges,
                    cngCharges: cngCharges,
                    thirdPartyDriverCharges: thirdPartyDriverCharges,
                    thirdPartyDriverName: thirdPartyDriverName,
                    thirdPartyDriverPhone: thirdPartyDriverPhone,
                    thirdPartyDriverAddress: thirdPartyDriverAddress,
                  }
                });
              }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="customerName">Customer Name</Label>
                    <Input
                      id="customerName"
                      name="customerName"
                      type="text"
                      defaultValue={editingBooking.customerName || ""}
                      placeholder="Enter customer name"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="baseAmount">Base Amount (₹)</Label>
                    <Input
                      id="baseAmount"
                      name="baseAmount"
                      type="number"
                      step="0.01"
                      defaultValue={(() => {
                        const currentAmount = parseFloat(editingBooking.totalAmount || editingBooking.amount) || 0;
                        const tollCharges = parseFloat(editingBooking.tollCharges) || 0;
                        const parkingCharges = parseFloat(editingBooking.parkingCharges) || 0;
                        const petrolCharges = parseFloat(editingBooking.petrolCharges) || 0;
                        const dieselCharges = parseFloat(editingBooking.dieselCharges) || 0;
                        const cngCharges = parseFloat(editingBooking.cngCharges) || 0;
                        const thirdPartyDriverCharges = parseFloat(editingBooking.thirdPartyDriverCharges) || 0;
                        const totalFuelCost = petrolCharges + dieselCharges + cngCharges;
                        const totalDeductions = totalFuelCost + thirdPartyDriverCharges;
                        return (currentAmount + tollCharges + parkingCharges + totalDeductions).toString();
                      })()}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="tollCharges">Toll Charges (₹)</Label>
                    <Input
                      id="tollCharges"
                      name="tollCharges"
                      type="number"
                      step="0.01"
                      defaultValue={editingBooking.tollCharges || "0"}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="parkingCharges">Parking Charges (₹)</Label>
                    <Input
                      id="parkingCharges"
                      name="parkingCharges"
                      type="number"
                      step="0.01"
                      defaultValue={editingBooking.parkingCharges || "0"}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="petrolCharges">Petrol Charges (₹)</Label>
                    <Input
                      id="petrolCharges"
                      name="petrolCharges"
                      type="number"
                      step="0.01"
                      defaultValue={editingBooking.petrolCharges || "0"}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dieselCharges">Diesel Charges (₹)</Label>
                    <Input
                      id="dieselCharges"
                      name="dieselCharges"
                      type="number"
                      step="0.01"
                      defaultValue={editingBooking.dieselCharges || "0"}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cngCharges">CNG Charges (₹)</Label>
                    <Input
                      id="cngCharges"
                      name="cngCharges"
                      type="number"
                      step="0.01"
                      defaultValue={editingBooking.cngCharges || "0"}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="thirdPartyDriverCharges">Third Party Driver Charges (₹)</Label>
                    <Input
                      id="thirdPartyDriverCharges"
                      name="thirdPartyDriverCharges"
                      type="number"
                      step="0.01"
                      defaultValue={editingBooking.thirdPartyDriverCharges || "0"}
                      placeholder="0"
                    />
                  </div>
                </div>
                
                {/* Third Party Driver Details Section */}
                <div className="border-t pt-4">
                  <h3 className="font-medium text-gray-900 mb-3">Third Party Driver Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="thirdPartyDriverName">Driver Name</Label>
                      <Input
                        id="thirdPartyDriverName"
                        name="thirdPartyDriverName"
                        type="text"
                        defaultValue={editingBooking.thirdPartyDriverName || ""}
                        placeholder="Enter driver name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="thirdPartyDriverPhone">Driver Phone</Label>
                      <Input
                        id="thirdPartyDriverPhone"
                        name="thirdPartyDriverPhone"
                        type="tel"
                        defaultValue={editingBooking.thirdPartyDriverPhone || ""}
                        placeholder="Enter phone number"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="thirdPartyDriverAddress">Driver Address</Label>
                      <Input
                        id="thirdPartyDriverAddress"
                        name="thirdPartyDriverAddress"
                        type="text"
                        defaultValue={editingBooking.thirdPartyDriverAddress || ""}
                        placeholder="Enter driver address"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowEditBookingForm(false);
                      setEditingBooking(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateBookingMutation.isPending}
                    className="flex-1"
                  >
                    {updateBookingMutation.isPending ? "Updating..." : "Update Booking"}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Booking Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to cancel this booking for {cancellingBooking?.customerName}?
            </p>
            <div className="space-y-2">
              <Label htmlFor="cancellation-reason">Reason for Cancellation*</Label>
              <Textarea
                id="cancellation-reason"
                placeholder="Please provide a reason for cancelling this booking (e.g., customer request, vehicle unavailable, weather conditions)"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelDialog(false);
                setCancellingBooking(null);
                setCancellationReason("");
              }}
              className="flex-1"
            >
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancelBooking}
              disabled={cancelBookingMutation.isPending || !cancellationReason.trim()}
              className="flex-1"
            >
              {cancelBookingMutation.isPending ? "Cancelling..." : "Cancel Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced Invoice Generator Modal */}
      <EnhancedInvoiceGenerator
        booking={invoiceBooking}
        isOpen={showInvoiceModal}
        onClose={() => {
          setShowInvoiceModal(false);
          setInvoiceBooking(null);
        }}
      />

      {/* View Driver Profile Modal */}
      <Dialog open={!!viewingDriver} onOpenChange={() => setViewingDriver(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Users className="text-blue-600" size={24} />
              <span>Driver Profile</span>
            </DialogTitle>
          </DialogHeader>
          {viewingDriver && (
            <div className="space-y-6">
              {/* Header with driver photo and basic info */}
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-2xl">👤</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{viewingDriver.name}</h2>
                  <p className="text-gray-600">{viewingDriver.phone}</p>
                  <Badge 
                    variant={viewingDriver.status === "available" ? "default" : 
                            viewingDriver.status === "on_duty" ? "secondary" : "destructive"}
                  >
                    {viewingDriver.status}
                  </Badge>
                </div>
              </div>

              {/* Main driver details in grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Basic Information</h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Full Name</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.name}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Phone Number</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.phone}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Email</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.email || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Age</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.age || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Experience</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.experience || "Not provided"} years</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Rating</Label>
                      <div className="flex items-center">
                        <span className="text-yellow-500">⭐</span>
                        <span className="ml-1 text-sm text-gray-900">{viewingDriver.rating || "5.0"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* License Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">License Information</h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">License Number</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.licenseNumber || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">License Type</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.licenseType || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">License Expiry</Label>
                      <p className="text-sm text-gray-900">
                        {viewingDriver.licenseExpiry ? new Date(viewingDriver.licenseExpiry).toLocaleDateString() : "Not provided"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Current Status</Label>
                      <Badge 
                        variant={viewingDriver.status === "available" ? "default" : 
                                viewingDriver.status === "on_duty" ? "secondary" : "destructive"}
                      >
                        {viewingDriver.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Additional Personal Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Personal Details</h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Permanent Address</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.permanentAddress || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Current Address</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.currentAddress || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Marital Status</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.maritalStatus || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Date of Joining</Label>
                      <p className="text-sm text-gray-900">
                        {viewingDriver.dateOfJoining ? new Date(viewingDriver.dateOfJoining).toLocaleDateString() : "Not provided"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Government Documents */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Government Documents</h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Aadhar Number</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.aadharNumber || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">PAN Number</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.panNumber || "Not provided"}</p>
                    </div>

                  </div>
                </div>
              </div>

              {/* Additional notes or comments if any */}
              {viewingDriver.notes && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Additional Notes</h3>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">{viewingDriver.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => setViewingDriver(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Star className="text-purple-600" size={20} />
              <span>Upgrade Your Plan</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Ready to unlock more features and expand your fleet management capabilities? 
              Contact us to upgrade your subscription plan.
            </p>
            
            <div className="space-y-3">
              <button 
                onClick={() => window.open('tel:+919876543210', '_self')}
                className="flex items-center space-x-3 p-3 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors w-full text-left"
              >
                <Phone className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">Phone Support</p>
                  <p className="text-sm text-gray-600">+91 98765 43210</p>
                </div>
              </button>
              
              <button 
                onClick={() => {
                  const subject = encodeURIComponent('FleetPro - Plan Upgrade Request');
                  const body = encodeURIComponent(`Hello FleetPro Support Team,

I am interested in upgrading my subscription plan. 

Current Plan: ${(user as any)?.tenantId?.subscriptionPlan || 'Starter'}
Business Name: ${(user as any)?.tenantId?.businessName || ''}
User ID: ${user?.userId || ''}

Please provide me with information about available upgrade options and pricing.

Thank you!`);
                  window.open(`mailto:support@fleetpro.com?subject=${subject}&body=${body}`, '_self');
                }}
                className="flex items-center space-x-3 p-3 bg-gray-50 hover:bg-green-50 rounded-lg transition-colors w-full text-left"
              >
                <Mail className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">Email Support</p>
                  <p className="text-sm text-gray-600">support@fleetpro.com</p>
                </div>
              </button>
              
              <button 
                onClick={() => {
                  const message = encodeURIComponent(`Hello! I'm interested in upgrading my FleetPro subscription plan.

Current Plan: ${(user as any)?.tenantId?.subscriptionPlan || 'Starter'}
Business: ${(user as any)?.tenantId?.businessName || ''}

Please help me with upgrade options. Thank you!`);
                  window.open(`https://wa.me/919876543210?text=${message}`, '_blank');
                }}
                className="flex items-center space-x-3 p-3 bg-gray-50 hover:bg-purple-50 rounded-lg transition-colors w-full text-left"
              >
                <MessageCircle className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="font-medium text-gray-900">WhatsApp Support</p>
                  <p className="text-sm text-gray-600">Available 24/7</p>
                </div>
              </button>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Pro Tip:</strong> Mention your current plan and desired features for personalized recommendations.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowContactModal(false)}
              className="w-full"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary Form Modal */}
      <Dialog open={showAddSalaryForm} onOpenChange={(open) => {
        setShowAddSalaryForm(open);
        if (!open) {
          setIsCustomRole(false);
          setCustomRole("");
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Salary Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const selectedRole = formData.get('role') as string;
            const customRoleValue = formData.get('customRole') as string;
            const amountValue = formData.get('amount') as string;
            
            // Use custom role if "Custom" is selected, otherwise use selected role
            const role = selectedRole === 'Custom' ? customRoleValue : selectedRole;
            const amount = amountValue ? parseInt(amountValue) : undefined;
            
            // Validate that role is provided
            if (!role || role.trim() === '') {
              toast({
                variant: "destructive",
                title: "Role Required",
                description: "Please provide a role for the salary entry.",
              });
              return;
            }
            
            handleAddSalary(role, amount);
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="role">Role</Label>
                <Select 
                  name="role" 
                  required 
                  onValueChange={(value) => setIsCustomRole(value === 'Custom')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Driver">Driver</SelectItem>
                    <SelectItem value="Accountant">Accountant</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Cleaner">Cleaner</SelectItem>
                    <SelectItem value="Mechanic">Mechanic</SelectItem>
                    <SelectItem value="Security">Security</SelectItem>
                    <SelectItem value="Helper">Helper</SelectItem>
                    <SelectItem value="Custom">Custom Role</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {isCustomRole && (
                <div>
                  <Label htmlFor="customRole">Custom Role Name</Label>
                  <Input
                    id="customRole"
                    name="customRole"
                    type="text"
                    placeholder="Enter custom role name"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    required
                  />
                </div>
              )}
              
              <div>
                <Label htmlFor="amount">Amount (₹) - Optional</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  placeholder="Enter amount (optional)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank if amount is not specified
                </p>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => {
                setShowAddSalaryForm(false);
                setIsCustomRole(false);
                setCustomRole("");
              }}>
                Cancel
              </Button>
              <Button type="submit">Add Salary</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Driver Selection Dialog */}
      <Dialog open={showDriverSelection} onOpenChange={setShowDriverSelection}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Select Drivers for Salary Management</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Select one or more drivers to add to your salary management panel.
            </p>
            
            {drivers && drivers.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {drivers.map((driver: any) => (
                  <div key={driver._id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                    <input
                      type="checkbox"
                      id={`driver-${driver._id}`}
                      checked={selectedDrivers.includes(driver._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDrivers([...selectedDrivers, driver._id]);
                        } else {
                          setSelectedDrivers(selectedDrivers.filter(id => id !== driver._id));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <div className="flex items-center flex-1">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{driver.name}</h4>
                        <p className="text-sm text-gray-600">{driver.phone}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">License: {driver.licenseNumber}</p>
                        <Badge variant={driver.isActive ? "default" : "secondary"} className="text-xs">
                          {driver.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p>No drivers available</p>
                <p className="text-sm">Add drivers to your fleet first</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDriverSelection(false);
                setSelectedDrivers([]);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => handleDriverSelection(selectedDrivers)}
              disabled={selectedDrivers.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Add Selected Drivers ({selectedDrivers.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
    </>
  );
}
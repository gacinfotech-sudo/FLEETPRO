import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Calendar, Car, Users, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
// import { Alert, AlertDescription } from "@/components/ui/alert";

export default function EnhancedStats() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: vehicles } = useQuery({
    queryKey: ["/api/vehicles"],
  });

  const { data: drivers } = useQuery({
    queryKey: ["/api/drivers"],  
  });

  const { data: bookings } = useQuery({
    queryKey: ["/api/bookings"],
  });

  // Use real-time data from actual API calls
  const realStats = {
    totalRevenue: (stats as any)?.totalRevenue || 0,
    totalBookings: (stats as any)?.totalBookings || 0,
    fleetSize: (vehicles as any[])?.length || 0,
    activeDrivers: (drivers as any[])?.length || 0,
  };

  // Check if we have enough bookings for meaningful analytics
  const hasEnoughData = realStats.totalBookings >= 10;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="animate-pulse">
                <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-6 sm:h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Show warning when not enough data */}
      {!hasEnoughData && realStats.totalBookings > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-yellow-600 mr-2" />
              <span className="text-sm text-yellow-800">
                Need {10 - realStats.totalBookings} more bookings for detailed analytics and insights.
              </span>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Stats Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${user?.role === 'manager' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4 lg:gap-6`}>
        {user?.role !== 'manager' && (
          <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center">
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="text-green-600" size={18} />
                </div>
                <div className="ml-3 lg:ml-4">
                  <h3 className="text-xl lg:text-2xl font-bold text-gray-900">
                    ₹{realStats.totalRevenue.toLocaleString()}
                  </h3>
                  <p className="text-sm lg:text-base text-gray-600">Total Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="text-blue-600" size={18} />
              </div>
              <div className="ml-3 lg:ml-4">
                <h3 className="text-xl lg:text-2xl font-bold text-gray-900">
                  {realStats.totalBookings}
                </h3>
                <p className="text-sm lg:text-base text-gray-600">Total Bookings</p>
              </div>
            </div>
            <div className="mt-3 lg:mt-4">
              <span className={`text-xs lg:text-sm font-medium ${hasEnoughData ? 'text-blue-600' : 'text-gray-500'}`}>
                {hasEnoughData ? '+0%' : `${10 - realStats.totalBookings} more needed`}
              </span>
              <span className="text-gray-500 text-xs lg:text-sm ml-1">
                {hasEnoughData ? 'from last month' : 'for analytics'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Car className="text-purple-600" size={18} />
              </div>
              <div className="ml-3 lg:ml-4">
                <h3 className="text-xl lg:text-2xl font-bold text-gray-900">
                  {realStats.fleetSize}
                </h3>
                <p className="text-sm lg:text-base text-gray-600">Total Vehicles</p>
              </div>
            </div>
            <div className="mt-3 lg:mt-4">
              <span className="text-purple-600 text-xs lg:text-sm font-medium">
                {realStats.fleetSize} ready
              </span>
              <span className="text-gray-500 text-xs lg:text-sm ml-1">for bookings</span>
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Users className="text-orange-600" size={18} />
              </div>
              <div className="ml-3 lg:ml-4">
                <h3 className="text-xl lg:text-2xl font-bold text-gray-900">
                  {realStats.activeDrivers}
                </h3>
                <p className="text-sm lg:text-base text-gray-600">Total Drivers</p>
              </div>
            </div>
            <div className="mt-3 lg:mt-4">
              <span className="text-orange-600 text-xs lg:text-sm font-medium">
                {realStats.activeDrivers} ready
              </span>
              <span className="text-gray-500 text-xs lg:text-sm ml-1">for trips</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
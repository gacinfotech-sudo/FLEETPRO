import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Calendar, Car, Users } from "lucide-react";

export default function StatsCards() {
  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  // Check if we have enough bookings for meaningful stats (10-20 bookings)
  const hasEnoughData = stats?.totalBookings >= 10;

  const cards = [
    {
      title: "Total Revenue",
      value: hasEnoughData ? `₹${stats?.totalRevenue?.toLocaleString() || "0"}` : "₹0",
      icon: DollarSign,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      change: hasEnoughData ? "+0%" : "Not enough data",
      changeText: hasEnoughData ? "from last month" : "Need 10+ bookings",
    },
    {
      title: "Total Bookings",
      value: stats?.totalBookings || "0",
      icon: Calendar,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      change: hasEnoughData ? "+0%" : "Add more bookings",
      changeText: hasEnoughData ? "from last month" : "for analytics",
    },
    {
      title: "Fleet Size",
      value: stats?.fleetSize || "0",
      icon: Car,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      change: `${stats?.fleetSize || 0} available`,
      changeText: "vehicles",
    },
    {
      title: "Active Drivers",
      value: stats?.activeDrivers || "0",
      icon: Users,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      change: `${stats?.activeDrivers || 0} available`,
      changeText: "drivers",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index}>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center">
                <div className={`w-10 h-10 lg:w-12 lg:h-12 ${card.iconBg} rounded-lg flex items-center justify-center`}>
                  <Icon className={card.iconColor} size={20} />
                </div>
                <div className="ml-3 lg:ml-4">
                  <h3 className="text-xl lg:text-2xl font-bold text-gray-900">{card.value}</h3>
                  <p className="text-sm text-gray-600">{card.title}</p>
                </div>
              </div>
              <div className="mt-3 lg:mt-4">
                <span className={`${card.iconColor} text-sm font-medium`}>{card.change}</span>
                <span className="text-gray-500 text-sm"> {card.changeText}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

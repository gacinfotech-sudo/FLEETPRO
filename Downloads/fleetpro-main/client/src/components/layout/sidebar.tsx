import { Car, BarChart3, Calendar, Users, History, TrendingUp, Menu, Shield, LogOut, UserPlus, ReceiptIcon, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "bookings", label: "Add Booking", icon: Calendar },
  { id: "fleet", label: "View Fleet", icon: Car },
  { id: "drivers", label: "Manage Drivers", icon: Users, restrictedForManagers: true },
  { id: "history", label: "Booking History", icon: History },
  { id: "revenue", label: "Revenue Report", icon: TrendingUp, restrictedForManagers: true },
  { id: "expenses", label: "Manage Expenses", icon: ReceiptIcon },
  { id: "salary", label: "Salary", icon: Banknote },
  { id: "users", label: "Manage Users", icon: UserPlus, adminOnly: true },
  { id: "profile", label: "Profile", icon: Shield },
];

export default function Sidebar({ currentView, onViewChange, isOpen, onToggle }: SidebarProps) {
  const { logout, user } = useAuth();
  
  // Filter navigation items based on user role
  const visibleNavItems = navItems.filter(item => {
    if (item.adminOnly) {
      return user?.role === 'admin' || user?.role === 'client';
    }
    if (item.restrictedForManagers && user?.role === 'manager') {
      return false;
    }
    return true;
  });

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden transition-opacity duration-300 ease-in-out animate-in fade-in-0"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col h-screen",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-center h-16 bg-blue-600">
          <div className="flex items-center">
            <Car className="text-white text-2xl mr-3" size={32} />
            <span className="text-white text-xl font-bold">FleetPro</span>
          </div>
        </div>
        
        <nav className="mt-6 lg:mt-8 flex-1">
          <div className="px-3 lg:px-4 space-y-1 lg:space-y-2">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start px-3 lg:px-4 py-3 lg:py-3 text-sm lg:text-base text-gray-700 hover:bg-gray-100 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] h-12 lg:h-auto",
                    isActive && "bg-blue-50 border-r-4 border-blue-600 text-blue-700 shadow-sm"
                  )}
                  onClick={() => {
                    onViewChange(item.id);
                    // Auto-close sidebar on mobile after selection
                    if (window.innerWidth < 1024) {
                      setTimeout(() => onToggle(), 200);
                    }
                  }}
                >
                  <Icon className="mr-2 lg:mr-3" size={18} />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </nav>

        {/* Logout Button */}
        <div className="p-3 lg:p-4 border-t border-gray-200">
          <Button
            variant="ghost"
            className="w-full justify-start px-3 lg:px-4 py-3 text-sm lg:text-base text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] h-12 lg:h-auto"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 lg:mr-3" size={18} />
            Logout
          </Button>
        </div>
      </div>
    </>
  );
}

import { useAuth } from "../../hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Menu, LogOut } from "lucide-react";
import { NotificationCenter } from "@/components/ui/notifications";
import { OnlineStatusIndicator } from "@/components/offline-notification";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex justify-between items-center px-4 py-3 lg:px-8 lg:py-4">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden mr-3"
            onClick={onMenuClick}
          >
            <Menu size={20} />
          </Button>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500">Welcome back to your fleet management system</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="hidden md:block">
            <span className="text-sm text-gray-500">
              Last login: {new Date().toLocaleDateString()}
            </span>
          </div>
          <OnlineStatusIndicator />
          <NotificationCenter />
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="mr-2" size={16} />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}

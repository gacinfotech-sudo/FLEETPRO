import { useOfflineDetection } from '@/hooks/use-offline';
import { WifiOff, RefreshCw, AlertTriangle, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function OfflineNotification() {
  const { isOnline, showOfflineModal, closeOfflineModal } = useOfflineDetection();

  const handleRetry = () => {
    window.location.reload();
  };

  const handleDismiss = () => {
    closeOfflineModal();
  };

  if (!showOfflineModal) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-300">
      <Card className="mx-4 w-full max-w-md animate-in slide-in-from-bottom-4 duration-500 shadow-2xl border-2 border-red-200 dark:border-red-800">
        <CardHeader className="text-center pb-3">
          <div className="flex items-center justify-center mb-3">
            <div className="relative">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-2">
                <WifiOff className="w-8 h-8 text-red-600 dark:text-red-400 animate-pulse" />
              </div>
              <div className="absolute -top-1 -right-1">
                <Badge variant="destructive" className="animate-bounce">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Offline
                </Badge>
              </div>
            </div>
          </div>
          <CardTitle className="text-xl font-bold text-red-700 dark:text-red-400">
            Connection Lost
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300">
            FleetPro requires an internet connection to function properly
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  What this means:
                </p>
                <ul className="text-xs text-red-700 dark:text-red-400 space-y-1">
                  <li>• Vehicle and booking data cannot be synced</li>
                  <li>• Real-time updates are paused</li>
                  <li>• Some features may not work properly</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start space-x-3">
              <Wifi className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  Quick fixes:
                </p>
                <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                  <li>• Check your WiFi or mobile data connection</li>
                  <li>• Move to an area with better signal</li>
                  <li>• Refresh the page when connection returns</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button 
              onClick={handleRetry} 
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Connection
            </Button>
            <Button 
              onClick={handleDismiss} 
              variant="outline" 
              className="flex-1 border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Continue Offline
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              FleetPro • Fleet Management System
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Lightweight online status indicator for the navbar
export function OnlineStatusIndicator() {
  const { isOnline } = useOfflineDetection();

  if (isOnline) return null;

  return (
    <div className="flex items-center space-x-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/20 rounded-full border border-red-200 dark:border-red-800">
      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
      <span className="text-xs font-medium text-red-700 dark:text-red-400">
        Offline
      </span>
    </div>
  );
}
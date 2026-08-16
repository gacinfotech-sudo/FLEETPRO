import { useState } from 'react';
import { Bell, X, Check, Car, Calendar, DollarSign } from 'lucide-react';
import { Button } from './button';
import { Badge } from './badge';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { ScrollArea } from './scroll-area';
import { useNotifications, type Notification } from '@/hooks/use-notifications';

function NotificationIcon({ type }: { type: Notification['type'] }) {
  switch (type) {
    case 'booking_created':
      return <Calendar className="w-4 h-4 text-blue-600" />;
    case 'booking_completed':
      return <Check className="w-4 h-4 text-green-600" />;
    default:
      return <Bell className="w-4 h-4 text-gray-600" />;
  }
}

function NotificationItem({ notification, onMarkAsRead, onClear }: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onClear: (id: string) => void;
}) {
  const timeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div className={`p-3 border-b border-gray-100 ${!notification.read ? 'bg-blue-50' : 'bg-white'} hover:bg-gray-50 transition-colors`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <NotificationIcon type={notification.type} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className={`text-sm ${!notification.read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
              {notification.message}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onClear(notification.id)}
              className="flex-shrink-0 h-6 w-6 p-0 hover:bg-gray-200"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          
          {notification.data && (
            <div className="mt-1 text-xs text-gray-500">
              {notification.type === 'booking_created' && (
                <span>Customer: {notification.data.customerName} • Amount: ₹{notification.data.amount}</span>
              )}
              {notification.type === 'booking_completed' && (
                <span>Customer: {notification.data.customerName} • Revenue: ₹{notification.data.amount}</span>
              )}
            </div>
          )}
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">{timeAgo(notification.timestamp)}</span>
            {!notification.read && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMarkAsRead(notification.id)}
                className="text-xs h-6 px-2 text-blue-600 hover:bg-blue-100"
              >
                Mark as read
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications
  } = useNotifications();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Notifications</CardTitle>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs text-gray-500">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            {notifications.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs h-6 px-2"
                  disabled={unreadCount === 0}
                >
                  Mark all read
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllNotifications}
                  className="text-xs h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Clear all
                </Button>
              </div>
            )}
          </CardHeader>
          
          <CardContent className="p-0">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Bell className="w-8 h-8 mb-2 text-gray-300" />
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs text-gray-400 text-center mt-1">
                  You'll see real-time updates for bookings here
                </p>
              </div>
            ) : (
              <ScrollArea className="h-80">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onClear={clearNotification}
                  />
                ))}
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}

export function NotificationBadge() {
  const { unreadCount } = useNotifications();
  
  if (unreadCount === 0) return null;
  
  return (
    <Badge 
      variant="destructive" 
      className="ml-2 h-5 min-w-5 flex items-center justify-center px-1 text-xs"
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </Badge>
  );
}
import {
  CheckmarkCircle01Icon,
  Notification01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useUIStore } from '@/store/ui';

export function NotificationDrawer() {
  const { notifications, markAllNotificationsRead, dismissNotification } =
    useUIStore();

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Sheet>
      <SheetTrigger>
        <Button variant="ghost" size="icon" className="relative">
          <HugeiconsIcon icon={Notification01Icon} size={20} />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-primary" />
          )}
          <span className="sr-only">Open notifications</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] flex flex-col sm:max-w-[540px]">
        <SheetHeader className="flex flex-row items-center justify-between border-b pb-4">
          <SheetTitle>Notifications</SheetTitle>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllNotificationsRead}
            >
              Mark all as read
            </Button>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-4">
          {notifications.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <HugeiconsIcon
                icon={Notification01Icon}
                size={48}
                className="mb-4 opacity-20"
              />
              <p>No notifications yet</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start gap-4 rounded-lg p-3 ${!n.read ? 'bg-muted/50' : ''}`}
                >
                  <div className="mt-1">
                    <HugeiconsIcon
                      icon={Notification01Icon}
                      size={20}
                      className={
                        !n.read ? 'text-primary' : 'text-muted-foreground'
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold">{n.title}</h4>
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {new Date(n.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => dismissNotification(n.id)}
                  >
                    <span className="sr-only">Dismiss</span>
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

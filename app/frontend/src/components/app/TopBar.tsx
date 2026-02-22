import { Search01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUIStore } from '@/store/ui';
import { Breadcrumbs } from './Breadcrumbs';
import { CommandPalette } from './CommandPalette';
import { NotificationDrawer } from './NotificationDrawer';

export function TopBar() {
  const { connectionStatus, colorMode, setColorMode } = useUIStore();
  const [commandOpen, setCommandOpen] = useState(false);

  const statusColor =
    {
      connected: 'bg-green-500',
      connecting: 'bg-amber-500',
      disconnected: 'bg-red-500',
    }[connectionStatus] || 'bg-gray-400';

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <Breadcrumbs />
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          className="hidden w-64 justify-between text-muted-foreground sm:flex"
          onClick={() => setCommandOpen(true)}
        >
          <span className="flex items-center">
            <HugeiconsIcon icon={Search01Icon} size={16} className="mr-2" />
            Search...
          </span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>

        <NotificationDrawer />

        <div className="flex items-center space-x-2">
          <div
            className={`h-2.5 w-2.5 rounded-full ${statusColor}`}
            title={connectionStatus}
          />
          <span className="sr-only">{connectionStatus}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">User</p>
                <p className="text-xs leading-none text-muted-foreground">
                  user@example.com
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                setColorMode(colorMode === 'dark' ? 'light' : 'dark')
              }
            >
              Toggle Theme
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandPalette open={commandOpen} setOpen={setCommandOpen} />
    </header>
  );
}

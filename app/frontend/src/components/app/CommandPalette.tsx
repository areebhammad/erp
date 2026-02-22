import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { usePermissionsStore } from '@/store/permissions';
import { navigationConfig } from './navigation';

export function CommandPalette({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { can } = usePermissionsStore();
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, setOpen]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {navigationConfig.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (!item.permissionRequired) return true;
            return can(
              item.permissionRequired.resource,
              item.permissionRequired.action
            );
          });

          if (visibleItems.length === 0) return null;

          return (
            <CommandGroup key={group.name} heading={group.name}>
              {visibleItems.map((item) => (
                <CommandItem
                  key={item.href}
                  onSelect={() => runCommand(() => navigate({ to: item.href }))}
                >
                  <span>{item.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}

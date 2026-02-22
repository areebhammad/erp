import {
  Briefcase01Icon,
  DeliveryBox01Icon,
  Home01Icon,
  // Menu01Icon,
  Menu03Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Link } from '@tanstack/react-router';
import { usePermissionsStore } from '@/store/permissions';
import { useUIStore } from '@/store/ui';
import { navigationConfig } from './navigation';

// Mapping string icons from config to actual hugeicons
const iconMap: Record<string, any> = {
  Home: Home01Icon,
  Briefcase: Briefcase01Icon,
  Box: DeliveryBox01Icon,
};

export function Sidebar() {
  const { can } = usePermissionsStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={`flex flex-col border-r bg-background transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
    >
      <div
        className={`flex h-14 items-center border-b px-4 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}
      >
        {!sidebarCollapsed && <span className="font-semibold">Marchly</span>}
        <button
          onClick={toggleSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <HugeiconsIcon icon={Menu03Icon} size={20} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
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
            <div key={group.name} className="mb-6 px-3">
              {!sidebarCollapsed && (
                <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.name}
                </h3>
              )}
              <ul className="space-y-1">
                {visibleItems.map((item) => {
                  const IconNode = iconMap[item.icon];
                  return (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        className="group flex items-center rounded-md px-2 py-2 text-sm font-medium hover:bg-muted"
                        activeProps={{
                          className: 'bg-muted text-primary',
                          'aria-current': 'page',
                        }}
                        // If we had tooltips, we'd wrap this
                        title={sidebarCollapsed ? item.name : undefined}
                      >
                        {IconNode && (
                          <HugeiconsIcon
                            icon={IconNode}
                            size={20}
                            className={!sidebarCollapsed ? 'mr-3' : ''}
                          />
                        )}
                        {!sidebarCollapsed && <span>{item.name}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

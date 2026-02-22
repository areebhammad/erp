export type NavigationItem = {
  name: string;
  href: string;
  icon: string; // Or a Lucide icon component if preferred
  permissionRequired?: { resource: string; action: string };
};

export type NavigationGroup = {
  name: string;
  items: NavigationItem[];
};

export const navigationConfig: NavigationGroup[] = [
  {
    name: 'Overview',
    items: [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: 'Home',
      },
    ],
  },
  {
    name: 'Finance',
    items: [
      {
        name: 'Accounts',
        href: '/accounts',
        icon: 'Briefcase',
        permissionRequired: { resource: 'accounts', action: 'read' },
      },
    ],
  },
  {
    name: 'Operations',
    items: [
      {
        name: 'Inventory',
        href: '/inventory',
        icon: 'Box',
        permissionRequired: { resource: 'inventory', action: 'read' },
      },
    ],
  },
];

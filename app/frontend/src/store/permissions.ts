import { create } from 'zustand';

export interface PermissionsState {
  roles: string[];
  permissions: Set<string>;
  featureFlags: Record<string, boolean>;

  setPermissions: (
    roles: string[],
    permissions: string[] | Set<string>,
    featureFlags: Record<string, boolean>
  ) => void;
  clearPermissions: () => void;

  can: (resource: string, action: string) => boolean;
  hasRole: (role: string) => boolean;
}

export const usePermissionsStore = create<PermissionsState>((set, get) => ({
  roles: [],
  permissions: new Set<string>(),
  featureFlags: {},

  setPermissions: (roles, permissions, featureFlags) => {
    set({
      roles,
      permissions:
        permissions instanceof Set ? permissions : new Set(permissions),
      featureFlags,
    });
  },

  clearPermissions: () => {
    set({
      roles: [],
      permissions: new Set<string>(),
      featureFlags: {},
    });
  },

  can: (resource, action) => {
    const { permissions } = get();
    // Assuming permission strings are like `resource:action` or similar.
    // E.g., `feature:read` or `*` or `feature:*`
    const permissionStr = `${resource}:${action}`;
    if (permissions.has('*') || permissions.has('*:*')) return true;
    if (permissions.has(`${resource}:*`)) return true;
    return permissions.has(permissionStr);
  },

  hasRole: (role) => {
    return get().roles.includes(role);
  },
}));

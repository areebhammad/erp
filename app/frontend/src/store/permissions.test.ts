import { beforeEach, describe, expect, it } from 'vitest';
import { usePermissionsStore } from './permissions';

describe('Permissions Store', () => {
  beforeEach(() => {
    // Reset store state
    usePermissionsStore.getState().clearPermissions();
  });

  it('sets and correctly evaluates permissions (can)', () => {
    usePermissionsStore
      .getState()
      .setPermissions(['editor'], ['post:read', 'post:write'], {
        new_dashboard: true,
      });

    const store = usePermissionsStore.getState();
    expect(store.can('post', 'read')).toBe(true);
    expect(store.can('post', 'delete')).toBe(false);
  });

  it('handles wildcard permissions correctly', () => {
    usePermissionsStore.getState().setPermissions(['admin'], ['*'], {});
    expect(usePermissionsStore.getState().can('anything', 'any_action')).toBe(
      true
    );

    usePermissionsStore
      .getState()
      .setPermissions(['admin'], new Set(['*:*']), {});
    expect(usePermissionsStore.getState().can('anything', 'any_action')).toBe(
      true
    );

    usePermissionsStore.getState().setPermissions(['user'], ['users:*'], {});
    expect(usePermissionsStore.getState().can('users', 'create')).toBe(true);
    expect(usePermissionsStore.getState().can('posts', 'read')).toBe(false);
  });

  it('checks roles correctly', () => {
    usePermissionsStore
      .getState()
      .setPermissions(['admin', 'reviewer'], [], {});
    expect(usePermissionsStore.getState().hasRole('admin')).toBe(true);
    expect(usePermissionsStore.getState().hasRole('user')).toBe(false);
  });

  it('clears permissions state properly', () => {
    usePermissionsStore
      .getState()
      .setPermissions(['role'], ['perm'], { feat: true });
    usePermissionsStore.getState().clearPermissions();

    const store = usePermissionsStore.getState();
    expect(store.roles).toEqual([]);
    expect(store.permissions.size).toBe(0);
    expect(store.featureFlags).toEqual({});
  });
});

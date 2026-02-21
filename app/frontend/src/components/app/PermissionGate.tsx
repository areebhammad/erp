import React from 'react';
import { usePermissionsStore } from '../../store/permissions';

export type PermissionGateProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
} & (
  | { resource: string; action: string; flag?: never; role?: never }
  | { flag: string; resource?: never; action?: never; role?: never }
  | { role: string; resource?: never; action?: never; flag?: never }
);

export function PermissionGate({
  children,
  fallback = null,
  resource,
  action,
  flag,
  role,
}: PermissionGateProps) {
  const { can, hasRole, featureFlags } = usePermissionsStore();

  let isAllowed = false;

  if (flag) {
    isAllowed = !!featureFlags[flag];
  } else if (role) {
    isAllowed = hasRole(role);
  } else if (resource && action) {
    isAllowed = can(resource, action);
  }

  return <>{isAllowed ? children : fallback}</>;
}

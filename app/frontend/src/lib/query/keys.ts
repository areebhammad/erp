export const keys = {
  auth: {
    me: ['auth', 'me'] as const,
    sessions: ['auth', 'sessions'] as const,
  },
  tenant: {
    current: ['tenant', 'current'] as const,
  },
  permissions: {
    mine: ['permissions', 'mine'] as const,
  },
};

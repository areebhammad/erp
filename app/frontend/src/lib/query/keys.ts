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
  finance: {
    accounts: (filters?: any) => ['finance', 'accounts', filters] as const,
    fiscalYears: () => ['finance', 'fiscal-years'] as const,
    journalEntries: (filters?: any) => ['finance', 'journal-entries', filters] as const,
    journalEntry: (id: string) => ['finance', 'journal-entries', id] as const,
    trialBalance: (filters?: any) => ['finance', 'trial-balance', filters] as const,
    taxRates: (filters?: any) => ['finance', 'tax-rates', filters] as const,
  },
};

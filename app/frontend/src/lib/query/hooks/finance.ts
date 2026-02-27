import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getAccountsApi,
    createAccountApi,
    updateAccountApi,
    deactivateAccountApi,
    getFiscalYearsApi,
    createFiscalYearApi,
    closeFiscalYearApi,
    getJournalEntriesApi,
    getJournalEntryApi,
    postJournalEntryApi,
    reverseJournalEntryApi,
    getTrialBalanceApi,
    getTaxRatesApi,
    createTaxRateApi,
    updateTaxRateApi,
    deactivateTaxRateApi,
} from '../../api/finance';
import { keys } from '../keys';

// Accounts
export const useAccounts = (filters?: { include_inactive?: boolean }) => {
    return useQuery({
        queryKey: keys.finance.accounts(filters),
        queryFn: () => getAccountsApi(filters),
    });
};

export const useCreateAccount = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createAccountApi,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.finance.accounts() }),
    });
};

export const useUpdateAccount = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateAccountApi(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.finance.accounts() }),
    });
};

export const useDeactivateAccount = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deactivateAccountApi,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.finance.accounts() }),
    });
};

// Fiscal Years
export const useFiscalYears = () => {
    return useQuery({
        queryKey: keys.finance.fiscalYears(),
        queryFn: getFiscalYearsApi,
    });
};

export const useCreateFiscalYear = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createFiscalYearApi,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.finance.fiscalYears() }),
    });
};

export const useCloseFiscalYear = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: closeFiscalYearApi,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.finance.fiscalYears() }),
    });
};

// Journal Entries
export const useJournalEntries = (filters?: { fiscal_year_id?: string; account_id?: string; limit?: number; offset?: number }) => {
    return useQuery({
        queryKey: keys.finance.journalEntries(filters),
        queryFn: () => getJournalEntriesApi(filters),
    });
};

export const useJournalEntry = (id: string, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: keys.finance.journalEntry(id),
        queryFn: () => getJournalEntryApi(id),
        enabled: options?.enabled,
    });
};

export const usePostJournalEntry = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: postJournalEntryApi,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: keys.finance.journalEntries() });
            queryClient.invalidateQueries({ queryKey: keys.finance.trialBalance() });
        },
    });
};

export const useReverseJournalEntry = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => reverseJournalEntryApi(id, data),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: keys.finance.journalEntries() });
            queryClient.invalidateQueries({ queryKey: keys.finance.journalEntry(id) });
            queryClient.invalidateQueries({ queryKey: keys.finance.trialBalance() });
        },
    });
};

// Reports
export const useTrialBalance = (filters: { fiscal_year_id: string; as_of?: string }, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: keys.finance.trialBalance(filters),
        queryFn: () => getTrialBalanceApi(filters),
        enabled: options?.enabled ?? !!filters.fiscal_year_id,
    });
};

// Tax Rates
export const useTaxRates = (filters?: { active_only?: boolean }) => {
    return useQuery({
        queryKey: keys.finance.taxRates(filters),
        queryFn: () => getTaxRatesApi(filters),
    });
};

export const useCreateTaxRate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createTaxRateApi,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.finance.taxRates() }),
    });
};

export const useUpdateTaxRate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateTaxRateApi(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.finance.taxRates() }),
    });
};

export const useDeactivateTaxRate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deactivateTaxRateApi,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.finance.taxRates() }),
    });
};

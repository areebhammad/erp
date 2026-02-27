import { client } from './client';

// Chart of Accounts
export const getAccountsApi = async (params?: { include_inactive?: boolean }) =>
    client.get('/api/v1/finance/accounts', { params }).then((r) => r.data);

export const createAccountApi = async (data: any) =>
    client.post('/api/v1/finance/accounts', data).then((r) => r.data);

export const updateAccountApi = async (id: string, data: any) =>
    client.patch(`/api/v1/finance/accounts/${id}`, data).then((r) => r.data);

export const deactivateAccountApi = async (id: string) =>
    client.delete(`/api/v1/finance/accounts/${id}`).then((r) => r.data);

// Fiscal Years
export const getFiscalYearsApi = async () =>
    client.get('/api/v1/finance/fiscal-years').then((r) => r.data);

export const createFiscalYearApi = async (data: any) =>
    client.post('/api/v1/finance/fiscal-years', data).then((r) => r.data);

export const closeFiscalYearApi = async (id: string) =>
    client.patch(`/api/v1/finance/fiscal-years/${id}/close`).then((r) => r.data);

// Journal Entries
export const getJournalEntriesApi = async (params?: { fiscal_year_id?: string; account_id?: string; limit?: number; offset?: number }) =>
    client.get('/api/v1/finance/journal-entries', { params }).then((r) => r.data);

export const getJournalEntryApi = async (id: string) =>
    client.get(`/api/v1/finance/journal-entries/${id}`).then((r) => r.data);

export const postJournalEntryApi = async (data: any) =>
    client.post('/api/v1/finance/journal-entries', data).then((r) => r.data);

export const reverseJournalEntryApi = async (id: string, data: any) =>
    client.post(`/api/v1/finance/journal-entries/${id}/reverse`, data).then((r) => r.data);

// Reports
export const getTrialBalanceApi = async (params: { fiscal_year_id: string; as_of?: string }) =>
    client.get('/api/v1/finance/reports/trial-balance', { params }).then((r) => r.data);

// Tax Rates
export const getTaxRatesApi = async (params?: { active_only?: boolean }) =>
    client.get('/api/v1/finance/tax-rates', { params }).then((r) => r.data);

export const createTaxRateApi = async (data: any) =>
    client.post('/api/v1/finance/tax-rates', data).then((r) => r.data);

export const updateTaxRateApi = async (id: string, data: any) =>
    client.patch(`/api/v1/finance/tax-rates/${id}`, data).then((r) => r.data);

export const deactivateTaxRateApi = async (id: string) =>
    client.delete(`/api/v1/finance/tax-rates/${id}`).then((r) => r.data);

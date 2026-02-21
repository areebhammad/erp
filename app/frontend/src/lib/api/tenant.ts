import { client } from './client';

export const getCurrentTenantApi = async () =>
  client.get('/api/v1/tenants/me').then((r) => r.data);
export const updateTenantApi = async (data: any) =>
  client.patch('/api/v1/tenants/me', data).then((r) => r.data);

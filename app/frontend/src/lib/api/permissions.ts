import { client } from './client';

export const getMyPermissionsApi = async () =>
  client.get('/api/v1/users/me/permissions').then((r) => r.data);

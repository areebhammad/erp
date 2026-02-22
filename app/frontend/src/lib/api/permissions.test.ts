import { describe, expect, it, vi } from 'vitest';
import { client } from './client';
import { getMyPermissionsApi } from './permissions';

vi.mock('./client', () => ({
  client: {
    get: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

describe('permissions API', () => {
  it('calls getMyPermissionsApi endpoint', async () => {
    await getMyPermissionsApi();
    expect(client.get).toHaveBeenCalledWith('/api/v1/users/me/permissions');
  });
});

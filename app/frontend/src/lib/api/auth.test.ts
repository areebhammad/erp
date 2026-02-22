import { describe, expect, it, vi } from 'vitest';
import {
  forgotPasswordApi,
  getCsrfApi,
  getMeApi,
  getSessionsApi,
  loginApi,
  logoutApi,
  refreshApi,
  registerApi,
  resetPasswordApi,
  revokeAllSessionsApi,
  revokeSessionApi,
  verifyMfaApi,
} from './auth';
import { client } from './client';

vi.mock('./client', () => ({
  client: {
    get: vi.fn().mockResolvedValue({ data: { success: true } }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
    delete: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

describe('auth API', () => {
  it('calls login endpoint', async () => {
    const data = { email: 'test@example.com', password: 'password123' };
    await loginApi(data);
    expect(client.post).toHaveBeenCalledWith('/api/v1/auth/login', data);
  });

  it('calls register endpoint', async () => {
    const data = { email: 'test@example.com' };
    await registerApi(data);
    expect(client.post).toHaveBeenCalledWith('/api/v1/auth/register', data);
  });

  it('calls refresh endpoint', async () => {
    await refreshApi();
    expect(client.get).toHaveBeenCalledWith('/api/v1/auth/refresh');
  });

  it('calls logout endpoint', async () => {
    await logoutApi();
    expect(client.post).toHaveBeenCalledWith('/api/v1/auth/logout');
  });

  it('calls forgot_password endpoint', async () => {
    await forgotPasswordApi({});
    expect(client.post).toHaveBeenCalledWith(
      '/api/v1/auth/forgot-password',
      {}
    );
  });

  it('calls reset_password endpoint', async () => {
    await resetPasswordApi({});
    expect(client.post).toHaveBeenCalledWith('/api/v1/auth/reset-password', {});
  });

  it('calls getMe endpoint', async () => {
    await getMeApi();
    expect(client.get).toHaveBeenCalledWith('/api/v1/auth/me');
  });

  it('calls verifyMfa endpoint', async () => {
    await verifyMfaApi({});
    expect(client.post).toHaveBeenCalledWith('/api/v1/auth/verify-mfa', {});
  });

  it('calls getSessions endpoint', async () => {
    await getSessionsApi();
    expect(client.get).toHaveBeenCalledWith('/api/v1/users/me/sessions');
  });

  it('calls revokeSession endpoint', async () => {
    await revokeSessionApi('session-1');
    expect(client.delete).toHaveBeenCalledWith(
      '/api/v1/users/me/sessions/session-1'
    );
  });

  it('calls revokeAllSessions endpoint', async () => {
    await revokeAllSessionsApi();
    expect(client.delete).toHaveBeenCalledWith('/api/v1/users/me/sessions');
  });

  it('calls getCsrf endpoint', async () => {
    await getCsrfApi();
    expect(client.get).toHaveBeenCalledWith('/api/v1/auth/csrf');
  });
});

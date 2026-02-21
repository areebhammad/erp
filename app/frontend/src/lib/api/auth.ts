import { client } from './client';

export const loginApi = async (data: any) =>
  client.post('/api/v1/auth/login', data).then((r) => r.data);
export const registerApi = async (data: any) =>
  client.post('/api/v1/auth/register', data).then((r) => r.data);
export const refreshApi = async () =>
  client.get('/api/v1/auth/refresh').then((r) => r.data);
export const logoutApi = async () =>
  client.post('/api/v1/auth/logout').then((r) => r.data);
export const forgotPasswordApi = async (data: any) =>
  client.post('/api/v1/auth/forgot-password', data).then((r) => r.data);
export const resetPasswordApi = async (data: any) =>
  client.post('/api/v1/auth/reset-password', data).then((r) => r.data);
export const getMeApi = async () =>
  client.get('/api/v1/auth/me').then((r) => r.data);
export const verifyMfaApi = async (data: any) =>
  client.post('/api/v1/auth/verify-mfa', data).then((r) => r.data);
export const getSessionsApi = async () =>
  client.get('/api/v1/users/me/sessions').then((r) => r.data);
export const revokeSessionApi = async (sessionId: string) =>
  client.delete(`/api/v1/users/me/sessions/${sessionId}`).then((r) => r.data);
export const revokeAllSessionsApi = async () =>
  client.delete('/api/v1/users/me/sessions').then((r) => r.data);
export const getCsrfApi = async () =>
  client.get('/api/v1/auth/csrf').then((r) => r.data);

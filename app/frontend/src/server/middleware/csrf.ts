import { randomUUID } from 'node:crypto';
import { defineEventHandler, setCookie } from 'h3';

export default defineEventHandler((event: any) => {
  const token = randomUUID();
  setCookie(event, '__Host-csrf', token, {
    path: '/',
    secure: true,
    sameSite: 'strict',
    // Not HttpOnly, so JS can read it for axios headers
  });
});

import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  clientPrefix: 'VITE_',
  client: {
    VITE_API_URL: z.string().url(),
    VITE_WS_URL: z
      .string()
      .url()
      .refine(
        (val: string) => val.startsWith('ws://') || val.startsWith('wss://'),
        {
          message: 'Must be a valid ws:// or wss:// URL',
        }
      ),
    VITE_SENTRY_DSN: z.string(),
    VITE_POSTHOG_KEY: z.string(),
    VITE_POSTHOG_HOST: z.string().url().default('https://app.posthog.com'),
  },
  runtimeEnv: typeof window !== 'undefined' ? import.meta.env : process.env,
});

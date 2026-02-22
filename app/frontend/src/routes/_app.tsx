import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { env } from '@/env';
import { WSClient } from '@/lib/ws/client';
import { WSContext } from '@/lib/ws/context';
import { useUIStore } from '@/store/ui';
import { useAuthStore } from '@/store/auth';
import { AppShell } from '@/components/app/AppShell';

export const Route = createFileRoute('/_app')({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setConnectionStatus = useUIStore((s) => s.setConnectionStatus);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const wsClient = useMemo(() => {
    return new WSClient(env.VITE_WS_URL, setConnectionStatus);
  }, [setConnectionStatus]);

  useEffect(() => {
    wsClient.connect();

    const unsubscribe = wsClient.subscribe((event) => {
      if (event.type === 'session_invalidated') {
        clearAuth();
        navigate({ to: '/login', search: { session_expired: true } as any } as any);
      } else if (event.type === 'data_changed') {
        queryClient.invalidateQueries({ queryKey: [event.module] });
      }
    });

    return () => {
      unsubscribe();
      wsClient.disconnect();
    };
  }, [wsClient, clearAuth, navigate, queryClient]);

  useEffect(() => {
    // This listener re-fetches permissions when the window regains focus.
    const onFocus = async () => {
      try {
        console.debug('Window focused: re-fetching permissions...');
      } catch (err) {
        console.error('Failed to re-fetch permissions on focus', err);
      }
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  return (
    <WSContext.Provider value={wsClient}>
      <AppShell>
        <Outlet />
      </AppShell>
    </WSContext.Provider>
  );
}

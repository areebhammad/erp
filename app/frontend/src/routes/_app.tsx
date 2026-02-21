import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
// import { usePermissionsStore } from '../store/permissions';

// @ts-expect-error TanStack router codegen will fix this once run
export const Route = createFileRoute('/_app')({
  component: AppLayout,
});

function AppLayout() {
  // const { setPermissions } = usePermissionsStore();

  useEffect(() => {
    // This listener re-fetches permissions when the window regains focus.
    const onFocus = async () => {
      try {
        // TODO: In Phase 4, replace this with actual API call:
        // const res = await getMyPermissionsApi();
        // setPermissions(res.roles, res.permissions, res.featureFlags);
        console.debug('Window focused: re-fetching permissions...');
      } catch (err) {
        console.error('Failed to re-fetch permissions on focus', err);
      }
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  return (
    <div className="app-shell-placeholder">
      {/* Full AppShell layout will be built in Phase 6 */}
      <Outlet />
    </div>
  );
}

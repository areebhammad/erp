import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { useAuthStore } from '@/store/auth';

export const Route = createFileRoute('/_auth')({
    beforeLoad: () => {
        // If authenticated, redirect to /dashboard
        if (useAuthStore.getState().isAuthenticated) {
            throw redirect({
                to: '/dashboard',
            });
        }
    },
    component: AuthLayout,
});

function AuthLayout() {
    return (
        <div className="min-h-screen bg-surface flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-text">
                    ERP
                </h2>
            </div>
            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-surface-raised py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-border">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}

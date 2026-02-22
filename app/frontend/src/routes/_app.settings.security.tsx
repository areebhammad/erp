import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { getSessionsApi, revokeSessionApi, revokeAllSessionsApi } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth';

export const Route = createFileRoute('/_app/settings/security')({
    component: SecuritySettingsPage,
});

function SecuritySettingsPage() {
    const queryClient = useQueryClient();
    const sessionId = useAuthStore((s) => s.sessionId);

    const { data: sessions, isLoading, isError } = useQuery({
        queryKey: ['auth', 'sessions'],
        queryFn: getSessionsApi,
    });

    const revokeMutation = useMutation({
        mutationFn: (id: string) => revokeSessionApi(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
        },
    });

    const revokeAllMutation = useMutation({
        mutationFn: () => revokeAllSessionsApi(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
        },
    });

    const handleRevoke = (id: string) => {
        if (window.confirm('Are you sure you want to revoke this session?')) {
            revokeMutation.mutate(id);
        }
    };

    const handleRevokeAll = () => {
        if (window.confirm('Are you sure you want to sign out all other devices?')) {
            revokeAllMutation.mutate();
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8 w-full">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-text">Security Settings</h1>
                <p className="text-text-subtle text-sm">Manage your account security and active sessions.</p>
            </div>

            <div className="bg-surface-raised shadow-sm border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-border">
                    <div>
                        <h3 className="text-lg leading-6 font-medium text-text">Active Sessions</h3>
                        <p className="max-w-2xl text-sm text-text-subtle mt-1">
                            These are the devices that have logged into your account. Revoke any sessions that you do not recognize.
                        </p>
                    </div>
                    <button
                        onClick={handleRevokeAll}
                        disabled={revokeAllMutation.isPending || (sessions && sessions.length <= 1)}
                        className="py-2 px-4 border border-border rounded-md shadow-sm text-sm font-medium text-error bg-surface hover:bg-error/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-error disabled:opacity-50 transition-colors"
                    >
                        {revokeAllMutation.isPending ? 'Signing out...' : 'Sign out all other devices'}
                    </button>
                </div>

                <div className="divide-y divide-border">
                    {isLoading && <div className="p-4 text-center text-text-subtle">Loading sessions...</div>}
                    {isError && <div className="p-4 text-center text-error">Failed to load sessions</div>}

                    {sessions && sessions.map((session: any) => (
                        <div key={session.id} className="p-4 sm:px-6 flex items-center justify-between">
                            <div className="flex items-start gap-4">
                                <div className="mt-1 p-2 bg-surface-overlay border border-border rounded-md">
                                    {session.device_type === 'mobile' ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-subtle"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-subtle"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-text">
                                            {session.device_name || 'Unknown Device'} • {session.browser || 'Unknown Browser'}
                                        </p>
                                        {session.id === sessionId && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success border border-success/20">
                                                Current
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-text-subtle mt-1 flex gap-3">
                                        <span>{session.ip_address} ({session.ip_geo || 'Unknown Location'})</span>
                                        <span>Last active: {new Date(session.last_active_at).toLocaleString()}</span>
                                    </p>
                                </div>
                            </div>

                            {session.id !== sessionId && (
                                <button
                                    onClick={() => handleRevoke(session.id)}
                                    disabled={revokeMutation.isPending}
                                    className="text-sm text-error hover:underline disabled:opacity-50"
                                >
                                    Revoke
                                </button>
                            )}
                        </div>
                    ))}

                    {sessions && sessions.length === 0 && (
                        <div className="p-8 text-center text-text-subtle">
                            No active sessions found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

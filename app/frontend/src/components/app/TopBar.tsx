import { useUIStore } from '@/store/ui';

export function TopBar() {
    const { connectionStatus } = useUIStore();

    const statusColor = {
        connected: 'bg-green-500',
        connecting: 'bg-amber-500',
        disconnected: 'bg-red-500',
    }[connectionStatus];

    return (
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
            <div className="flex flex-1 items-center justify-end space-x-4">
                <div className="flex items-center space-x-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${statusColor}`} title={connectionStatus} />
                    <span className="text-sm text-muted-foreground capitalize">{connectionStatus}</span>
                </div>
            </div>
        </header>
    );
}

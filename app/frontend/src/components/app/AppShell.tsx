import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useUIStore } from '@/store/ui';
import { TopBar } from './TopBar';

export function AppShell({ children }: { children: ReactNode }) {
    const { connectionStatus } = useUIStore();
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        if (connectionStatus === 'disconnected') {
            timeoutId = setTimeout(() => setShowBanner(true), 30000); // 30s
        } else {
            setShowBanner(false);
        }
        return () => clearTimeout(timeoutId);
    }, [connectionStatus]);

    return (
        <div className="flex flex-col min-h-screen flex-1">
            {showBanner && (
                <div className="bg-destructive text-destructive-foreground px-4 py-2 text-center text-sm font-medium">
                    Unable to reach server. Retrying...
                </div>
            )}
            <TopBar />
            <main className="flex flex-1 flex-col overflow-y-auto">
                {children}
            </main>
        </div>
    );
}

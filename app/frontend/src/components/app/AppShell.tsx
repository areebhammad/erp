/**
 * App Shell Component
 *
 * Main layout component with CSS Grid for sidebar + topbar + main content.
 * Provides the structural foundation for the authenticated app.
 */

import type { ReactNode } from "react";
import { useSidebarCollapsed } from "@/store";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
	children: ReactNode;
}

export function AppShell({ children }: AppShellProps): ReactNode {
	const sidebarCollapsed = useSidebarCollapsed();

	return (
		<div className="app-shell grid min-h-screen w-full">
			{/* Sidebar */}
			<aside
				className="fixed left-0 top-0 z-[var(--z-fixed)] h-screen transition-all duration-300"
				style={{
					width: sidebarCollapsed ? "4rem" : "16rem",
				}}
			>
				<Sidebar />
			</aside>

			{/* Main content area */}
			<div
				className="flex flex-col transition-all duration-300"
				style={{
					marginLeft: sidebarCollapsed ? "4rem" : "16rem",
				}}
			>
				{/* Top bar */}
				<header className="sticky top-0 z-[var(--z-sticky)] h-14 border-b border-border bg-background">
					<TopBar />
				</header>

				{/* Main content */}
				<main className="flex-1 overflow-auto p-6">{children}</main>
			</div>
		</div>
	);
}

/**
 * Sidebar Component
 *
 * Navigation sidebar with:
 * - Collapsible mode
 * - Permission-based item filtering
 * - Active link detection
 * - Keyboard navigation
 */

import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { usePermissionsStore, useSidebarCollapsed, useUIStore } from "@/store";

/**
 * Navigation item configuration
 */
interface NavItem {
	title: string;
	href: string;
	icon?: ReactNode;
	permission?: { resource: string; action: string };
}

/**
 * Navigation group configuration
 */
interface NavGroup {
	title: string;
	items: NavItem[];
}

/**
 * Default navigation configuration
 * This will be extended as modules are implemented
 */
const navigation: NavGroup[] = [
	{
		title: "Overview",
		items: [
			{
				title: "Dashboard",
				href: "/dashboard",
				// Icon would be added here
			},
		],
	},
	{
		title: "Modules",
		items: [
			{
				title: "Accounts",
				href: "/accounts",
				permission: { resource: "accounts", action: "read" },
			},
			{
				title: "Inventory",
				href: "/inventory",
				permission: { resource: "inventory", action: "read" },
			},
			{
				title: "Reports",
				href: "/reports",
				permission: { resource: "reports", action: "read" },
			},
		],
	},
	{
		title: "Settings",
		items: [
			{
				title: "Settings",
				href: "/settings",
			},
		],
	},
];

/**
 * Sidebar navigation item component
 */
function SidebarNavItem({ item }: { item: NavItem }): ReactNode {
	const routerState = useRouterState();
	const currentPath = routerState.location.pathname;
	const isActive =
		currentPath === item.href || currentPath.startsWith(`${item.href}/`);
	const collapsed = useSidebarCollapsed();

	return (
		<Link
			to={item.href}
			className={`
				flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium
				transition-colors duration-200
				${
					isActive
						? "bg-primary text-primary-foreground"
						: "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
				}
				${collapsed ? "justify-center" : ""}
			`}
			aria-current={isActive ? "page" : undefined}
		>
			{item.icon && <span className="flex-shrink-0">{item.icon}</span>}
			{!collapsed && <span>{item.title}</span>}
		</Link>
	);
}

/**
 * Sidebar navigation group component
 */
function SidebarNavGroup({ group }: { group: NavGroup }): ReactNode {
	const collapsed = useSidebarCollapsed();
	const can = usePermissionsStore((state) => state.can);

	// Filter items by permission
	const visibleItems = group.items.filter((item) => {
		if (!item.permission) return true;
		return can(item.permission.resource, item.permission.action);
	});

	if (visibleItems.length === 0) return null;

	return (
		<div className="space-y-1">
			{!collapsed && (
				<h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					{group.title}
				</h3>
			)}
			{visibleItems.map((item) => (
				<SidebarNavItem key={item.href} item={item} />
			))}
		</div>
	);
}

/**
 * Sidebar component
 */
export function Sidebar(): ReactNode {
	const collapsed = useSidebarCollapsed();
	const toggleSidebar = useUIStore((state) => state.toggleSidebar);

	return (
		<div
			className={`
				flex h-full flex-col border-r border-border bg-sidebar
				${collapsed ? "w-16" : "w-64"}
			`}
		>
			{/* Logo / Brand */}
			<div className="flex h-14 items-center justify-between border-b border-border px-4">
				{!collapsed && (
					<span className="text-lg font-semibold text-sidebar-foreground">
						ERP
					</span>
				)}
				<button
					type="button"
					onClick={toggleSidebar}
					className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent"
					aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
				>
					{collapsed ? "→" : "←"}
				</button>
			</div>

			{/* Navigation */}
			<nav
				className="flex-1 overflow-y-auto p-3 space-y-6"
				aria-label="Main navigation"
			>
				{navigation.map((group) => (
					<SidebarNavGroup key={group.title} group={group} />
				))}
			</nav>

			{/* Footer */}
			<div className="border-t border-border p-3">
				{!collapsed && (
					<span className="text-xs text-muted-foreground">
						© 2024 ERP System
					</span>
				)}
			</div>
		</div>
	);
}

/**
 * Command Palette Component
 *
 * A keyboard-driven command palette (⌘K / Ctrl+K) for quick navigation
 * and actions. Uses cmdk library for fuzzy search and keyboard navigation.
 */

import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { Home, LogOut, Moon, Search, Sun } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { usePermissionsStore } from "@/store/permissions";
import { useUIStore } from "@/store/ui";

interface CommandItem {
	id: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	action: () => void;
	keywords?: string[];
	permission?: { resource: string; action: string };
	group: "navigation" | "actions" | "settings";
}

interface CommandPaletteProps {
	/** Whether the palette is open */
	open: boolean;
	/** Callback when open state changes */
	onOpenChange: (open: boolean) => void;
}

/**
 * Command Palette with fuzzy search and keyboard navigation
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
	const navigate = useNavigate();
	const { clearAuth } = useAuthStore();
	const { can } = usePermissionsStore();
	const [search, setSearch] = useState("");

	const colorMode = useUIStore((state) => state.colorMode);
	const setColorMode = useUIStore((state) => state.setColorMode);

	// Define all available commands
	// Note: Routes will be added as they are implemented
	const commands: CommandItem[] = useMemo(
		() => [
			// Navigation
			{
				id: "nav-home",
				label: "Go to Dashboard",
				icon: Home,
				action: () => navigate({ to: "/" }),
				keywords: ["home", "dashboard", "main"],
				group: "navigation",
			},
			// TODO: Uncomment these routes when they are implemented
			// {
			//     id: 'nav-customers',
			//     label: 'Go to Customers',
			//     icon: Users,
			//     action: () => navigate({ to: '/customers' }),
			//     keywords: ['customers', 'clients', 'contacts'],
			//     permission: { resource: 'customers', action: 'read' },
			//     group: 'navigation',
			// },
			// {
			//     id: 'nav-products',
			//     label: 'Go to Products',
			//     icon: Package,
			//     action: () => navigate({ to: '/products' }),
			//     keywords: ['products', 'items', 'catalog'],
			//     permission: { resource: 'products', action: 'read' },
			//     group: 'navigation',
			// },
			// {
			//     id: 'nav-orders',
			//     label: 'Go to Orders',
			//     icon: ShoppingCart,
			//     action: () => navigate({ to: '/orders' }),
			//     keywords: ['orders', 'sales', 'transactions'],
			//     permission: { resource: 'orders', action: 'read' },
			//     group: 'navigation',
			// },
			// {
			//     id: 'nav-invoices',
			//     label: 'Go to Invoices',
			//     icon: FileText,
			//     action: () => navigate({ to: '/invoices' }),
			//     keywords: ['invoices', 'billing', 'payments'],
			//     permission: { resource: 'invoices', action: 'read' },
			//     group: 'navigation',
			// },
			// {
			//     id: 'nav-inventory',
			//     label: 'Go to Inventory',
			//     icon: Warehouse,
			//     action: () => navigate({ to: '/inventory' }),
			//     keywords: ['inventory', 'stock', 'warehouse'],
			//     permission: { resource: 'inventory', action: 'read' },
			//     group: 'navigation',
			// },
			// {
			//     id: 'nav-reports',
			//     label: 'Go to Reports',
			//     icon: BarChart3,
			//     action: () => navigate({ to: '/reports' }),
			//     keywords: ['reports', 'analytics', 'insights'],
			//     permission: { resource: 'reports', action: 'read' },
			//     group: 'navigation',
			// },
			// {
			//     id: 'nav-company',
			//     label: 'Go to Company Settings',
			//     icon: Building2,
			//     action: () => navigate({ to: '/settings/company' }),
			//     keywords: ['company', 'organization', 'business'],
			//     permission: { resource: 'settings', action: 'read' },
			//     group: 'navigation',
			// },
			// {
			//     id: 'nav-billing',
			//     label: 'Go to Billing',
			//     icon: CreditCard,
			//     action: () => navigate({ to: '/settings/billing' }),
			//     keywords: ['billing', 'subscription', 'plan'],
			//     permission: { resource: 'billing', action: 'read' },
			//     group: 'navigation',
			// },
			// // Actions
			// {
			//     id: 'action-new-customer',
			//     label: 'Create New Customer',
			//     icon: Users,
			//     action: () => navigate({ to: '/customers/new' }),
			//     keywords: ['new', 'create', 'add', 'customer'],
			//     permission: { resource: 'customers', action: 'create' },
			//     group: 'actions',
			// },
			// {
			//     id: 'action-new-order',
			//     label: 'Create New Order',
			//     icon: ShoppingCart,
			//     action: () => navigate({ to: '/orders/new' }),
			//     keywords: ['new', 'create', 'add', 'order', 'sale'],
			//     permission: { resource: 'orders', action: 'create' },
			//     group: 'actions',
			// },
			// {
			//     id: 'action-new-invoice',
			//     label: 'Create New Invoice',
			//     icon: FileText,
			//     action: () => navigate({ to: '/invoices/new' }),
			//     keywords: ['new', 'create', 'add', 'invoice', 'bill'],
			//     permission: { resource: 'invoices', action: 'create' },
			//     group: 'actions',
			// },
			// Settings
			{
				id: "settings-theme-toggle",
				label:
					colorMode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
				icon: colorMode === "dark" ? Sun : Moon,
				action: () => setColorMode(colorMode === "dark" ? "light" : "dark"),
				keywords: ["theme", "dark", "light", "mode", "appearance"],
				group: "settings",
			},
			// TODO: Uncomment when settings route is implemented
			// {
			//     id: 'settings-preferences',
			//     label: 'Open Settings',
			//     icon: Settings,
			//     action: () => navigate({ to: '/settings' }),
			//     keywords: ['settings', 'preferences', 'options'],
			//     group: 'settings',
			// },
			{
				id: "settings-logout",
				label: "Sign Out",
				icon: LogOut,
				action: () => {
					clearAuth();
					navigate({ to: "/login" });
				},
				keywords: ["logout", "sign out", "exit"],
				group: "settings",
			},
		],
		[clearAuth, colorMode, navigate, setColorMode],
	);

	// Filter commands based on permissions
	const filteredCommands = commands.filter((cmd) => {
		if (!cmd.permission) return true;
		return can(cmd.permission.resource, cmd.permission.action);
	});

	// Group commands
	const navigationCommands = filteredCommands.filter(
		(c) => c.group === "navigation",
	);
	const actionCommands = filteredCommands.filter((c) => c.group === "actions");
	const settingsCommands = filteredCommands.filter(
		(c) => c.group === "settings",
	);

	// Handle command selection
	const handleSelect = useCallback(
		(commandId: string) => {
			const command = commands.find((c) => c.id === commandId);
			if (command) {
				command.action();
				onOpenChange(false);
				setSearch("");
			}
		},
		[commands, onOpenChange],
	);

	// Reset search when closing
	useEffect(() => {
		if (!open) {
			setSearch("");
		}
	}, [open]);

	return (
		<Command.Dialog
			open={open}
			onOpenChange={onOpenChange}
			label="Command Palette"
			className="fixed inset-0 z-50"
		>
			{/* Backdrop */}
			<div
				className="fixed inset-0 bg-black/50 backdrop-blur-sm"
				aria-hidden="true"
			/>

			{/* Dialog */}
			<div className="fixed left-1/2 top-1/4 w-full max-w-lg -translate-x-1/2 rounded-xl border border-border bg-popover shadow-2xl">
				{/* Search Input */}
				<div className="flex items-center border-b border-border px-3">
					<Search className="h-4 w-4 text-muted-foreground" />
					<Command.Input
						value={search}
						onValueChange={setSearch}
						placeholder="Type a command or search..."
						className="flex-1 bg-transparent px-3 py-4 text-sm outline-none placeholder:text-muted-foreground"
					/>
					<kbd className="hidden rounded bg-muted px-2 py-1 text-xs text-muted-foreground sm:inline-block">
						ESC
					</kbd>
				</div>

				{/* Command List */}
				<Command.List className="max-h-80 overflow-y-auto p-2">
					<Command.Empty className="py-6 text-center text-sm text-muted-foreground">
						No results found.
					</Command.Empty>

					{/* Navigation Group */}
					{navigationCommands.length > 0 && (
						<Command.Group
							heading="Navigation"
							className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
						>
							{navigationCommands.map((cmd) => (
								<Command.Item
									key={cmd.id}
									value={cmd.id}
									keywords={cmd.keywords}
									onSelect={handleSelect}
									className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
								>
									<cmd.icon className="h-4 w-4" />
									<span>{cmd.label}</span>
								</Command.Item>
							))}
						</Command.Group>
					)}

					{/* Actions Group */}
					{actionCommands.length > 0 && (
						<Command.Group
							heading="Quick Actions"
							className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
						>
							{actionCommands.map((cmd) => (
								<Command.Item
									key={cmd.id}
									value={cmd.id}
									keywords={cmd.keywords}
									onSelect={handleSelect}
									className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
								>
									<cmd.icon className="h-4 w-4" />
									<span>{cmd.label}</span>
								</Command.Item>
							))}
						</Command.Group>
					)}

					{/* Settings Group */}
					{settingsCommands.length > 0 && (
						<Command.Group
							heading="Settings"
							className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
						>
							{settingsCommands.map((cmd) => (
								<Command.Item
									key={cmd.id}
									value={cmd.id}
									keywords={cmd.keywords}
									onSelect={handleSelect}
									className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
								>
									<cmd.icon className="h-4 w-4" />
									<span>{cmd.label}</span>
								</Command.Item>
							))}
						</Command.Group>
					)}
				</Command.List>

				{/* Footer */}
				<div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
					<div className="flex items-center gap-2">
						<kbd className="rounded bg-muted px-1.5 py-0.5">↑↓</kbd>
						<span>Navigate</span>
					</div>
					<div className="flex items-center gap-2">
						<kbd className="rounded bg-muted px-1.5 py-0.5">↵</kbd>
						<span>Select</span>
					</div>
					<div className="flex items-center gap-2">
						<kbd className="rounded bg-muted px-1.5 py-0.5">ESC</kbd>
						<span>Close</span>
					</div>
				</div>
			</div>
		</Command.Dialog>
	);
}

/**
 * Hook to manage command palette state with keyboard shortcut
 */
export function useCommandPalette() {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// ⌘K on Mac, Ctrl+K on Windows/Linux
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setOpen((prev) => !prev);
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	return { open, setOpen };
}

export default CommandPalette;

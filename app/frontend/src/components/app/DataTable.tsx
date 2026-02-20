/**
 * DataTable Component
 *
 * A flexible data table with sorting, pagination, row selection,
 * and loading states. Built on TanStack Table.
 */

import {
	type ColumnDef,
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type RowSelectionState,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	ChevronsUpDown,
	ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> {
	/** Column definitions */
	columns: ColumnDef<TData, unknown>[];
	/** Data array */
	data: TData[];
	/** Loading state */
	loading?: boolean;
	/** Enable row selection */
	enableRowSelection?: boolean;
	/** Callback when selection changes */
	onSelectionChange?: (selectedRows: TData[]) => void;
	/** Enable pagination */
	enablePagination?: boolean;
	/** Page size options */
	pageSizeOptions?: number[];
	/** Default page size */
	defaultPageSize?: number;
	/** Additional CSS classes */
	className?: string;
	/** Empty state message */
	emptyMessage?: string;
	/** Number of skeleton rows to show when loading */
	skeletonRows?: number;
}

/**
 * Skeleton row for loading state
 */
function SkeletonRow({ columnCount }: { columnCount: number }) {
	return (
		<tr className="border-b border-border">
			{Array.from({ length: columnCount }).map((_, i) => (
				<td key={i} className="px-4 py-3">
					<div className="h-4 w-full animate-pulse rounded bg-muted" />
				</td>
			))}
		</tr>
	);
}

/**
 * DataTable component with sorting, pagination, and selection
 */
export function DataTable<TData>({
	columns,
	data,
	loading = false,
	enableRowSelection = false,
	onSelectionChange,
	enablePagination = true,
	pageSizeOptions = [10, 20, 50, 100],
	defaultPageSize = 10,
	className,
	emptyMessage = "No data available",
	skeletonRows = 5,
}: DataTableProps<TData>) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

	const table = useReactTable({
		data,
		columns,
		state: {
			sorting,
			rowSelection,
			columnFilters,
		},
		enableRowSelection,
		onSortingChange: setSorting,
		onRowSelectionChange: (updater) => {
			const newSelection =
				typeof updater === "function" ? updater(rowSelection) : updater;
			setRowSelection(newSelection);

			if (onSelectionChange) {
				const selectedRows = Object.keys(newSelection)
					.filter((key) => newSelection[key])
					.map((key) => data[parseInt(key, 10)]);
				onSelectionChange(selectedRows);
			}
		},
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: enablePagination
			? getPaginationRowModel()
			: undefined,
		getFilteredRowModel: getFilteredRowModel(),
		initialState: {
			pagination: {
				pageSize: defaultPageSize,
			},
		},
	});

	const headerGroups = table.getHeaderGroups();
	const rows = table.getRowModel().rows;

	return (
		<div className={cn("w-full", className)}>
			{/* Table */}
			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full border-collapse text-sm">
					<thead className="bg-muted/50">
						{headerGroups.map((headerGroup) => (
							<tr key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									const canSort = header.column.getCanSort();
									const sortDirection = header.column.getIsSorted();

									return (
										<th
											key={header.id}
											className={cn(
												"px-4 py-3 text-left font-medium text-muted-foreground",
												canSort &&
													"cursor-pointer select-none hover:text-foreground",
											)}
											onClick={
												canSort
													? header.column.getToggleSortingHandler()
													: undefined
											}
										>
											<div className="flex items-center gap-2">
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
												{canSort && (
													<span className="text-muted-foreground">
														{sortDirection === "asc" ? (
															<ChevronUp className="h-4 w-4" />
														) : sortDirection === "desc" ? (
															<ChevronDown className="h-4 w-4" />
														) : (
															<ChevronsUpDown className="h-4 w-4 opacity-50" />
														)}
													</span>
												)}
											</div>
										</th>
									);
								})}
							</tr>
						))}
					</thead>
					<tbody>
						{loading ? (
							// Loading skeleton
							Array.from({ length: skeletonRows }).map((_, i) => (
								<SkeletonRow key={i} columnCount={columns.length} />
							))
						) : rows.length === 0 ? (
							// Empty state
							<tr>
								<td
									colSpan={columns.length}
									className="px-4 py-12 text-center text-muted-foreground"
								>
									{emptyMessage}
								</td>
							</tr>
						) : (
							// Data rows
							rows.map((row) => (
								<tr
									key={row.id}
									className={cn(
										"border-b border-border transition-colors hover:bg-muted/50",
										row.getIsSelected() && "bg-primary/5",
									)}
								>
									{row.getVisibleCells().map((cell) => (
										<td key={cell.id} className="px-4 py-3">
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</td>
									))}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{/* Pagination */}
			{enablePagination && !loading && data.length > 0 && (
				<div className="mt-4 flex items-center justify-between">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<span>Rows per page:</span>
						<select
							value={table.getState().pagination.pageSize}
							onChange={(e) => table.setPageSize(Number(e.target.value))}
							className="rounded border border-border bg-background px-2 py-1"
						>
							{pageSizeOptions.map((size) => (
								<option key={size} value={size}>
									{size}
								</option>
							))}
						</select>
						<span className="ml-4">
							{table.getState().pagination.pageIndex *
								table.getState().pagination.pageSize +
								1}
							-
							{Math.min(
								(table.getState().pagination.pageIndex + 1) *
									table.getState().pagination.pageSize,
								data.length,
							)}{" "}
							of {data.length}
						</span>
					</div>

					<div className="flex items-center gap-1">
						<Button
							variant="outline"
							size="sm"
							onClick={() => table.setPageIndex(0)}
							disabled={!table.getCanPreviousPage()}
						>
							<ChevronsLeft className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => table.previousPage()}
							disabled={!table.getCanPreviousPage()}
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<span className="px-2 text-sm">
							Page {table.getState().pagination.pageIndex + 1} of{" "}
							{table.getPageCount()}
						</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() => table.nextPage()}
							disabled={!table.getCanNextPage()}
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => table.setPageIndex(table.getPageCount() - 1)}
							disabled={!table.getCanNextPage()}
						>
							<ChevronsRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
			)}

			{/* Selection info */}
			{enableRowSelection && Object.keys(rowSelection).length > 0 && (
				<div className="mt-2 text-sm text-muted-foreground">
					{Object.keys(rowSelection).filter((k) => rowSelection[k]).length} of{" "}
					{data.length} row(s) selected
				</div>
			)}
		</div>
	);
}

export default DataTable;

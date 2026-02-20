import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Create a singleton query client
let queryClient: QueryClient | null = null;

function getQueryClient(): QueryClient {
	if (!queryClient) {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: {
					staleTime: 1000 * 60 * 5, // 5 minutes
					gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
					retry: (failureCount, error) => {
						// Don't retry on 4xx errors
						if (error instanceof Error && "status" in error) {
							const status = (error as { status: number }).status;
							if (status >= 400 && status < 500) {
								return false;
							}
						}
						return failureCount < 3;
					},
					refetchOnWindowFocus: true,
					refetchOnReconnect: true,
				},
				mutations: {
					retry: false,
				},
			},
		});
	}
	return queryClient;
}

export function getContext() {
	const queryClient = getQueryClient();
	return {
		queryClient,
	};
}

interface TanStackQueryProviderProps {
	children: ReactNode;
}

export function TanStackQueryProvider({
	children,
}: TanStackQueryProviderProps) {
	const client = getQueryClient();
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export default TanStackQueryProvider;

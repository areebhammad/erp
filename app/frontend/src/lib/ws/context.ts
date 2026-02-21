import { createContext, useContext } from 'react';
import type { WSClient } from './client';

export const WSContext = createContext<WSClient | null>(null);

export function useWSClient() {
    const context = useContext(WSContext);
    if (!context) {
        throw new Error('useWSClient must be used within a WSContext.Provider');
    }
    return context;
}

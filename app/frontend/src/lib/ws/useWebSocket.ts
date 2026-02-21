import { useEffect } from 'react';
import { useWSClient } from './context';
import type { WSEvent } from './events';

export function useWebSocket<T extends WSEvent['type']>(
  type: T,
  callback: (event: Extract<WSEvent, { type: T }>) => void
) {
  const client = useWSClient();

  useEffect(() => {
    const handler = (event: WSEvent) => {
      if (event.type === type) {
        callback(event as Extract<WSEvent, { type: T }>);
      }
    };

    const unsubscribe = client.subscribe(handler);
    return () => {
      unsubscribe();
    };
  }, [client, type, callback]);
}

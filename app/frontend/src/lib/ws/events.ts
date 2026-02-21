export type Notification = any;

export type WSEvent =
  | { type: 'notification'; payload: Notification }
  | {
      type: 'data_changed';
      module: string;
      resource: string;
      tenant_id: string;
    }
  | { type: 'session_invalidated' }
  | { type: 'ping' };

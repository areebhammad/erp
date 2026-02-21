// Note: we might implement a real request-id context later, for now we just use a global or fallback
let currentRequestId: string | null = null;

export function setCurrentRequestId(id: string | null) {
  currentRequestId = id;
}

export function getCurrentRequestId(): string | null {
  return currentRequestId;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function createLogger(module: string) {
  const isProduction = import.meta.env.PROD;

  const log = (level: LogLevel, ...args: any[]) => {
    if (isProduction && (level === 'debug' || level === 'info')) {
      return;
    }

    const timestamp = new Date().toISOString();
    const requestId = getCurrentRequestId();
    const reqStr = requestId ? ` [Req: ${requestId}]` : '';
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${module}]${reqStr}:`;

    switch (level) {
      case 'debug':
        console.debug(prefix, ...args);
        break;
      case 'info':
        console.info(prefix, ...args);
        break;
      case 'warn':
        console.warn(prefix, ...args);
        break;
      case 'error':
        console.error(prefix, ...args);
        break;
    }
  };

  return {
    debug: (...args: any[]) => log('debug', ...args),
    info: (...args: any[]) => log('info', ...args),
    warn: (...args: any[]) => log('warn', ...args),
    error: (...args: any[]) => log('error', ...args),
  };
}

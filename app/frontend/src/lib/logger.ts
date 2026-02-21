export const createLogger = (module: string) => ({
  debug: (...args: Array<any>) => {
    if (import.meta.env.DEV) console.debug(`[${module}]`, ...args);
  },
  info: (...args: Array<any>) => {
    if (import.meta.env.DEV) console.info(`[${module}]`, ...args);
  },
  warn: (...args: Array<any>) => console.warn(`[${module}]`, ...args),
  error: (...args: Array<any>) => console.error(`[${module}]`, ...args),
});

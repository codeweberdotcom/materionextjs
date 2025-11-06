import { format } from 'winston';
import { LogMetadata } from '../types';

export const jsonFormatter = format.combine(
  format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  format.errors({ stack: true }),
  format.json(),
  format.printf(({ timestamp, level, message, module, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      module,
      message,
      ...(Object.keys(meta).length > 0 && { metadata: meta }),
    };
    return JSON.stringify(logEntry);
  })
);

export const consoleFormatter = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.colorize(),
  format.printf(({ timestamp, level, module, message, ...meta }) => {
    const moduleStr = module ? `[${String(module).toUpperCase()}]` : '';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${moduleStr} ${message}${metaStr}`;
  })
);
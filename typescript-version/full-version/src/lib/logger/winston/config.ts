import path from 'path';
import { LogLevel } from '../types';

export const LOG_CONFIG = {
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  dir: process.env.LOG_DIR || path.join(process.cwd(), 'logs'),
  maxSize: process.env.LOG_MAX_SIZE || '10m',
  maxFiles: process.env.LOG_MAX_FILES || '5',
  isDevelopment: process.env.NODE_ENV !== 'production',
};

export const LOG_MODULES = {
  socket: 'socket.log',
  auth: 'auth.log',
  notifications: 'notifications.log',
  rateLimit: 'rate-limit.log',
  database: 'database.log',
  app: 'app.log',
} as const;

export type LogModule = keyof typeof LOG_MODULES;

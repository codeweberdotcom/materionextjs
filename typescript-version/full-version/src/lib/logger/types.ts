export interface LogMetadata {
  userId?: string;
  socketId?: string;
  ip?: string;
  userAgent?: string;
  roomId?: string;
  event?: string;
  error?: string;
  duration?: number;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  module: string;
  message: string;
  metadata?: LogMetadata;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

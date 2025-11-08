// Re-export Winston loggers for backward compatibility
export {
  socketLogger,
  authLogger,
  rateLimitLogger,
  databaseLogger,
  notificationsLogger,
  default as logger
} from './winston';

// Legacy logger interface for backward compatibility
import logger from './winston';

export default logger;

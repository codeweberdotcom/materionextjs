// Legacy exports for backward compatibility
// All functionality has been migrated to the new service-oriented architecture

export type {
  RateLimitConfig,
  RateLimitResult,
  RateLimitCheckOptions,
  RateLimitStats,
  ListRateLimitStatesParams,
  RateLimitStateAdminEntry,
  RateLimitStateListResult,
  RateLimitEventAdminEntry,
  ListRateLimitEventsParams,
  RateLimitEventListResult
} from './rate-limit/types'

// New service-oriented architecture exports
export { rateLimitContainer } from './rate-limit/di/container'
export { RateLimitContainer } from './rate-limit/di/container'

// Legacy export for backward compatibility - now delegates to new architecture
import { rateLimitContainer } from './rate-limit/di/container'
export const rateLimitService = rateLimitContainer.getRateLimitEngine()

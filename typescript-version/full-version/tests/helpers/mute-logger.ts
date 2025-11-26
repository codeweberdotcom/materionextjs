import { vi } from 'vitest'

// Silence logger output during tests
try {
  const logger = (await import('@/lib/logger')).default as any
  for (const level of ['info', 'warn', 'error', 'debug']) {
    if (typeof logger[level] === 'function') {
      vi.spyOn(logger, level as keyof typeof logger).mockImplementation(() => {})
    }
  }
} catch (error) {
  // If logger cannot be imported, ignore
}

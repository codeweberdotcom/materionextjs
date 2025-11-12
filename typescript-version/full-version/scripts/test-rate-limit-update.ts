import { rateLimitService } from '@/lib/rate-limit'

async function main() {
  try {
    await rateLimitService.updateConfig('chat', {
      maxRequests: 10,
      windowMs: 60_000,
      blockMs: 900_000,
      warnThreshold: 0
    })

    console.log('Update succeeded')
  } catch (error) {
    console.error('Update failed:', error)
  }
}

main()
  .catch(error => {
    console.error('Script failed:', error)
  })

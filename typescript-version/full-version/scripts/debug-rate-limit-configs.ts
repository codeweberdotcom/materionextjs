import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== RateLimitConfig ===')
  const configs = await prisma.rateLimitConfig.findMany({
    orderBy: { module: 'asc' }
  })
  configs.forEach(config => {
    console.log(`${config.module.padEnd(12)} max=${config.maxRequests} windowMs=${config.windowMs} blockMs=${config.blockMs} warn=${config.warnThreshold}`)
  })

  console.log('\n=== Recent RateLimitState entries ===')
  const states = await prisma.rateLimitState.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 10
  })

  states.forEach(state => {
    console.log(
      `${state.module} :: ${state.key} count=${state.count} windowStart=${state.windowStart.toISOString()} blockedUntil=${state.blockedUntil?.toISOString() ?? '-'}`
    )
  })
}

main()
  .catch(error => {
    console.error('Failed to inspect rate limit tables:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

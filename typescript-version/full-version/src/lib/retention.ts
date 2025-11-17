import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const getRetentionDays = () => {
  const days = Number.parseInt(process.env.RATE_LIMIT_EVENT_RETENTION_DAYS || '90', 10)
  return Number.isFinite(days) && days > 0 ? days : 90
}

export const runRateLimitEventCleanup = async () => {
  const retentionDays = getRetentionDays()
  const threshold = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  const toDelete = await prisma.rateLimitEvent.count({
    where: { createdAt: { lt: threshold } }
  })

  if (toDelete === 0) {
    return { deleted: 0, retentionDays, threshold, message: 'Nothing to delete' }
  }

  const result = await prisma.rateLimitEvent.deleteMany({
    where: { createdAt: { lt: threshold } }
  })

  return {
    deleted: result.count,
    retentionDays,
    threshold,
    message: `Deleted ${result.count} RateLimitEvent rows older than ${retentionDays} days`
  }
}

export const recordCronStatus = async (name: string, payload: { lastRunAt?: Date; lastSuccessAt?: Date; lastResult?: string; lastCount?: number }) => {
  await prisma.cronJobStatus.upsert({
    where: { name },
    update: {
      lastRunAt: payload.lastRunAt ?? new Date(),
      lastSuccessAt: payload.lastSuccessAt,
      lastResult: payload.lastResult,
      lastCount: payload.lastCount
    },
    create: {
      name,
      lastRunAt: payload.lastRunAt ?? new Date(),
      lastSuccessAt: payload.lastSuccessAt,
      lastResult: payload.lastResult,
      lastCount: payload.lastCount
    }
  })
}

export const getCronStatus = async (name: string) => {
  return prisma.cronJobStatus.findUnique({ where: { name } })
}

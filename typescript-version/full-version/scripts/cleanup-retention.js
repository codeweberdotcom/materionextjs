#!/usr/bin/env node
/**
 * Weekly retention cleanup for RateLimitEvent.
 * Runs a dry-run count, then deletes events older than RETENTION_DAYS (default 90).
 */
require('dotenv').config({ path: '.env' })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const days = Number.parseInt(process.env.RATE_LIMIT_EVENT_RETENTION_DAYS || '90', 10)
const retentionDays = Number.isFinite(days) && days > 0 ? days : 90
const threshold = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

const log = (...args) => console.log('[retention]', ...args)

async function main() {
  log(`Retention for RateLimitEvent: ${retentionDays} days (before ${threshold.toISOString()})`)

  const toDelete = await prisma.rateLimitEvent.count({
    where: { createdAt: { lt: threshold } }
  })
  log(`Dry-run: would delete ${toDelete} rows from RateLimitEvent`)

  if (toDelete === 0) {
    log('Nothing to delete, exiting.')
    return
  }

  const result = await prisma.rateLimitEvent.deleteMany({
    where: { createdAt: { lt: threshold } }
  })
  log(`Deleted rows: ${result.count}`)
}

main()
  .catch(error => {
    console.error('[retention] Error:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

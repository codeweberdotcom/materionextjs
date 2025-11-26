import { PrismaClient } from '@prisma/client'

// Metrics imports - only on server
let metricsModule: typeof import('@/lib/metrics/database') | null = null
if (typeof window === 'undefined') {
  // Dynamic import for server-only metrics
  metricsModule = require('@/lib/metrics/database')
}

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient
}

const createPrismaClient = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' }
        ] 
      : [{ emit: 'stdout', level: 'error' }]
  })

  // Add query metrics middleware (only on server)
  if (metricsModule) {
    const { startQueryTimer, trackConnectionError } = metricsModule
    
    client.$use(async (params, next) => {
      const model = params.model || 'unknown'
      const operation = params.action || 'unknown'
      const stopTimer = startQueryTimer(model, operation)
      
      try {
        const result = await next(params)
        
        // Count results for findMany operations
        let resultCount: number | undefined
        if (params.action === 'findMany' && Array.isArray(result)) {
          resultCount = result.length
        } else if (params.action === 'count' && typeof result === 'number') {
          resultCount = result
        }
        
        stopTimer('success', resultCount)
        return result
      } catch (error) {
        stopTimer('error')
        
        // Track specific error types
        if (error instanceof Error) {
          if (error.message.includes('connection')) {
            trackConnectionError('connection_failed')
          } else if (error.message.includes('timeout')) {
            trackConnectionError('timeout')
          }
        }
        
        throw error
      }
    })
  }

  // Log query events in development
  if (process.env.NODE_ENV === 'development') {
    client.$on('query' as never, (e: { query: string; params: string; duration: number }) => {
      // Query logging is handled by the middleware above
    })
  }

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Helper for transactions with metrics
export async function withTransaction<T>(
  fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  const startTime = Date.now()
  try {
    const result = await prisma.$transaction(fn)
    if (metricsModule) {
      metricsModule.trackTransaction('success', Date.now() - startTime)
    }
    return result
  } catch (error) {
    if (metricsModule) {
      metricsModule.trackTransaction('error', Date.now() - startTime)
    }
    throw error
  }
}

export type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

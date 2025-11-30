/**
 * API для проверки S3 bucket'а
 * POST - проверить доступность bucket'а
 */

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isSuperadmin } from '@/utils/permissions/permissions'
import { S3Adapter } from '@/services/media/storage/S3Adapter'
import { prisma } from '@/libs/prisma'
import { safeDecrypt } from '@/lib/config/encryption'
import logger from '@/lib/logger'

/**
 * Получить конфигурацию S3 из переменных окружения
 */
function getS3ConfigFromEnv() {
  const endpoint = process.env.S3_ENDPOINT
  const accessKeyId = process.env.S3_ACCESS_KEY || process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_KEY || process.env.S3_SECRET_ACCESS_KEY
  const region = process.env.S3_REGION || 'us-east-1'
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true'

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null
  }

  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    region,
    forcePathStyle,
  }
}

/**
 * Получить конфигурацию S3 из ServiceConfiguration по ID
 */
async function getS3ConfigFromService(serviceId: string) {
  const service = await prisma.serviceConfiguration.findUnique({
    where: { id: serviceId }
  })

  if (!service || service.type !== 'S3') {
    return null
  }

  if (!service.username || !service.password) {
    return null
  }

  const metadata = JSON.parse(service.metadata || '{}')
  const protocol = (service.protocol || 'https').replace(/:\/\/$/, '').replace(/:$/, '')

  return {
    endpoint: service.port 
      ? `${protocol}://${service.host}:${service.port}`
      : `${protocol}://${service.host}`,
    accessKeyId: service.username,
    secretAccessKey: safeDecrypt(service.password),
    region: metadata.region || 'us-east-1',
    forcePathStyle: metadata.forcePathStyle ?? true,
  }
}

/**
 * POST /api/admin/media/s3/buckets/validate
 * Проверить существование и доступность bucket'а
 * Body:
 *   - bucketName: имя bucket
 *   - serviceId: ID сервиса (опционально)
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { bucketName, serviceId } = body

    if (!bucketName || typeof bucketName !== 'string') {
      return NextResponse.json(
        { error: 'bucketName is required' },
        { status: 400 }
      )
    }

    let s3Config

    if (serviceId) {
      s3Config = await getS3ConfigFromService(serviceId)
      if (!s3Config) {
        return NextResponse.json({
          exists: false,
          accessible: false,
          error: 'S3 сервис не найден или не настроен',
        })
      }
    } else {
      s3Config = getS3ConfigFromEnv()
      if (!s3Config) {
        return NextResponse.json({
          exists: false,
          accessible: false,
          error: 'S3 не настроен',
        })
      }
    }

    try {
      const result = await S3Adapter.validateBucketStatic(s3Config, bucketName)

      logger.debug('[S3 Validate API] Bucket validation', {
        bucketName,
        serviceId,
        result,
      })

      return NextResponse.json(result)
    } catch (error: any) {
      logger.error('[S3 Validate API] Validation failed', {
        bucketName,
        serviceId,
        error: error.message,
      })

      return NextResponse.json({
        exists: false,
        accessible: false,
        error: error.message,
      })
    }
  } catch (error: any) {
    logger.error('[S3 Validate API] Error', { error: error.message })

    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    )
  }
}

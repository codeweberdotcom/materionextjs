/**
 * API для проверки S3 bucket'а
 * POST - проверить доступность bucket'а
 */

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isSuperadmin } from '@/utils/permissions/permissions'
import { S3Adapter } from '@/services/media/storage/S3Adapter'
import logger from '@/lib/logger'

/**
 * Получить конфигурацию S3 из переменных окружения
 */
function getS3Config() {
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
 * POST /api/admin/media/s3/buckets/validate
 * Проверить существование и доступность bucket'а
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
    const { bucketName } = body

    if (!bucketName || typeof bucketName !== 'string') {
      return NextResponse.json(
        { error: 'bucketName is required' },
        { status: 400 }
      )
    }

    const s3Config = getS3Config()

    if (!s3Config) {
      return NextResponse.json({
        exists: false,
        accessible: false,
        error: 'S3 не настроен',
      })
    }

    try {
      const result = await S3Adapter.validateBucketStatic(s3Config, bucketName)

      logger.debug('[S3 Validate API] Bucket validation', {
        bucketName,
        result,
      })

      return NextResponse.json(result)
    } catch (error: any) {
      logger.error('[S3 Validate API] Validation failed', {
        bucketName,
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


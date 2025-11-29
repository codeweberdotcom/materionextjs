/**
 * API для управления S3 bucket'ами
 * GET - список bucket'ов
 * POST - создать новый bucket
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
 * GET /api/admin/media/s3/buckets
 * Получить список всех bucket'ов
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    logger.debug('[S3 Buckets API] Auth check', {
      userId: user?.id,
      roleCode: user?.role?.code,
      roleId: user?.roleId,
      permissions: user?.role?.permissions,
    })

    if (!isSuperadmin(user)) {
      logger.warn('[S3 Buckets API] Access denied', {
        userId: user?.id,
        roleCode: user?.role?.code,
      })
      
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const s3Config = getS3Config()

    if (!s3Config) {
      return NextResponse.json({
        configured: false,
        buckets: [],
        error: 'S3 не настроен. Укажите S3_ENDPOINT, S3_ACCESS_KEY и S3_SECRET_KEY в .env',
      })
    }

    try {
      const buckets = await S3Adapter.listBucketsStatic(s3Config)

      return NextResponse.json({
        configured: true,
        buckets: buckets.map(b => ({
          name: b.name,
          creationDate: b.creationDate?.toISOString(),
        })),
      })
    } catch (error: any) {
      logger.error('[S3 Buckets API] Failed to list buckets', {
        error: error.message,
      })

      return NextResponse.json({
        configured: true,
        buckets: [],
        error: `Ошибка подключения к S3: ${error.message}`,
      })
    }
  } catch (error: any) {
    logger.error('[S3 Buckets API] Error', { error: error.message })

    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    )
  }
}

/**
 * POST /api/admin/media/s3/buckets
 * Создать новый bucket
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

    // Валидация имени bucket'а
    const bucketNameRegex = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/
    if (!bucketNameRegex.test(bucketName)) {
      return NextResponse.json(
        { 
          error: 'Некорректное имя bucket. Используйте строчные буквы, цифры, точки и дефисы. Длина 3-63 символа.' 
        },
        { status: 400 }
      )
    }

    const s3Config = getS3Config()

    if (!s3Config) {
      return NextResponse.json(
        { error: 'S3 не настроен. Укажите переменные окружения S3_*' },
        { status: 400 }
      )
    }

    try {
      await S3Adapter.createBucketStatic(s3Config, bucketName)

      logger.info('[S3 Buckets API] Bucket created', { bucketName })

      return NextResponse.json({
        success: true,
        bucketName,
        message: `Bucket "${bucketName}" успешно создан`,
      })
    } catch (error: any) {
      logger.error('[S3 Buckets API] Failed to create bucket', {
        bucketName,
        error: error.message,
      })

      return NextResponse.json(
        { error: `Ошибка создания bucket: ${error.message}` },
        { status: 500 }
      )
    }
  } catch (error: any) {
    logger.error('[S3 Buckets API] Error', { error: error.message })

    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    )
  }
}


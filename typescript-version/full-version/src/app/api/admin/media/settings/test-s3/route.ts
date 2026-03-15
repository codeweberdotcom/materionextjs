/**
 * API: Test S3 Connection
 * POST /api/admin/media/settings/test-s3 - Проверить подключение к S3
 *
 * @module app/api/admin/media/settings/test-s3
 */

import { NextResponse } from 'next/server'

import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { isSuperadmin } from '@/utils/permissions/permissions'
import logger from '@/lib/logger'

/**
 * POST /api/admin/media/settings/test-s3
 * Проверить подключение к S3
 */
export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const {
      bucket,
      region,
      endpoint,
      accessKeyId,
      secretAccessKey,
    } = body

    // Проверяем обязательные поля
    if (!bucket) {
      return NextResponse.json({ error: 'Bucket is required' }, { status: 400 })
    }

    // Используем переданные credentials или из ENV
    const credentials = {
      accessKeyId: accessKeyId || process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '',
    }

    if (!credentials.accessKeyId || !credentials.secretAccessKey) {
      return NextResponse.json({
        success: false,
        error: 'AWS credentials not configured',
        details: 'Provide accessKeyId and secretAccessKey or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables',
      })
    }

    // Создаём S3 клиент
    const s3Config: any = {
      region: region || process.env.AWS_REGION || 'us-east-1',
      credentials,
    }

    // Для MinIO/Yandex Object Storage
    if (endpoint) {
      s3Config.endpoint = endpoint
      s3Config.forcePathStyle = true
    }

    const s3Client = new S3Client(s3Config)

    // Проверяем доступ к бакету
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucket }))
    } catch (bucketError: any) {
      if (bucketError.name === 'NotFound' || bucketError.$metadata?.httpStatusCode === 404) {
        return NextResponse.json({
          success: false,
          error: `Bucket "${bucket}" not found`,
          details: 'Check if the bucket exists and you have access to it',
        })
      }

      if (bucketError.name === 'Forbidden' || bucketError.$metadata?.httpStatusCode === 403) {
        return NextResponse.json({
          success: false,
          error: 'Access denied to bucket',
          details: 'Check your IAM permissions for the bucket',
        })
      }

      throw bucketError
    }

    logger.info('[API] S3 connection test successful', {
      bucket,
      region: s3Config.region,
      endpoint: endpoint || 'AWS',
      testedBy: user.id,
    })

    return NextResponse.json({
      success: true,
      message: 'S3 подключение успешно',
      bucket,
      region: s3Config.region,
      endpoint: endpoint || 'AWS S3',
    })
  }
})

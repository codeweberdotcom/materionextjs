/**
 * Скрипт для включения и настройки MinIO S3
 * Запуск: npx tsx scripts/enable-minio.ts
 */

import { PrismaClient } from '@prisma/client'
import { encrypt, isEncryptionAvailable } from '../src/lib/config/encryption'

const prisma = new PrismaClient()

// Safe encrypt - возвращает plaintext если шифрование недоступно
function safeEncrypt(value: string): string {
  if (isEncryptionAvailable()) {
    return encrypt(value)
  }
  // Для локальной разработки без CREDENTIALS_ENCRYPTION_KEY
  return value
}

async function main() {
  console.log('🔧 Configuring MinIO S3...\n')

  // Находим конфигурацию MinIO
  const minioConfig = await prisma.serviceConfiguration.findFirst({
    where: {
      OR: [
        { name: 's3-minio' },
        { type: 'S3', host: 'localhost' },
      ],
    },
  })

  if (!minioConfig) {
    console.log('❌ MinIO configuration not found in database')
    console.log('   Run: pnpm db:seed to create seed data first')
    return
  }

  console.log(`📌 Found config: ${minioConfig.displayName} (${minioConfig.name})`)
  console.log(`   Current status: ${minioConfig.enabled ? 'ENABLED' : 'DISABLED'}`)

  // Обновляем конфигурацию
  const updatedConfig = await prisma.serviceConfiguration.update({
    where: { id: minioConfig.id },
    data: {
      enabled: true,
      status: 'UNKNOWN',
      host: 'localhost',
      port: 9000,
      protocol: 'http://',
      username: 'minioadmin',
      password: safeEncrypt('minioadmin123'),
      metadata: JSON.stringify({
        region: 'us-east-1',
        bucket: 'materio-bucket',
        storageType: 'minio',
        forcePathStyle: true,
      }),
    },
  })

  console.log('\n✅ MinIO configuration updated:')
  console.log(`   Host: ${updatedConfig.host}:${updatedConfig.port}`)
  console.log(`   Protocol: ${updatedConfig.protocol}`)
  console.log(`   Enabled: ${updatedConfig.enabled}`)
  console.log(`   Bucket: materio-bucket`)

  // Обновляем глобальные настройки медиа
  const globalSettings = await prisma.mediaGlobalSettings.findFirst()

  if (globalSettings) {
    await prisma.mediaGlobalSettings.update({
      where: { id: globalSettings.id },
      data: {
        s3DefaultBucket: 'materio-bucket',
        s3DefaultRegion: 'us-east-1',
        defaultStorageStrategy: 'local_first',
        autoSyncEnabled: true,
      },
    })
    console.log('\n✅ MediaGlobalSettings updated:')
    console.log('   s3DefaultBucket: materio-bucket')
    console.log('   autoSyncEnabled: true')
  }

  console.log('\n🎉 Done! You can now test S3 integration.')
  console.log('\n📝 Next steps:')
  console.log('   1. Open MinIO Console: http://localhost:9001')
  console.log('   2. Login: minioadmin / minioadmin123')
  console.log('   3. Create bucket: materio-bucket')
  console.log('   4. Test upload in Media Library')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())


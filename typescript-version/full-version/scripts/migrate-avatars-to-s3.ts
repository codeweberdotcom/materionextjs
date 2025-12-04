/**
 * Скрипт для миграции аватаров пользователей на S3 URLs
 * Обновляет поле user.image для всех пользователей, у которых есть avatarMediaId
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateAvatarsToS3() {
  try {
    console.log('🔄 Starting avatar migration to S3...')

    // Получаем настройки S3
    const globalSettings = await prisma.mediaGlobalSettings.findFirst()
    
    if (!globalSettings) {
      console.error('❌ Media global settings not found')
      return
    }

    const s3Enabled = globalSettings.s3Enabled
    const s3PublicUrlPrefix = globalSettings.s3PublicUrlPrefix

    console.log('📋 S3 Settings:')
    console.log(`   - S3 Enabled: ${s3Enabled}`)
    console.log(`   - S3 Public URL Prefix: ${s3PublicUrlPrefix}`)

    if (!s3Enabled || !s3PublicUrlPrefix) {
      console.log('ℹ️  S3 is not enabled or public URL prefix is not set')
      return
    }

    // Получаем всех пользователей с аватарами
    const usersWithAvatars = await prisma.user.findMany({
      where: {
        avatarMediaId: {
          not: null
        }
      },
      include: {
        avatarMedia: true
      }
    })

    console.log(`\n👥 Found ${usersWithAvatars.length} users with avatars`)

    let updated = 0
    let skipped = 0
    let errors = 0

    for (const user of usersWithAvatars) {
      if (!user.avatarMedia) {
        console.log(`⚠️  User ${user.email} has avatarMediaId but media not found`)
        skipped++
        continue
      }

      const media = user.avatarMedia
      const variants = JSON.parse(media.variants || '{}')
      const mediumVariant = variants.medium

      // Проверяем есть ли S3 ключ
      const s3Key = mediumVariant?.s3Key || media.s3Key

      if (!s3Key) {
        console.log(`⚠️  User ${user.email}: Media has no s3Key, skipping`)
        skipped++
        continue
      }

      // Формируем S3 URL
      const newAvatarUrl = `${s3PublicUrlPrefix}/${s3Key}`

      // Проверяем нужно ли обновлять
      if (user.image === newAvatarUrl) {
        console.log(`✓ User ${user.email}: Already using S3 URL`)
        skipped++
        continue
      }

      try {
        // Обновляем user.image
        await prisma.user.update({
          where: { id: user.id },
          data: { image: newAvatarUrl }
        })

        console.log(`✅ User ${user.email}:`)
        console.log(`   Old: ${user.image}`)
        console.log(`   New: ${newAvatarUrl}`)
        updated++
      } catch (error) {
        console.error(`❌ Failed to update user ${user.email}:`, error)
        errors++
      }
    }

    console.log('\n📊 Migration Summary:')
    console.log(`   ✅ Updated: ${updated}`)
    console.log(`   ⏭️  Skipped: ${skipped}`)
    console.log(`   ❌ Errors: ${errors}`)
    console.log('\n✨ Migration completed!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем миграцию
migrateAvatarsToS3().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})



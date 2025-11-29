/**
 * Скрипт миграции файлов из public/uploads/.trash в storage/.trash
 * и обновления trashMetadata в базе данных
 */

import { PrismaClient } from '@prisma/client'
import fs from 'fs/promises'
import path from 'path'

const prisma = new PrismaClient()

const OLD_TRASH_BASE = path.join(process.cwd(), 'public', 'uploads', '.trash')
const NEW_TRASH_BASE = path.join(process.cwd(), 'storage', '.trash')

async function migrate() {
  console.log('🗑️  Миграция корзины из public/uploads/.trash в storage/.trash\n')

  // Создаём новую директорию корзины
  await fs.mkdir(NEW_TRASH_BASE, { recursive: true })

  // Получаем все записи с trashMetadata
  const trashedMedia = await prisma.media.findMany({
    where: {
      deletedAt: { not: null },
      trashMetadata: { not: null },
    },
  })

  console.log(`📋 Найдено ${trashedMedia.length} записей в корзине\n`)

  let migrated = 0
  let skipped = 0
  let errors = 0

  for (const media of trashedMedia) {
    try {
      const trashMeta = JSON.parse(media.trashMetadata!)
      const oldTrashPath = trashMeta.trashPath
      const oldTrashVariants = trashMeta.trashVariants || {}

      // Проверяем, нужна ли миграция (путь содержит uploads/.trash)
      if (!oldTrashPath || !oldTrashPath.includes('uploads/.trash')) {
        // Уже мигрирован или другой формат
        console.log(`⏭️  ${media.id}: уже мигрирован или другой формат`)
        skipped++
        continue
      }

      const mediaTrashDir = path.join(NEW_TRASH_BASE, media.id)
      await fs.mkdir(mediaTrashDir, { recursive: true })

      // Перемещаем оригинал
      const oldAbsPath = path.join(process.cwd(), 'public', oldTrashPath)
      const filename = path.basename(oldTrashPath)
      const newTrashPath = path.join(mediaTrashDir, filename)

      try {
        await fs.rename(oldAbsPath, newTrashPath)
        console.log(`  ✅ Оригинал: ${filename}`)
      } catch (e) {
        console.log(`  ⚠️  Оригинал не найден: ${oldAbsPath}`)
      }

      // Перемещаем варианты
      const newTrashVariants: Record<string, string> = {}
      for (const [name, oldVariantPath] of Object.entries(oldTrashVariants) as [string, string][]) {
        const variantFilename = path.basename(oldVariantPath)
        const newVariantPath = path.join(mediaTrashDir, variantFilename)

        try {
          const oldVariantAbsPath = path.join(process.cwd(), 'public', oldVariantPath)
          await fs.rename(oldVariantAbsPath, newVariantPath)
          newTrashVariants[name] = newVariantPath
          console.log(`  ✅ Вариант ${name}: ${variantFilename}`)
        } catch (e) {
          console.log(`  ⚠️  Вариант ${name} не найден`)
        }
      }

      // Обновляем trashMetadata в базе
      const newTrashMeta = {
        ...trashMeta,
        trashPath: newTrashPath,
        trashVariants: newTrashVariants,
      }

      await prisma.media.update({
        where: { id: media.id },
        data: { trashMetadata: JSON.stringify(newTrashMeta) },
      })

      console.log(`✅ ${media.id}: мигрирован\n`)
      migrated++
    } catch (error) {
      console.error(`❌ ${media.id}: ошибка -`, error)
      errors++
    }
  }

  // Удаляем старую директорию если пуста
  try {
    const oldDirs = await fs.readdir(OLD_TRASH_BASE)
    for (const dir of oldDirs) {
      const dirPath = path.join(OLD_TRASH_BASE, dir)
      const files = await fs.readdir(dirPath)
      if (files.length === 0) {
        await fs.rmdir(dirPath)
      }
    }
    const remaining = await fs.readdir(OLD_TRASH_BASE)
    if (remaining.length === 0) {
      await fs.rmdir(OLD_TRASH_BASE)
      console.log('\n🗑️  Старая папка .trash удалена')
    }
  } catch (e) {
    // Игнорируем
  }

  console.log('\n📊 Результат:')
  console.log(`  ✅ Мигрировано: ${migrated}`)
  console.log(`  ⏭️  Пропущено: ${skipped}`)
  console.log(`  ❌ Ошибок: ${errors}`)

  await prisma.$disconnect()
}

migrate().catch(console.error)


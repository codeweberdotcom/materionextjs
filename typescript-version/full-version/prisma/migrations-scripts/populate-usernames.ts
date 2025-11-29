/**
 * Скрипт для заполнения username существующим пользователям
 * Запускать после миграции: npx tsx prisma/migrations-scripts/populate-usernames.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Таблица транслитерации кириллицы
const translitMap: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
  'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
  'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
  'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch',
  'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
}

function transliterate(text: string): string {
  return text
    .split('')
    .map(char => translitMap[char] || char)
    .join('')
}

function generateSlug(source: string): string {
  if (!source || source.trim() === '') {
    return ''
  }

  let slug = transliterate(source)
    .toLowerCase()
    .trim()
    // Заменяем пробелы и дефисы на underscore
    .replace(/[\s\-]+/g, '_')
    // Удаляем все символы кроме a-z, 0-9, _
    .replace(/[^a-z0-9_]/g, '')
    // Убираем множественные underscore
    .replace(/_+/g, '_')
    // Убираем underscore в начале и конце
    .replace(/^_+|_+$/g, '')

  // Минимальная длина 3 символа
  if (slug.length < 3) {
    slug = slug.padEnd(3, '0')
  }

  // Максимальная длина 50 символов
  if (slug.length > 50) {
    slug = slug.substring(0, 50).replace(/_+$/, '')
  }

  return slug
}

async function isSlugAvailable(slug: string, entityType: 'user' | 'account', excludeId?: string): Promise<boolean> {
  if (entityType === 'user') {
    const existing = await prisma.user.findFirst({
      where: {
        username: slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {})
      }
    })
    return !existing
  } else {
    const existing = await prisma.userAccount.findFirst({
      where: {
        slug: slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {})
      }
    })
    return !existing
  }
}

async function generateUniqueSlug(source: string, entityType: 'user' | 'account', excludeId?: string): Promise<string> {
  const baseSlug = generateSlug(source)
  
  if (!baseSlug) {
    // Если не удалось сгенерировать slug, используем случайный
    const randomSlug = `user_${Date.now().toString(36)}`
    return randomSlug
  }

  // Проверяем базовый slug
  if (await isSlugAvailable(baseSlug, entityType, excludeId)) {
    return baseSlug
  }

  // Добавляем суффикс
  let counter = 1
  let slug = `${baseSlug}_${counter}`
  
  while (!(await isSlugAvailable(slug, entityType, excludeId))) {
    counter++
    slug = `${baseSlug}_${counter}`
    
    // Защита от бесконечного цикла
    if (counter > 1000) {
      slug = `${baseSlug}_${Date.now().toString(36)}`
      break
    }
  }

  return slug
}

async function populateUsernames() {
  console.log('🔄 Starting username population...')
  
  // Получаем всех пользователей без username
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: null as any },
        { username: '' }
      ]
    },
    select: {
      id: true,
      name: true,
      email: true
    }
  })

  console.log(`📊 Found ${users.length} users without username`)

  let updated = 0
  let errors = 0

  for (const user of users) {
    try {
      // Определяем источник для генерации username
      let source = ''
      
      if (user.name && user.name.trim()) {
        source = user.name
      } else if (user.email) {
        // Берём часть email до @
        source = user.email.split('@')[0]
      } else {
        source = `user_${user.id.slice(-8)}`
      }

      const username = await generateUniqueSlug(source, 'user', user.id)

      await prisma.user.update({
        where: { id: user.id },
        data: { username }
      })

      updated++
      console.log(`  ✅ User ${user.id}: "${source}" → "${username}"`)
    } catch (error) {
      errors++
      console.error(`  ❌ User ${user.id}: Error -`, error)
    }
  }

  console.log(`\n📈 Results:`)
  console.log(`  Updated: ${updated}`)
  console.log(`  Errors: ${errors}`)
}

async function populateAccountSlugs() {
  console.log('\n🔄 Starting account slug population...')
  
  // Получаем все аккаунты без slug
  const accounts = await prisma.userAccount.findMany({
    where: {
      OR: [
        { slug: null as any },
        { slug: '' }
      ]
    },
    select: {
      id: true,
      name: true
    }
  })

  console.log(`📊 Found ${accounts.length} accounts without slug`)

  let updated = 0
  let errors = 0

  for (const account of accounts) {
    try {
      const source = account.name || `account_${account.id.slice(-8)}`
      const slug = await generateUniqueSlug(source, 'account', account.id)

      await prisma.userAccount.update({
        where: { id: account.id },
        data: { slug }
      })

      updated++
      console.log(`  ✅ Account ${account.id}: "${source}" → "${slug}"`)
    } catch (error) {
      errors++
      console.error(`  ❌ Account ${account.id}: Error -`, error)
    }
  }

  console.log(`\n📈 Results:`)
  console.log(`  Updated: ${updated}`)
  console.log(`  Errors: ${errors}`)
}

async function main() {
  console.log('🚀 Username/Slug Population Script\n')
  console.log('=' .repeat(50))
  
  try {
    await populateUsernames()
    await populateAccountSlugs()
    
    console.log('\n' + '='.repeat(50))
    console.log('✅ Population completed!')
  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()


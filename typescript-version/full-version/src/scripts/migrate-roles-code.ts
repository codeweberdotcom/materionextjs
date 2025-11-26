/**
 * Миграция ролей: добавление code, level, isSystem
 * 
 * Запуск: npx ts-node src/scripts/migrate-roles-code.ts
 * или: pnpm tsx src/scripts/migrate-roles-code.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Системные роли с предопределенными значениями
const SYSTEM_ROLES: Record<string, { code: string; level: number }> = {
  superadmin: { code: 'SUPERADMIN', level: 0 },
  admin: { code: 'ADMIN', level: 10 },
  manager: { code: 'MANAGER', level: 20 },
  editor: { code: 'EDITOR', level: 30 },
  moderator: { code: 'MODERATOR', level: 40 },
  seo: { code: 'SEO', level: 50 },
  marketolog: { code: 'MARKETOLOG', level: 60 },
  support: { code: 'SUPPORT', level: 70 },
  subscriber: { code: 'SUBSCRIBER', level: 80 },
  user: { code: 'USER', level: 90 }
}

async function migrateRoles() {
  console.log('🚀 Starting roles migration...')
  
  try {
    // Получаем все существующие роли
    const roles = await prisma.role.findMany()
    console.log(`📋 Found ${roles.length} roles to migrate`)
    
    for (const role of roles) {
      const nameLower = role.name.toLowerCase()
      const systemRole = SYSTEM_ROLES[nameLower]
      
      if (systemRole) {
        // Системная роль - используем предопределенные значения
        console.log(`✅ Migrating system role: ${role.name} -> code: ${systemRole.code}, level: ${systemRole.level}`)
        
        await prisma.role.update({
          where: { id: role.id },
          data: {
            code: systemRole.code,
            level: systemRole.level,
            isSystem: true
          }
        })
      } else {
        // Кастомная роль - генерируем code из имени
        const code = role.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')
        console.log(`📝 Migrating custom role: ${role.name} -> code: ${code}, level: 100`)
        
        await prisma.role.update({
          where: { id: role.id },
          data: {
            code: code,
            level: 100,
            isSystem: false
          }
        })
      }
    }
    
    console.log('✅ Migration completed successfully!')
    
    // Выводим итоговое состояние
    const updatedRoles = await prisma.role.findMany({
      orderBy: { level: 'asc' }
    })
    
    console.log('\n📊 Final roles state:')
    console.table(updatedRoles.map(r => ({
      id: r.id.slice(0, 8) + '...',
      code: r.code,
      name: r.name,
      level: r.level,
      isSystem: r.isSystem
    })))
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Запуск миграции
migrateRoles()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))




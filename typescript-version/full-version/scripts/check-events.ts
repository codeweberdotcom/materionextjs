/**
 * Скрипт для проверки записи событий в базу данных
 * Использование: npx tsx scripts/check-events.ts [source] [limit]
 * 
 * Примеры:
 *   npx tsx scripts/check-events.ts export 10
 *   npx tsx scripts/check-events.ts import 10
 *   npx tsx scripts/check-events.ts user_management 10
 */

import { prisma } from '../src/libs/prisma'

async function checkEvents(source?: string, limit: number = 20) {
  try {
    console.log('\n🔍 Проверка событий в базе данных...\n')

    const where: any = {}
    if (source) {
      where.source = source
    }

    // Получаем последние события
    const events = await prisma.event.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      select: {
        id: true,
        source: true,
        module: true,
        type: true,
        severity: true,
        message: true,
        actorType: true,
        actorId: true,
        subjectType: true,
        subjectId: true,
        key: true,
        correlationId: true,
        createdAt: true,
        payload: true
      }
    })

    if (events.length === 0) {
      console.log(`❌ События не найдены${source ? ` для источника '${source}'` : ''}`)
      console.log('\n💡 Попробуйте выполнить операцию экспорта/импорта в приложении')
      return
    }

    console.log(`✅ Найдено событий: ${events.length}\n`)

    // Группируем по источникам
    const bySource: Record<string, any[]> = {}
    events.forEach(event => {
      if (!bySource[event.source]) {
        bySource[event.source] = []
      }
      bySource[event.source].push(event)
    })

    // Выводим статистику по источникам
    console.log('📊 Статистика по источникам:')
    Object.entries(bySource).forEach(([source, sourceEvents]) => {
      const byType: Record<string, number> = {}
      sourceEvents.forEach(event => {
        byType[event.type] = (byType[event.type] || 0) + 1
      })
      
      console.log(`\n  ${source}: ${sourceEvents.length} событий`)
      Object.entries(byType).forEach(([type, count]) => {
        console.log(`    - ${type}: ${count}`)
      })
    })

    // Выводим последние события
    console.log('\n📋 Последние события:\n')
    events.slice(0, 10).forEach((event, index) => {
      const payload = event.payload ? JSON.parse(event.payload as string) : {}
      console.log(`${index + 1}. [${event.severity.toUpperCase()}] ${event.source}.${event.type}`)
      console.log(`   Сообщение: ${event.message}`)
      console.log(`   Инициатор: ${event.actorType || 'N/A'} ${event.actorId || '(не указан)'}`)
      console.log(`   Correlation ID: ${event.correlationId || 'N/A'}`)
      console.log(`   Время: ${event.createdAt.toISOString()}`)
      
      // Выводим ключевые данные из payload
      if (payload.entityType) console.log(`   Сущность: ${payload.entityType}`)
      if (payload.format) console.log(`   Формат: ${payload.format}`)
      if (payload.recordCount !== undefined) console.log(`   Записей: ${payload.recordCount}`)
      if (payload.successCount !== undefined) console.log(`   Успешно: ${payload.successCount}`)
      if (payload.errorCount !== undefined) console.log(`   Ошибок: ${payload.errorCount}`)
      if (payload.count) console.log(`   Количество: ${payload.count}`)
      if (payload.mode) console.log(`   Режим: ${payload.mode}`)
      if (payload.action) console.log(`   Действие: ${payload.action}`)
      
      console.log('')
    })

    // Проверяем correlationId
    const withCorrelationId = events.filter(e => e.correlationId)
    if (withCorrelationId.length > 0) {
      console.log(`\n🔗 События с correlationId: ${withCorrelationId.length}`)
      
      // Группируем по correlationId
      const byCorrelation: Record<string, any[]> = {}
      withCorrelationId.forEach(event => {
        if (!byCorrelation[event.correlationId!]) {
          byCorrelation[event.correlationId!] = []
        }
        byCorrelation[event.correlationId!].push(event)
      })

      // Показываем примеры связанных событий
      const multiEventCorrelations = Object.entries(byCorrelation)
        .filter(([_, events]) => events.length > 1)
        .slice(0, 3)

      if (multiEventCorrelations.length > 0) {
        console.log('\n📎 Примеры связанных событий (по correlationId):')
        multiEventCorrelations.forEach(([correlationId, correlationEvents]) => {
          console.log(`\n  Correlation ID: ${correlationId}`)
          correlationEvents.forEach(event => {
            console.log(`    - ${event.type} (${event.severity})`)
          })
        })
      }
    }

    // Проверяем наличие actorId
    const withActor = events.filter(e => e.actorId)
    const withoutActor = events.filter(e => !e.actorId)
    console.log(`\n👤 Инициаторы:`)
    console.log(`   С указанным ID: ${withActor.length}`)
    console.log(`   Без ID: ${withoutActor.length}`)

    if (withoutActor.length > 0 && withoutActor.length < 5) {
      console.log('\n⚠️  События без инициатора:')
      withoutActor.forEach(event => {
        console.log(`   - ${event.type} (${event.createdAt.toISOString()})`)
      })
    }

  } catch (error) {
    console.error('❌ Ошибка при проверке событий:', error)
    if (error instanceof Error) {
      console.error('   Сообщение:', error.message)
      console.error('   Стек:', error.stack)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Получаем аргументы командной строки
const source = process.argv[2] || undefined
const limit = parseInt(process.argv[3] || '20', 10)

checkEvents(source, limit)
  .then(() => {
    console.log('\n✅ Проверка завершена\n')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ Критическая ошибка:', error)
    process.exit(1)
  })









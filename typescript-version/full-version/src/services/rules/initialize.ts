/**
 * Инициализация Rules Engine
 *
 * Загружает правила из БД и запускает обработчик событий
 */

import logger from '@/lib/logger'

import { rulesService } from './RulesService'
import { eventRulesHandler } from './EventRulesHandler'
import { autoBlockingRules } from './rules/auto-blocking-rules'
import { notificationRules } from './rules/notification-rules'

/**
 * Инициализировать Rules Engine
 *
 * 1. Загружает правила из БД
 * 2. Создаёт базовые правила автоблокировок (если их нет)
 * 3. Запускает обработчик событий
 */
export async function initializeRulesEngine(): Promise<void> {
  try {
    logger.info('[RulesEngine] Инициализация...')

    // Создать базовые правила автоблокировок (если их нет)
    await createDefaultRules()

    // Загрузить правила из БД
    const loadedCount = await rulesService.loadRules()
    logger.info(`[RulesEngine] Загружено ${loadedCount} правил из БД`)

    // Запустить обработчик событий
    eventRulesHandler.start()
    logger.info('[RulesEngine] Обработчик событий запущен')

    logger.info('[RulesEngine] Инициализация завершена')
  } catch (error) {
    logger.error('[RulesEngine] Ошибка инициализации', {
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

/**
 * Создать базовые правила (если их нет)
 */
async function createDefaultRules(): Promise<void> {
  // Создать правила автоблокировок
  for (const rule of autoBlockingRules) {
    try {
      const existing = await rulesService.getRuleByName(rule.name)

      if (!existing) {
        await rulesService.createRule({
          ...rule,
          createdBy: 'system'
        })
        logger.info(`[RulesEngine] Создано правило: ${rule.name}`)
      }
    } catch (error) {
      logger.warn(`[RulesEngine] Ошибка создания правила ${rule.name}:`, error)
    }
  }

  // Создать правила уведомлений
  for (const rule of notificationRules) {
    try {
      const existing = await rulesService.getRuleByName(rule.name)

      if (!existing) {
        await rulesService.createRule({
          ...rule,
          createdBy: 'system'
        })
        logger.info(`[RulesEngine] Создано правило: ${rule.name}`)
      }
    } catch (error) {
      logger.warn(`[RulesEngine] Ошибка создания правила ${rule.name}:`, error)
    }
  }
}

/**
 * Остановить Rules Engine
 */
export async function shutdownRulesEngine(): Promise<void> {
  try {
    eventRulesHandler.stop()
    logger.info('[RulesEngine] Остановлен')
  } catch (error) {
    logger.error('[RulesEngine] Ошибка остановки', {
      error: error instanceof Error ? error.message : String(error)
    })
  }
}


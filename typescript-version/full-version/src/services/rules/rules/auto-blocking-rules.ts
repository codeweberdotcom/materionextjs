/**
 * Правила автоблокировок
 *
 * Автоматические правила для блокировки/приостановки пользователей
 * на основе событий и статистики
 */

import type { CreateRuleInput } from '../types'

/**
 * Правило: Автоблокировка при множественных жалобах
 *
 * Условие: Пользователь получил >= 5 жалоб за последние 7 дней
 * Действие: Блокировка пользователя
 */
export const autoBlockOnReportsRule: CreateRuleInput = {
  name: 'auto-block-on-reports',
  description: 'Автоматическая блокировка пользователя при множественных жалобах',
  category: 'blocking',
  priority: 100,
  enabled: true,
  conditions: {
    all: [
      {
        fact: 'userStats',
        operator: 'greaterThanInclusive',
        value: 5,
        path: '$.reportsCount'
      },
      {
        fact: 'user',
        operator: 'notEqual',
        value: 'blocked',
        path: '$.status'
      },
      {
        fact: 'user',
        operator: 'notEqual',
        value: 'deleted',
        path: '$.status'
      }
    ]
  },
  event: {
    type: 'user.block',
    params: {
      reason: 'Автоматическая блокировка: множественные жалобы пользователей',
      autoBlock: true
    }
  }
}

/**
 * Правило: Автоприостановка при спаме
 *
 * Условие: Пользователь создал >= 10 объявлений за последний час
 * Действие: Приостановка пользователя
 */
export const autoSuspendOnSpamRule: CreateRuleInput = {
  name: 'auto-suspend-on-spam',
  description: 'Автоматическая приостановка при подозрении на спам',
  category: 'blocking',
  priority: 90,
  enabled: true,
  conditions: {
    all: [
      {
        fact: 'userStats',
        operator: 'greaterThanInclusive',
        value: 10,
        path: '$.listingsCount'
      },
      {
        fact: 'user',
        operator: 'equal',
        value: 'active',
        path: '$.status'
      }
    ]
  },
  event: {
    type: 'user.suspend',
    params: {
      reason: 'Автоматическая приостановка: подозрение на спам (множественные объявления)',
      autoSuspend: true
    }
  }
}

/**
 * Правило: Автоблокировка при блокировке владельца объявления
 *
 * Условие: Владелец объявления заблокирован или приостановлен
 * Действие: Скрытие/архивация объявлений
 */
export const autoArchiveListingsOnOwnerBlockRule: CreateRuleInput = {
  name: 'auto-archive-listings-on-owner-block',
  description: 'Автоматическая архивация объявлений при блокировке владельца',
  category: 'blocking',
  priority: 80,
  enabled: true,
  conditions: {
    all: [
      {
        fact: 'listingStats',
        operator: 'equal',
        value: true,
        path: '$.ownerBlocked'
      },
      {
        fact: 'listing',
        operator: 'equal',
        value: 'active',
        path: '$.status'
      }
    ]
  },
  event: {
    type: 'listing.archive',
    params: {
      reason: 'Владелец объявления заблокирован',
      autoArchive: true
    }
  }
}

/**
 * Все правила автоблокировок
 */
export const autoBlockingRules: CreateRuleInput[] = [
  autoBlockOnReportsRule,
  autoSuspendOnSpamRule,
  autoArchiveListingsOnOwnerBlockRule
]




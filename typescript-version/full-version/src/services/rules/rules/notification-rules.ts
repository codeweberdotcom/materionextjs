/**
 * Правила уведомлений
 *
 * Автоматические правила для отправки уведомлений
 * на основе событий системы
 */

import type { CreateRuleInput } from '../types'

/**
 * Правило: Приветственное письмо при регистрации
 */
export const welcomeEmailRule: CreateRuleInput = {
  name: 'welcome-email',
  description: 'Приветственное письмо при регистрации пользователя',
  category: 'notification',
  priority: 100,
  enabled: true,
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'auth', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'user.registered', path: '$.type' },
      { fact: 'user', operator: 'notEqual', value: null, path: '$.id' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['email'], // Можно указать несколько: ['email', 'sms', 'telegram']
      templateId: 'welcome',
      delay: 0
    }
  }
}

/**
 * Правило: Сброс пароля
 */
export const passwordResetRule: CreateRuleInput = {
  name: 'password-reset',
  description: 'Уведомление при запросе сброса пароля',
  category: 'notification',
  priority: 100,
  enabled: true,
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'auth', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'user.password_reset_requested', path: '$.type' },
      { fact: 'user', operator: 'notEqual', value: null, path: '$.id' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['email'],
      templateId: 'password-reset',
      delay: 0
    }
  }
}

/**
 * Правило: SMS подтверждение телефона
 */
export const phoneVerificationSmsRule: CreateRuleInput = {
  name: 'phone-verification-sms',
  description: 'SMS с кодом подтверждения телефона',
  category: 'notification',
  priority: 100,
  enabled: true,
  conditions: {
    all: [
      {
        any: [
          { fact: 'event', operator: 'equal', value: 'auth', path: '$.source' },
          { fact: 'event', operator: 'equal', value: 'verification', path: '$.source' }
        ]
      },
      {
        any: [
          { fact: 'event', operator: 'equal', value: 'user.phone_verification_code_sent', path: '$.type' },
          { fact: 'event', operator: 'equal', value: 'verification.phone_code_sent', path: '$.type' },
          { fact: 'event', operator: 'contains', value: 'phone', path: '$.type' }
        ]
      },
      { fact: 'user', operator: 'notEqual', value: null, path: '$.id' },
      { fact: 'user', operator: 'notEqual', value: null, path: '$.phone' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['sms'], // Только SMS для кода верификации
      templateId: 'phone-verification-code',
      delay: 0
    }
  }
}

/**
 * Правило: Новое сообщение в чате
 */
export const newMessageRule: CreateRuleInput = {
  name: 'new-message',
  description: 'Уведомление о новом сообщении в чате',
  category: 'notification',
  priority: 90,
  enabled: true,
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'chat', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'chat.message_received', path: '$.type' },
      { fact: 'user', operator: 'notEqual', value: null, path: '$.id' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser'], // in-app уведомления через browser канал
      delay: 0
    }
  }
}

/**
 * Правило: Объявление одобрено
 */
export const listingApprovedRule: CreateRuleInput = {
  name: 'listing-approved',
  description: 'Уведомление об одобрении объявления',
  category: 'notification',
  priority: 90,
  enabled: true,
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'workflow', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'listing.approved', path: '$.type' },
      { fact: 'listing', operator: 'notEqual', value: null, path: '$.ownerId' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser'], // in-app уведомления через browser канал
      templateId: 'listing-approved',
      delay: 0
    }
  }
}

/**
 * Правило: Верификация пройдена
 */
export const verificationCompletedRule: CreateRuleInput = {
  name: 'verification-completed',
  description: 'Уведомление о прохождении верификации',
  category: 'notification',
  priority: 90,
  enabled: true,
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'user', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'user.verification_completed', path: '$.type' },
      { fact: 'user', operator: 'notEqual', value: null, path: '$.id' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser'], // in-app уведомления через browser канал
      templateId: 'verification-completed',
      delay: 0
    }
  }
}

/**
 * Правило: Аккаунт заблокирован
 */
export const accountBlockedRule: CreateRuleInput = {
  name: 'account-blocked',
  description: 'Уведомление о блокировке аккаунта',
  category: 'notification',
  priority: 100,
  enabled: true,
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'workflow', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'user.blocked', path: '$.type' },
      { fact: 'user', operator: 'notEqual', value: null, path: '$.id' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser'], // in-app уведомления через browser канал
      templateId: 'account-blocked',
      delay: 0
    }
  }
}

/**
 * Правило: Новое уведомление (когда система создаёт уведомление)
 */
export const newNotificationRule: CreateRuleInput = {
  name: 'new-notification',
  description: 'Уведомление о поступлении нового уведомления (для push/email)',
  category: 'notification',
  priority: 80,
  enabled: true,
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'notifications', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'notification.created', path: '$.type' },
      { fact: 'user', operator: 'notEqual', value: null, path: '$.id' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser', 'email'], // Можно настроить приоритет каналов
      delay: 0
    }
  }
}

/**
 * Правило: Напоминание об окончании тарифа за 7 дней
 */
export const tariffExpiringIn7DaysRule: CreateRuleInput = {
  name: 'tariff-expiring-7-days',
  description: 'Напоминание об окончании тарифа за 7 дней',
  category: 'notification',
  priority: 80,
  enabled: true,
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'scheduler', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'tariff.check_expiration', path: '$.type' },
      { fact: 'account', operator: 'equal', value: true, path: '$.needsReminder7Days' },
      { fact: 'account', operator: 'notEqual', value: 'FREE', path: '$.tariffPlanCode' } // Не напоминаем для FREE
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['email', 'browser'],
      templateId: 'tariff-expiring-7-days',
      delay: 0,
      updateReminderSent: true // Флаг для обновления tariffReminderSentAt
    }
  }
}

/**
 * Правило: Напоминание об окончании тарифа за 3 дня
 */
export const tariffExpiringIn3DaysRule: CreateRuleInput = {
  name: 'tariff-expiring-3-days',
  description: 'Напоминание об окончании тарифа за 3 дня',
  category: 'notification',
  priority: 85,
  enabled: true,
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'scheduler', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'tariff.check_expiration', path: '$.type' },
      { fact: 'account', operator: 'equal', value: true, path: '$.needsReminder3Days' },
      { fact: 'account', operator: 'notEqual', value: 'FREE', path: '$.tariffPlanCode' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['email', 'browser'],
      templateId: 'tariff-expiring-3-days',
      delay: 0,
      updateReminderSent: true
    }
  }
}

/**
 * Правило: Напоминание об окончании тарифа за 1 день
 */
export const tariffExpiringIn1DayRule: CreateRuleInput = {
  name: 'tariff-expiring-1-day',
  description: 'Напоминание об окончании тарифа за 1 день',
  category: 'notification',
  priority: 90,
  enabled: true,
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'scheduler', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'tariff.check_expiration', path: '$.type' },
      { fact: 'account', operator: 'equal', value: true, path: '$.needsReminder1Day' },
      { fact: 'account', operator: 'notEqual', value: 'FREE', path: '$.tariffPlanCode' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['email', 'browser', 'sms'], // SMS для срочного напоминания
      templateId: 'tariff-expiring-1-day',
      delay: 0,
      updateReminderSent: true
    }
  }
}

/**
 * Правило: Окончание тарифа (downgrade на FREE)
 */
export const tariffExpiredRule: CreateRuleInput = {
  name: 'tariff-expired',
  description: 'Уведомление об окончании тарифа и переходе на FREE',
  category: 'notification',
  priority: 100,
  enabled: true,
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'scheduler', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'tariff.expired', path: '$.type' },
      { fact: 'account', operator: 'equal', value: true, path: '$.tariffExpired' },
      { fact: 'account', operator: 'notEqual', value: 'FREE', path: '$.tariffPlanCode' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['email', 'browser'],
      templateId: 'tariff-expired',
      delay: 0,
      triggerDowngrade: true // Флаг для downgrade на FREE
    }
  }
}

/**
 * Правило: Компания одобрена
 */
export const companyApprovedRule: CreateRuleInput = {
  name: 'company-approved',
  description: 'Уведомление об одобрении компании',
  category: 'notification',
  priority: 90,
  enabled: true,
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'workflow', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'company.approved', path: '$.type' },
      { fact: 'user', operator: 'notEqual', value: null, path: '$.id' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser'], // in-app уведомления через browser канал
      templateId: 'company-approved',
      delay: 0
    }
  }
}

/**
 * Правило: Аккаунт одобрен
 */
export const accountApprovedRule: CreateRuleInput = {
  name: 'account-approved',
  description: 'Уведомление об одобрении аккаунта',
  category: 'notification',
  priority: 90,
  enabled: true,
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'workflow', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'account.approved', path: '$.type' },
      { fact: 'user', operator: 'notEqual', value: null, path: '$.id' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser'], // in-app уведомления через browser канал
      templateId: 'account-approved',
      delay: 0
    }
  }
}

/**
 * Правило: Объявление возвращено на доработку
 */
export const listingReturnedForRevisionRule: CreateRuleInput = {
  name: 'listing-returned-for-revision',
  description: 'Уведомление о возврате объявления на доработку',
  category: 'notification',
  priority: 90,
  enabled: true,
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'workflow', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'listing.returned_for_revision', path: '$.type' },
      { fact: 'listing', operator: 'notEqual', value: null, path: '$.ownerId' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser'], // in-app уведомления через browser канал
      templateId: 'listing-returned-for-revision',
      delay: 0
    }
  }
}

/**
 * Правило: Объявление заблокировано
 */
export const listingBlockedRule: CreateRuleInput = {
  name: 'listing-blocked',
  description: 'Уведомление о блокировке объявления',
  category: 'notification',
  priority: 100,
  enabled: true,
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'workflow', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'listing.blocked', path: '$.type' },
      { fact: 'listing', operator: 'notEqual', value: null, path: '$.ownerId' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser'], // in-app уведомления через browser канал
      templateId: 'listing-blocked',
      delay: 0
    }
  }
}

/**
 * Правило: Компания возвращена на доработку
 */
export const companyReturnedForRevisionRule: CreateRuleInput = {
  name: 'company-returned-for-revision',
  description: 'Уведомление о возврате компании на доработку',
  category: 'notification',
  priority: 90,
  enabled: true,
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'workflow', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'company.returned_for_revision', path: '$.type' },
      { fact: 'user', operator: 'notEqual', value: null, path: '$.id' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser'], // in-app уведомления через browser канал
      templateId: 'company-returned-for-revision',
      delay: 0
    }
  }
}

/**
 * Все правила уведомлений
 */
export const notificationRules: CreateRuleInput[] = [
  welcomeEmailRule,
  passwordResetRule,
  phoneVerificationSmsRule,
  newMessageRule,
  listingApprovedRule,
  verificationCompletedRule,
  accountBlockedRule,
  newNotificationRule,
  // Tariff expiration reminders
  tariffExpiringIn7DaysRule,
  tariffExpiringIn3DaysRule,
  tariffExpiringIn1DayRule,
  tariffExpiredRule,
  companyApprovedRule,
  accountApprovedRule,
  listingReturnedForRevisionRule,
  listingBlockedRule,
  companyReturnedForRevisionRule
]


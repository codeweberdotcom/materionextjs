/**
 * Бизнес-правила для системы аккаунтов
 *
 * Используется json-rules-engine для проверки:
 * - Лимитов тарифных планов
 * - Прав доступа
 * - Ограничений на создание аккаунтов
 */

import type { RuleDefinition, RuleCategory, RuleEvent } from '../types'

/**
 * Правила для проверки лимитов тарифных планов
 */
export const accountTariffRules: RuleDefinition[] = [
  {
    name: 'check_max_accounts_limit',
    description: 'Проверка лимита максимального количества аккаунтов для тарифного плана',
    category: 'tariff' as RuleCategory,
    conditions: {
      all: [
        {
          fact: 'userAccountCount',
          operator: 'greaterThanInclusive',
          value: {
            fact: 'tariffMaxAccounts'
          }
        },
        {
          fact: 'tariffMaxAccounts',
          operator: 'notEqual',
          value: -1 // -1 означает unlimited
        }
      ]
    },
    event: {
      type: 'account_limit_exceeded',
      params: {
        message: 'Превышен лимит количества аккаунтов для вашего тарифного плана',
        limit: {
          fact: 'tariffMaxAccounts'
        }
      }
    } as RuleEvent,
    priority: 10,
    enabled: true
  },
  {
    name: 'check_max_managers_limit',
    description: 'Проверка лимита максимального количества менеджеров для тарифного плана',
    category: 'tariff' as RuleCategory,
    conditions: {
      all: [
        {
          fact: 'accountManagerCount',
          operator: 'greaterThanInclusive',
          value: {
            fact: 'tariffMaxManagers'
          }
        },
        {
          fact: 'tariffMaxManagers',
          operator: 'notEqual',
          value: -1 // -1 означает unlimited
        },
        {
          fact: 'tariffCanAssignManagers',
          operator: 'equal',
          value: true
        }
      ]
    },
    event: {
      type: 'manager_limit_exceeded',
      params: {
        message: 'Превышен лимит количества менеджеров для вашего тарифного плана',
        limit: {
          fact: 'tariffMaxManagers'
          }
      }
    } as RuleEvent,
    priority: 10,
    enabled: true
  },
  {
    name: 'check_account_type_allowed',
    description: 'Проверка, разрешен ли тип аккаунта для тарифного плана',
    category: 'tariff' as RuleCategory,
    conditions: {
      any: [
        {
          fact: 'accountType',
          operator: 'equal',
          value: 'NETWORK'
        },
        {
          fact: 'tariffMaxAccounts',
          operator: 'greaterThan',
          value: 1
        }
      ]
    },
    event: {
      type: 'account_type_allowed',
      params: {
        message: 'Тип аккаунта разрешен'
      }
    } as RuleEvent,
    priority: 5,
    enabled: true
  }
]

/**
 * Правила для проверки прав доступа
 */
export const accountAccessRules: RuleDefinition[] = [
  {
    name: 'check_account_owner_access',
    description: 'Проверка доступа владельца аккаунта',
    category: 'limit' as RuleCategory,
    conditions: {
      all: [
        {
          fact: 'userId',
          operator: 'equal',
          value: {
            fact: 'accountOwnerId'
          }
        }
      ]
    },
    event: {
      type: 'access_granted',
      params: {
        message: 'Владелец имеет полный доступ к аккаунту'
      }
    } as RuleEvent,
    priority: 20,
    enabled: true
  },
  {
    name: 'check_account_manager_access',
    description: 'Проверка доступа менеджера аккаунта',
    category: 'limit' as RuleCategory,
    conditions: {
      all: [
        {
          fact: 'isManager',
          operator: 'equal',
          value: true
        },
        {
          fact: 'managerCanManage',
          operator: 'equal',
          value: true
        },
        {
          fact: 'managerRevokedAt',
          operator: 'equal',
          value: null
        }
      ]
    },
    event: {
      type: 'access_granted',
      params: {
        message: 'Менеджер имеет доступ к аккаунту'
      }
    } as RuleEvent,
    priority: 15,
    enabled: true
  }
]

/**
 * Правила для проверки ограничений на операции
 */
export const accountOperationRules: RuleDefinition[] = [
  {
    name: 'check_can_create_account',
    description: 'Проверка возможности создания нового аккаунта',
    category: 'limit' as RuleCategory,
    conditions: {
      all: [
        {
          fact: 'userAccountCount',
          operator: 'lessThan',
          value: {
            fact: 'tariffMaxAccounts'
          }
        }
      ]
    },
    event: {
      type: 'account_creation_allowed',
      params: {
        message: 'Создание аккаунта разрешено'
      }
    } as RuleEvent,
    priority: 10,
    enabled: true
  },
  {
    name: 'check_can_assign_manager',
    description: 'Проверка возможности назначения менеджера',
    category: 'limit' as RuleCategory,
    conditions: {
      all: [
        {
          fact: 'tariffCanAssignManagers',
          operator: 'equal',
          value: true
        },
        {
          fact: 'accountManagerCount',
          operator: 'lessThan',
          value: {
            fact: 'tariffMaxManagers'
          }
        }
      ]
    },
    event: {
      type: 'manager_assignment_allowed',
      params: {
        message: 'Назначение менеджера разрешено'
      }
    } as RuleEvent,
    priority: 10,
    enabled: true
  }
]

/**
 * Все правила для аккаунтов
 */
export const allAccountRules: RuleDefinition[] = [
  ...accountTariffRules,
  ...accountAccessRules,
  ...accountOperationRules
]




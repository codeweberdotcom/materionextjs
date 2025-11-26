# 🧪 Unit тесты

## Обновление 2025-11-24 - User Module Test Coverage (актуальное)

### Новые тесты для модуля User

Создано полное тестовое покрытие для модуля управления пользователями:

#### Unit-тесты для API endpoints

**Admin Users API** (`tests/unit/api/admin-users-route.test.ts`):
- `POST /api/admin/users` - создание пользователя с хешированием пароля, генерацией временного пароля, валидацией
- `GET /api/admin/users` - список пользователей с кешированием, фильтрацией, трансформацией данных

**Admin Users by ID API** (`tests/unit/api/admin-users-id-route.test.ts`):
- `GET /api/admin/users/[id]` - получение пользователя
- `PUT /api/admin/users/[id]` - обновление пользователя, защита superadmin
- `PATCH /api/admin/users/[id]` - toggle статуса, защита от само-деактивации
- `DELETE /api/admin/users/[id]` - удаление пользователя, защита от само-удаления

**User Profile API** (`tests/unit/api/user-profile-route.test.ts`):
- `GET /api/user/profile` - получение профиля
- `PUT /api/user/profile` - обновление профиля
- `POST /api/user/change-password` - смена пароля с валидацией
- `POST /api/user/avatar` - загрузка аватара с валидацией типа и размера
- `DELETE /api/user/avatar` - удаление аватара

#### Integration-тесты для сервисного слоя

**UserRepository** (`tests/integration/user-repository.test.ts`):
- Все CRUD операции: `findById`, `findByEmail`, `create`, `update`, `delete`, `findMany`
- Сложные запросы: where, pagination, ordering, select
- Обработка ошибок БД

**UserService** (`tests/integration/user-service.test.ts`):
- Интеграция с UserRepository
- Отправка welcome email при создании пользователя
- Graceful degradation при ошибках email
- Логирование ошибок
- Цепочки операций (workflow тесты)

#### E2E-тесты

**User Management** (`tests/e2e/user/user-management.spec.ts`):
- Создание пользователя через админ-панель
- Обновление пользователя
- Toggle статуса пользователя
- Массовые операции
- Экспорт/импорт пользователей

**User Profile** (`tests/e2e/user/user-profile.spec.ts`):
- Просмотр и обновление профиля
- Смена пароля
- Загрузка аватара

**Примечание:** E2E тесты созданы и добавлены в `test-scripts.ts`, но не были запущены. Для запуска используйте интерфейс мониторинга (`http://localhost:3000/ru/admin/monitoring/testing`) или командную строку (`pnpm test:e2e`).

### Структура тестов User Module

```
tests/
├── unit/
│   └── api/
│       ├── admin-users-route.test.ts
│       ├── admin-users-id-route.test.ts
│       └── user-profile-route.test.ts
├── integration/
│   ├── user-repository.test.ts
│   └── user-service.test.ts
└── e2e/
    └── user/
        ├── user-management.spec.ts
        └── user-profile.spec.ts
```

### Команды запуска

- Все unit-тесты: `pnpm test:unit`
- Все integration-тесты: `pnpm test:integration`
- Все тесты: `pnpm test`
- E2E тесты: `pnpm test:e2e`
- Конкретный файл: `pnpm test admin-users-route.test.ts`

---

## Обновление 2025-11-21 - Data Sanitization + Rate Limit unit tests

### Структура

Актуальные unit-тесты лежат в `tests/unit/`:

```
tests/unit/
├── rate-limit/
│   └── resilient-store.test.ts  # проверяет ResilientRateLimitStore
└── data-sanitization/
    └── data-sanitization.service.test.ts  # проверяет DataSanitizationService
```

### Data Sanitization Service тесты

`data-sanitization.service.test.ts` покрывает сервис безопасной очистки данных (`src/services/data-sanitization.service.ts`):

#### Тестируемые сценарии:

- **Валидация параметров**: проверка обязательных полей, типов данных, режимов
- **Режимы очистки**:
  - `DELETE` - полное удаление пользователя и связанных данных
  - `ANONYMIZE` - анонимизация данных (GDPR compliance)
  - `SELECTIVE` - выборочная очистка по типам данных
- **Preview режим**: безопасное тестирование без выполнения операций
- **Поиск данных**: определение объема данных пользователя
- **Обработка ошибок**: graceful error handling с логированием
- **Безопасность**: защита от удаления реальных данных

#### Особенности тестирования:

- Моки Prisma для изоляции от базы данных
- Транзакционные операции с откатом
- Проверка аудит логов
- Валидация тестовых данных (защита от реальных email)

### Rate Limit тесты

`resilient-store.test.ts` покрывает резервный store (`src/lib/rate-limit/stores/index.ts`):

- uses primary store when available — при нормальной работе все операции идут через Redis и метрики помечаются backend=`redis`.
- falls back to prisma store after redis failure and retries after interval — моделируется падение Redis, стор переключается на Prisma, вызывает `recordRedisFailure`, затем после retry-интервала возвращается к Redis и пишет `recordFallbackDuration`.

Используются jest-моки для метрик (`startConsumeDurationTimer`, `recordBackendSwitch`) и ручная фиксация `Date.now()` для симуляции retry-интервала.

### Команды запуска

- Все unit-тесты: `pnpm test:unit`
- Watch по unit-пакету: `pnpm test:watch -- --testPathPattern=tests/unit`
- Покрытие: `pnpm test:coverage`
- Конкретный сервис: `pnpm test data-sanitization.service.test.ts`

## 📋 Обзор

Unit тесты проверяют отдельные функции и модули в изоляции. Они быстрые, надежные и помогают поймать регрессии на ранних этапах.

## 🛠️ Инструменты

- **Vitest** - Тестовый фреймворк
- **TypeScript** - Типизация
- **ESM/CommonJS** - Поддержка модулей

## 📁 Структура

```
src/
├── utils/
│   └── formatting/
│       ├── getInitials.ts
│       └── __tests__/
│           └── getInitials.test.ts
├── lib/
│   ├── logger.ts
│   └── __tests__/
│       └── logger.test.ts
└── services/
    └── api/
        ├── userService.ts
        └── __tests__/
            └── userService.test.ts
```

## 🎯 Лучшие практики

### **AAA паттерн**

```typescript
describe('getInitials', () => {
  it('should return initials for full name', () => {
    // Arrange - подготовка данных
    const input = 'John Doe'

    // Act - выполнение действия
    const result = getInitials(input)

    // Assert - проверка результата
    expect(result).toBe('JD')
  })
})
```

### **Тестирование edge cases**

```typescript
describe('getInitials edge cases', () => {
  it('should handle null input', () => {
    expect(getInitials(null)).toBe('')
  })

  it('should handle undefined input', () => {
    expect(getInitials(undefined)).toBe('')
  })

  it('should handle empty string', () => {
    expect(getInitials('')).toBe('')
  })

  it('should handle whitespace only', () => {
    expect(getInitials('   ')).toBe('')
  })
})
```

## 📝 Примеры тестов

делают?### **DataSanitizationService**

```typescript
// src/services/data-sanitization.service.ts (фрагмент)
export class DataSanitizationService {
  async sanitize(target: SanitizationTarget, options: SanitizationOptions) {
    // Валидация и выполнение очистки
    this.validateSanitizationRequest(request)

    // Выполнение в транзакции
    return await this.prisma.$transaction(async tx => {
      // Логика очистки по режимам: DELETE, ANONYMIZE, SELECTIVE
    })
  }

  async previewSanitization(target: SanitizationTarget, options: SanitizationOptions) {
    // Preview режим - расчет без выполнения
    const result = await this.sanitize(target, { ...options, mode: SanitizationMode.SELECTIVE })
    result.dryRun = true
    return result
  }
}
```

```typescript
// tests/unit/data-sanitization/data-sanitization.service.test.ts
import { DataSanitizationService, SanitizationMode, DataType } from '@/services/data-sanitization.service'

describe('DataSanitizationService', () => {
  let service: DataSanitizationService

  beforeEach(() => {
    service = new DataSanitizationService()
  })

  describe('sanitize', () => {
    it('should perform DELETE mode sanitization', async () => {
      const target = { userId: 'test-user-id' }
      const options = { mode: 'delete', requestedBy: 'test' }

      // Mock транзакции
      mockPrisma.$transaction.mockImplementation(async callback => {
        const tx = {
          /* mocked transaction */
        }
        return callback(tx)
      })

      const result = await service.sanitize(target, options)

      expect(result.cleaned.users).toBe(1)
      expect(result.cleaned.messages).toBeGreaterThan(0)
    })

    it('should perform ANONYMIZE mode sanitization', async () => {
      const target = { userId: 'test-user-id' }
      const options = { mode: 'anonymize', requestedBy: 'test' }

      const result = await service.sanitize(target, options)

      expect(result.cleaned.anonymizedUsers).toBe(1)
      expect(result.cleaned.anonymizedMessages).toBeGreaterThan(0)
    })

    it('should perform SELECTIVE mode sanitization', async () => {
      const target = {
        userId: 'test-user-id',
        dataTypes: [DataType.MESSAGES, DataType.RATE_LIMITS]
      }
      const options = { mode: 'selective', requestedBy: 'test' }

      const result = await service.sanitize(target, options)

      expect(result.cleaned.messages).toBeGreaterThan(0)
      expect(result.cleaned.rateLimitStates).toBeGreaterThan(0)
      expect(result.cleaned.users).toBe(0) // PROFILE не выбран
    })
  })

  describe('previewSanitization', () => {
    it('should return preview result without executing', async () => {
      const target = { userId: 'test-user-id' }
      const options = { mode: 'delete', requestedBy: 'test' }

      const result = await service.previewSanitization(target, options)

      expect(result.dryRun).toBe(true)
      expect(result.cleaned.users).toBeGreaterThan(0)
    })
  })

  describe('validation', () => {
    it('should reject non-test data', async () => {
      const target = { email: 'realuser@gmail.com' }
      const options = { mode: 'delete', requestedBy: 'test' }

      await expect(service.sanitize(target, options, true)).rejects.toThrow(
        'Удаление разрешено только для тестовых данных'
      )
    })

    it('should reject selective mode without dataTypes', async () => {
      const target = { userId: 'test-user-id' }
      const options = { mode: 'selective', requestedBy: 'test' }

      await expect(service.sanitize(target, options, true)).rejects.toThrow(
        'Selective режим требует указания типов данных'
      )
    })
  })
})
```

### **Функция getInitials**

```typescript
// src/utils/formatting/getInitials.ts
export const getInitials = (string?: string | null) => {
  if (!string || typeof string !== 'string' || string.trim() === '') {
    return ''
  }
  return string.split(/\s/).reduce((response, word) => (response += word.slice(0, 1)), '')
}
```

```typescript
// src/utils/formatting/__tests__/getInitials.test.ts
import { getInitials } from '../getInitials'

describe('getInitials', () => {
  it('should return initials for full name', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('should return initials for multiple words', () => {
    expect(getInitials('John Michael Doe')).toBe('JMD')
  })

  it('should handle single name', () => {
    expect(getInitials('John')).toBe('J')
  })

  it('should handle null/undefined', () => {
    expect(getInitials(null)).toBe('')
    expect(getInitials(undefined)).toBe('')
  })

  it('should handle empty string', () => {
    expect(getInitials('')).toBe('')
    expect(getInitials('   ')).toBe('')
  })

  it('should handle names with extra spaces', () => {
    expect(getInitials('  John   Doe  ')).toBe('JD')
  })

  it('should handle names with multiple spaces between words', () => {
    expect(getInitials('John   Doe')).toBe('JD')
  })
})
```

### **Сервис с HTTP запросами**

```typescript
// src/services/api/userService.ts
export class UserService {
  async getUser(id: string) {
    const response = await fetch(`/api/users/${id}`)
    if (!response.ok) {
      throw new Error('Failed to fetch user')
    }
    return response.json()
  }

  async createUser(userData: UserData) {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    })
    return response.json()
  }
}
```

```typescript
// src/services/api/__tests__/userService.test.ts
import { UserService } from '../userService'

// Mock fetch globally
global.fetch = jest.fn()

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

describe('UserService', () => {
  let userService: UserService

  beforeEach(() => {
    userService = new UserService()
    jest.clearAllMocks()
  })

  describe('getUser', () => {
    it('should return user data on success', async () => {
      const mockUser = { id: '1', name: 'John Doe' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUser)
      } as Response)

      const result = await userService.getUser('1')

      expect(mockFetch).toHaveBeenCalledWith('/api/users/1')
      expect(result).toEqual(mockUser)
    })

    it('should throw error on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      } as Response)

      await expect(userService.getUser('999')).rejects.toThrow('Failed to fetch user')
    })
  })

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const userData = { name: 'Jane Doe', email: 'jane@example.com' }
      const createdUser = { id: '2', ...userData }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createdUser)
      } as Response)

      const result = await userService.createUser(userData)

      expect(mockFetch).toHaveBeenCalledWith('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      })
      expect(result).toEqual(createdUser)
    })
  })
})
```

## 🔧 Моки и стабы

### **Мокинг модулей**

```typescript
// Мок внешней зависимости
jest.mock('@/lib/database', () => ({
  connect: jest.fn(),
  query: jest.fn(),
  disconnect: jest.fn()
}))

// Мок таймера
jest.useFakeTimers()

// Мок даты
const mockDate = new Date('2023-01-01')
jest.spyOn(global, 'Date').mockImplementation(() => mockDate)
```

### **Мокинг функций**

```typescript
const mockFunction = jest.fn()
mockFunction.mockReturnValue('mocked value')
mockFunction.mockResolvedValue('async result')
mockFunction.mockRejectedValue(new Error('mock error'))
```

### **Шпионы**

```typescript
// Шпион за методом объекта
const spy = jest.spyOn(console, 'log').mockImplementation(() => {})

// Шпион за геттером/сеттером
const spy = jest.spyOn(object, 'property', 'get')
```

## 📊 Покрытие кода

### **Настройка покрытия**

```javascript
// jest.config.js
module.exports = {
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/**/*.d.ts', '!src/pages/_*.tsx', '!src/**/*.config.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
}
```

### **Исключение файлов**

```javascript
coveragePathIgnorePatterns: ['/node_modules/', '/__tests__/', '/__mocks__/', '/coverage/']
```

## 🚀 Запуск тестов

### **Все unit тесты**

```bash
pnpm test
```

### **Конкретный файл**

```bash
pnpm test getInitials.test.ts
```

### **С покрытием**

```bash
pnpm run test:coverage
```

### **Watch режим**

```bash
pnpm run test:watch
```

### **Фильтр по имени**

```bash
pnpm test -- --testNamePattern="should handle null"
```

## 🔍 Отладка тестов

### **Debug в VS Code**

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Vitest Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceRoot}/node_modules/.bin/vitest",
      "args": ["--runInBand"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### **Логирование в тестах**

```typescript
// Временное логирование
console.log('Debug value:', variable)

// Или с помощью Vitest
expect(variable).toBe(expected) // Останавливается на ошибке
```

## 📈 Производительность

### **Быстрые тесты**

- ✅ Изоляция зависимостей
- ✅ Минимум сетевых вызовов
- ✅ Использование моков
- ✅ Параллельное выполнение

### **Оптимизация**

```javascript
// Пропуск медленных тестов в CI
if (process.env.CI) {
  // Пропустить интеграционные тесты
}

// Группировка связанных тестов
describe('User API', () => {
  // Все тесты пользователя в одной группе
})
```

## 🎯 Распространенные паттерны

### **Тестирование исключений**

```typescript
it('should throw error for invalid input', () => {
  expect(() => {
    validateEmail('invalid')
  }).toThrow('Invalid email format')
})
```

### **Async/await**

```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction()
  expect(result).toBeDefined()
})
```

### **Тестирование таймаутов**

```typescript
it('should timeout after 5 seconds', async () => {
  jest.useFakeTimers()

  const promise = timeoutFunction()
  jest.advanceTimersByTime(5000)

  await expect(promise).rejects.toThrow('Timeout')
})
```

### **Snapshot тестирование**

```typescript
it('should match snapshot', () => {
  const result = generateHTML(props)
  expect(result).toMatchSnapshot()
})
```

## 📚 Дополнительные ресурсы

- [Vitest документация](https://vitest.dev/guide/)
- [Тестирование JavaScript приложений](https://kentcdodds.com/blog/)
- [Unit Testing Best Practices](https://martinfowler.com/bliki/UnitTest.html)

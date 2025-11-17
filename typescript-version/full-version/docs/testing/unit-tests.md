# 🧪 Unit тесты

## Обновление 2025-11-16: rate-limit unit tests (актуальное)

### Структура
Актуальные unit-тесты по rate-limit лежат в `tests/unit/rate-limit`:

```
tests/unit/
└── rate-limit/
    └── resilient-store.test.ts  # проверяет ResilientRateLimitStore
```

### Текущие сценарии

`resilient-store.test.ts` покрывает резервный store (`src/lib/rate-limit/stores/index.ts`):
- uses primary store when available — при нормальной работе все операции идут через Redis и метрики помечаются backend=`redis`.
- falls back to prisma store after redis failure and retries after interval — моделируется падение Redis, стор переключается на Prisma, вызывает `recordRedisFailure`, затем после retry-интервала возвращается к Redis и пишет `recordFallbackDuration`.

Используются jest-моки для метрик (`startConsumeDurationTimer`, `recordBackendSwitch`) и ручная фиксация `Date.now()` для симуляции retry-интервала.

### Команды запуска для rate-limit юнитов
- Все unit-тесты: `pnpm test:unit`
- Watch по unit-пакету: `pnpm test:watch -- --testPathPattern=tests/unit`
- Покрытие: `pnpm test:coverage`

## 📋 Обзор

Unit тесты проверяют отдельные функции и модули в изоляции. Они быстрые, надежные и помогают поймать регрессии на ранних этапах.

## 🛠️ Инструменты

- **Jest** - Тестовый фреймворк
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
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/pages/_*.tsx',
    '!src/**/*.config.ts'
  ],
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
coveragePathIgnorePatterns: [
  '/node_modules/',
  '/__tests__/',
  '/__mocks__/',
  '/coverage/'
]
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
      "name": "Debug Jest Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceRoot}/node_modules/.bin/jest",
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

// Или с помощью Jest
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

- [Jest документация](https://jestjs.io/docs/getting-started)
- [Тестирование JavaScript приложений](https://kentcdodds.com/blog/)
- [Unit Testing Best Practices](https://martinfowler.com/bliki/UnitTest.html)

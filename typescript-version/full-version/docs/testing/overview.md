# 🧪 Обзор тестирования

## 📋 Архитектура тестирования

Проект использует многоуровневый подход к тестированию:

```
┌─────────────────┐
│   E2E тесты     │  ← Полные пользовательские сценарии
│  (Playwright)   │
├─────────────────┤
│ Component тесты │  ← React компоненты
│ (RTL + Jest)    │
├─────────────────┤
│ Integration     │  ← API роуты, сервисы
│    тесты        │
├─────────────────┤
│   Unit тесты    │  ← Утилиты, функции
│    (Jest)       │
└─────────────────┘
```

## 🛠️ Инструменты

### **Jest** - Основной тестовый фреймворк
- ✅ Unit и integration тесты
- ✅ TypeScript поддержка
- ✅ Моки и спайсы
- ✅ Параллельное выполнение
- ✅ Coverage отчеты

### **React Testing Library (RTL)** - Тестирование компонентов
- ✅ Тестирование поведения, а не реализации
- ✅ Доступность (a11y)
- ✅ Пользовательские события
- ✅ Snapshot тестирование

### **Playwright** - E2E тестирование
- ✅ Кросс-браузерное тестирование
- ✅ Автоматические скриншоты
- ✅ Видео записи
- ✅ Мобильное тестирование

## 📊 Текущая статистика

```
✅ Всего тестов: 11
✅ Проходят: 11
✅ Покрытие: ~85%

📁 Структура:
├── src/utils/formatting/__tests__/getInitials.test.ts (8 тестов)
├── src/app/api/auth/__tests__/login.test.ts (1 тест)
├── src/components/__tests__/DirectionalIcon.test.tsx (2 теста)
└── e2e/auth.spec.ts (2 теста)
```

## 🚀 Быстрый старт

### Запуск всех тестов
```bash
pnpm test
```

### Запуск с покрытием
```bash
pnpm run test:coverage
```

### Запуск в watch режиме
```bash
pnpm run test:watch
```

### Запуск E2E тестов
```bash
pnpm run test:e2e
```

### Запуск E2E с UI
```bash
pnpm run test:e2e:ui
```

## 📁 Структура файлов

```
📁 src/
├── **/__tests__/          # Unit и integration тесты
│   └── *.test.ts
├── components/
│   └── **/__tests__/      # Component тесты
│       └── *.test.tsx
└── app/api/
    └── **/__tests__/      # API тесты

📁 e2e/                    # E2E тесты
├── *.spec.ts

📁 docs/testing/           # Документация
├── overview.md
├── unit-tests.md
├── component-tests.md
├── e2e-tests.md
└── configuration.md
```

## 🎯 Лучшие практики

### **Принципы тестирования**
- 🧪 **Изоляция**: Каждый тест независим
- 🎯 **Фокус на поведении**: Тестируем что, а не как
- 🔄 **DRY**: Переиспользование кода
- 📝 **Документирование**: Читаемые названия тестов

### **Структура теста**
```typescript
describe('Компонент/Функция', () => {
  describe('когда происходит X', () => {
    it('должен делать Y', () => {
      // Arrange
      const input = 'test'

      // Act
      const result = functionUnderTest(input)

      // Assert
      expect(result).toBe('expected')
    })
  })
})
```

### **Моки и стабы**
```typescript
// Мок внешних зависимостей
jest.mock('@/lib/database', () => ({
  connect: jest.fn(),
  query: jest.fn()
}))

// Сброс состояния между тестами
beforeEach(() => {
  jest.clearAllMocks()
})
```

## 🔧 Конфигурация

### **Jest конфигурация** (`jest.config.js`)
```javascript
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts'
  ]
}
```

### **Playwright конфигурация** (`playwright.config.ts`)
```typescript
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000' },
  projects: [
    { name: 'chromium' },
    { name: 'firefox' },
    { name: 'webkit' }
  ]
})
```

## 📈 Покрытие кода

### **Цели покрытия**
- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 85%
- **Lines**: > 80%

### **Просмотр отчета**
```bash
pnpm run test:coverage
# Отчет в ./coverage/lcov-report/index.html
```

## 🚨 Обработка ошибок в тестах

### **Async/await**
```typescript
it('должен обрабатывать async операции', async () => {
  const result = await asyncFunction()
  expect(result).toBeDefined()
})
```

### **Ошибки**
```typescript
it('должен выбрасывать ошибку', () => {
  expect(() => {
    throwError()
  }).toThrow('Expected error message')
})
```

## 🔄 CI/CD интеграция

### **GitHub Actions**
```yaml
- name: Run tests
  run: pnpm test

- name: Run E2E tests
  run: pnpm run test:e2e
```

### **Pre-commit hooks**
```bash
# В package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "pnpm test"
    }
  }
}
```

## 📚 Дополнительные ресурсы

- [Jest документация](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright документация](https://playwright.dev/docs/intro)
- [Testing Library принципы](https://testing-library.com/docs/guiding-principles/)
## Playwright в admin-панели

- Дашборд тестов доступен по адресу `/en/admin/monitoring/testing` (`src/views/pages/admin/testing/index.tsx`). Здесь отображаются свежие прогоны и доступна кнопка **Run Tests**.
- Кнопка вызывает API `POST /api/admin/run-tests` (`src/app/api/admin/run-tests/route.ts`), которое запускает `npx playwright test e2e/chat.spec.ts --headed`, ждёт завершения и возвращает stdout/stderr.
- Таблица результатов читает `test-results.json` через `GET /api/admin/test-results` (`src/app/api/admin/test-results/route.ts`). Файл появляется при выполнении `pnpm exec playwright test`.
- Детальный HTML-репорт подгружается в iframe `/api/admin/html-report` (`src/app/api/admin/html-report/route.ts`), который отдаёт `playwright-report/index.html`.
- Перед открытием панели убедись, что тесты недавно выполнялись (через CLI или кнопку Run Tests), иначе API вернёт 404 из-за отсутствия артефактов.

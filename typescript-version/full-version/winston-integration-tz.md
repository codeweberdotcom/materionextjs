# Техническое задание: Интеграция Winston для модульного логирования

## Анализ проекта

**Текущая архитектура логирования:**
- Простой логгер в `src/lib/logger.ts` с выводом в консоль
- Уровни: debug, info, warn, error
- Специализированные методы для Socket.IO событий
- Использование в middleware: auth, errorHandler, rateLimit
- Использование в namespaces: notifications

**Ключевые модули для логирования:**
1. **Socket.IO** (`src/lib/sockets/`): подключения, события, ошибки
2. **Authentication** (`src/lib/sockets/middleware/auth.ts`): JWT верификация, роли, разрешения
3. **Rate Limiting** (`src/lib/sockets/middleware/rateLimit.ts`): лимиты запросов
4. **Notifications** (`src/lib/sockets/namespaces/notifications/`): уведомления, статусы
5. **Database** (Prisma): запросы, ошибки БД
6. **Application**: общее логирование приложения

## Цели интеграции

1. Заменить консольный логгер на Winston с файловым выводом
2. Создать отдельные лог-файлы для каждого модуля
3. Обеспечить структурированное JSON логирование
4. Сохранить обратную совместимость API

## Функциональные требования

### WL-1: Модульная структура логов
- **socket.log**: Все события Socket.IO (подключения, отключения, сообщения)
- **auth.log**: Аутентификация, авторизация, JWT верификация
- **notifications.log**: Создание, обновление, удаление уведомлений
- **rate-limit.log**: Превышения лимитов, блокировки
- **database.log**: Запросы Prisma, ошибки БД
- **app.log**: Общее логирование приложения (ошибки, предупреждения)

### WL-2: Уровни логирования
- **DEBUG**: Детальная отладочная информация
- **INFO**: Общие события (подключения, успешные операции)
- **WARN**: Предупреждения (неудачные попытки, rate limits)
- **ERROR**: Критические ошибки

### WL-3: Формат логов
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "module": "socket",
  "message": "User connected",
  "userId": "user123",
  "socketId": "socket456",
  "ip": "192.168.1.1",
  "metadata": {
    "event": "connection",
    "userAgent": "Mozilla/5.0..."
  }
}
```

### WL-4: Конфигурация
- **Environment variables**:
  - `LOG_LEVEL=info`
  - `LOG_DIR=logs/`
  - `LOG_MAX_SIZE=10m`
  - `LOG_MAX_FILES=5`
- **Development**: Консоль + файлы
- **Production**: Только файлы с ротацией

## Технические требования

### WT-1: Архитектура Winston
```
src/lib/logger/
├── index.ts              # Главный экспорт с обратной совместимостью
├── winston/
│   ├── config.ts         # Основная конфигурация
│   ├── transports.ts     # Транспорты для каждого модуля
│   └── formatters.ts     # JSON форматтеры
├── modules/
│   ├── socket.ts         # Socket.IO логгер
│   ├── auth.ts           # Auth логгер
│   ├── notifications.ts  # Notifications логгер
│   ├── rateLimit.ts      # Rate limit логгер
│   └── database.ts       # Database логгер
└── types.ts              # TypeScript интерфейсы
```

### WT-2: API совместимость
```typescript
// Существующий API должен работать без изменений
import logger from '@/lib/logger'

logger.info('User connected', { userId: '123', socketId: '456' })
logger.socketEvent('message', 'socket123', 'user456', { roomId: 'room1' })

// Новые модульные логгеры
import { socketLogger, authLogger } from '@/lib/logger'

socketLogger.info('Connection established', { socketId: '123' })
authLogger.warn('Invalid token', { userId: '456', ip: '192.168.1.1' })
```

### WT-3: Интеграция с существующими модулями

**Socket.IO Server (`src/server/websocket-server.js`)**:
- Заменить `console.log` на `socketLogger`
- Логировать подключения, сообщения, rate limits

**Auth Middleware (`src/lib/sockets/middleware/auth.ts`)**:
- Использовать `authLogger` для всех auth событий
- Логировать JWT верификацию, роли, разрешения

**Rate Limit Middleware (`src/lib/sockets/middleware/rateLimit.ts`)**:
- `rateLimitLogger` для превышений лимитов
- Детальная информация о блокировках

**Notifications Namespace (`src/lib/sockets/namespaces/notifications/index.ts`)**:
- `notificationsLogger` для CRUD операций
- Логирование отправки уведомлений

**Database Operations**:
- `databaseLogger` для Prisma запросов
- Логирование ошибок подключения

### WT-4: Производительность
- Асинхронная запись в файлы
- Буферизация для снижения I/O нагрузки
- Memory limits для предотвращения утечек

### WT-5: Ротация и архивирование
- Автоматическая ротация при достижении размера
- Сжатие старых файлов (.gz)
- Ограничение количества файлов

## Критерии приемки

### AC-1: Функциональное тестирование
- [ ] Каждый модуль логирует в свой файл
- [ ] JSON формат корректен и парсится
- [ ] Уровни логирования работают
- [ ] Ротация файлов происходит автоматически

### AC-2: Интеграционное тестирование
- [ ] Socket.IO события логируются в socket.log
- [ ] Auth попытки логируются в auth.log
- [ ] Rate limits логируются в rate-limit.log
- [ ] Notifications логируются в notifications.log
- [ ] DB ошибки логируются в database.log

### AC-3: Регрессионное тестирование
- [ ] Существующий код работает без изменений
- [ ] API логгера совместим
- [ ] Производительность не ухудшилась

### AC-4: Документация
- [ ] Создать документацию в папке `docs/logging/`
- [ ] `docs/logging/README.md` - обзор системы логирования
- [ ] `docs/logging/configuration.md` - настройка Winston
- [ ] `docs/logging/modules.md` - описание модульных логгеров
- [ ] `docs/logging/examples.md` - примеры использования
- [ ] Обновить основной `docs/README.md` с ссылками на логирование

## Риски и решения

1. **Производительность**: Тестирование нагрузки перед продакшеном
2. **Дисковое пространство**: Мониторинг размера логов, настройка retention
3. **Совместимость**: Полное покрытие тестами существующего API

## Оценка трудоемкости
- **Анализ и планирование**: 0.5 дня
- **Разработка Winston конфигурации**: 1 день
- **Интеграция с модулями**: 2 дня
- **Тестирование**: 1 день
- **Документация**: 0.5 дня

## Следующие шаги
1. Установка зависимостей (winston, winston-daily-rotate-file)
2. Создание базовой структуры логгеров
3. Интеграция с Socket.IO модулями
4. Тестирование и оптимизация

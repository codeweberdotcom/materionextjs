# План: Рефакторинг WebSocket сервера на standalone архитектуру

**Дата создания:** 2025-12-02  
**Дата завершения:** 2025-12-03  
**Статус:** ✅ Завершено  
**Приоритет:** Высокий  
**Время выполнения:** 1.5 часа  
**Связанный анализ:** [analysis-websocket-standalone-refactor-2025-12-02.md](../../analysis/architecture/analysis-websocket-standalone-refactor-2025-12-02.md)  
**Отчёт:** [report-websocket-standalone-2025-12-03.md](../../reports/deployment/report-websocket-standalone-2025-12-03.md)

---

## 🎯 Цель

Создать независимый WebSocket сервер без зависимости от Next.js для устранения конфликтов и соответствия современным стандартам микросервисной архитектуры.

---

## 📋 Этапы реализации

### Этап 1: Создание standalone WebSocket сервера

**Файл:** `src/server/websocket-standalone.ts`

**Действия:**
1. Создать HTTP сервер без импорта Next.js
2. Инициализировать Socket.IO с существующей конфигурацией
3. Добавить health check endpoint (`/health`, `/metrics`)
4. Настроить graceful shutdown (SIGTERM, SIGINT)
5. Подключить Lucia auth middleware
6. Использовать Redis adapter для синхронизации

**Зависимости:**
- `http` (Node.js)
- `socket.io` (существующий)
- `@/lib/sockets` (существующий)
- `@/lib/logger` (существующий)

**Порт:** 3001 (из ENV: `WEBSOCKET_PORT`)

---

### Этап 2: Обновление конфигурации

#### 2.1 `.env` / `.env.local`

Добавить:
```env
# WebSocket Server
WEBSOCKET_PORT=3001
NEXT_PUBLIC_WS_URL=http://localhost:3001

# Production
# NEXT_PUBLIC_WS_URL=https://ws.yoursite.ru
```

#### 2.2 `package.json`

**Обновить скрипты:**
```json
{
  "dev": "next dev",
  "dev:socket": "tsx src/server/websocket-standalone.ts",
  "dev:full": "pnpm docker:up && pnpm pg:up && npx prisma generate && concurrently \"pnpm dev:socket\" \"pnpm dev\"",
  "full": "pnpm dev:full",
  
  "build": "next build",
  "build:full": "pnpm docker:up && pnpm pg:up && npx prisma generate && npx prisma db push && next build",
  
  "start": "next start",
  "start:socket": "node --loader tsx src/server/websocket-standalone.ts",
  "start:full": "concurrently \"pnpm start:socket\" \"pnpm start\"",
  
  "prod": "pnpm start:full"
}
```

---

### Этап 3: Обновление клиентской части

#### 3.1 Socket.IO клиент

**Файл:** `src/lib/sockets/client.ts` (или где инициализируется socket)

**Изменения:**
```typescript
// Старый код:
const socket = io()

// Новый код:
const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001'
const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
})
```

#### 3.2 Обновить все компоненты с Socket.IO

**Затронутые файлы:**
- `src/app/[lang]/(dashboard)/(private)/apps/chat/ChatWrapper.tsx`
- `src/components/layout/shared/NotificationDropdown.tsx`
- Другие компоненты, использующие socket

**Проверить:** Все компоненты должны использовать клиент из `src/lib/sockets/client.ts`

---

### Этап 4: Миграция старого сервера

#### 4.1 Переименовать старый файл

```bash
mv src/server/websocket-server-new.ts src/server/websocket-server-new.ts.old
```

**Причина:** Сохранить для справки, удалить после тестирования

#### 4.2 Создать новый standalone сервер

**Структура:**
```typescript
import { createServer } from 'http'
import { initializeSocketServer } from '@/lib/sockets'
import logger from '@/lib/logger'

const PORT = process.env.WEBSOCKET_PORT || 3001

async function main() {
  // HTTP сервер БЕЗ Next.js
  const httpServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        status: 'ok', 
        service: 'websocket',
        uptime: process.uptime(),
        connections: io.engine.clientsCount
      }))
      return
    }
    res.writeHead(404)
    res.end()
  })

  // Socket.IO
  const io = await initializeSocketServer(httpServer)
  globalThis.io = io

  // Start
  httpServer.listen(PORT, () => {
    logger.info('🚀 WebSocket server started', {
      port: PORT,
      environment: process.env.NODE_ENV,
      namespaces: ['/chat', '/notifications'],
    })
  })

  // Graceful shutdown
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main()
```

---

### Этап 5: Тестирование

#### 5.1 Локальное тестирование

**Проверить:**
- ✅ `pnpm dev` (только Next.js) — работает
- ✅ `pnpm dev:socket` (только WebSocket) — работает
- ✅ `pnpm full` (оба через concurrently) — работает без ошибок
- ✅ Подключение клиента к WebSocket на порту 3001
- ✅ Отправка/получение сообщений в чате
- ✅ Real-time уведомления
- ✅ Health check: `curl http://localhost:3001/health`

#### 5.2 Production-like тестирование

**Build и запуск:**
```bash
pnpm build:full
pnpm start:full
```

**Проверить:**
- ✅ Оба сервера запускаются
- ✅ WebSocket подключается к production build
- ✅ Нет ошибок в консоли

---

### Этап 6: Документация

#### 6.1 Обновить ROOT_FILES_DESCRIPTION.md

Добавить секцию:

```markdown
## 🔌 WebSocket Server (Standalone)

### Архитектура

Standalone WebSocket сервер на отдельном порту (3001) без зависимости от Next.js.

### Структура файлов

| Путь | Назначение |
|------|------------|
| `src/server/websocket-standalone.ts` | Главный файл WebSocket сервера |
| `src/lib/sockets/index.ts` | Инициализация Socket.IO |
| `src/lib/sockets/namespaces/chat.ts` | Namespace /chat |
| `src/lib/sockets/namespaces/notifications.ts` | Namespace /notifications |
| `src/lib/sockets/client.ts` | Клиент Socket.IO (frontend) |

### Порты

| Сервис | Dev | Production |
|--------|-----|------------|
| Next.js | 3000 | 3000 |
| WebSocket | 3001 | 3001 |

### ENV переменные

```env
WEBSOCKET_PORT=3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```
```

#### 6.2 Создать отчёт о выполнении

**Файл:** `docs/reports/deployment/report-websocket-standalone-2025-12-02.md`

---

## 🚀 Production деплой

### PM2 конфигурация

**Файл:** `ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'materio-nextjs',
      script: 'npm',
      args: 'start',
      cwd: './typescript-version/full-version',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        PORT: 3000,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'materio-websocket',
      script: 'node',
      args: '--loader tsx src/server/websocket-standalone.ts',
      cwd: './typescript-version/full-version',
      instances: 1,
      exec_mode: 'fork',
      env: {
        WEBSOCKET_PORT: 3001,
        NODE_ENV: 'production'
      }
    }
  ]
}
```

### Nginx reverse proxy

**Конфигурация:**
```nginx
# /etc/nginx/sites-available/materio

upstream nextjs {
    server localhost:3000;
}

upstream websocket {
    server localhost:3001;
}

server {
    listen 80;
    server_name yoursite.ru;

    # Next.js
    location / {
        proxy_pass http://nextjs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Для клиента всё на одном домене:**
```typescript
// Production
const socket = io('https://yoursite.ru', {
  path: '/socket.io/',
})
```

---

## 🔍 Риски и митигация

| Риск | Вероятность | Митигация |
|------|:-----------:|-----------|
| Клиент не подключается к новому порту | Средняя | Проверить ENV переменные, добавить fallback |
| Потеря Redis синхронизации | Низкая | Тестирование Redis adapter |
| Проблемы CORS | Средняя | Настроить CORS в Socket.IO config |
| Старый код сломается | Низкая | Сохранить старый файл `.old`, rollback при проблемах |

---

## 📊 Критерии успеха

- ✅ `pnpm full` запускается без ошибок `.next/trace`
- ✅ WebSocket сервер доступен на порту 3001
- ✅ Next.js работает на порту 3000
- ✅ Клиент подключается к WebSocket
- ✅ Чат и уведомления работают
- ✅ Health check отвечает
- ✅ Документация обновлена

---

## ⏱️ Оценка времени

| Этап | Время |
|------|:-----:|
| Создание standalone сервера | 15 мин |
| Обновление конфигурации | 5 мин |
| Обновление клиента | 10 мин |
| Тестирование | 15 мин |
| Документация | 10 мин |
| **Итого** | **55 мин** |

---

## 📝 Чек-лист реализации

### Backend
- [ ] Создать `websocket-standalone.ts`
- [ ] Добавить health check endpoint
- [ ] Настроить graceful shutdown
- [ ] Обновить `package.json` скрипты
- [ ] Добавить ENV переменные

### Frontend
- [ ] Обновить Socket.IO client подключение
- [ ] Проверить все компоненты с socket
- [ ] Добавить fallback для dev/production URL

### DevOps
- [ ] Обновить `.env.example`
- [ ] Создать `ecosystem.config.js`
- [ ] Документировать Nginx конфигурацию

### Тестирование
- [ ] Запуск `pnpm full` без ошибок
- [ ] Подключение клиента
- [ ] Отправка сообщений в чат
- [ ] Real-time уведомления
- [ ] Health check работает
- [ ] Production build работает

### Документация
- [ ] Обновить `ROOT_FILES_DESCRIPTION.md`
- [ ] Создать отчёт о выполнении
- [ ] Обновить `STATUS_INDEX.md`

---

## 🎓 Следующие шаги

1. ✅ **Анализ проведён** → `analysis-websocket-standalone-refactor-2025-12-02.md`
2. ✅ **План создан** → Этот документ
3. ⏳ **Реализация** → Начать рефакторинг
4. ⏳ **Тестирование** → Проверить функциональность
5. ⏳ **Отчёт** → Создать deployment report
6. ⏳ **Документация** → Обновить корневые файлы


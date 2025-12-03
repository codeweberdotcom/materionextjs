# Настройка WebSocket сервера (Standalone)

**Дата:** 2025-12-02  
**Статус:** Активно

---

## 📝 ENV переменные

Добавьте в ваш `.env` или `.env.local` файл:

```env
# WebSocket Server
WEBSOCKET_PORT=3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

**Описание:**
- `WEBSOCKET_PORT` - порт для standalone WebSocket сервера (по умолчанию: 3001)
- `NEXT_PUBLIC_WS_URL` - публичный URL WebSocket сервера для клиента (по умолчанию: http://localhost:3001)

**Production:**
```env
NEXT_PUBLIC_WS_URL=https://ws.yoursite.ru
```

---

## 🚀 Запуск

### Development:
```bash
pnpm full
```

Это запустит:
1. Docker сервисы (PostgreSQL, Redis, MinIO, etc.)
2. Next.js на порту 3000
3. WebSocket сервер на порту 3001

### Только WebSocket:
```bash
pnpm dev:socket
```

### Только Next.js:
```bash
pnpm dev
```

---

## ✅ Проверка

### Health Check:
```bash
curl http://localhost:3001/health
```

Должен вернуть:
```json
{
  "status": "ok",
  "service": "websocket",
  "uptime": 123.45,
  "port": 3001,
  "environment": "development"
}
```

---

## 📚 См. также

- [План рефакторинга](../plans/active/plan-websocket-standalone-refactor-2025-12-02.md)
- [Анализ архитектуры](../analysis/architecture/analysis-websocket-standalone-refactor-2025-12-02.md)


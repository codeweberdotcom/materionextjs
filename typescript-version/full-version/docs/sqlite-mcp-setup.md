# Настройка SQLite MCP сервера в Kilo Code

## Обзор

Этот документ описывает процесс настройки Model Context Protocol (MCP) сервера для работы с SQLite базой данных в Kilo Code.

## Требования

- Node.js 18+
- TypeScript
- Kilo Code с поддержкой MCP

## Установка и настройка

### 1. Сборка MCP сервера

MCP сервер SQLite находится в директории `../../../Users/web/AppData/Roaming/Kilo-Code/MCP/sqlite-server/`.

Для сборки сервера выполните:

```bash
cd ../../../Users/web/AppData/Roaming/Kilo-Code/MCP/sqlite-server
npm run build
```

### 2. Конфигурация MCP в Kilo Code

Создайте или отредактируйте файл `.kilocode/mcp.json` в корне проекта:

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "node",
      "args": [
        "c:/Users/web/AppData/Roaming/Kilo-Code/MCP/sqlite-server/build/index.js",
        "--db-path",
        "c:/laragon/www/materionextjs/typescript-version/full-version/src/prisma/dev3.db"
      ],
      "disabled": false,
      "alwaysAllow": []
    }
  }
}
```

### 3. Проверка подключения

После настройки MCP сервер должен автоматически запуститься. В логах Kilo Code вы увидите:

```
SQLite MCP server running on stdio
Connected to SQLite database at c:/laragon/www/materionextjs/typescript-version/full-version/src/prisma/dev3.db
```

## Доступные инструменты

MCP сервер предоставляет следующие инструменты для работы с базой данных:

- `execute_query` - Выполнение произвольных SQL запросов
- `create_table` - Создание новых таблиц
- `insert_data` - Вставка данных в таблицы
- `select_data` - Выборка данных из таблиц

## Структура базы данных

База данных содержит следующие основные таблицы:

- `User` - Пользователи системы
- `Role` - Роли пользователей
- `VerificationToken` - Токены верификации
- `Account` - Аккаунты OAuth
- `Session` - Сессии пользователей
- `Language`, `Country`, `Currency` - Справочные данные
- `ChatRoom`, `Message` - Чат система
- `Notification` - Уведомления
- `RateLimit*` - Ограничения скорости

## Устранение неполадок

### Ошибка "Connection closed"

1. Проверьте путь к файлу базы данных в конфигурации
2. Убедитесь, что файл базы данных существует
3. Проверьте права доступа к файлу

### Ошибка "Module not found"

1. Убедитесь, что MCP сервер собран (`npm run build`)
2. Проверьте пути в конфигурации

### База данных не обновляется

1. Проверьте, что MCP подключен к правильному файлу базы данных
2. Сравните размер файла - рабочая база должна быть больше 300KB
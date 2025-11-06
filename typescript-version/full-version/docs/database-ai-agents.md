# Работа с базой данных для AI агентов

## Обзор

Этот документ описывает возможности работы с SQLite базой данных через MCP сервер для AI агентов в Kilo Code.

## Доступные инструменты

### 1. execute_query

Выполняет произвольные SQL запросы.

**Примеры использования:**

```sql
-- Получить всех пользователей
SELECT * FROM User;

-- Найти пользователя по email
SELECT * FROM User WHERE email = 'user@example.com';

-- Получить статистику по ролям
SELECT roleId, COUNT(*) as count FROM User GROUP BY roleId;
```

### 2. create_table

Создает новые таблицы в базе данных.

**Пример:**

```sql
CREATE TABLE test_table (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3. insert_data

Вставляет данные в существующие таблицы.

**Пример:**

```sql
INSERT INTO User (name, email, password, roleId)
VALUES ('Test User', 'test@example.com', 'hashed_password', 'role_id');
```

### 4. select_data

Выбирает данные из таблиц с возможностью фильтрации.

**Примеры:**

```sql
-- Все пользователи
SELECT * FROM User;

-- Пользователи с определенной ролью
SELECT * FROM User WHERE roleId = 'admin';

-- С лимитом
SELECT * FROM User LIMIT 10;
```

## Структура базы данных

### Основные таблицы

#### User
- `id` - Уникальный идентификатор
- `name` - Имя пользователя
- `email` - Email адрес
- `password` - Хэшированный пароль
- `emailVerified` - Дата верификации email
- `roleId` - ID роли
- `language` - Язык интерфейса
- `currency` - Валюта
- `country` - Страна
- `isActive` - Статус активности
- `createdAt` - Дата создания
- `updatedAt` - Дата обновления

#### Role
- `id` - Уникальный идентификатор
- `name` - Название роли (superadmin, admin, user, etc.)

#### VerificationToken
- `identifier` - Идентификатор (обычно email)
- `token` - Токен верификации
- `expires` - Дата истечения

#### Account (OAuth аккаунты)
- `id` - Уникальный идентификатор
- `userId` - ID пользователя
- `type` - Тип аккаунта
- `provider` - Провайдер (google, github, etc.)
- `providerAccountId` - ID в провайдере
- `refresh_token`, `access_token` - Токены OAuth
- `expires_at` - Время истечения

#### Session
- `id` - Уникальный идентификатор
- `sessionToken` - Токен сессии
- `userId` - ID пользователя
- `expires` - Время истечения

### Справочные таблицы

- `Language` - Доступные языки
- `Country` - Страны
- `Currency` - Валюты
- `State` - Штаты/области
- `City` - Города
- `District` - Районы

### Бизнес-логика таблицы

- `ChatRoom` - Комнаты чата
- `Message` - Сообщения
- `Notification` - Уведомления
- `EmailTemplate` - Шаблоны email
- `Translation` - Переводы интерфейса
- `RateLimit*` - Ограничения скорости API
- `UserBlock` - Блокировки пользователей

## Рекомендации по использованию

### 1. Безопасность

- Не выполняйте запросы с пользовательским вводом без валидации
- Используйте подготовленные запросы при работе с переменными
- Ограничьте доступ к чувствительным таблицам

### 2. Производительность

- Используйте индексы для часто запрашиваемых полей
- Ограничивайте количество возвращаемых записей (LIMIT)
- Избегайте SELECT * для больших таблиц

### 3. Работа с данными

- Всегда проверяйте существование записей перед обновлением
- Используйте транзакции для связанных операций
- Валидируйте данные перед вставкой

## Примеры сценариев

### Создание тестового пользователя

```sql
-- Найти ID роли admin
SELECT id FROM Role WHERE name = 'admin';

-- Создать пользователя
INSERT INTO User (id, name, email, password, roleId, isActive)
VALUES ('test-user-id', 'Test User', 'test@example.com', 'hashed_pass', 'admin-role-id', true);
```

### Работа с токенами верификации

```sql
-- Создать токен
INSERT INTO VerificationToken (identifier, token, expires)
VALUES ('user@example.com', 'random-token-123', '2025-12-31 23:59:59');

-- Проверить токен
SELECT * FROM VerificationToken
WHERE identifier = 'user@example.com' AND token = 'random-token-123' AND expires > datetime('now');
```

### Аналитика пользователей

```sql
-- Статистика по ролям
SELECT r.name as role_name, COUNT(u.id) as user_count
FROM Role r
LEFT JOIN User u ON r.id = u.roleId
GROUP BY r.id, r.name;

-- Активные пользователи по странам
SELECT country, COUNT(*) as count
FROM User
WHERE isActive = true
GROUP BY country
ORDER BY count DESC;
```

## Мониторинг и отладка

### Проверка подключения

MCP сервер логирует подключение к базе:
```
Connected to SQLite database at [path]
```

### Просмотр структуры таблиц

```sql
-- Список всех таблиц
SELECT name FROM sqlite_master WHERE type='table';

-- Структура конкретной таблицы
PRAGMA table_info(User);
```

### Проверка данных

```sql
-- Количество записей в таблице
SELECT COUNT(*) FROM User;

-- Последние добавленные пользователи
SELECT * FROM User ORDER BY createdAt DESC LIMIT 5;
```

## Расширение функциональности

При необходимости можно добавить новые инструменты в MCP сервер:

1. Редактировать `src/index.ts` в директории sqlite-server
2. Добавить новый метод в `server.setRequestHandler`
3. Пересобрать сервер (`npm run build`)
4. Обновить документацию

## Поддержка

При возникновении проблем с базой данных или MCP сервером обращайтесь к логам Kilo Code и проверяйте:

1. Корректность путей в конфигурации
2. Наличие файла базы данных
3. Права доступа к файлу
4. Корректность SQL запросов
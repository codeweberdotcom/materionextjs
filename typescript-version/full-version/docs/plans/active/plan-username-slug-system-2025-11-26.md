# План: Система Username/Slug для User и Account

**Дата создания:** 2025-11-26  
**Статус:** ✅ Завершено  
**Приоритет:** Высокий

## Цель

Добавить уникальные username (для User) и slug (для Account) для формирования публичных URL профилей и страниц продавцов.

## Требования

### Основные

| Требование | Описание |
|------------|----------|
| Автогенерация | При регистрации/создании генерируется автоматически |
| Уникальность | Глобально уникальные в пределах таблицы |
| Изменяемость | Можно менять раз в 30 дней (настраивается в админке) |
| История | Хранить старые slug для 301 редиректа |
| Формат | Только lowercase латиница, цифры, underscore |

### Правила формирования

```
Источник                    → Результат
─────────────────────────────────────────
Иван Петров                 → ivan_petrov
Анна-Мария Иванова          → anna_maria_ivanova
ООО "Ромашка"               → ooo_romashka
BMW Official Store          → bmw_official_store
Café & Restaurant           → cafe_restaurant
Пользователь123             → polzovatel123

Если занято:
ivan_petrov                 → ivan_petrov_1
ivan_petrov_1               → ivan_petrov_2
```

### Запрещённые символы

```
? = ; : @ # $ % ^ & * ( ) + [ ] { } | \ / < > " ' ` ~
```

### Зарезервированные имена

```
admin, administrator, support, help, api, www, static, 
assets, user, users, account, accounts, settings, profile,
login, logout, register, auth, admin, moderator, system,
null, undefined, true, false, new, edit, delete, create
```

## Архитектура

### Схема БД

```prisma
// Добавить в User
model User {
  id                String    @id @default(cuid())
  username          String    @unique
  usernameChangedAt DateTime? // Последнее изменение username
  name              String?
  ...
}

// Добавить в UserAccount
model UserAccount {
  id            String    @id @default(cuid())
  slug          String    @unique
  slugChangedAt DateTime? // Последнее изменение slug
  name          String
  ...
}

// Новая модель для истории
model SlugHistory {
  id         String   @id @default(cuid())
  entityType String   // 'user' | 'account'
  entityId   String   // ID пользователя или аккаунта
  oldSlug    String   // Старый slug
  newSlug    String   // Новый slug
  changedAt  DateTime @default(now())
  
  @@index([entityType, oldSlug])
  @@index([entityId])
}
```

### SlugService

```typescript
interface SlugService {
  // Генерация slug из текста
  generateSlug(source: string): string
  
  // Генерация уникального slug с проверкой в БД
  generateUniqueSlug(
    source: string, 
    entityType: 'user' | 'account',
    excludeId?: string
  ): Promise<string>
  
  // Проверка доступности
  isSlugAvailable(
    slug: string, 
    entityType: 'user' | 'account',
    excludeId?: string
  ): Promise<boolean>
  
  // Смена slug с проверкой лимита
  changeSlug(
    entityType: 'user' | 'account',
    entityId: string,
    newSlug: string
  ): Promise<{ success: boolean; error?: string }>
  
  // Поиск по старому slug (для редиректа)
  findByOldSlug(
    entityType: 'user' | 'account',
    oldSlug: string
  ): Promise<{ currentSlug: string; entityId: string } | null>
  
  // Транслитерация
  transliterate(text: string): string
}
```

### URL Структура

```
/user/[username]     → Публичный профиль пользователя
/company/[slug]      → Страница компании (аккаунта)
```

### Middleware для редиректов

```typescript
// middleware.ts
if (pathname.startsWith('/user/') || pathname.startsWith('/company/')) {
  const type = pathname.split('/')[1] // 'user' | 'company'
  const slug = pathname.split('/')[2]
  const entityType = type === 'user' ? 'user' : 'account'
  const redirect = await slugService.findByOldSlug(entityType, slug)
  if (redirect) {
    return NextResponse.redirect(`/${type}/${redirect.currentSlug}`, 301)
  }
}
```

## Этапы реализации

### Этап 1: База данных (1-2 часа) ✅
- [x] Добавить поля в schema.prisma
- [x] Создать модель SlugHistory
- [x] Выполнить миграцию
- [x] Заполнить username существующим пользователям

### Этап 2: SlugService (2-3 часа) ✅
- [x] Создать сервис транслитерации
- [x] Создать SlugService
- [x] Добавить валидацию
- [x] Добавить проверку зарезервированных имён
- [x] Unit тесты

### Этап 3: Интеграция в регистрацию (1-2 часа) ✅
- [x] Обновить API регистрации
- [x] Обновить API создания аккаунта
- [x] Генерация username/slug при создании

### Этап 4: API для смены slug (1-2 часа) ✅
- [x] API: PUT /api/user/username
- [x] API: PUT /api/account/[id]/slug
- [x] Проверка лимита 30 дней
- [x] Запись в историю

### Этап 5: Админка (2-3 часа) ✅
- [x] Настройка лимита смены (дни)
- [x] API настроек /api/admin/settings/slug
- [x] Принудительная смена администратором

### Этап 6: Публичные страницы (3-4 часа) ✅

**Существующие шаблоны MUI:**
- `src/views/pages/user-profile/` - готовый шаблон профиля
- `UserProfileHeader.tsx` - шапка с аватаром
- `AboutOverview.tsx` - информация о пользователе

**Задачи:**
- [x] Создать `/user/[username]/page.tsx` - публичный профиль
- [x] Создать `/company/[slug]/page.tsx` - страница компании
- [x] Создать `PublicUserProfile` компонент
- [x] Создать `PublicCompanyProfile` компонент
- [x] 301 редиректы через SlugService
- [x] SEO meta tags (title, description, og:image)

### Этап 7: Импорт/Экспорт (1 час) ✅
- [x] Обновить UserAdapter - использовать реальное поле username
- [x] Поддержка username в экспорте/импорте

## Оценка времени

| Этап | Время |
|------|-------|
| База данных | 1-2 ч |
| SlugService | 2-3 ч |
| Регистрация | 1-2 ч |
| API смены | 1-2 ч |
| Админка | 2-3 ч |
| Публичные страницы | 3-4 ч |
| Импорт/Экспорт | 1 ч |
| **Итого** | **11-17 ч** |

## Риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Коллизии при генерации | Низкая | Среднее | Проверка уникальности + суффикс |
| Производительность истории | Низкая | Низкое | Индексы в БД |
| SEO при смене slug | Средняя | Среднее | 301 редирект |

## Транслитерация (примеры)

```
а→a  б→b  в→v  г→g  д→d  е→e  ё→yo  ж→zh  з→z  и→i
й→y  к→k  л→l  м→m  н→n  о→o  п→p  р→r  с→s  т→t
у→u  ф→f  х→kh ц→ts ч→ch ш→sh щ→sch ъ→   ы→y  ь→
э→e  ю→yu я→ya
```

## Согласование

- [x] План согласован
- [x] Реализация завершена

## Созданные файлы

### База данных
- `prisma/schema.prisma` - поля username, slug, модели SlugHistory, SlugSettings
- `prisma/migrations-scripts/populate-usernames.ts` - скрипт заполнения

### SlugService
- `src/services/slug/SlugService.ts` - основной сервис
- `src/services/slug/index.ts` - экспорт
- `tests/unit/services/slug-service.test.ts` - unit тесты

### API
- `src/app/api/user/username/route.ts` - GET/PUT username
- `src/app/api/user/username/check/route.ts` - проверка доступности
- `src/app/api/account/[id]/slug/route.ts` - GET/PUT slug аккаунта
- `src/app/api/admin/users/[id]/username/route.ts` - админ смена username
- `src/app/api/admin/settings/slug/route.ts` - настройки slug

### Публичные страницы
- `src/app/[lang]/user/[username]/page.tsx` - профиль пользователя
- `src/app/[lang]/company/[slug]/page.tsx` - страница компании
- `src/views/pages/public-profile/PublicUserProfile.tsx`
- `src/views/pages/public-profile/PublicCompanyProfile.tsx`

### Обновлённые файлы
- `src/app/api/register/route.ts` - генерация username при регистрации
- `src/services/accounts/AccountService.ts` - генерация slug при создании
- `src/services/adapters/UserAdapter.ts` - поддержка username в экспорте

## Дополнительные файлы (фаза 2)

### UI компоненты
- `src/views/pages/account-settings/account/UsernameCard.tsx` - карточка смены username
- `src/views/admin/settings/SlugSettings.tsx` - страница настроек slug в админке
- `src/app/[lang]/(dashboard)/(private)/admin/settings/slug/page.tsx` - route для настроек

### Навигация
- `src/data/navigation/verticalMenuData.tsx` - добавлен пункт "Username Settings"
- `src/data/dictionaries/en.json`, `ru.json`, `ar.json` - переводы slugSettings

### E2E тесты
- `tests/e2e/username/username-change.spec.ts` - тесты для username системы
- `src/data/testing/test-scripts.ts` - добавлен в список тестов мониторинга


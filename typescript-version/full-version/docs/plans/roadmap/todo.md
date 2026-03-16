# RateLimit TODO / Backlog

## i18n / Локализация

1. **404 для отключённых языков** *(SEO)*
   - Отключённые в `languages.json` локали должны возвращать 404, а не редиректить
   - Реализовать через `notFound()` в `src/app/[lang]/layout.tsx` — проверять что `lang` есть в `i18n.locales`
   - Тогда поисковик не индексирует `/en/...` вообще (без лишних редиректов)

2. **Редирект по языку браузера** *(UX)*
   - При обращении к неизвестному/отключённому локалю — определять язык из `Accept-Language` заголовка
   - Если язык браузера есть в `i18n.locales` → редирект туда
   - Иначе → `defaultLocale`
   - Актуально для middleware

---

## Онбординг / Выбор типа аккаунта

1. **Страница выбора типа аккаунта** *(onboarding)*
   - Создать отдельную страницу `/onboarding/account-type` (или аналогичный маршрут)
   - Показывать карточки выбора: LISTING / COMPANY / NETWORK (UI уже готов — перенести из Register.tsx)
   - **Редирект:** срабатывать после успешной регистрации И после входа в аккаунт
   - **Проверка при входе:** если `accountType` не выбран (null / дефолт не подтверждён) — показывать страницу выбора перед дашбордом
   - Сохранять выбранный тип в БД (`Account.type`) через существующий API
   - Переводы: ключи `register.accountType*` уже есть во всех 4 словарях (`en/ru/fr/ar`) — переиспользовать
   - После выбора → редирект на дашборд

## Карточка пользователя

1. **Блокировки в профиле пользователя** *(admin/users/view)*
   - Добавить секцию "Блокировки" на страницу просмотра пользователя (`/apps/user/view?id=...`)
   - Показывать активные и истёкшие блоки пользователя
   - Связывать через `UserBlock.userId` и `UserBlock.emailHash` (HMAC от email)
   - Показывать: модуль, причину, дату блока, срок действия, автора
   - Кнопка "Снять блок" для активных блоков (superadmin/admin)
   - Ссылка на страницу `/admin/blocks` с фильтром по пользователю

## Backlog

1. **PII / ipHash** *(RateLimitService, EventService)*
   - Добавить поля `ipHash`, `ipPrefix`, `hashVersion` в `RateLimitEvent` и `UserBlock`.
   - Хэшировать IP через HMAC (секрет хранить в `.env`, см. `RATE_LIMIT_IP_HASH_SECRET`).
   - Настроить ретеншн (cron) для raw IP и событий.
2. **Тесты** *(rate-limit stores + API)*
   - PrismaRateLimitStore (warn, block, resetCache).
   - RedisRateLimitStore (monitor/enforce, cache reset, meta keys).
   - RateLimitService (fail-fast, manual blocks, events).
   - API (`/api/admin/rate-limits`, `/api/admin/rate-limits?view=states`).
3. **Модуль Events** *(EventService)*
   - Реализовать EventService и таблицу Event (см. "Техническое задание ... Events.MD").
   - Встроить rate-limit события и унифицировать ретеншн.
4. **Документация** *(docs/monitoring, README)*
   - Расширить операционный гайд (примеры cron-задач, ipHash-политика).
   - Дополнить README разделом о мониторинге rate-limit (готово) и при необходимости расширить.
5. **PII Retention** *(Security/Compliance)*
   - Описать процедуру ротации `hashVersion` и хранения секретов.
6. **Unit/Integration tests for API** *(Next.js API)*
   - Проверить курсорную пагинацию states/events.
   - Валидация PUT/DELETE запросов.
7. **Миграция schema/seed** *(Prisma)*
   - Обновить seed, добавив конфиги для новых модулей/l18n.

документа---

# Data Sanitization Module ✅

**Статус**: Завершен и документирован

### Реализованная функциональность:
- ✅ **DataSanitizationService** - сервис для безопасной очистки данных
- ✅ **3 режима очистки**: DELETE, ANONYMIZE, SELECTIVE
- ✅ **API endpoint**: `/api/admin/data-sanitization`
- ✅ **GDPR compliance**: анонимизация вместо удаления
- ✅ **Безопасность**: защита от удаления реальных данных
- ✅ **Preview режим**: безопасное тестирование операций
- ✅ **Unit тесты**: 10 тестов, полное покрытие
- ✅ **Документация**: `docs/data-sanitization.md`
- ✅ **Документация по тестам**: обновлена `docs/testing/unit-tests.md`
- ✅ **Аудит логирование**: все операции логируются

### Документация:
- 📖 [Data Sanitization Service Guide](data-sanitization.md)

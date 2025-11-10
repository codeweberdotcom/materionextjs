### Обзор и цель
Этот документ фиксирует рекомендации по безопасности для Materio MUI Next.js Admin Template (Next.js 15/RSC, TypeScript, Prisma, Socket.IO, Lucia Auth, SMTP). Цели: снизить риски XSS/CSRF/SSRF/RCE/IDOR, укрепить аутентификацию/авторизацию, защитить API/Socket, секреты и пайплайн.

---

### 1) Модель угроз (что защищаем)
- Аккаунты админов/пользователей (перехват сессий, брутфорс, фишинг).
- Данные БД (чаты, уведомления, пользователи, SMTP-пароли) — несанкционированный доступ/утечка.
- Инфраструктура real-time (Socket.IO) — подмена событий, DDoS каналов.
- Почтовая система — рассылка спама, SSRF через вебхуки/URL.
- Панель администратора — IDOR (доступ к чужим ресурсам), уязвимости UI (XSS/Clickjacking).

---

### 2) Базовые security headers и политика контента
Рекомендуется включить строгое подмножество заголовков через Next middleware или `headers()`:
- Content-Security-Policy (CSP) с nonce для inline-скриптов:
  - Пример (минималистично, адаптируйте под CDN/шрифты):
    ```http
    Content-Security-Policy: default-src 'self';
      script-src 'self' 'nonce-<nonce>' 'strict-dynamic';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      font-src 'self' https: data:;
      connect-src 'self' https://api.yourdomain.tld ws://localhost:3003 wss://socket.yourdomain.tld; 
      frame-ancestors 'none';
      base-uri 'self';
      form-action 'self'
    ```
- Strict-Transport-Security (HSTS): `max-age=63072000; includeSubDomains; preload` (только после уверенного HTTPS).
- X-Frame-Options: `DENY` (или CSP frame-ancestors как выше).
- Referrer-Policy: `strict-origin-when-cross-origin`.
- Permissions-Policy: запретить лишние API (camera, microphone, geolocation и т.п.).
- X-Content-Type-Options: `nosniff`.
- Cross-Origin-Resource-Policy: `same-origin` (или `same-site` при необходимости).
- Cross-Origin-Opener-Policy: `same-origin` (изолированность контекста).
- Cross-Origin-Embedder-Policy: при необходимости `require-corp` (только если понимаете последствия).

Реализация: добавить генерацию `nonce` в middleware и прокинуть в layout; запрещать инлайны без nonce.

---

### 3) Аутентификация и сессии (Lucia Auth)
- Cookies: `Secure; HttpOnly; SameSite=Lax|Strict` (для панелей админов чаще `Strict`, но следите за OAuth/редиректами).
- Фиксация сессии: ротация session id при логине/эскалации прав.
- Ограничение срока жизни и idle-timeout, принудительная ревокация при смене пароля.
- MFA (TOTP/WebAuthn) для админских аккаунтов; хранить факты прохождения MFA в сессии (Binding).
- Защита от брутфорса: rate-limit на логин/ввод TOTP, задержки при ошибках, одинаковые ответы при неверном логине/пароле.
- Повышение доверия: при критичных действиях — повторная проверка пароля/2FA (re-auth step-up).

---

### 4) CSRF защита
- Для state-changing запросов из браузера:
  - Используйте `SameSite=Strict`/`Lax` cookie и/или double-submit cookie токены.
  - Для Server Actions/форм — внедрить CSRF-токен (на уровне UI формы и проверки на сервере).
  - Для API, вызываемых через `fetch` из SPA — предпочтительно использовать Bearer (header) либо устанавливать custom header + проверка `Origin/Referer`.
- Блокировать CORS для сторонних источников, разрешать только доверенные домены; preflight проверка.

---

### 5) XSS и безопасность UI
- React экранирует по умолчанию — избегать `dangerouslySetInnerHTML`. Если неизбежно — sanitize (DOMPurify) белым списком (строгим) и «замораживать» стиль/скрипт теги.
- MUI: не подставлять пользовательские строки в `sx` без валидации. Стили должны быть декларативными.
- Настроить Next Image `domains` для внешних изображений. Запрещать произвольные data-URL, если не нужно.
- Не хранить секреты в `NEXT_PUBLIC_*` переменных.
- Валидация и нормализация HTML/Markdown (если поддерживаются) — строгий sanitize профиль.

---

### 6) Ввод/вывод и валидация данных
- Единый слой валидации через `zod` для всех API/Actions/Socket payloads.
- Нормализация: тримминг, нормализация email/urls, ограничения длины строк.
- Типы файлов и размер — проверять на сервере, MIME sniffing не доверять; для изображений — re-encode/strip metadata.
- Унифицированный формат ошибок (ProblemDetails) без утечки стека в проде.

---

### 7) Prisma/БД безопасность
- Использовать параметризованные запросы (Prisma делает это по умолчанию). Избегать `prisma.$queryRawUnsafe`.
- Миграции — код-ревью, контроль разрушающих изменений; безопасные default-значения; индексы для полей фильтрации.
- Политики доступа на уровне приложения: IDOR-защита — в каждом запросе фильтровать по текущему пользователю/tenantId.
- Soft-delete (`deletedAt`) и фильтры по умолчанию для сущностей, не доступных пользователю.
- Транзакции (`$transaction`) для консистентных операций.

---

### 8) Авторизация (RBAC/ABAC) и IDOR
- Централизованный policy-слой: `can(user).action('Resource', context)`.
- Применять политики в UI (скрыть) и на сервере (жёстко). UI — не источник правды.
- Проверки на уровне репозиториев: любые `find/read/update` — ограничены контекстом пользователя/tenant.
- Audit trail для чувствительных действий (кто/что/когда/откуда), хранение IP/UA.

---

### 9) Rate limiting, защита от брутфорса и DoS
- Global & per-route лимиты (логин/пароль, запросы к SMTP, Socket handshake):
  - Token bucket/Sliding window (Redis). Учитывать IP+аккаунт, экспоненциальные задержки.
- Protection на Socket.IO: ограничить частоту событий (message/send, markAsRead), disconnect при превышении.
- Загрузка файлов — лимит размера, количество за интервал.
- Включить gzip/br (по умолчанию в платформах), лимитировать размер тела запроса в Next (route handlers).

---

### 10) Socket.IO безопасность
- Аутентификация при handshake по Lucia-токену, проверка истечения/отзыва токена, периодический re-auth.
- Разграничение комнат (по userId/tenantId), запрет подписок на чужие каналы.
- Валидация payload (zod) для каждого события, ограничение частоты, максимальная длина сообщений.
- При горизонтальном масштабировании — Redis adapter, авторизация на каждом узле.

---

### 11) Безопасность почтовой подсистемы
- Санитизировать шаблоны email — не вставлять сырые HTML из пользовательского ввода.
- Прятать SMTPсекреты, хранить шифрованно (KMS/secret manager), не логировать пароли.
- Web-предпросмотр/вебхуки: валидировать источники (подписи), запрещать SSRF (не ходить по произвольным URL из писем/вебхуков).

---

### 12) Управление секретами и конфигами
- Все секреты только в переменных окружения, загружаемых через `zod`-валидацию (`src/shared/config/env.ts`).
- Разделить public/private конфиг; не экспортировать приватные значения в клиент.
- Для прод — использовать Secret Manager (Vault, AWS/GCP/Azure). Ротация ключей и паролей.
- Запретить коммит `.env*` в VCS; проверка на CI (git-secrets/trufflehog).

---

### 13) Управление зависимостями и сборкой
- Регулярные обновления зависимостей, включить `pnpm audit` в CI (но не полагаться слепо на auto-fix).
- Бандлинг: удалять dev-инструменты из прод-сборки, не включать мок-данные.
- Тайпинги для пакетов без типов — локальные `d.ts`, избегать `any` (уменьшает риск пропуска проблем).

---

### 14) Безопасные редиректы и URL
- Валидировать параметры редиректа (allowlist доменов/путей), запрещать `//evil.com` open redirect.
- Нормализовать и проверять внешние URL перед fetch/проксированием (анти-SSRF: блок private IP ranges, link-local, `file://`).

---

### 15) Файлы и загрузки
- Проверка типа/MIME/расширения, ограничение размера, серверная переупаковка изображений.
- Хранение — отдельный домен/поддомен для статики (исключить риск XSS при отдаче как HTML), правильные headers (`Content-Type`, `Content-Disposition`).
- Антивирусная проверка (по возможности) для документов.

---

### 16) Observability и реагирование
- Pino JSON-логи с кореляционным `requestId` (middleware), маскирование PII/секретов.
- Sentry для клиент+сервер, настройка release, source maps приватно.
- OpenTelemetry: трассировка HTTP/Prisma/Redis/Socket/Jobs. Метрики в Prometheus.
- Алерты: рост 5xx, время ответа, глубина очередей, количество ошибок авторизации.

---

### 17) Политики контента и защита от Clickjacking
- `frame-ancestors 'none'` в CSP; X-Frame-Options: DENY (для совместимости).
- Для страниц, требующих встраивания (если будет) — явный allowlist доменов.

---

### 18) Безопасность разработки и CI/CD
- Обязательный код-ревью, secret scanning, линтер security-правил (eslint-plugin-security, eslint-plugin-react, @typescript-eslint строгие правила «unsafe-*» на warn/error).
- Отдельные роли в CI: deploy token с минимумом прав, окружения с ручным апрувом для prod.
- SBOM (CycloneDX), подпись артефактов (по возможности).

---

### 19) Мультиарендность (если планируется)
- Повсеместный `tenantId` в ключевых сущностях; контекст в каждом запросе/сокете; фильтрация по tenant по умолчанию.
- Ограничение кэша и комнат по tenant (ключи Redis с префиксом tenant).

---

### 20) Идемпотентность и защита от повторов
- Идемпотентные ключи для POST/PUT на критичных операциях (заголовок `Idempotency-Key`).
- На стороне сервера хранить результат по ключу на TTL; предотвращает double-submit/повторы.

---

### 21) Практические snippets
- Middleware для `nonce` и заголовков:
  ```ts
  // middleware.ts (идея)
  import { NextResponse } from 'next/server'

  export function middleware(req: Request) {
    const res = NextResponse.next()
    const nonce = crypto.randomUUID()
    res.headers.set('Content-Security-Policy',
      `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`)
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.headers.set('X-Frame-Options', 'DENY')
    res.headers.set('X-Content-Type-Options', 'nosniff')
    res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    // Пробросьте nonce в контекст (cookies/headers) и используйте в layout
    return res
  }
  ```
- Проверка Origin/Referer для POST:
  ```ts
  import { NextRequest, NextResponse } from 'next/server'
  const ALLOWED = new Set(['https://app.yourdomain.tld'])

  export async function POST(req: NextRequest) {
    const origin = req.headers.get('origin') || req.headers.get('referer') || ''
    if (![...ALLOWED].some(a => origin.startsWith(a))) {
      return NextResponse.json({ title: 'Forbidden' }, { status: 403 })
    }
    // ...
  }
  ```
- Ограничение размера тела:
  ```ts
  export const config = { api: { bodyParser: { sizeLimit: '1mb' } } } // для pages api
  // Для app routes используйте кастомный парсинг/либы с лимитом или edge runtime
  ```

---

### 22) Приоритетный план внедрения (2–4 недели)
1) Headers, CSP с nonce, HSTS, Referrer-Policy, Permissions-Policy. ✓
2) Централизация валидации (zod) и формат ошибок; проверка Origin на write-эндпоинтах. ✓
3) Rate-limits (логин, SMTP, write API), размер тела; ограничение событий Socket.IO. ✓
4) Политики авторизации (RBAC/ABAC) и IDOR защита в репозиториях. ✓
5) Observability: Sentry + pino + базовая OTel; алерты. ✓
6) Секреты: zod-конфиг, secret scanning, запрет `NEXT_PUBLIC` утечек. ✓
7) Файлы: строгая проверка, re-encode изображений, отдельный домен для статики. ✓

---

### Итог
После внедрения указанных мер приложение получит:
- Сильную защиту фронта (CSP/headers/XSS),
- Надёжную аутентификацию и сессии (Lucia + CSRF/Rate-limit/MFA),
- Жёсткую авторизацию и предотвращение IDOR,
- Укреплённый real-time слой и почтовую подсистему,
- Наблюдаемость и готовность к инцидентам,
- Процессы и инструменты для предотвращения регрессий безопасности.

Готов подготовить PR, который внедрит: базовые headers+CSP, модуль `env` с zod-валидацией, шаблон `ProblemDetails`, rate-limiter для логина/SMTP, и пример policy-слоя — это займёт ~1–2 дня.

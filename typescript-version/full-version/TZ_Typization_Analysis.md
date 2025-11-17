# Техническое задание: Улучшение типизации проекта MaterioNextJS

**Дата:** 2025-11-15  
**Версия:** 1.0  
**Статус:** К исполнению

---

## 1. Введение

### 1.1 Цель документа
Настоящее техническое задание определяет полный комплекс мероприятий по улучшению типизации TypeScript в проекте MaterioNextJS, устранению использования `any`, `@ts-ignore` и других escape-hatch механизмов, повышению типобезопасности и качества кода.

### 1.2 Контекст проекта
- **Технологический стек:** Next.js 14, TypeScript, Prisma, Lucia Auth, Socket.IO, TailwindCSS
- **Текущая конфигурация:** `strict: true`, `moduleResolution: Bundler`
- **Выявленные проблемы:**
  - 17 использований `@ts-ignore`
  - Минимум 79 принудительных приведений к `any`
  - Отсутствие типизации в критичных модулях (WebSocket, Session, Menu, Permissions)

### 1.3 Ожидаемые результаты
- Полное устранение `@ts-ignore` за исключением обоснованных случаев
- Сокращение использования `any` на 95%+
- Внедрение строгой типизации для всех доменных сущностей
- Улучшение поддержки разработки (автодополнение, type checking, refactoring)
- Снижение количества runtime ошибок

---

## 2. Анализ текущего состояния

### 2.1 Конфигурация TypeScript

**Файл:** `tsconfig.json`

**Текущие настройки:**
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true
  }
}
```

**Оценка:**
- ✅ `strict: true` — хорошая база
- ⚠️ `allowJs: true` — ослабляет контроль типов для .js файлов
- ⚠️ `skipLibCheck: true` — скрывает проблемы в типах зависимостей
- ✅ Path aliases настроены корректно

### 2.2 Выявленные проблемы типизации

#### 2.2.1 Категория: Критичные (High Priority)

**A. WebSocket/Socket.IO слой**
- **Локация:** `src/server/socket.ts`, обработчики событий
- **Проблемы:**
  - `(socket as any).userId`
  - `(global as any).io`
  - Отсутствие типизации событий клиент-сервер
- **Влияние:** Высокий риск runtime ошибок при работе с реалтайм уведомлениями

**B. Lucia Auth Session**
- **Локация:** API routes, middleware, компоненты
- **Проблемы:**
  - `(user as any).role`
  - Недостаточная типизация User attributes
  - Отсутствие типизации для role объекта с permissions
- **Влияние:** Потеря безопасности при работе с авторизацией

**C. Prisma Client**
- **Локация:** Database queries, API handlers
- **Проблемы:**
  - `(prisma as any).model.method(...)`
  - Игнорирование сгенерированных типов
- **Влияние:** Потеря валидации схемы БД на уровне типов

**D. Система меню и навигации**
- **Локация:** `src/components/layout/navigation`, `MenuProvider.tsx`
- **Проблемы:**
  - `(item as any).children`
  - `(menuItem as any).permission`
  - Отсутствие интерфейсов `MenuItem`, `MenuSection`
- **Влияние:** Ошибки при рендеринге меню, проблемы с permissions

#### 2.2.2 Категория: Важные (Medium Priority)

**E. API Routes**
- **Локация:** `src/app/api/**/*.ts`
- **Проблемы:**
  - `const body = await ({} as any).json()`
  - Отсутствие валидации входных данных
  - Слабая типизация Response
- **Влияние:** Уязвимости безопасности, некорректная обработка запросов

**F. Система прав и ролей**
- **Локация:** `src/utils/permissions/permissions.ts`
- **Проблемы:**
  - `(permissionIds as any)[key]`
  - Динамические ключи без type guard
- **Влияние:** Ошибки в проверке прав доступа

**G. Клиентский код (window, browser APIs)**
- **Локация:** Client components
- **Проблемы:**
  - `(window as any).someGlobal`
  - Отсутствие type guards для browser APIs
- **Влияние:** Ошибки при SSR/SSG

#### 2.2.3 Категория: Технический долг (Low Priority)

**H. Использование @ts-ignore**
- **Статистика:** 17 мест
- **Основные категории:**
  - Calendar компоненты (сторонние библиотеки)
  - Chat UI элементы
  - Logistics/Admin панели
- **Рекомендация:** Аудит каждого случая, замена на `@ts-expect-error` с комментарием или proper typing

### 2.3 Метрики кодовой базы

```
Всего TypeScript файлов: 264
Файлов с 'any': ~79
Использований @ts-ignore: 17
Использований @ts-expect-error: минимально (в тестах)
```

---

## 3. Приоритизация задач

### 3.1 Матрица приоритетов

| Категория | Проблема | Сложность | Влияние | Приоритет | Фаза |
|-----------|----------|-----------|---------|-----------|------|
| WebSocket | Типизация Socket.IO | Средняя | Высокое | P0 | 1 |
| Auth | Lucia Auth User types | Низкая | Высокое | P0 | 1 |
| Database | Prisma типизация | Низкая | Высокое | P0 | 1 |
| Navigation | Menu interfaces | Средняя | Высокое | P1 | 2 |
| Permissions | Role/Permission types | Средняя | Высокое | P1 | 2 |
| API | Request/Response types | Высокая | Среднее | P1 | 2 |
| Client | Browser API guards | Низкая | Среднее | P2 | 3 |
| Legacy | @ts-ignore audit | Высокая | Низкое | P3 | 4 |

### 3.2 Определение приоритетов

**P0 (Критично):** Влияет на безопасность и стабильность системы  
**P1 (Высоко):** Важно для качества разработки и поддержки  
**P2 (Средне):** Улучшает DX, но не блокирует работу  
**P3 (Низко):** Технический долг, постепенное улучшение

---

## 4. Детальный план реализации

### ФАЗА 1: Критичная инфраструктура (P0)

**Сроки:** 1-2 недели  
**Ресурсы:** 1-2 разработчика

#### 4.1.1 Задача: Типизация WebSocket/Socket.IO

**Описание:**
Внедрить полную типизацию событий Socket.IO для клиент-серверного взаимодействия.

**Шаги реализации:**

1. **Создать файл типов для Socket.IO**
   ```typescript
   // src/types/socket.d.ts
   
   import type { Server as HTTPServer } from 'http'
   import type { Socket as NetSocket } from 'net'
   import type { Server as IOServer, Socket } from 'socket.io'
   
   // Типы событий от сервера к клиенту
   export interface ServerToClientEvents {
     notification: (payload: {
       id: string
       userId: string
       type: string
       title: string
       message: string
       status: 'unread' | 'read'
       createdAt: string
     }) => void
     
     messageReceived: (payload: {
       id: string
       roomId: string
       senderId: string
       content: string
       createdAt: string
     }) => void
     
     userStatusChanged: (payload: {
       userId: string
       status: 'online' | 'offline'
     }) => void
   }
   
   // Типы событий от клиента к серверу
   export interface ClientToServerEvents {
     markNotificationAsRead: (notificationId: string) => void
     sendMessage: (data: {
       roomId: string
       content: string
     }) => void
     joinRoom: (roomId: string) => void
     leaveRoom: (roomId: string) => void
   }
   
   // Типы данных, хранимых в сокете
   export interface SocketData {
     userId: string
     sessionId: string
   }
   
   // Типизированный Socket
   export type TypedSocket = Socket<
     ClientToServerEvents,
     ServerToClientEvents,
     {},
     SocketData
   >
   
   // Типизированный Server
   export type TypedIOServer = IOServer<
     ClientToServerEvents,
     ServerToClientEvents,
     {},
     SocketData
   >
   
   // Расширение глобального типа для Next.js
   declare global {
     // eslint-disable-next-line no-var
     var io: TypedIOServer | undefined
   }
   ```

2. **Обновить серверный код**
   ```typescript
   // src/server/socket.ts
   
   import type { TypedIOServer, TypedSocket } from '@/types/socket'
   
   export function initializeSocketServer(server: HTTPServer): TypedIOServer {
     if (global.io) {
       return global.io
     }
     
     const io: TypedIOServer = new Server(server, {
       // конфигурация
     })
     
     io.on('connection', (socket: TypedSocket) => {
       // Теперь socket.data.userId типизирован!
       const userId = socket.data.userId
       
       socket.on('markNotificationAsRead', (notificationId) => {
         // Автодополнение работает
       })
     })
     
     global.io = io
     return io
   }
   ```

3. **Обновить клиентский код**
   ```typescript
   // src/hooks/useSocket.ts
   
   import { io, Socket } from 'socket.io-client'
   import type { ServerToClientEvents, ClientToServerEvents } from '@/types/socket'
   
   type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>
   
   export function useSocket(): ClientSocket | null {
     // Типизированный сокет на клиенте
   }
   ```

**Критерии приёмки:**
- ✅ Все обращения к `socket` типизированы
- ✅ Убраны `(socket as any)` и `(global as any).io`
- ✅ TypeScript проверяет корректность событий
- ✅ IDE автодополнение работает для всех событий

---

#### 4.1.2 Задача: Типизация Lucia Auth User и Role

**Описание:**
Расширить типы Lucia для полной типизации User attributes с включением role объекта.

**Шаги реализации:**

1. **Расширить DatabaseUserAttributes в lucia.ts**
   ```typescript
   // src/libs/lucia.ts
   
   import { Lucia } from 'lucia'
   import { PrismaAdapter } from '@lucia-auth/adapter-prisma'
   import type { Role } from '@prisma/client'
   
   declare module 'lucia' {
     interface Register {
       Lucia: typeof lucia
       DatabaseUserAttributes: {
         id: string
         email: string
         name: string | null
         roleId: string
         permissions: string | null
       }
     }
   }
   ```

2. **Создать типы для User с загруженной Role**
   ```typescript
   // src/types/auth.ts
   
   import type { User as LuciaUser } from 'lucia'
   import type { Role } from '@prisma/client'
   
   export type UserWithRole = LuciaUser & {
     role?: Role | null
   }
   ```

3. **Обновить requireAuth для типобезопасной загрузки role**
   ```typescript
   // src/utils/auth/auth.ts
   
   import type { UserWithRole } from '@/types/auth'
   
   export async function requireAuth(request?: NextRequest): Promise<{
     session: Session
     user: UserWithRole
   }> {
     const { session, user } = await getLuciaSession(request)
     
     if (!session || !user) {
       throw new Error('Unauthorized')
     }
     
     const userWithRole: UserWithRole = user
     
     if (user.roleId) {
       const role = await prisma.role.findUnique({
         where: { id: user.roleId }
       })
       userWithRole.role = role
     }
     
     return { session, user: userWithRole }
   }
   ```

4. **Удалить все `(user as any).role` в проекте**
   ```typescript
   // До:
   const userRole = (user as any).role
   
   // После:
   const { user } = await requireAuth(request)
   const userRole = user.role // Типизировано!
   ```

**Критерии приёмки:**
- ✅ Нет приведений `(user as any).role`
- ✅ TypeScript валидирует `user.role`
- ✅ Все обращения к user attributes типизированы
- ✅ requireAuth возвращает UserWithRole

---

#### 4.1.3 Задача: Типизация Prisma Client

**Описание:**
Использовать сгенерированные Prisma типы вместо `any`.

**Шаги реализации:**

1. **Создать типизированный Prisma instance**
   ```typescript
   // src/libs/prisma.ts
   
   import { PrismaClient } from '@prisma/client'
   
   const globalForPrisma = globalThis as unknown as {
     prisma: PrismaClient | undefined
   }
   
   export const prisma = globalForPrisma.prisma ?? new PrismaClient({
     log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
   })
   
   if (process.env.NODE_ENV !== 'production') {
     globalForPrisma.prisma = prisma
   }
   ```

2. **Использовать Prisma типы в коде**
   ```typescript
   // До:
   const rooms = await (prisma as any).chatRoom.findMany(...)
   
   // После:
   import type { ChatRoom, User } from '@prisma/client'
   
   const rooms = await prisma.chatRoom.findMany({
     where: { /* автодополнение полей! */ },
     include: { user1: true }
   })
   // rooms имеет тип (ChatRoom & { user1: User })[]
   ```

3. **Создать вспомогательные типы**
   ```typescript
   // src/types/prisma.ts
   
   import type { Prisma } from '@prisma/client'
   
   // Тип User с включёнными связями
   export type UserWithRole = Prisma.UserGetPayload<{
     include: { role: true }
   }>
   
   // Тип ChatRoom со всеми связями
   export type ChatRoomWithUsers = Prisma.ChatRoomGetPayload<{
     include: {
       user1: true
       user2: true
       messages: {
         include: { sender: true }
       }
     }
   }>
   ```

**Критерии приёмки:**
- ✅ Нет `(prisma as any)`
- ✅ Используются сгенерированные типы
- ✅ IDE автодополнение работает для всех моделей

---

### ФАЗА 2: Доменные сущности (P1)

**Сроки:** 2-3 недели  
**Ресурсы:** 1-2 разработчика

#### 4.2.1 Задача: Типизация системы меню

**Шаги реализации:**

1. **Создать типы меню**
   ```typescript
   // src/types/menu.ts
   
   import type { ReactNode } from 'react'
   
   export interface MenuItem {
     label: string
     href?: string
     icon?: ReactNode
     children?: MenuItem[]
     permission?: string
     badge?: {
       content: string | number
       color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'
     }
     disabled?: boolean
     openInNewTab?: boolean
   }
   
   export interface MenuSection {
     title?: string
     items: MenuItem[]
     permission?: string
   }
   
   export type VerticalMenuData = MenuSection[]
   export type HorizontalMenuData = MenuItem[]
   ```

2. **Обновить компоненты меню**
   ```typescript
   // src/components/layout/navigation/VerticalMenu.tsx
   
   import type { VerticalMenuData, MenuItem } from '@/types/menu'
   
   interface Props {
     menuData: VerticalMenuData
   }
   
   export function VerticalMenu({ menuData }: Props) {
     // Теперь menuData.items[0].children типизирован!
   }
   ```

**Критерии приёмки:**
- ✅ Нет `(item as any).children`
- ✅ Все компоненты меню типизированы
- ✅ Автодополнение работает для свойств MenuItem

#### 4.2.2 Задача: Типизация системы прав

**Шаги реализации:**

1. **Создать строгие типы для прав**
   ```typescript
   // src/types/permissions.ts
   
   export const MODULES = [
     'users',
     'roles',
     'events',
     'chat',
     'ads',
     'logistics'
   ] as const
   
   export const ACTIONS = [
     'read',
     'create',
     'update',
     'delete',
     'manage',
     'view_sensitive'
   ] as const
   
   export type Module = typeof MODULES[number]
   export type Action = typeof ACTIONS[number]
   
   export type PermissionMap = Partial<Record<Module, Action[]>>
   export type Permissions = PermissionMap | 'all'
   
   export interface ModulePermission {
     module: Module
     action: Action
   }
   ```

2. **Обновить функции проверки прав**
   ```typescript
   // src/utils/permissions/permissions.ts
   
   import type { Module, Action, Permissions } from '@/types/permissions'
   
   export const checkPermission = (
     user: UserWithRole | null,
     module: Module,
     action: Action
   ): boolean => {
     // Типизированная логика
   }
   ```

**Критерии приёмки:**
- ✅ Нет динамических строк для модулей/действий
- ✅ TypeScript проверяет корректность permissions
- ✅ Автодополнение для модулей и действий

#### 4.2.3 Задача: Типизация API Routes

**Шаги реализации:**

1. **Создать типы для API**
   ```typescript
   // src/types/api.ts
   
   import type { NextRequest } from 'next/server'
   
   export interface TypedNextRequest<T = unknown> extends NextRequest {
     json(): Promise<T>
   }
   
   // Типы для конкретных эндпоинтов
   export namespace EventsAPI {
     export interface ListParams {
       source?: string
       module?: string
       type?: string
       severity?: 'info' | 'warning' | 'error' | 'critical'
       limit?: number
       cursor?: string
     }
     
     export interface ListResponse {
       items: Event[]
       nextCursor?: string
     }
   }
   ```

2. **Использовать типизированные requests**
   ```typescript
   // src/app/api/admin/events/route.ts
   
   import type { TypedNextRequest } from '@/types/api'
   import type { EventsAPI } from '@/types/api'
   
   export async function GET(request: NextRequest) {
     const { searchParams } = new URL(request.url)
     
     const params: EventsAPI.ListParams = {
       source: searchParams.get('source') || undefined,
       // TypeScript валидирует тип!
     }
   }
   ```

3. **Добавить валидацию с Zod**
   ```typescript
   import { z } from 'zod'
   
   const CreateEventSchema = z.object({
     source: z.string().min(1),
     type: z.string().min(1),
     severity: z.enum(['info', 'warning', 'error', 'critical']),
     message: z.string().min(1)
   })
   
   export async function POST(request: NextRequest) {
     const body = await request.json()
     const validated = CreateEventSchema.parse(body) // Типобезопасно!
   }
   ```

**Критерии приёмки:**
- ✅ Нет `await ({} as any).json()`
- ✅ Валидация входных данных через Zod
- ✅ Типизированные response объекты

---

### ФАЗА 3: Клиентский код и Browser APIs (P2)

**Сроки:** 1-2 недели  
**Ресурсы:** 1 разработчик

#### 4.3.1 Задача: Type guards для window/browser APIs

**Шаги реализации:**

1. **Создать вспомогательные type guards**
   ```typescript
   // src/utils/browser.ts
   
   export const isBrowser = (): boolean => typeof window !== 'undefined'
   
   export const hasLocalStorage = (): boolean => {
     try {
       return isBrowser() && 'localStorage' in window
     } catch {
       return false
     }
   }
   
   export function getLocalStorage(): Storage | null {
     return hasLocalStorage() ? window.localStorage : null
   }
   ```

2. **Типизировать глобальные расширения**
   ```typescript
   // src/types/window.d.ts
   
   interface CustomWindow extends Window {
     gtag?: (...args: any[]) => void
     dataLayer?: any[]
     customConfig?: {
       apiUrl: string
       wsUrl: string
     }
   }
   
   declare const window: CustomWindow
   ```

**Критерии приёмки:**
- ✅ Нет прямых `(window as any)`
- ✅ Используются type guards
- ✅ SSR безопасность

---

### ФАЗА 4: Технический долг и аудит (P3)

**Сроки:** 2-3 недели  
**Ресурсы:** 1 разработчик

#### 4.4.1 Задача: Аудит @ts-ignore

**Шаги:**

1. Найти все 17 использований `@ts-ignore`
2. Для каждого случая:
   - Попытаться устранить (proper typing)
   - Если невозможно → заменить на `@ts-expect-error` + комментарий
   - Документировать причину
3. Создать файл `KNOWN_TYPE_ISSUES.md` с объяснениями

**Критерии приёмки:**
- ✅ Максимум 5 оставшихся `@ts-expect-error`
- ✅ Все случаи задокументированы
- ✅ Нет `@ts-ignore` без комментария

---

## 5. Дополнительные рекомендации

### 5.1 Линтинг и автоматизация

**Обновить ESLint конфигурацию:**

```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "warn",
    "@typescript-eslint/no-unsafe-member-access": "warn",
    "@typescript-eslint/no-unsafe-call": "warn",
    "@typescript-eslint/ban-ts-comment": [
      "error",
      {
        "ts-expect-error": "allow-with-description",
        "ts-ignore": true,
        "minimumDescriptionLength": 10
      }
    ]
  }
}
```

### 5.2 CI/CD интеграция

**Добавить type checking в pipeline:**

```yaml
# .github/workflows/ci.yml
- name: Type Check
  run: npm run type-check

- name: Lint
  run: npm run lint

- name: Check for any types
  run: |
    if grep -r ": any" src/ --include="*.ts" --include="*.tsx"; then
      echo "Found 'any' types in code"
      exit 1
    fi
```

### 5.3 Документация

**Создать руководство для команды:**

1. **CONTRIBUTING.md** — правила работы с типами
2. **TYPE_GUIDELINES.md** — best practices
3. **MIGRATION_GUIDE.md** — как мигрировать старый код

---

## 6. Метрики успеха

### 6.1 Количественные метрики

| Метрика | До | Цель | Способ измерения |
|---------|----|----|------------------|
| Использований `any` | 79+ | <5 | `grep -r ": any" src/` |
| Использований `@ts-ignore` | 17 | 0 | `grep -r "@ts-ignore" src/` |
| Использований `@ts-expect-error` | ~3 | <5 | `grep -r "@ts-expect-error" src/` |
| Type coverage | ~85% | >98% | `npx type-coverage` |
| TypeScript ошибок при сборке | 0 (из-за any) | 0 | `tsc --noEmit` |

### 6.2 Качественные метрики

- ✅ Улучшение автодополнения в IDE
- ✅ Снижение времени на code review
- ✅ Уменьшение количества runtime ошибок
- ✅ Улучшение onboarding новых разработчиков
- ✅ Безопасный рефакторинг

---

## 7. Риски и митигация

### 7.1 Идентифицированные риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Breaking changes при миграции | Средняя | Высокое | Поэтапное внедрение, тесты на каждом шаге |
| Сопротивление команды (более verbose код) | Низкая | Среднее | Обучение, демонстрация преимуществ |
| Увеличение времени разработки | Средняя | Низкое | Инвестиция окупается снижением багов |
| Конфликты типов с библиотеками | Средняя | Среднее | Создание .d.ts shims, обновление зависимостей |

### 7.2 План действий при проблемах

1. **Если типы библиотеки некорректны:**
   - Создать .d.ts файл с правильными типами
   - Отправить PR в @types/* или upstream

2. **Если типизация слишком сложна:**
   - Использовать `@ts-expect-error` с detailed комментарием
   - Создать issue для будущей доработки

3. **Если ломаются тесты:**
   - Обновить моки и фикстуры с правильными типами
   - Не использовать `any` в тестах

---

## 8. Timeline и ресурсы

### 8.1 Общий график

```
Неделя 1-2:  Фаза 1 - WebSocket, Auth, Prisma
Неделя 3-5:  Фаза 2 - Menu, Permissions, API Routes
Неделя 6-7:  Фаза 3 - Browser APIs, клиентский код
Неделя 8-10: Фаза 4 - Аудит, документация, финализация
```

### 8.2 Необходимые ресурсы

- **Разработчики:** 1-2 senior TS/React разработчика
- **Code reviewer:** 1 tech lead
- **Время:** 8-10 недель (можно параллелить задачи)
- **Инструменты:** 
  - TypeScript 5.x
  - ESLint с TS плагинами
  - type-coverage
  - Zod для валидации

---

## 9. Чеклист выполнения

### Фаза 1: Критичная инфраструктура
- [ ] Socket.IO типизирован
- [ ] Lucia Auth User типизирован
- [ ] Prisma типы используются везде
- [ ] Нет `(global as any)`, `(socket as any)`, `(prisma as any)`

### Фаза 2: Доменные сущности
- [ ] MenuItem, MenuSection интерфейсы созданы
- [ ] Module, Action типы определены
- [ ] API Routes типизированы
- [ ] Zod валидация внедрена

### Фаза 3: Клиентский код
- [ ] Type guards для window созданы
- [ ] Нет прямых обращений к `(window as any)`
- [ ] SSR-safe код

### Фаза 4: Финализация
- [ ] @ts-ignore аудит завершён
- [ ] Документация обновлена
- [ ] CI/CD настроен
- [ ] Команда обучена

---

## 10. Заключение

Данное ТЗ предоставляет полный roadmap для улучшения типизации проекта. Внедрение изменений позволит:

1. **Повысить надёжность** — меньше runtime ошибок
2. **Ускорить разработку** — лучше автодополнение и навигация
3. **Упростить поддержку** — типы как документация
4. **Улучшить безопасность** — валидация на уровне типов

**Ключевой принцип:** Постепенное внедрение, тестирование на каждом шаге, без breaking changes для пользователей.

---

**Подготовлено:** Junie AI  
**Контакт для вопросов:** Tech Lead команды  
**Дата следующего ревью:** После завершения Фазы 1

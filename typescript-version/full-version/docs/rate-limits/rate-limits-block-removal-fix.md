# Исправление проблемы снятия блокировок на странице Rate Limits

## Проблема

На странице `http://localhost:3000/ru/admin/rate-limits` невозможно было снять блокировки (manual blocks) в строках таблицы.

## Причина

1. **Manual блоки не возвращались в списке**: Метод `listStates` в `RateLimitEngine` возвращал только записи `RateLimitState`, но не включал manual блоки (`UserBlock`) в результат, хотя в UI была проверка `entry.source === 'manual'`.

2. **Неправильный endpoint для снятия блокировок**: Функция `handleClearState` в `RateLimitManagement.tsx` всегда использовала endpoint `DELETE /api/admin/rate-limits/${id}` для всех типов блокировок, но для manual блоков нужно использовать `DELETE /api/admin/rate-limits/blocks/${id}`.

## Исправления

### 1. Добавление manual блоков в список (`RateLimitEngine.ts`)

- Добавлена логика получения active manual блоков из базы данных
- Manual блоки теперь включаются в результат `listStates` с правильными полями:
  - `source: 'manual'`
  - `id: block.id` (ID UserBlock)
  - `activeBlock` с полной информацией о блокировке
- Добавлена поддержка фильтрации по `module` и `search` для manual блоков
- Результаты сортируются по дате (новые сначала)

### 2. Исправление логики снятия блокировок (`RateLimitManagement.tsx`)

- `handleClearState` теперь принимает весь объект `entry` вместо только `id`
- Добавлена проверка типа блокировки (`entry.source === 'manual'`)
- Для manual блоков используется endpoint `DELETE /api/admin/rate-limits/blocks/${blockId}`
- Для state блоков используется endpoint `DELETE /api/admin/rate-limits/${stateId}`
- Улучшена обработка ошибок с отображением сообщений из API

## Измененные файлы

1. `src/lib/rate-limit/services/RateLimitEngine.ts`
   - Метод `listStates`: добавлена логика получения и включения manual блоков

2. `src/views/admin/rate-limits/RateLimitManagement.tsx`
   - Функция `handleClearState`: обновлена для поддержки разных типов блокировок
   - Вызов `handleClearState`: изменен для передачи всего объекта `entry`

## Тестирование

После исправлений необходимо проверить:

1. ✅ Manual блоки отображаются в списке на странице `/admin/rate-limits`
2. ✅ Кнопка "Clear block" работает для manual блоков
3. ✅ Кнопка "Clear block" работает для state блоков
4. ✅ После снятия блокировки она исчезает из списка
5. ✅ Фильтрация по module и search работает для manual блоков

## API Endpoints

- `DELETE /api/admin/rate-limits/${stateId}` - для снятия state блокировок
- `DELETE /api/admin/rate-limits/blocks/${blockId}` - для снятия manual блокировок










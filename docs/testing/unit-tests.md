# Unit tests

## Структура

Все unit-тесты лежат в каталоге `tests/unit`. Для rate-limit модулей предусмотрен подпакет `tests/unit/rate-limit`, где каждый файл отвечает за конкретный компонент:

```
tests/unit/
└── rate-limit/
    └── resilient-store.test.ts  # проверяет ResilientRateLimitStore
```

## Текущие сценарии

### `resilient-store.test.ts`

Проверяет резервный стор (`src/lib/rate-limit/stores/index.ts`):

- **uses primary store when available** — убеждаемся, что при нормальной работе все операции идут через Redis и метрики фиксируются на backend="redis".
- **falls back to prisma store after redis failure and retries after interval** — моделируем падение Redis, проверяем, что стора переключается на Prisma, вызывает `recordRedisFailure`, а после истечения retry-интервала возвращается к Redis и записывает `recordFallbackDuration`.

Используются моки (jest.fn) для метрик (`startConsumeDurationTimer`, `recordBackendSwitch`) и ручная фиксация `Date.now()` — так симулируем истечение retry-интервала и отображение `recordFallbackDuration`.

## Команды запуска

- Прогнать весь unit-пакет:
  ```bash
  pnpm test:unit
  ```
- Watch-режим (для разработки):
  ```bash
  pnpm test:watch -- --testPathPattern=tests/unit
  ```
- Покрытие (вместо всего пакета можно добавить `--testPathPattern`):
  ```bash
  pnpm test:coverage
  ```

## Добавление новых тестов

1. Создайте файл в `tests/unit/<module>/<scenario>.test.ts`.
2. Используйте алиасы `@/lib/...` для импортов.
3. Для зависимостей (Prisma, Redis) предпочтительно создавать моки (например, с помощью jest.fn или библиотек вроде @quramy/prisma-mock).
4. Опишите сценарий в `describe()` и `it()` так, чтобы по названию было понятно, что именно проверяется.

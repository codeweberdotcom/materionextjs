/**
 * Типы для системы кэширования ролей
 */

export interface Role {
  id: string
  code: string // Immutable code: 'SUPERADMIN', 'ADMIN', 'USER'
  name: string // Display name (can be renamed)
  description?: string | null
  permissions?: string | null
  level: number // Hierarchy level (0 = highest priority)
  isSystem: boolean // System role (cannot be deleted)
  createdAt: Date
  updatedAt: Date
}

/**
 * Интерфейс хранилища кэша ролей
 */
export interface RoleCacheStore {
  /**
   * Получить роли из кэша
   * @param key - Ключ кэша (обычно 'all-roles')
   * @returns Массив ролей или null, если не найдено
   */
  get(key: string): Promise<Role[] | null>

  /**
   * Сохранить роли в кэш
   * @param key - Ключ кэша
   * @param value - Массив ролей для сохранения
   * @param ttl - Время жизни кэша в миллисекундах
   */
  set(key: string, value: Role[], ttl: number): Promise<void>

  /**
   * Удалить роли из кэша
   * @param key - Ключ кэша
   */
  delete(key: string): Promise<void>

  /**
   * Очистить весь кэш
   */
  clear(): Promise<void>

  /**
   * Проверка здоровья хранилища
   * @returns Статус здоровья и задержка
   */
  healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }>

  /**
   * Закрытие соединения (для Redis)
   */
  shutdown(): Promise<void>
}





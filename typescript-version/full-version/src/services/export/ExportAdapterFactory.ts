import { IEntityAdapter } from '@/types/export-import'
import { UserAdapter } from '@/services/adapters/UserAdapter'

/**
 * Фабрика адаптеров экспорта
 * Управляет созданием адаптеров для разных типов сущностей
 */
export class ExportAdapterFactory {
  private adapters: Map<string, IEntityAdapter> = new Map()

  /**
   * Регистрирует адаптер для типа сущности
   */
  registerAdapter(entityType: string, adapter: IEntityAdapter): void {
    this.adapters.set(entityType, adapter)
  }

  /**
   * Получает адаптер для типа сущности
   */
  getAdapter(entityType: string): IEntityAdapter | null {
    return this.adapters.get(entityType) || null
  }

  /**
   * Проверяет, зарегистрирован ли адаптер для типа сущности
   */
  hasAdapter(entityType: string): boolean {
    return this.adapters.has(entityType)
  }

  /**
   * Возвращает список всех зарегистрированных типов сущностей
   */
  getRegisteredEntityTypes(): string[] {
    return Array.from(this.adapters.keys())
  }

  /**
   * Удаляет адаптер для типа сущности
   */
  unregisterAdapter(entityType: string): boolean {
    return this.adapters.delete(entityType)
  }

  /**
   * Очищает все зарегистрированные адаптеры
   */
  clearAdapters(): void {
    this.adapters.clear()
  }
}

// Singleton instance
export const exportAdapterFactory = new ExportAdapterFactory()

// Register default adapters
exportAdapterFactory.registerAdapter('users', new UserAdapter())

/**
 * Типы для очередей обработки медиа
 * 
 * @module services/media/queue/types
 */

/**
 * Данные задачи обработки медиа
 */
export interface MediaProcessingJobData {
  /** Путь к временному файлу */
  tempPath: string
  /** Оригинальное имя файла */
  filename: string
  /** MIME тип файла */
  mimeType: string
  /** Тип сущности (user_avatar, listing_image и т.д.) */
  entityType: string
  /** ID связанной сущности */
  entityId?: string
  /** ID пользователя, загрузившего файл */
  uploadedBy?: string
  /** Дополнительные опции */
  options?: {
    alt?: string
    title?: string
    caption?: string
    description?: string
    position?: number
  }
}

/**
 * Данные задачи синхронизации с S3
 */
export interface MediaSyncJobData {
  /** Тип операции */
  operation: 'upload_to_s3' | 'download_from_s3' | 'delete_s3' | 'delete_local' | 'hard_delete'
  /** ID медиа файла */
  mediaId: string
  /** ID задачи синхронизации в БД */
  jobId?: string
  /** ID родительской задачи (для batch jobs) */
  parentJobId?: string
  /** Индекс batch'а */
  batchIndex?: number
  /** Локальный путь (для upload) */
  localPath?: string
  /** S3 ключ (для download) */
  s3Key?: string
  /** Удалить источник после операции */
  deleteSource?: boolean
  /** Дополнительные опции */
  options?: {
    deleteSource?: boolean
    overwrite?: boolean
  }
}

/**
 * Результат обработки медиа
 */
export interface MediaProcessingResult {
  success: boolean
  mediaId?: string
  error?: string
  urls?: Record<string, string>
}

/**
 * Результат синхронизации
 */
export interface MediaSyncResult {
  success: boolean
  mediaId: string
  operation: string
  error?: string
}

/**
 * Статистика очереди
 */
export interface QueueStats {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  queueType: 'bull' | 'in-memory' | 'none'
}

/**
 * Статус задачи
 */
export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'

/**
 * In-memory задача (fallback)
 */
export interface InMemoryJob<T> {
  id: string
  data: T
  scheduledAt: Date
  attempts: number
  maxAttempts: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  progress: number
}

/**
 * Данные задачи применения водяного знака
 */
export interface WatermarkJobData {
  /** ID медиа файла */
  mediaId: string
  /** Тип сущности */
  entityType: string
  /** Конкретный размер для обработки (если null - все размеры) */
  sizeKey?: string
  /** Принудительный водяной знак (игнорировать настройки entityType) */
  watermarkId?: string
  /** Переопределение опций */
  options?: {
    position?: string
    opacity?: number
    scale?: number
  }
  /** Перезаписать если уже есть водяной знак */
  overwrite?: boolean
}

/**
 * Результат применения водяного знака
 */
export interface WatermarkResult {
  success: boolean
  mediaId: string
  sizeKey?: string
  error?: string
}


/**
 * Экспорты модуля очередей медиа
 * 
 * @module services/media/queue
 */

// Типы
export type {
  MediaProcessingJobData,
  MediaProcessingResult,
  MediaSyncJobData,
  MediaSyncResult,
  WatermarkJobData,
  WatermarkResult,
  QueueStats,
  JobStatus,
  InMemoryJob,
} from './types'

// Очереди
export { MediaProcessingQueue, mediaProcessingQueue } from './MediaProcessingQueue'
export { MediaSyncQueue, mediaSyncQueue } from './MediaSyncQueue'
export {
  initializeWatermarkQueue,
  registerProcessor as registerWatermarkProcessor,
  addWatermarkJob,
  addBulkWatermarkJobs,
  getQueueStats as getWatermarkQueueStats,
  getWatermarkQueue,
  isWatermarkQueueInitialized,
  clearWatermarkQueue,
  closeWatermarkQueue,
} from './WatermarkQueue'

// Workers
export { MediaProcessingWorker, mediaProcessingWorker, notifyMediaProcessed } from './MediaProcessingWorker'
export { MediaSyncWorker, mediaSyncWorker } from './MediaSyncWorker'
export { processWatermark, shouldApplyWatermark, getWatermarkVariants } from './WatermarkWorker'

// Флаг и promise для предотвращения повторной/параллельной регистрации
let mediaQueuesInitialized = false
let initializationPromise: Promise<void> | null = null

/**
 * Инициализировать все очереди и зарегистрировать workers
 * Защита от race condition: если вызывается параллельно, все вызовы ждут одну инициализацию
 */
export async function initializeMediaQueues(): Promise<void> {
  // Уже инициализировано
  if (mediaQueuesInitialized) {
    return
  }

  // Инициализация уже запущена - ждём её завершения
  if (initializationPromise) {
    return initializationPromise
  }

  // Запускаем инициализацию и сохраняем promise
  initializationPromise = (async () => {
    // Двойная проверка после захвата "lock"
    if (mediaQueuesInitialized) {
      return
    }

    const { mediaProcessingQueue } = await import('./MediaProcessingQueue')
    const { mediaSyncQueue } = await import('./MediaSyncQueue')
    const { mediaProcessingWorker, notifyMediaProcessed } = await import('./MediaProcessingWorker')
    const { mediaSyncWorker } = await import('./MediaSyncWorker')
    const { initializeWatermarkQueue, registerProcessor: registerWatermarkProcessor } = await import('./WatermarkQueue')
    const { processWatermark } = await import('./WatermarkWorker')
    const logger = (await import('@/lib/logger')).default

    // Инициализируем очереди
    await mediaProcessingQueue.initialize()
    await mediaSyncQueue.initialize()
    await initializeWatermarkQueue()

    // Регистрируем обработчики с уведомлениями
    mediaProcessingQueue.registerProcessor(async (job) => {
      const result = await mediaProcessingWorker.process(job)
      
      // Отправляем WebSocket уведомление о результате
      try {
        await notifyMediaProcessed(job.data.uploadedBy, {
          jobId: job.id,
          mediaId: result.mediaId,
          success: result.success,
          error: result.error,
          urls: result.urls,
          filename: job.data.filename,
        })
      } catch (notifyError) {
        logger.warn('[MediaQueue] Failed to send completion notification', {
          jobId: job.id,
          error: notifyError instanceof Error ? notifyError.message : String(notifyError),
        })
      }
      
      return result
    })
    
    mediaSyncQueue.registerProcessor((job) => mediaSyncWorker.process(job))
    await registerWatermarkProcessor(processWatermark)
    
    mediaQueuesInitialized = true
    logger.info('[MediaQueues] All queues initialized successfully')
  })()

  return initializationPromise
}

/**
 * Закрыть все очереди
 */
export async function closeMediaQueues(): Promise<void> {
  const { mediaProcessingQueue } = await import('./MediaProcessingQueue')
  const { mediaSyncQueue } = await import('./MediaSyncQueue')
  const { closeWatermarkQueue } = await import('./WatermarkQueue')

  await mediaProcessingQueue.close()
  await mediaSyncQueue.close()
  await closeWatermarkQueue()
}


/**
 * useBulkUpload - хук для массовой загрузки файлов
 * 
 * Версия 2.0 - Ref-based Queue Architecture
 * 
 * Особенности:
 * - Ref-based очередь для стабильной работы
 * - Mutex для атомарного захвата файлов
 * - Стабильный worker pool
 * - Batch UI updates для производительности
 * - Pause/Resume/Cancel
 * - Retry для failed файлов
 * 
 * @module hooks/useBulkUpload
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'

/**
 * Статус файла в очереди
 */
export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error' | 'cancelled'

/**
 * Файл в очереди загрузки
 */
export interface QueuedFile {
  id: string
  file: File
  status: UploadStatus
  progress: number
  error?: string
  preview?: string
  mediaId?: string
  jobId?: string
  retryCount: number
}

/**
 * Общая статистика загрузки
 */
export interface UploadStats {
  total: number
  pending: number
  uploading: number
  success: number
  error: number
  cancelled: number
  progress: number
  bytesTotal: number
  bytesUploaded: number
  estimatedTimeLeft: number
  speed: number
}

/**
 * Опции хука
 */
export interface UseBulkUploadOptions {
  endpoint?: string
  useAsyncUpload?: boolean
  parallelLimit?: number
  maxFiles?: number
  maxFileSize?: number
  entityType?: string
  entityId?: string
  maxPreviews?: number
  maxRetries?: number
  onFileSuccess?: (file: QueuedFile) => void
  onFileError?: (file: QueuedFile, error: string) => void
  onComplete?: (stats: UploadStats) => void
}

/**
 * Возвращаемый интерфейс хука
 */
export interface UseBulkUploadReturn {
  files: QueuedFile[]
  stats: UploadStats
  isUploading: boolean
  isPaused: boolean
  addFiles: (files: File[]) => void
  removeFile: (id: string) => void
  clearQueue: () => void
  startUpload: () => void
  pauseUpload: () => void
  resumeUpload: () => void
  cancelUpload: () => void
  retryFailed: () => void
  clearSuccess: () => void
}

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Хук для массовой загрузки файлов
 */
export function useBulkUpload(options: UseBulkUploadOptions = {}): UseBulkUploadReturn {
  const {
    endpoint = '/api/admin/media',
    useAsyncUpload = false,
    parallelLimit = 5,
    maxFiles = 10000,
    maxFileSize = 10 * 1024 * 1024, // 10MB default, override from settings
    entityType = 'other',
    entityId,
    maxPreviews = 20,
    maxRetries = 2,
    onFileSuccess,
    onFileError,
    onComplete,
  } = options

  // UI State (только для отображения)
  const [files, setFiles] = useState<QueuedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  // === REF-BASED QUEUE (источник истины) ===
  const queueRef = useRef<QueuedFile[]>([])
  const isUploadingRef = useRef(false)
  const isPausedRef = useRef(false)
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())
  const uploadStartTimeRef = useRef<number>(0)
  
  // Mutex для атомарного захвата файлов
  const mutexRef = useRef<Promise<void>>(Promise.resolve())
  
  // Опции (актуальные значения)
  const optionsRef = useRef({ entityType, entityId, endpoint, useAsyncUpload, parallelLimit })
  useEffect(() => {
    optionsRef.current = { entityType, entityId, endpoint, useAsyncUpload, parallelLimit }
  }, [entityType, entityId, endpoint, useAsyncUpload, parallelLimit])

  // Callbacks refs
  const callbacksRef = useRef({ onFileSuccess, onFileError, onComplete })
  useEffect(() => {
    callbacksRef.current = { onFileSuccess, onFileError, onComplete }
  }, [onFileSuccess, onFileError, onComplete])

  // === SYNC QUEUE TO UI (batch updates) ===
  const uiUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const syncQueueToUI = useCallback(() => {
    // Batch UI updates - не чаще чем раз в 250ms (optimized for performance)
    if (uiUpdateTimeoutRef.current) return
    
    uiUpdateTimeoutRef.current = setTimeout(() => {
      uiUpdateTimeoutRef.current = null
      setFiles([...queueRef.current])
    }, 250)
  }, [])
  
  const syncQueueToUIImmediate = useCallback(() => {
    if (uiUpdateTimeoutRef.current) {
      clearTimeout(uiUpdateTimeoutRef.current)
      uiUpdateTimeoutRef.current = null
    }
    setFiles([...queueRef.current])
  }, [])

  // Cleanup
  useEffect(() => {
    return () => {
      if (uiUpdateTimeoutRef.current) {
        clearTimeout(uiUpdateTimeoutRef.current)
      }
      queueRef.current.forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview)
      })
    }
  }, [])

  // === STATISTICS (optimized - single pass) ===
  const calculateStats = useCallback((): UploadStats => {
    const queue = queueRef.current
    const total = queue.length
    
    // Single pass through array for all counts
    let pending = 0, uploading = 0, success = 0, error = 0, cancelled = 0
    let bytesTotal = 0, bytesUploaded = 0
    
    for (const f of queue) {
      bytesTotal += f.file.size
      
      switch (f.status) {
        case 'pending': pending++; break
        case 'uploading': 
          uploading++
          bytesUploaded += f.file.size * f.progress / 100
          break
        case 'success': 
          success++
          bytesUploaded += f.file.size
          break
        case 'error': error++; break
        case 'cancelled': cancelled++; break
      }
    }

    // Uploadable = pending + uploading + success + cancelled (not error from validation)
    const uploadableTotal = pending + uploading + success + cancelled

    // Progress based only on uploadable files (excluding validation errors)
    const progress = uploadableTotal > 0 ? Math.round(((success + cancelled) / uploadableTotal) * 100) : 0

    const elapsed = uploadStartTimeRef.current 
      ? (Date.now() - uploadStartTimeRef.current) / 1000 
      : 0
    const speed = elapsed > 0 ? bytesUploaded / elapsed : 0
    const bytesRemaining = bytesTotal - bytesUploaded
    const estimatedTimeLeft = speed > 0 ? bytesRemaining / speed : 0

    return {
      total, pending, uploading, success, error, cancelled,
      progress, bytesTotal, bytesUploaded, speed, estimatedTimeLeft,
    }
  }, [])

  // Memoized stats - only recalculate when files state changes
  const stats = useMemo(() => calculateStats(), [files, calculateStats])

  // === QUEUE OPERATIONS ===
  
  const addFiles = useCallback((newFiles: File[]) => {
    const currentCount = queueRef.current.length
    const allowedCount = Math.min(newFiles.length, maxFiles - currentCount)
    
    if (allowedCount <= 0) return
    
    const filesToAdd = newFiles.slice(0, allowedCount)
    const maxSizeMB = Math.round(maxFileSize / (1024 * 1024))
    
    // Fast path: create queued files without previews first
    const queuedFiles: QueuedFile[] = filesToAdd.map((file) => {
      const exceedsMaxSize = file.size > maxFileSize
      
      return {
        id: generateId(),
        file,
        status: exceedsMaxSize ? 'error' as const : 'pending' as const,
        progress: 0,
        retryCount: 0,
        error: exceedsMaxSize ? `File size exceeds ${maxSizeMB} MB limit` : undefined,
        preview: undefined, // Will be created asynchronously
      }
    })

    queueRef.current = [...queueRef.current, ...queuedFiles]
    
    // Debounced UI update (not immediate - prevents blocking on large batches)
    syncQueueToUI()
    
    // Create previews asynchronously for first N files only
    const previewsToCreate = queuedFiles
      .filter((f, i) => currentCount + i < maxPreviews && f.file.type.startsWith('image/') && f.status !== 'error')
      .slice(0, Math.max(0, maxPreviews - currentCount))
    
    if (previewsToCreate.length > 0) {
      // Use requestIdleCallback or setTimeout for non-blocking preview creation
      const createPreviews = () => {
        for (const qf of previewsToCreate) {
          const fileInQueue = queueRef.current.find(f => f.id === qf.id)
          if (fileInQueue && !fileInQueue.preview) {
            fileInQueue.preview = URL.createObjectURL(qf.file)
          }
        }
        syncQueueToUI() // Batch update after all previews created
      }
      
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(createPreviews, { timeout: 500 })
      } else {
        setTimeout(createPreviews, 50)
      }
    }
  }, [maxFiles, maxFileSize, maxPreviews, syncQueueToUI])

  const removeFile = useCallback((id: string) => {
    const file = queueRef.current.find(f => f.id === id)
    if (file?.preview) URL.revokeObjectURL(file.preview)
    
    const controller = abortControllersRef.current.get(id)
    if (controller) {
      controller.abort()
      abortControllersRef.current.delete(id)
    }
    
    queueRef.current = queueRef.current.filter(f => f.id !== id)
    syncQueueToUIImmediate()
  }, [syncQueueToUIImmediate])

  const clearQueue = useCallback(() => {
    abortControllersRef.current.forEach(controller => controller.abort())
    abortControllersRef.current.clear()
    
    queueRef.current.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview)
    })
    
    queueRef.current = []
    isUploadingRef.current = false
    isPausedRef.current = false
    setIsUploading(false)
    setIsPaused(false)
    syncQueueToUIImmediate()
  }, [syncQueueToUIImmediate])

  // === MUTEX-BASED FILE CLAIMING ===
  
  const claimNextFile = useCallback(async (): Promise<QueuedFile | null> => {
    // Ждём освобождения mutex
    await mutexRef.current
    
    // Создаём новый promise для следующего ожидающего
    let releaseMutex: () => void
    mutexRef.current = new Promise(resolve => { releaseMutex = resolve })
    
    try {
      // Находим первый pending файл
      const index = queueRef.current.findIndex(f => f.status === 'pending')
      
      if (index === -1) {
        return null
      }
      
      // Атомарно меняем статус
      const file = queueRef.current[index]
      queueRef.current[index] = { ...file, status: 'uploading', progress: 0 }
      
      syncQueueToUI()
      return file
    } finally {
      releaseMutex!()
    }
  }, [syncQueueToUI])

  // === FILE UPLOAD ===
  
  const uploadFile = useCallback(async (queuedFile: QueuedFile): Promise<boolean> => {
    const controller = new AbortController()
    abortControllersRef.current.set(queuedFile.id, controller)

    try {
      const formData = new FormData()
      formData.append('file', queuedFile.file)
      formData.append('entityType', optionsRef.current.entityType)
      if (optionsRef.current.entityId) {
        formData.append('entityId', optionsRef.current.entityId)
      }

      const uploadEndpoint = optionsRef.current.useAsyncUpload 
        ? '/api/admin/media/upload-async' 
        : optionsRef.current.endpoint

      const result = await new Promise<{ success: boolean; mediaId?: string; jobId?: string; error?: string }>((resolve) => {
        const xhr = new XMLHttpRequest()
        
        // Throttle progress updates - update only every 5% or 500ms
        let lastProgressUpdate = 0
        let lastProgressValue = 0
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100)
            const now = Date.now()
            
            // Only update if: progress changed by 5%+ OR 500ms passed OR completed
            const significantChange = progress - lastProgressValue >= 5
            const timeElapsed = now - lastProgressUpdate >= 500
            const isComplete = progress >= 100
            
            if (significantChange || timeElapsed || isComplete) {
              lastProgressUpdate = now
              lastProgressValue = progress
              
              // Direct update without findIndex (we know the file)
              const index = queueRef.current.findIndex(f => f.id === queuedFile.id)
              if (index !== -1) {
                queueRef.current[index].progress = progress
                syncQueueToUI()
              }
            }
          }
        })

        xhr.addEventListener('load', () => {
          try {
            const response = JSON.parse(xhr.responseText)
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve({ 
                success: true, 
                mediaId: response.media?.id || response.id,
                jobId: response.jobId,
              })
            } else {
              resolve({ success: false, error: response.error || `HTTP ${xhr.status}` })
            }
          } catch {
            resolve({ success: false, error: 'Invalid response' })
          }
        })

        xhr.addEventListener('error', () => resolve({ success: false, error: 'Network error' }))
        xhr.addEventListener('abort', () => resolve({ success: false, error: 'Cancelled' }))

        controller.signal.addEventListener('abort', () => xhr.abort())

        xhr.open('POST', uploadEndpoint)
        xhr.send(formData)
      })

      abortControllersRef.current.delete(queuedFile.id)

      // Update file status in queue
      const index = queueRef.current.findIndex(f => f.id === queuedFile.id)
      if (index !== -1) {
        if (result.success) {
          queueRef.current[index] = { 
            ...queueRef.current[index], 
            status: 'success', 
            progress: 100,
            mediaId: result.mediaId,
            jobId: result.jobId,
          }
          callbacksRef.current.onFileSuccess?.(queueRef.current[index])
        } else {
          queueRef.current[index] = { 
            ...queueRef.current[index], 
            status: 'error', 
            error: result.error,
          }
          callbacksRef.current.onFileError?.(queueRef.current[index], result.error || 'Unknown error')
        }
        syncQueueToUI()
      }

      return result.success
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      
      const index = queueRef.current.findIndex(f => f.id === queuedFile.id)
      if (index !== -1) {
        queueRef.current[index] = { 
          ...queueRef.current[index], 
          status: 'error', 
          error: errorMsg,
        }
        callbacksRef.current.onFileError?.(queueRef.current[index], errorMsg)
        syncQueueToUI()
      }
      
      abortControllersRef.current.delete(queuedFile.id)
      return false
    }
  }, [syncQueueToUI])

  // === WORKER FUNCTION ===
  
  const runWorker = useCallback(async (workerId: number) => {
    console.log(`[Worker ${workerId}] Started`)
    
    while (isUploadingRef.current) {
      // Check pause
      if (isPausedRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100))
        continue
      }

      // Try to claim next file
      const file = await claimNextFile()
      
      if (!file) {
        // No pending files, check if there are still uploading files
        const hasUploading = queueRef.current.some(f => f.status === 'uploading')
        if (!hasUploading) {
          // All done
          console.log(`[Worker ${workerId}] No more files, exiting`)
          break
        }
        // Wait a bit and retry
        await new Promise(resolve => setTimeout(resolve, 50))
        continue
      }

      console.log(`[Worker ${workerId}] Uploading: ${file.file.name}`)
      await uploadFile(file)
    }
    
    console.log(`[Worker ${workerId}] Stopped`)
  }, [claimNextFile, uploadFile])

  // === CONTROL FUNCTIONS ===

  const startUpload = useCallback(() => {
    if (isUploadingRef.current) return
    
    const pending = queueRef.current.filter(f => f.status === 'pending')
    if (pending.length === 0) return

    const currentParallelLimit = optionsRef.current.parallelLimit
    console.log(`[useBulkUpload] Starting upload of ${pending.length} files with ${currentParallelLimit} workers`)
    
    isUploadingRef.current = true
    isPausedRef.current = false
    uploadStartTimeRef.current = Date.now()
    
    setIsUploading(true)
    setIsPaused(false)

    // Start workers
    const workerPromises = Array(currentParallelLimit)
      .fill(null)
      .map((_, i) => runWorker(i + 1))

    // Wait for all workers to finish
    Promise.all(workerPromises).then(() => {
      console.log('[useBulkUpload] All workers finished')
      isUploadingRef.current = false
      setIsUploading(false)
      syncQueueToUIImmediate()
      
      const finalStats = calculateStats()
      callbacksRef.current.onComplete?.(finalStats)
    })
  }, [runWorker, syncQueueToUIImmediate, calculateStats])

  const pauseUpload = useCallback(() => {
    console.log('[useBulkUpload] Pausing')
    isPausedRef.current = true
    setIsPaused(true)
  }, [])

  const resumeUpload = useCallback(() => {
    console.log('[useBulkUpload] Resuming')
    isPausedRef.current = false
    setIsPaused(false)
  }, [])

  const cancelUpload = useCallback(() => {
    console.log('[useBulkUpload] Cancelling')
    
    // Stop workers
    isUploadingRef.current = false
    isPausedRef.current = false
    
    // Abort all current uploads
    abortControllersRef.current.forEach(controller => controller.abort())
    abortControllersRef.current.clear()
    
    // Mark uploading and pending as cancelled
    queueRef.current = queueRef.current.map(f => 
      f.status === 'uploading' || f.status === 'pending'
        ? { ...f, status: 'cancelled' as const }
        : f
    )
    
    setIsUploading(false)
    setIsPaused(false)
    syncQueueToUIImmediate()
  }, [syncQueueToUIImmediate])

  const retryFailed = useCallback(() => {
    console.log('[useBulkUpload] Retrying failed files')
    
    queueRef.current = queueRef.current.map(f => {
      if (f.status === 'error' && f.retryCount < maxRetries) {
        return { ...f, status: 'pending' as const, error: undefined, retryCount: f.retryCount + 1 }
      }
      if (f.status === 'cancelled') {
        return { ...f, status: 'pending' as const, retryCount: 0 }
      }
      return f
    })
    
    syncQueueToUIImmediate()
    
    // Auto-start if not uploading
    if (!isUploadingRef.current) {
      setTimeout(() => startUpload(), 100)
    }
  }, [maxRetries, syncQueueToUIImmediate, startUpload])

  const clearSuccess = useCallback(() => {
    queueRef.current
      .filter(f => f.status === 'success')
      .forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview)
      })
    
    queueRef.current = queueRef.current.filter(f => f.status !== 'success')
    syncQueueToUIImmediate()
  }, [syncQueueToUIImmediate])

  return {
    files,
    stats,
    isUploading,
    isPaused,
    addFiles,
    removeFile,
    clearQueue,
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    retryFailed,
    clearSuccess,
  }
}

export default useBulkUpload

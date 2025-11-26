/**
 * Утилиты для пагинации bulk операций
 * Разбивает большие списки ID на батчи для обработки
 */

export interface PaginationOptions {
  /**
   * Максимальный размер батча
   */
  batchSize: number
  
  /**
   * Максимальное количество параллельных батчей
   */
  maxConcurrentBatches?: number
}

export interface BatchResult<T> {
  batchIndex: number
  result: T
  success: boolean
}

/**
 * Разбить массив ID на батчи
 */
export function chunkIds(ids: string[], batchSize: number): string[][] {
  const batches: string[][] = []
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize))
  }
  return batches
}

/**
 * Выполнить bulk операцию с пагинацией
 * Разбивает большие списки на батчи и обрабатывает их последовательно или параллельно
 */
export async function executeBulkWithPagination<T>(
  ids: string[],
  operation: (batchIds: string[]) => Promise<T>,
  options: PaginationOptions
): Promise<{
  results: BatchResult<T>[]
  totalProcessed: number
  totalSuccess: number
  totalFailed: number
}> {
  const batches = chunkIds(ids, options.batchSize)
  const results: BatchResult<T>[] = []
  const maxConcurrent = options.maxConcurrentBatches || 1

  // Обрабатываем батчи с ограничением параллелизма
  for (let i = 0; i < batches.length; i += maxConcurrent) {
    const concurrentBatches = batches.slice(i, i + maxConcurrent)
    
    const batchResults = await Promise.allSettled(
      concurrentBatches.map(async (batch, index) => {
        try {
          const result = await operation(batch)
          return {
            batchIndex: i + index,
            result,
            success: true
          } as BatchResult<T>
        } catch (error) {
          return {
            batchIndex: i + index,
            result: error as T,
            success: false
          } as BatchResult<T>
        }
      })
    )

    results.push(
      ...batchResults.map((r, idx) => 
        r.status === 'fulfilled' 
          ? r.value 
          : {
              batchIndex: i + idx,
              result: r.reason as T,
              success: false
            } as BatchResult<T>
      )
    )
  }

  const totalSuccess = results.filter(r => r.success).length
  const totalFailed = results.length - totalSuccess

  return {
    results,
    totalProcessed: ids.length,
    totalSuccess: totalSuccess * options.batchSize, // Приблизительно
    totalFailed: totalFailed * options.batchSize // Приблизительно
  }
}







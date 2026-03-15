import { describe, it, expect, vi } from 'vitest'
import { chunkIds, executeBulkWithPagination } from '@/services/bulk/bulk-pagination'

describe('chunkIds', () => {
  it('should split array into chunks of given size', () => {
    expect(chunkIds(['1', '2', '3', '4', '5'], 2)).toEqual([['1', '2'], ['3', '4'], ['5']])
  })

  it('should return single chunk when array length equals batch size', () => {
    expect(chunkIds(['1', '2', '3'], 3)).toEqual([['1', '2', '3']])
  })

  it('should return single chunk when array is smaller than batch size', () => {
    expect(chunkIds(['1', '2'], 5)).toEqual([['1', '2']])
  })

  it('should return empty array for empty input', () => {
    expect(chunkIds([], 5)).toEqual([])
  })

  it('should return chunks of size 1 when batchSize is 1', () => {
    expect(chunkIds(['a', 'b', 'c'], 1)).toEqual([['a'], ['b'], ['c']])
  })

  it('should return one chunk per element when batchSize equals array length', () => {
    const ids = ['x', 'y', 'z']
    const result = chunkIds(ids, ids.length)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(ids)
  })
})

describe('executeBulkWithPagination', () => {
  it('should process all batches sequentially by default (maxConcurrentBatches not set)', async () => {
    // Arrange
    const ids = ['1', '2', '3', '4', '5']
    const operationOrder: string[][] = []
    const operation = vi.fn().mockImplementation(async (batchIds: string[]) => {
      operationOrder.push(batchIds)
      return { processed: batchIds.length }
    })

    // Act
    const result = await executeBulkWithPagination(ids, operation, { batchSize: 2 })

    // Assert
    expect(operation).toHaveBeenCalledTimes(3) // batches: [1,2], [3,4], [5]
    expect(operationOrder[0]).toEqual(['1', '2'])
    expect(operationOrder[1]).toEqual(['3', '4'])
    expect(operationOrder[2]).toEqual(['5'])
    expect(result.totalProcessed).toBe(5)
  })

  it('should return results for all batches', async () => {
    // Arrange
    const ids = ['a', 'b', 'c', 'd']
    const operation = vi.fn()
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 2 })

    // Act
    const result = await executeBulkWithPagination(ids, operation, { batchSize: 2 })

    // Assert
    expect(result.results).toHaveLength(2)
    expect(result.results[0].success).toBe(true)
    expect(result.results[1].success).toBe(true)
    expect(result.results[0].batchIndex).toBe(0)
    expect(result.results[1].batchIndex).toBe(1)
  })

  it('should execute batches concurrently when maxConcurrentBatches is set', async () => {
    // Arrange
    const ids = ['1', '2', '3', '4']
    const concurrentCallTrack: number[] = []
    let activeBatches = 0
    let maxActiveBatches = 0

    const operation = vi.fn().mockImplementation(async (batchIds: string[]) => {
      activeBatches++
      maxActiveBatches = Math.max(maxActiveBatches, activeBatches)
      // Simulate async work
      await Promise.resolve()
      activeBatches--
      return { count: batchIds.length }
    })

    // Act
    await executeBulkWithPagination(ids, operation, {
      batchSize: 2,
      maxConcurrentBatches: 2
    })

    // Assert — with 4 IDs and batchSize=2 and maxConcurrent=2, both batches run in parallel
    expect(operation).toHaveBeenCalledTimes(2)
    // maxActiveBatches should be 2 (concurrent execution)
    expect(maxActiveBatches).toBe(2)
  })

  it('should continue processing other batches when one batch fails (Promise.allSettled)', async () => {
    // Arrange
    const ids = ['1', '2', '3', '4']
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('Batch 1 failed'))
      .mockResolvedValueOnce({ count: 2 })

    // Act
    const result = await executeBulkWithPagination(ids, operation, {
      batchSize: 2,
      maxConcurrentBatches: 2
    })

    // Assert — both batches run, one fails but we get results for both
    expect(result.results).toHaveLength(2)
    const failedBatch = result.results.find(r => !r.success)
    const successBatch = result.results.find(r => r.success)
    expect(failedBatch).toBeDefined()
    expect(successBatch).toBeDefined()
  })

  it('should return empty results for empty IDs array', async () => {
    // Arrange
    const operation = vi.fn()

    // Act
    const result = await executeBulkWithPagination([], operation, { batchSize: 100 })

    // Assert
    expect(operation).not.toHaveBeenCalled()
    expect(result.results).toHaveLength(0)
    expect(result.totalProcessed).toBe(0)
  })

  it('should track totalSuccess and totalFailed counts', async () => {
    // Arrange
    const ids = ['1', '2', '3', '4', '5', '6']
    // 3 batches: first 2 succeed, last one fails
    const operation = vi.fn()
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 2 })
      .mockRejectedValueOnce(new Error('Failed'))

    // Act
    const result = await executeBulkWithPagination(ids, operation, { batchSize: 2 })

    // Assert
    expect(result.totalSuccess).toBeGreaterThan(0)
    expect(result.totalFailed).toBeGreaterThan(0)
    expect(result.totalProcessed).toBe(6)
  })
})

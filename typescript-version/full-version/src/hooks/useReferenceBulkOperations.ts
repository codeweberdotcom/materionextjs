import { useState, useCallback, useMemo } from 'react'

import type { RowSelectionState } from '@tanstack/react-table'
import { toast } from 'react-toastify'

interface UseReferenceBulkOperationsProps<T extends { id: string; isActive: boolean }> {
  /** Entity name for API path (e.g. 'countries', 'states', 'cities', 'districts') */
  entity: string
  /** URL for refetching data after operation */
  refetchUrl: string
  /** Current filtered data array */
  filteredData: T[]
  /** State setter for main data array */
  setData: (data: T[]) => void
  /** State setter for filtered data array */
  setFilteredData: (data: T[]) => void
  /** Translation dictionary */
  dictionary: Record<string, any>
}

interface UseReferenceBulkOperationsReturn {
  rowSelection: RowSelectionState
  setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>
  selectedCount: number
  bulkLoading: boolean
  bulkDeleteLoading: boolean
  bulkActivateLoading: boolean
  bulkDeactivateLoading: boolean
  handleBulkDelete: () => Promise<void>
  handleBulkStatusChange: (activate: boolean) => Promise<void>
}

export function useReferenceBulkOperations<T extends { id: string; isActive: boolean }>({
  entity,
  refetchUrl,
  filteredData,
  setData,
  setFilteredData,
  dictionary
}: UseReferenceBulkOperationsProps<T>): UseReferenceBulkOperationsReturn {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false)
  const [bulkActivateLoading, setBulkActivateLoading] = useState(false)
  const [bulkDeactivateLoading, setBulkDeactivateLoading] = useState(false)

  const bulkLoading = bulkDeleteLoading || bulkActivateLoading || bulkDeactivateLoading

  const selectedIds = useMemo(() => {
    return Object.keys(rowSelection)
      .filter(key => rowSelection[key])
      .map(index => filteredData[Number(index)]?.id)
      .filter(Boolean) as string[]
  }, [rowSelection, filteredData])

  const selectedCount = selectedIds.length

  const refetchData = useCallback(async () => {
    const response = await fetch(refetchUrl)

    if (response.ok) {
      const items = await response.json()

      setData(items)
      setFilteredData(items)
    }
  }, [refetchUrl, setData, setFilteredData])

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return

    if (!confirm(dictionary.navigation.bulkDeleteConfirm?.replace('${count}', String(selectedIds.length)) || `Delete ${selectedIds.length} records?`)) return

    setBulkDeleteLoading(true)

    try {
      const response = await fetch(`/api/admin/references/${entity}/bulk/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      })

      if (!response.ok) {
        const error = await response.json()

        throw new Error(error.message || 'Bulk delete failed')
      }

      const result = await response.json()

      toast.success(dictionary.navigation.bulkOperationSuccess?.replace('${successCount}', String(result.deleted)) || `Deleted ${result.deleted} records`)
      await refetchData()
      setRowSelection({})
    } catch (error) {
      console.error('Bulk delete error:', error)
      toast.error(error instanceof Error ? error.message : (dictionary.navigation.bulkOperationFailed || 'Operation failed'))
    } finally {
      setBulkDeleteLoading(false)
    }
  }, [entity, selectedIds, refetchData, dictionary])

  const handleBulkStatusChange = useCallback(async (activate: boolean) => {
    if (selectedIds.length === 0) return

    if (activate) {
      setBulkActivateLoading(true)
    } else {
      setBulkDeactivateLoading(true)
    }

    const action = activate ? 'activate' : 'deactivate'

    try {
      const response = await fetch(`/api/admin/references/${entity}/bulk/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      })

      if (!response.ok) {
        const error = await response.json()

        throw new Error(error.message || 'Bulk status change failed')
      }

      const result = await response.json()

      toast.success(dictionary.navigation.bulkOperationSuccess?.replace('${successCount}', String(result.affected)) || `Updated ${result.affected} records`)
      await refetchData()
      setRowSelection({})
    } catch (error) {
      console.error('Bulk status change error:', error)
      toast.error(error instanceof Error ? error.message : (dictionary.navigation.bulkOperationFailed || 'Operation failed'))
    } finally {
      setBulkActivateLoading(false)
      setBulkDeactivateLoading(false)
    }
  }, [entity, selectedIds, refetchData, dictionary])

  return {
    rowSelection,
    setRowSelection,
    selectedCount,
    bulkLoading,
    bulkDeleteLoading,
    bulkActivateLoading,
    bulkDeactivateLoading,
    handleBulkDelete,
    handleBulkStatusChange
  }
}

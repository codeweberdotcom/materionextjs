'use client'

// React Imports
import { useEffect, useState, useMemo } from 'react'

// Next Imports
import { useParams } from 'next/navigation'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import Switch from '@mui/material/Switch'
import { styled } from '@mui/material/styles'
import TablePagination from '@mui/material/TablePagination'
import type { TextFieldProps } from '@mui/material/TextField'

// Third-party Imports
import classnames from 'classnames'
import { rankItem } from '@tanstack/match-sorter-utils'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
  getPaginationRowModel,
  getSortedRowModel
} from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import type { RankingInfo } from '@tanstack/match-sorter-utils'
import { toast } from 'react-toastify'

// Type Imports
import type { ThemeColor } from '@core/types'
import type { Locale } from '@configs/i18n'

// Component Imports
import AddTranslationDialog from './AddTranslationDialog'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Style Imports
import tableStyles from '@core/styles/table.module.css'

declare module '@tanstack/table-core' {
  interface FilterFns {
    fuzzy: FilterFn<unknown>
  }
  interface FilterMeta {
    itemRank: RankingInfo
  }
}

type Translation = {
  id: string
  key: string
  language: string
  value: string
  namespace: string
  isActive: boolean
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)
  addMeta({ itemRank })
  return itemRank.passed
}

const DebouncedInput = ({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}: {
  value: string | number
  onChange: (value: string | number) => void
  debounce?: number
} & Omit<TextFieldProps, 'onChange'>) => {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value)
    }, debounce)

    return () => clearTimeout(timeout)
  }, [value])

  return <TextField {...props} value={value} onChange={e => setValue(e.target.value)} size='small' />
}

const columnHelper = createColumnHelper<Translation>()

const TranslationsListTable = () => {
  // Hooks
  const dictionary = useTranslation()

  const [data, setData] = useState<Translation[]>([])
  const [filteredData, setFilteredData] = useState(data)
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [addTranslationOpen, setAddTranslationOpen] = useState(false)
  const [editTranslation, setEditTranslation] = useState<Translation | null>(null)

  const { lang: locale } = useParams()

  // Fetch translations data
  useEffect(() => {
    const fetchTranslations = async () => {
      try {
        const response = await fetch('/api/admin/references/translations')
        if (response.ok) {
          const translations = await response.json()
          setData(translations)
          setFilteredData(translations)
        }
      } catch (error) {
        console.error('Error fetching translations:', error)
        toast.error('Failed to load translations')
      } finally {
        setLoading(false)
      }
    }

    fetchTranslations()
  }, [])

  const columns = useMemo<ColumnDef<Translation, any>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          {...{
            checked: table.getIsAllRowsSelected(),
            indeterminate: table.getIsSomeRowsSelected(),
            onChange: table.getToggleAllRowsSelectedHandler()
          }}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          {...{
            checked: row.getIsSelected(),
            disabled: !row.getCanSelect(),
            indeterminate: row.getIsSomeSelected(),
            onChange: row.getToggleSelectedHandler()
          }}
        />
      )
    },
    columnHelper.accessor('key', {
      header: dictionary.navigation.translationKey,
      cell: ({ row }) => <Typography>{row.original.key}</Typography>
    }),
    columnHelper.accessor('namespace', {
      header: dictionary.navigation.namespace,
      cell: ({ row }) => <Typography>{row.original.namespace}</Typography>
    }),
    columnHelper.accessor('language', {
      header: dictionary.navigation.language,
      cell: ({ row }) => (
        <Chip
          label={row.original.language.toUpperCase()}
          size='small'
          variant='outlined'
        />
      )
    }),
    columnHelper.accessor('value', {
      header: dictionary.navigation.translation,
      cell: ({ row }) => (
        <Typography className='max-w-64 truncate' title={row.original.value}>
          {row.original.value}
        </Typography>
      )
    }),
    columnHelper.accessor('isActive', {
      header: dictionary.navigation.status,
      cell: ({ row }) => (
        <Chip
          variant='tonal'
          label={row.original.isActive ? dictionary.navigation.active : dictionary.navigation.inactive}
          size='small'
          color={row.original.isActive ? 'success' : 'secondary'}
        />
      )
    }),
    {
      id: 'actions',
      header: dictionary.navigation.actions,
      cell: ({ row }) => (
        <div className='flex items-center'>
          <IconButton onClick={() => handleEditTranslation(row.original)} title={dictionary.navigation.editTranslation}>
            <i className='ri-edit-line text-textSecondary' />
          </IconButton>
          <Switch
            checked={row.original.isActive}
            onChange={() => handleToggleTranslationStatus(row.original.id)}
            size='small'
          />
          <IconButton onClick={() => handleDeleteTranslation(row.original.id, row.original.key)} title={dictionary.navigation.deleteTranslation}>
            <i className='ri-delete-bin-7-line text-textSecondary' />
          </IconButton>
        </div>
      ),
      enableSorting: false
    }
  ], [data])

  const table = useReactTable({
    data: filteredData,
    columns,
    filterFns: {
      fuzzy: fuzzyFilter
    },
    state: {
      globalFilter
    },
    initialState: {
      pagination: {
        pageSize: 10
      }
    },
    enableRowSelection: true,
    globalFilterFn: fuzzyFilter,
    getCoreRowModel: getCoreRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues()
  })

  const handleDeleteTranslation = async (id: string, key: string) => {
    if (!confirm(`Are you sure you want to delete translation "${key}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/references/translations/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const updatedData = data.filter(translation => translation.id !== id)
        setData(updatedData)
        setFilteredData(updatedData)
        toast.success('Translation deleted successfully!')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to delete translation')
      }
    } catch (error) {
      console.error('Error deleting translation:', error)
      toast.error('Failed to delete translation')
    }
  }

  const handleEditTranslation = (translation: Translation) => {
    setEditTranslation(translation)
  }

  const handleToggleTranslationStatus = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/references/translations/${id}`, {
        method: 'PATCH'
      })

      if (response.ok) {
        const updatedTranslation = await response.json()
        const updatedData = data.map(translation =>
          translation.id === updatedTranslation.id ? updatedTranslation : translation
        )
        setData(updatedData)
        setFilteredData(updatedData)
        toast.success(`Translation ${updatedTranslation.isActive ? 'activated' : 'deactivated'} successfully!`)
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to toggle translation status')
      }
    } catch (error) {
      console.error('Error toggling translation status:', error)
      toast.error('Failed to toggle translation status')
    }
  }

  const handleAddTranslation = async (translationData: { key: string; language: string; value: string; namespace: string; isActive: boolean }) => {
    try {
      const response = await fetch('/api/admin/references/translations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(translationData)
      })

      if (response.ok) {
        const newTranslation = await response.json()
        const updatedData = [...data, newTranslation]
        setData(updatedData)
        setFilteredData(updatedData)
        setAddTranslationOpen(false)
        toast.success('Translation added successfully!')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to add translation')
      }
    } catch (error) {
      console.error('Error adding translation:', error)
      toast.error('Failed to add translation')
    }
  }

  const handleUpdateTranslation = async (translationData: { id: string; key: string; language: string; value: string; namespace: string; isActive: boolean }) => {
    try {
      const response = await fetch(`/api/admin/references/translations/${translationData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(translationData)
      })

      if (response.ok) {
        const updatedTranslation = await response.json()
        const updatedData = data.map(translation =>
          translation.id === updatedTranslation.id ? updatedTranslation : translation
        )
        setData(updatedData)
        setFilteredData(updatedData)
        setEditTranslation(null)
        toast.success('Translation updated successfully!')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to update translation')
      }
    } catch (error) {
      console.error('Error updating translation:', error)
      toast.error('Failed to update translation')
    }
  }

  const handleExportToJSON = async () => {
    try {
      const response = await fetch('/api/admin/references/translations/export', {
        method: 'POST'
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`Translations exported to JSON for languages: ${result.exportedLanguages.join(', ')}. Please restart the development server to see changes.`)
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to export translations')
      }
    } catch (error) {
      console.error('Error exporting translations:', error)
      toast.error('Failed to export translations')
    }
  }

  const handleImportFromJSON = async () => {
    try {
      const response = await fetch('/api/admin/references/translations/import', {
        method: 'POST'
      })

      if (response.ok) {
        const result = await response.json()
        // Refresh data
        const translationsResponse = await fetch('/api/admin/references/translations')
        if (translationsResponse.ok) {
          const translations = await translationsResponse.json()
          setData(translations)
          setFilteredData(translations)
        }
        toast.success(`Translations imported from JSON successfully. Imported ${result.importedCount} translations.`)
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to import translations')
      }
    } catch (error) {
      console.error('Error importing translations:', error)
      toast.error('Failed to import translations')
    }
  }

  if (loading) {
    return <Typography>{dictionary.navigation.loadingTranslations}</Typography>
  }

  return (
    <>
      <Card>
        <CardHeader title={dictionary.navigation.translationManagement} />
        <Divider />
        <div className='flex justify-between p-5 gap-4 flex-col items-start sm:flex-row sm:items-center'>
          <div className='flex items-center gap-x-4 gap-4 flex-col max-sm:is-full sm:flex-row'>
            <DebouncedInput
              value={globalFilter ?? ''}
              onChange={value => setGlobalFilter(String(value))}
              placeholder={dictionary.navigation.searchTranslations}
              className='max-sm:is-full'
            />
          </div>
          <div className='flex gap-2'>
            <Button variant='outlined' onClick={handleImportFromJSON} className='max-sm:is-full'>
              {dictionary.navigation.importFromJSON}
            </Button>
            <Button variant='outlined' onClick={handleExportToJSON} className='max-sm:is-full'>
              {dictionary.navigation.exportToJSON}
            </Button>
            <Button variant='contained' onClick={() => setAddTranslationOpen(true)} className='max-sm:is-full'>
              {dictionary.navigation.addNewTranslation}
            </Button>
          </div>
        </div>
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id}>
                    {header.isPlaceholder ? null : (
                      <div
                        className={classnames({
                          'flex items-center': header.column.getIsSorted(),
                          'cursor-pointer select-none': header.column.getCanSort()
                        })}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: <i className='ri-arrow-up-s-line text-xl' />,
                          desc: <i className='ri-arrow-down-s-line text-xl' />
                        }[header.column.getIsSorted() as 'asc' | 'desc'] ?? null}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          {table.getFilteredRowModel().rows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={table.getVisibleFlatColumns().length} className='text-center'>
                  {dictionary.navigation.noTranslationsAvailable}
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {table
                .getRowModel()
                .rows.slice(0, table.getState().pagination.pageSize)
                .map(row => (
                  <tr key={row.id} className={classnames({ selected: row.getIsSelected() })}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
            </tbody>
          )}
        </table>
      </div>
      <TablePagination
        rowsPerPageOptions={[10, 25, 50]}
        component='div'
        className='border-bs'
        count={table.getFilteredRowModel().rows.length}
        rowsPerPage={table.getState().pagination.pageSize}
        page={table.getState().pagination.pageIndex}
        onPageChange={(_, page) => table.setPageIndex(page)}
        onRowsPerPageChange={e => table.setPageSize(Number(e.target.value))}
      />
      </Card>
      <AddTranslationDialog
        open={addTranslationOpen || !!editTranslation}
        handleClose={() => {
          setAddTranslationOpen(false)
          setEditTranslation(null)
        }}
        onSubmit={handleAddTranslation}
        editTranslation={editTranslation}
        onUpdate={handleUpdateTranslation}
      />
    </>
  )
}

export default TranslationsListTable
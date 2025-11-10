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
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import { styled } from '@mui/material/styles'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import Switch from '@mui/material/Switch'
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
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

// Type Imports
import type { ThemeColor } from '@core/types'
import type { Locale } from '@configs/i18n'

// Component Imports
import AddLanguageDialog from './AddLanguageDialog'
import EditLanguageDialog from './EditLanguageDialog'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Style Imports
import tableStyles from '@core/styles/table.module.css'

declare module '@tanstack/react-table' {
  interface FilterFns {
    fuzzy: FilterFn<unknown>
  }
  interface FilterMeta {
    itemRank: RankingInfo
  }
}

type Language = {
  id: string
  name: string
  code: string
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

const columnHelper = createColumnHelper<Language>()

const LanguagesListTable = () => {
  // Hooks
  const dictionary = useTranslation()

  const [data, setData] = useState<Language[]>([])
  const [filteredData, setFilteredData] = useState(data)
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [addLanguageOpen, setAddLanguageOpen] = useState(false)
  const [editLanguageOpen, setEditLanguageOpen] = useState(false)
  const [editingLanguage, setEditingLanguage] = useState<Language | null>(null)

  const { lang: locale } = useParams()

  // Fetch languages data
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await fetch('/api/languages')

        if (response.ok) {
          const languages = await response.json()

          setData(languages)
          setFilteredData(languages)
        }
      } catch (error) {
        console.error('Error fetching languages:', error)
        toast.error('Failed to load languages')
      } finally {
        setLoading(false)
      }
    }

    fetchLanguages()
  }, [])

  const columns = useMemo<ColumnDef<Language, any>[]>(
    () => [
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
      columnHelper.accessor('name', {
        header: dictionary.navigation.language,
        cell: ({ row }) => <Typography>{row.original.name}</Typography>
      }),
      columnHelper.accessor('code', {
        header: dictionary.navigation.code,
        cell: ({ row }) => <Typography>{row.original.code}</Typography>
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
            <IconButton onClick={() => {
              setEditingLanguage(row.original)
              setEditLanguageOpen(true)
            }} title={dictionary.navigation.editTranslation}>
              <i className='ri-edit-line text-textSecondary' />
            </IconButton>
            <Switch
              checked={row.original.isActive}
              onChange={() => handleToggleLanguageStatus(row.original.id)}
              size='small'
            />
            <IconButton onClick={() => handleDeleteLanguage(row.original.id, row.original.name)} title={dictionary.navigation.deleteTranslation}>
              <i className='ri-delete-bin-7-line text-textSecondary' />
            </IconButton>
          </div>
        ),
        enableSorting: false
      }
    ],
    [data]
  )

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

  const handleDeleteLanguage = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete language "${name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/references/languages/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const updatedData = data.filter(lang => lang.id !== id)

        setData(updatedData)
        setFilteredData(updatedData)
        toast.success('Language deleted successfully!')
      } else {
        const error = await response.json()

        toast.error(error.message || 'Failed to delete language')
      }
    } catch (error) {
      console.error('Error deleting language:', error)
      toast.error('Failed to delete language')
    }
  }

  const handleAddLanguage = async (languageData: { name: string; code: string; isActive: boolean }) => {
    try {
      const response = await fetch('/api/admin/references/languages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(languageData)
      })

      if (response.ok) {
        const newLanguage = await response.json()
        const updatedData = [...data, newLanguage]

        setData(updatedData)
        setFilteredData(updatedData)
        setAddLanguageOpen(false)
        toast.success('Language added successfully!')
      } else {
        const error = await response.json()

        toast.error(error.message || 'Failed to add language')
      }
    } catch (error) {
      console.error('Error adding language:', error)
      toast.error('Failed to add language')
    }
  }

  const handleEditLanguage = async (id: string, languageData: { name: string; code: string; isActive: boolean }) => {
    try {
      const response = await fetch(`/api/admin/references/languages/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(languageData)
      })

      if (response.ok) {
        const updatedLanguage = await response.json()
        const updatedData = data.map(lang => lang.id === id ? updatedLanguage : lang)

        setData(updatedData)
        setFilteredData(updatedData)
        setEditLanguageOpen(false)
        setEditingLanguage(null)
        toast.success('Language updated successfully!')
      } else {
        const error = await response.json()

        toast.error(error.message || 'Failed to update language')
      }
    } catch (error) {
      console.error('Error updating language:', error)
      toast.error('Failed to update language')
    }
  }

  const handleToggleLanguageStatus = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/references/languages/${id}`, {
        method: 'PATCH'
      })

      if (response.ok) {
        const updatedLanguage = await response.json()

        const updatedData = data.map(lang =>
          lang.id === updatedLanguage.id ? updatedLanguage : lang
        )

        setData(updatedData)
        setFilteredData(updatedData)
        toast.success(`Language ${updatedLanguage.isActive ? 'activated' : 'deactivated'} successfully!`)
      } else {
        const error = await response.json()

        toast.error(error.message || 'Failed to toggle language status')
      }
    } catch (error) {
      console.error('Error toggling language status:', error)
      toast.error('Failed to toggle language status')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton width={200} height={28} />
        </CardHeader>
        <Divider />
        <div className='flex justify-between p-5 gap-4 flex-col items-start sm:flex-row sm:items-center'>
          <div className='flex items-center gap-x-4 gap-4 flex-col max-sm:is-full sm:flex-row'>
            <Skeleton width={300} height={40} />
          </div>
          <Skeleton width={150} height={36} />
        </div>
        <TableContainer>
          <Table className={tableStyles.table}>
            <TableHead>
              <TableRow>
                {[20, 120, 80, 70, 100].map((width, idx) => (
                  <TableCell key={idx}>
                    <Skeleton width={width} height={20} />
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.from({ length: 10 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton width={20} height={20} /></TableCell>
                  <TableCell><Skeleton width={120} height={16} /></TableCell>
                  <TableCell><Skeleton width={80} height={16} /></TableCell>
                  <TableCell><Skeleton width={70} height={24} /></TableCell>
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      <Skeleton width={24} height={24} />
                      <Skeleton width={24} height={24} />
                      <Skeleton width={40} height={20} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <div className='border-bs p-4'>
          <Skeleton width={200} height={24} />
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader title={dictionary.navigation.languagesManagement} />
        <Divider />
        <div className='flex justify-between p-5 gap-4 flex-col items-start sm:flex-row sm:items-center'>
          <div className='flex items-center gap-x-4 gap-4 flex-col max-sm:is-full sm:flex-row'>
            <DebouncedInput
              value={globalFilter ?? ''}
              onChange={value => setGlobalFilter(String(value))}
              placeholder={dictionary.navigation.searchLanguage}
              className='max-sm:is-full'
            />
          </div>
          <Button variant='contained' onClick={() => setAddLanguageOpen(true)} className='max-sm:is-full'>
            {dictionary.navigation.addNewLanguage}
          </Button>
        </div>
        <TableContainer>
          <Table className={tableStyles.table}>
            <TableHead>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <TableCell key={header.id}>
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
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {table.getFilteredRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={table.getVisibleFlatColumns().length} className='text-center'>
                    {dictionary.navigation.noDataAvailable}
                  </TableCell>
                </TableRow>
              ) : (
                table
                  .getRowModel()
                  .rows.slice(0, table.getState().pagination.pageSize)
                  .map(row => (
                    <TableRow key={row.id} className={classnames({ selected: row.getIsSelected() })}>
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
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
      <AddLanguageDialog
        open={addLanguageOpen}
        handleClose={() => setAddLanguageOpen(false)}
        onSubmit={handleAddLanguage}
      />
      {editingLanguage && (
        <EditLanguageDialog
          open={editLanguageOpen}
          handleClose={() => {
            setEditLanguageOpen(false)
            setEditingLanguage(null)
          }}
          language={editingLanguage}
          onSubmit={(data) => handleEditLanguage(editingLanguage.id, data)}
        />
      )}
    </>
  )
}

export default LanguagesListTable

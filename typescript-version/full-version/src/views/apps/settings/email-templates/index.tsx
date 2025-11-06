'use client'

// React Imports
import { useState, useEffect, useMemo } from 'react'

// Next Imports
import { useParams } from 'next/navigation'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import TablePagination from '@mui/material/TablePagination'
import type { TextFieldProps } from '@mui/material/TextField'
import Grid from '@mui/material/Grid'

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
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Type Imports
import type { ThemeColor } from '@core/types'

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

type EmailTemplate = {
  id: string
  name: string
  subject: string
  content: string
  createdAt: string
  updatedAt: string
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

const columnHelper = createColumnHelper<EmailTemplate>()

const EmailTemplates = () => {
  // Hooks
  const dictionary = useTranslation()

  const [data, setData] = useState<EmailTemplate[]>([])
  const [filteredData, setFilteredData] = useState(data)
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    content: ''
  })

  const [message, setMessage] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null)

  const { lang: locale } = useParams()

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/settings/email-templates')

      if (response.ok) {
        const data = await response.json()

        setData(data)
        setFilteredData(data)
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTemplate = () => {
    setEditingTemplate(null)
    setFormData({ name: '', subject: '', content: '' })
    setDialogOpen(true)
  }

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      subject: template.subject,
      content: template.content
    })
    setDialogOpen(true)
  }

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Вы уверены, что хотите удалить шаблон "${name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/settings/email-templates/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const updatedData = data.filter(t => t.id !== id)

        setData(updatedData)
        setFilteredData(updatedData)
        setMessage('Шаблон удален успешно!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage('Ошибка при удалении шаблона.')
      }
    } catch (error) {
      setMessage('Ошибка при удалении шаблона.')
    }
  }

  const handlePreviewTemplate = (template: EmailTemplate) => {
    setPreviewTemplate(template)
    setPreviewOpen(true)
  }

  const handleClosePreview = () => {
    setPreviewOpen(false)
    setPreviewTemplate(null)
  }

  // Sample variables for preview
  const sampleVariables = {
    name: 'Иван Иванов',
    email: 'ivan@example.com',
    date: new Date().toLocaleDateString('ru-RU'),
    link: 'https://example.com/reset-password'
  }

  // Replace variables in template
  const replaceVariables = (text: string, variables: Record<string, string>): string => {
    let result = text

    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value)
    })
    
return result
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingTemplate
        ? `/api/settings/email-templates/${editingTemplate.id}`
        : '/api/settings/email-templates'

      const method = editingTemplate ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const updatedTemplate = await response.json()

        if (editingTemplate) {
          const updatedData = data.map(t => t.id === editingTemplate.id ? updatedTemplate : t)

          setData(updatedData)
          setFilteredData(updatedData)
          setMessage('Шаблон обновлен успешно!')
        } else {
          const updatedData = [...data, updatedTemplate]

          setData(updatedData)
          setFilteredData(updatedData)
          setMessage('Шаблон создан успешно!')
        }

        setDialogOpen(false)
        setTimeout(() => setMessage(''), 3000)
      } else {
        const error = await response.json()

        setMessage(error.message || 'Ошибка при сохранении шаблона.')
      }
    } catch (error) {
      setMessage('Ошибка при сохранении шаблона.')
    }
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingTemplate(null)
    setFormData({ name: '', subject: '', content: '' })
  }

  const columns = useMemo<ColumnDef<EmailTemplate, any>[]>(() => [
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
      header: dictionary.navigation.templateName || 'Template Name',
      cell: ({ row }) => <Typography>{row.original.name}</Typography>
    }),
    columnHelper.accessor('subject', {
      header: dictionary.navigation.templateSubject || 'Subject',
      cell: ({ row }) => <Typography>{row.original.subject}</Typography>
    }),
    columnHelper.accessor('content', {
      header: dictionary.navigation.templateContent || 'Content',
      cell: ({ row }) => (
        <div
          dangerouslySetInnerHTML={{
            __html: row.original.content.length > 100
              ? row.original.content.substring(0, 100) + '...'
              : row.original.content
          }}
        />
      )
    }),
    {
      id: 'variables',
      header: dictionary.navigation.templateVariables || 'Variables',
      cell: ({ row }) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {['{name}', '{email}', '{date}', '{link}'].map(variable => (
            <Chip
              key={variable}
              label={variable}
              size='small'
              variant='outlined'
              color='primary'
            />
          ))}
        </div>
      )
    },
    {
      id: 'actions',
      header: dictionary.navigation.actions || 'Actions',
      cell: ({ row }) => (
        <div className='flex items-center'>
          <IconButton onClick={() => handlePreviewTemplate(row.original)} title={dictionary.navigation.previewTemplate || 'Preview'}>
            <i className='ri-eye-line text-textSecondary' />
          </IconButton>
          <IconButton onClick={() => handleEditTemplate(row.original)} title={dictionary.navigation.editTemplate || 'Edit'}>
            <i className='ri-edit-line text-textSecondary' />
          </IconButton>
          <IconButton onClick={() => handleDeleteTemplate(row.original.id, row.original.name)} title={dictionary.navigation.deleteTemplate || 'Delete'}>
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
        <div className='overflow-x-auto'>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th><Skeleton width={20} height={20} /></th>
                <th><Skeleton width={120} height={20} /></th>
                <th><Skeleton width={100} height={20} /></th>
                <th><Skeleton width={150} height={20} /></th>
                <th><Skeleton width={100} height={20} /></th>
                <th><Skeleton width={100} height={20} /></th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }).map((_, index) => (
                <tr key={index}>
                  <td><Skeleton width={20} height={20} /></td>
                  <td><Skeleton width={120} height={16} /></td>
                  <td><Skeleton width={100} height={16} /></td>
                  <td><Skeleton width={150} height={16} /></td>
                  <td>
                    <div className='flex items-center gap-2'>
                      <Skeleton width={24} height={24} />
                      <Skeleton width={24} height={24} />
                      <Skeleton width={24} height={24} />
                    </div>
                  </td>
                  <td>
                    <div className='flex items-center gap-2'>
                      <Skeleton width={24} height={24} />
                      <Skeleton width={24} height={24} />
                      <Skeleton width={24} height={24} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className='border-bs p-4'>
          <Skeleton width={200} height={24} />
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader title={dictionary?.navigation?.emailTemplates || 'Email Templates'} />
        <Divider />
        <div className='flex justify-between p-5 gap-4 flex-col items-start sm:flex-row sm:items-center'>
          <div className='flex items-center gap-x-4 gap-4 flex-col max-sm:is-full sm:flex-row'>
            <DebouncedInput
              value={globalFilter ?? ''}
              onChange={value => setGlobalFilter(String(value))}
              placeholder='Поиск шаблонов'
              className='max-sm:is-full'
            />
          </div>
          <Button variant='contained' onClick={handleCreateTemplate} className='max-sm:is-full'>
            {dictionary?.navigation?.createTemplate || 'Create Template'}
          </Button>
        </div>
        {message && (
          <Alert severity={message.includes('успешно') ? 'success' : 'error'} sx={{ mx: 5, mb: 4 }}>
            {message}
          </Alert>
        )}
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
                    {dictionary?.navigation?.noDataAvailable || 'No data available'}
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
          labelRowsPerPage='Строк на странице:'
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} из ${count}`}
        />
      </Card>

      {/* Template Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth='md' fullWidth>
        <DialogTitle>
          {editingTemplate ? dictionary?.navigation?.editTemplate || 'Edit Template' : dictionary?.navigation?.createTemplate || 'Create Template'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={dictionary?.navigation?.templateName || 'Template Name'}
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={dictionary?.navigation?.templateSubject || 'Email Subject'}
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={dictionary?.navigation?.templateContent || 'Email Content (HTML)'}
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  multiline
                  rows={8}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.navigation?.templateVariables || 'Available variables'}: {'{name}'}, {'{email}'}, {'{date}'}, {'{link}'}
                </Typography>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>
              {dictionary?.navigation?.cancel || 'Cancel'}
            </Button>
            <Button type='submit' variant='contained'>
              {editingTemplate ? dictionary?.navigation?.saveChanges || 'Save Changes' : dictionary?.navigation?.create || 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={handleClosePreview} maxWidth='md' fullWidth>
        <DialogTitle>
          {dictionary?.navigation?.previewTemplate || 'Preview Template'}: {previewTemplate?.name}
        </DialogTitle>
        <DialogContent>
          {previewTemplate && (
            <Box>
              <Typography variant='subtitle2' gutterBottom>
                <strong>{dictionary?.navigation?.templateSubject || 'Subject'}:</strong>
              </Typography>
              <Typography variant='body1' sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                {replaceVariables(previewTemplate.subject, sampleVariables)}
              </Typography>

              <Typography variant='subtitle2' gutterBottom>
                <strong>{dictionary?.navigation?.templateContent || 'Content'}:</strong>
              </Typography>
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'grey.50',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'grey.200'
                }}
                dangerouslySetInnerHTML={{
                  __html: replaceVariables(previewTemplate.content, sampleVariables)
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePreview}>
            {dictionary?.navigation?.cancel || 'Close'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default EmailTemplates
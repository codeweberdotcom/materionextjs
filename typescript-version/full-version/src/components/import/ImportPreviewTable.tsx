'use client'

import { useMemo, useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TablePagination,
  Tabs,
  Tab
} from '@mui/material'
import type { RowWithValidation, ValidationError } from '@/types/export-import'
import tableStyles from '@core/styles/table.module.css'

interface ImportPreviewTableProps {
  previewData: RowWithValidation[]
  onRowEdit?: (rowIndex: number, data: Record<string, any>) => void
  onRowClick?: (rowIndex: number) => void
  onRowDelete?: (rowIndex: number) => void
  importFields?: Array<{ key: string; label: string; type: string; enum?: string[] }>
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`preview-tabpanel-${index}`}
      aria-labelledby={`preview-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  )
}

/**
 * Компонент предпросмотра данных в таблице
 */
export default function ImportPreviewTable({
  previewData,
  onRowEdit,
  onRowClick,
  onRowDelete,
  importFields = []
}: ImportPreviewTableProps) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [tabValue, setTabValue] = useState(0)

  // Фильтруем данные по вкладкам
  const filteredData = useMemo(() => {
    switch (tabValue) {
      case 0: // Все
        return previewData
      case 1: // Валидные
        return previewData.filter(row => row.isValid)
      case 2: // С ошибками
        return previewData.filter(row => !row.isValid)
      default:
        return previewData
    }
  }, [previewData, tabValue])

  // Получаем все уникальные ключи из данных
  const allKeys = useMemo(() => {
    const keys = new Set<string>()
    previewData.forEach(row => {
      Object.keys(row.data).forEach(key => keys.add(key))
    })
    return Array.from(keys)
  }, [previewData])

  // Получаем заголовки колонок (используем importFields или ключи из данных)
  const columns = useMemo(() => {
    if (importFields.length > 0) {
      return importFields.map(field => ({
        key: field.key,
        label: field.label,
        type: field.type,
        enum: field.enum
      }))
    }
    // Если нет importFields, используем ключи из данных
    return allKeys.map(key => ({
      key,
      label: key,
      type: 'string' as const
    }))
  }, [importFields, allKeys])

  // Создаем маппинг label -> key для быстрого поиска
  const labelToKeyMap = useMemo(() => {
    const map = new Map<string, string>()
    if (importFields.length > 0) {
      importFields.forEach(field => {
        map.set(field.label.toLowerCase(), field.key)
        map.set(field.key.toLowerCase(), field.key)
      })
    }
    return map
  }, [importFields])

  // Пагинация
  const paginatedData = useMemo(() => {
    const start = page * rowsPerPage
    return filteredData.slice(start, start + rowsPerPage)
  }, [filteredData, page, rowsPerPage])

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const getErrorForCell = (row: RowWithValidation, fieldKey: string): ValidationError | undefined => {
    return row.errors.find(error => error.field === fieldKey)
  }

  const getCellValue = (row: RowWithValidation, columnKey: string, columnLabel?: string): any => {
    const data = row.data

    // Отладочная информация (только для первых нескольких строк)
    if (row.rowIndex <= 3) {
      console.log(`[Row ${row.rowIndex}] Looking for columnKey: "${columnKey}", columnLabel: "${columnLabel}"`)
      console.log(`[Row ${row.rowIndex}] Available keys in data:`, Object.keys(data))
      console.log(`[Row ${row.rowIndex}] Data values:`, data)
    }

    // 1. Пробуем найти по точному ключу (даже если значение пустое, но не undefined/null)
    if (columnKey in data) {
      const value = data[columnKey]
      if (value !== undefined && value !== null) {
        return value
      }
    }

    // 2. Пробуем найти по label (заголовок из CSV) - это самый важный вариант
    if (columnLabel) {
      // Точное совпадение
      if (columnLabel in data) {
        const value = data[columnLabel]
        if (value !== undefined && value !== null) {
          return value
        }
      }

      // Варианты регистра
      const labelLower = columnLabel.toLowerCase()
      const labelUpper = columnLabel.toUpperCase()
      const labelTitle = columnLabel.charAt(0).toUpperCase() + columnLabel.slice(1).toLowerCase()

      if (labelLower in data) {
        const value = data[labelLower]
        if (value !== undefined && value !== null) {
          return value
        }
      }
      if (labelUpper in data) {
        const value = data[labelUpper]
        if (value !== undefined && value !== null) {
          return value
        }
      }
      if (labelTitle in data) {
        const value = data[labelTitle]
        if (value !== undefined && value !== null) {
          return value
        }
      }
    }

    // 3. Пробуем найти по ключу в разных регистрах
    const keyLower = columnKey.toLowerCase()
    const keyUpper = columnKey.toUpperCase()
    const keyTitle = columnKey.charAt(0).toUpperCase() + columnKey.slice(1).toLowerCase()

    if (keyLower in data) {
      const value = data[keyLower]
      if (value !== undefined && value !== null) {
        return value
      }
    }
    if (keyUpper in data) {
      const value = data[keyUpper]
      if (value !== undefined && value !== null) {
        return value
      }
    }
    if (keyTitle in data) {
      const value = data[keyTitle]
      if (value !== undefined && value !== null) {
        return value
      }
    }

    // 4. Пробуем найти через маппинг label -> key
    if (columnLabel && labelToKeyMap.has(columnLabel.toLowerCase())) {
      const mappedKey = labelToKeyMap.get(columnLabel.toLowerCase())!
      if (mappedKey in data) {
        const value = data[mappedKey]
        if (value !== undefined && value !== null) {
          return value
        }
      }
    }

    // 5. Ищем по всем ключам данных (case-insensitive и с учетом пробелов)
    const searchKey = columnKey.toLowerCase().replace(/\s+/g, '')
    const searchLabel = columnLabel?.toLowerCase().replace(/\s+/g, '')

    for (const dataKey in data) {
      const normalizedDataKey = dataKey.toLowerCase().replace(/\s+/g, '')
      if (normalizedDataKey === searchKey || (searchLabel && normalizedDataKey === searchLabel)) {
        const value = data[dataKey]
        if (value !== undefined && value !== null) {
          return value
        }
      }
    }

    // 6. Последняя попытка - ищем частичное совпадение
    if (columnLabel) {
      for (const dataKey in data) {
        if (dataKey.toLowerCase().includes(columnLabel.toLowerCase()) ||
            columnLabel.toLowerCase().includes(dataKey.toLowerCase())) {
          const value = data[dataKey]
          if (value !== undefined && value !== null) {
            return value
          }
        }
      }
    }

    // Если ничего не найдено, возвращаем пустую строку (не "######")
    return ''
  }

  const handleRowClick = (rowIndex: number) => {
    onRowClick?.(rowIndex)
  }

  const handleEditClick = (e: React.MouseEvent, rowIndex: number) => {
    e.stopPropagation()
    onRowEdit?.(rowIndex, previewData.find(r => r.rowIndex === rowIndex)?.data || {})
  }

  const handleDeleteClick = (e: React.MouseEvent, rowIndex: number) => {
    e.stopPropagation()
    onRowDelete?.(rowIndex)
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Предпросмотр данных
          </Typography>
          <Chip
            label={`${previewData.length} строк`}
            size="small"
            variant="outlined"
          />
        </Box>

        {/* Вкладки фильтрации */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
            <Tab label={`Все (${previewData.length})`} />
            <Tab label={`Валидные (${previewData.filter(r => r.isValid).length})`} />
            <Tab label={`С ошибками (${previewData.filter(r => !r.isValid).length})`} />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <TableContent
            data={paginatedData}
            columns={columns}
            getErrorForCell={getErrorForCell}
            getCellValue={getCellValue}
            onRowClick={handleRowClick}
            onEditClick={handleEditClick}
            onDeleteClick={handleDeleteClick}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <TableContent
            data={paginatedData}
            columns={columns}
            getErrorForCell={getErrorForCell}
            getCellValue={getCellValue}
            onRowClick={handleRowClick}
            onEditClick={handleEditClick}
            onDeleteClick={handleDeleteClick}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <TableContent
            data={paginatedData}
            columns={columns}
            getErrorForCell={getErrorForCell}
            getCellValue={getCellValue}
            onRowClick={handleRowClick}
            onEditClick={handleEditClick}
            onDeleteClick={handleDeleteClick}
          />
        </TabPanel>

        {/* Пагинация */}
        <TablePagination
          component="div"
          count={filteredData.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Строк на странице:"
        />
      </CardContent>
    </Card>
  )
}

interface TableContentProps {
  data: RowWithValidation[]
  columns: Array<{ key: string; label: string; type: string; enum?: string[] }>
  getErrorForCell: (row: RowWithValidation, fieldKey: string) => ValidationError | undefined
  getCellValue: (row: RowWithValidation, key: string, label?: string) => any
  onRowClick: (rowIndex: number) => void
  onEditClick: (e: React.MouseEvent, rowIndex: number) => void
  onDeleteClick: (e: React.MouseEvent, rowIndex: number) => void
}

function TableContent({
  data,
  columns,
  getErrorForCell,
  getCellValue,
  onRowClick,
  onEditClick,
  onDeleteClick
}: TableContentProps) {
  if (data.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <i className="ri-inbox-line text-[48px] text-textDisabled mb-2" />
        <Typography variant="body1" color="text.secondary">
          Нет данных для отображения
        </Typography>
      </Box>
    )
  }

  return (
    <TableContainer>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th style={{ width: '60px' }}>Строка</th>
            {columns.map(column => (
              <th key={column.key}>{column.label}</th>
            ))}
            <th style={{ width: '120px' }}>Действия</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const hasErrors = row.errors.length > 0

            return (
              <tr
                key={row.rowIndex}
                onClick={() => onRowClick(row.rowIndex)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: hasErrors ? 'rgba(211, 47, 47, 0.08)' : 'transparent'
                }}
              >
                <td>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">{row.rowIndex}</Typography>
                    {hasErrors && (
                      <Tooltip title={`${row.errors.length} ошибок`}>
                        <i className="ri-error-warning-line text-error text-sm" />
                      </Tooltip>
                    )}
                    {!hasErrors && row.warnings.length > 0 && (
                      <Tooltip title={`${row.warnings.length} предупреждений`}>
                        <i className="ri-information-line text-warning text-sm" />
                      </Tooltip>
                    )}
                  </Box>
                </td>
                {columns.map(column => {
                  const error = getErrorForCell(row, column.key)
                  const value = getCellValue(row, column.key, column.label)

                  return (
                    <td
                      key={column.key}
                      style={{
                        backgroundColor: error ? 'rgba(211, 47, 47, 0.1)' : 'transparent'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: error ? 'error.main' : value ? 'text.primary' : 'text.disabled',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '200px',
                            fontStyle: value ? 'normal' : 'italic'
                          }}
                        >
                          {value !== undefined && value !== null && value !== '' ? String(value) : '(пусто)'}
                        </Typography>
                        {error && (
                          <Tooltip title={error.message}>
                            <i className="ri-error-warning-line text-error text-sm" />
                          </Tooltip>
                        )}
                      </Box>
                    </td>
                  )
                })}
                <td>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Редактировать строку">
                      <IconButton
                        size="small"
                        onClick={(e) => onEditClick(e, row.rowIndex)}
                      >
                        <i className="ri-edit-line" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Удалить строку">
                      <IconButton
                        size="small"
                        onClick={(e) => onDeleteClick(e, row.rowIndex)}
                        sx={{ color: 'error.main' }}
                      >
                        <i className="ri-delete-bin-line" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </TableContainer>
  )
}


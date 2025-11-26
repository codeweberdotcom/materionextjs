'use client'

import { useState, useMemo } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  IconButton,
  Tooltip
} from '@mui/material'
import type { ValidationError, ImportWarning } from '@/types/export-import'

interface ImportErrorsListProps {
  errors: ValidationError[]
  warnings: ImportWarning[]
  onRowClick?: (row: number) => void
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
      id={`errors-tabpanel-${index}`}
      aria-labelledby={`errors-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  )
}

/**
 * Компонент списка ошибок валидации
 */
export default function ImportErrorsList({ errors, warnings, onRowClick }: ImportErrorsListProps) {
  const [tabValue, setTabValue] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  // Группируем ошибки по строкам
  const errorsByRow = useMemo(() => {
    const grouped: Record<number, ValidationError[]> = {}
    errors.forEach(error => {
      const row = error.row || 0
      if (!grouped[row]) {
        grouped[row] = []
      }
      grouped[row].push(error)
    })
    return grouped
  }, [errors])

  // Группируем предупреждения по строкам
  const warningsByRow = useMemo(() => {
    const grouped: Record<number, ImportWarning[]> = {}
    warnings.forEach(warning => {
      const row = warning.row || 0
      if (!grouped[row]) {
        grouped[row] = []
      }
      grouped[row].push(warning)
    })
    return grouped
  }, [warnings])

  // Фильтруем ошибки по поисковому запросу
  const filteredErrorsByRow = useMemo(() => {
    if (!searchQuery) return errorsByRow

    const filtered: Record<number, ValidationError[]> = {}
    Object.entries(errorsByRow).forEach(([row, rowErrors]) => {
      const matchingErrors = rowErrors.filter(error =>
        error.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        error.field?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(error.value || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
      if (matchingErrors.length > 0) {
        filtered[Number(row)] = matchingErrors
      }
    })
    return filtered
  }, [errorsByRow, searchQuery])

  // Фильтруем предупреждения по поисковому запросу
  const filteredWarningsByRow = useMemo(() => {
    if (!searchQuery) return warningsByRow

    const filtered: Record<number, ImportWarning[]> = {}
    Object.entries(warningsByRow).forEach(([row, rowWarnings]) => {
      const matchingWarnings = rowWarnings.filter(warning =>
        warning.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        warning.field?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(warning.value || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
      if (matchingWarnings.length > 0) {
        filtered[Number(row)] = matchingWarnings
      }
    })
    return filtered
  }, [warningsByRow, searchQuery])

  const handleToggleRow = (row: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(row)) {
      newExpanded.delete(row)
    } else {
      newExpanded.add(row)
    }
    setExpandedRows(newExpanded)
  }

  const handleRowClick = (row: number) => {
    onRowClick?.(row)
  }

  const sortedErrorRows = Object.keys(filteredErrorsByRow)
    .map(Number)
    .sort((a, b) => a - b)

  const sortedWarningRows = Object.keys(filteredWarningsByRow)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Ошибки и предупреждения
          </Typography>
          <Chip
            label={`${errors.length} ошибок, ${warnings.length} предупреждений`}
            color={errors.length > 0 ? 'error' : 'warning'}
            size="small"
          />
        </Box>

        {/* Поиск */}
        <TextField
          fullWidth
          size="small"
          placeholder="Поиск по ошибкам..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <i className="ri-search-line" />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setSearchQuery('')}
                >
                  <i className="ri-close-line" />
                </IconButton>
              </InputAdornment>
            )
          }}
          sx={{ mb: 2 }}
        />

        {/* Вкладки */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
            <Tab
              label={`Ошибки (${errors.length})`}
              icon={<i className="ri-error-warning-line" />}
              iconPosition="start"
            />
            <Tab
              label={`Предупреждения (${warnings.length})`}
              icon={<i className="ri-information-line" />}
              iconPosition="start"
            />
          </Tabs>
        </Box>

        {/* Ошибки */}
        <TabPanel value={tabValue} index={0}>
          {sortedErrorRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <i className="ri-checkbox-circle-line text-[48px] text-success mb-2" />
              <Typography variant="body1" color="text.secondary">
                Ошибок не найдено
              </Typography>
            </Box>
          ) : (
            <Box>
              {sortedErrorRows.map(row => {
                const rowErrors = filteredErrorsByRow[row]
                const isExpanded = expandedRows.has(row)

                return (
                  <Accordion
                    key={row}
                    expanded={isExpanded}
                    onChange={() => handleToggleRow(row)}
                    sx={{
                      mb: 1,
                      '&:before': { display: 'none' },
                      border: '1px solid',
                      borderColor: 'error.light',
                      backgroundColor: 'error.lighter'
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<i className="ri-arrow-down-s-line" />}
                      sx={{ '& .MuiAccordionSummary-content': { alignItems: 'center' } }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                        <Chip
                          label={`Строка ${row}`}
                          color="error"
                          size="small"
                          icon={<i className="ri-file-line" />}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {rowErrors.length} {rowErrors.length === 1 ? 'ошибка' : 'ошибок'}
                        </Typography>
                        <Tooltip title="Перейти к строке">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRowClick(row)
                            }}
                          >
                            <i className="ri-arrow-right-line" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <List dense>
                        {rowErrors.map((error, index) => (
                          <ListItem key={index} sx={{ pl: 0 }}>
                            <ListItemIcon>
                              <i className="ri-error-warning-line text-error" />
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Box>
                                  <Typography variant="body2" component="span" fontWeight="medium">
                                    {error.field ? `Поле "${error.field}": ` : ''}
                                  </Typography>
                                  <Typography variant="body2" component="span">
                                    {error.message}
                                  </Typography>
                                </Box>
                              }
                              secondary={
                                error.value !== undefined && error.value !== null && error.value !== '' ? (
                                  <Typography variant="caption" color="text.secondary">
                                    Значение: {String(error.value)}
                                  </Typography>
                                ) : null
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                )
              })}
            </Box>
          )}
        </TabPanel>

        {/* Предупреждения */}
        <TabPanel value={tabValue} index={1}>
          {sortedWarningRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <i className="ri-information-line text-[48px] text-warning mb-2" />
              <Typography variant="body1" color="text.secondary">
                Предупреждений не найдено
              </Typography>
            </Box>
          ) : (
            <Box>
              {sortedWarningRows.map(row => {
                const rowWarnings = filteredWarningsByRow[row]
                const isExpanded = expandedRows.has(row)

                return (
                  <Accordion
                    key={row}
                    expanded={isExpanded}
                    onChange={() => handleToggleRow(row)}
                    sx={{
                      mb: 1,
                      '&:before': { display: 'none' },
                      border: '1px solid',
                      borderColor: 'warning.light',
                      backgroundColor: 'warning.lighter'
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<i className="ri-arrow-down-s-line" />}
                      sx={{ '& .MuiAccordionSummary-content': { alignItems: 'center' } }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                        <Chip
                          label={`Строка ${row}`}
                          color="warning"
                          size="small"
                          icon={<i className="ri-file-line" />}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {rowWarnings.length} {rowWarnings.length === 1 ? 'предупреждение' : 'предупреждений'}
                        </Typography>
                        <Tooltip title="Перейти к строке">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRowClick(row)
                            }}
                          >
                            <i className="ri-arrow-right-line" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <List dense>
                        {rowWarnings.map((warning, index) => (
                          <ListItem key={index} sx={{ pl: 0 }}>
                            <ListItemIcon>
                              <i className="ri-information-line text-warning" />
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Box>
                                  <Typography variant="body2" component="span" fontWeight="medium">
                                    {warning.field ? `Поле "${warning.field}": ` : ''}
                                  </Typography>
                                  <Typography variant="body2" component="span">
                                    {warning.message}
                                  </Typography>
                                </Box>
                              }
                              secondary={
                                warning.value !== undefined && warning.value !== null && warning.value !== '' ? (
                                  <Typography variant="caption" color="text.secondary">
                                    Значение: {String(warning.value)}
                                  </Typography>
                                ) : null
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                )
              })}
            </Box>
          )}
        </TabPanel>
      </CardContent>
    </Card>
  )
}










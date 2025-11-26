'use client'

import { useCallback, useEffect, useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableBody from '@mui/material/TableBody'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Tooltip from '@mui/material/Tooltip'
import TablePagination from '@mui/material/TablePagination'

import { toast } from 'react-toastify'
import { usePermissions } from '@/hooks/usePermissions'

interface Execution {
  id: string
  scenarioId: string
  scenarioName: string
  eventId: string | null
  status: string
  channel: string | null
  messageId: string | null
  error: string | null
  attempts: number
  maxAttempts: number
  createdAt: string
  completedAt: string | null
  scheduledAt: string | null
}

interface ExecutionDetail {
  id: string
  scenarioId: string
  scenario: {
    id: string
    name: string
    description: string | null
    trigger: any
    actions: any[]
  }
  eventId: string | null
  status: string
  result: any
  error: string | null
  attempts: number
  maxAttempts: number
  createdAt: string
  completedAt: string | null
  scheduledAt: string | null
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '–'
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(value))
  } catch {
    return value
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'success'
    case 'failed': return 'error'
    case 'processing': return 'info'
    case 'pending': return 'warning'
    default: return 'default'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'completed': return 'Успешно'
    case 'failed': return 'Ошибка'
    case 'processing': return 'Выполняется'
    case 'pending': return 'Ожидает'
    case 'cancelled': return 'Отменён'
    default: return status
  }
}

const getChannelIcon = (channel: string | null) => {
  switch (channel) {
    case 'email': return 'ri-mail-line'
    case 'sms': return 'ri-smartphone-line'
    case 'browser': return 'ri-notification-line'
    case 'telegram': return 'ri-telegram-line'
    default: return 'ri-notification-2-line'
  }
}

const NotificationExecutions = () => {
  const { checkPermission, isLoading: permissionsLoading } = usePermissions()

  const [executions, setExecutions] = useState<Execution[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [total, setTotal] = useState(0)

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [scenarioFilter, setScenarioFilter] = useState('')

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedExecution, setSelectedExecution] = useState<ExecutionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Retry
  const [retrying, setRetrying] = useState<string | null>(null)

  const canRead = checkPermission('notificationScenarios', 'read')
  const canUpdate = checkPermission('notificationScenarios', 'update')

  const fetchExecutions = useCallback(async () => {
    if (!canRead) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const params = new URLSearchParams({
        page: String(page + 1),
        limit: String(rowsPerPage)
      })
      if (statusFilter) params.set('status', statusFilter)
      if (scenarioFilter) params.set('scenarioId', scenarioFilter)

      const response = await fetch(`/api/admin/notifications/executions?${params}`)
      if (!response.ok) throw new Error('Failed to load')
      const data = await response.json()
      setExecutions(data.items)
      setTotal(data.pagination.total)
    } catch (err) {
      toast.error('Ошибка загрузки')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [canRead, page, rowsPerPage, statusFilter, scenarioFilter])

  useEffect(() => {
    if (!permissionsLoading) {
      fetchExecutions()
    }
  }, [fetchExecutions, permissionsLoading])

  const handleViewDetail = async (id: string) => {
    setDetailLoading(true)
    setDetailOpen(true)

    try {
      const response = await fetch(`/api/admin/notifications/executions/${id}`)
      if (!response.ok) throw new Error('Failed to load')
      const data = await response.json()
      setSelectedExecution(data.execution)
    } catch (err) {
      toast.error('Ошибка загрузки деталей')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleRetry = async (id: string) => {
    setRetrying(id)

    try {
      const response = await fetch(`/api/admin/notifications/executions/${id}/retry`, {
        method: 'POST'
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed')
      }
      toast.success('Повторная отправка запущена')
      fetchExecutions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setRetrying(null)
    }
  }

  if (permissionsLoading || loading) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress />
      </div>
    )
  }

  if (!canRead) {
    return (
      <Card>
        <CardContent>
          <Typography>Нет доступа</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader 
          title='История выполнений'
          subheader='Все выполнения сценариев уведомлений'
          action={
            <Button 
              variant='outlined' 
              onClick={fetchExecutions} 
              disabled={loading}
              startIcon={<i className='ri-refresh-line' />}
            >
              Обновить
            </Button>
          }
        />
        <CardContent>
          {/* Filters */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                select
                fullWidth
                size='small'
                label='Статус'
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
              >
                <MenuItem value=''>Все</MenuItem>
                <MenuItem value='completed'>Успешно</MenuItem>
                <MenuItem value='failed'>Ошибка</MenuItem>
                <MenuItem value='processing'>Выполняется</MenuItem>
                <MenuItem value='pending'>Ожидает</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button 
                variant='text' 
                onClick={() => { setStatusFilter(''); setScenarioFilter(''); setPage(0) }}
              >
                Сбросить фильтры
              </Button>
            </Grid>
          </Grid>

          {/* Table */}
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Сценарий</TableCell>
                <TableCell>Канал</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Попытки</TableCell>
                <TableCell>Создан</TableCell>
                <TableCell>Завершён</TableCell>
                <TableCell align='right'>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {executions.map(exec => (
                <TableRow key={exec.id} hover>
                  <TableCell>
                    <Typography variant='body2' fontWeight={500}>
                      {exec.scenarioName}
                    </Typography>
                    {exec.eventId && (
                      <Typography variant='caption' color='text.secondary'>
                        Event: {exec.eventId.slice(0, 8)}...
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {exec.channel && (
                      <Chip
                        size='small'
                        icon={<i className={getChannelIcon(exec.channel)} />}
                        label={exec.channel}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size='small'
                      label={getStatusLabel(exec.status)}
                      color={getStatusColor(exec.status) as any}
                    />
                  </TableCell>
                  <TableCell>
                    {exec.attempts}/{exec.maxAttempts}
                  </TableCell>
                  <TableCell>
                    <Typography variant='caption'>
                      {formatDateTime(exec.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant='caption'>
                      {formatDateTime(exec.completedAt)}
                    </Typography>
                  </TableCell>
                  <TableCell align='right'>
                    <Tooltip title='Подробнее'>
                      <IconButton size='small' onClick={() => handleViewDetail(exec.id)}>
                        <i className='ri-eye-line' />
                      </IconButton>
                    </Tooltip>
                    {exec.status === 'failed' && canUpdate && (
                      <Tooltip title='Повторить'>
                        <IconButton 
                          size='small' 
                          color='primary'
                          onClick={() => handleRetry(exec.id)}
                          disabled={retrying === exec.id}
                        >
                          {retrying === exec.id ? (
                            <CircularProgress size={16} />
                          ) : (
                            <i className='ri-restart-line' />
                          )}
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {executions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align='center'>
                    <Typography variant='body2' color='text.secondary'>
                      Нет данных
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <TablePagination
            component='div'
            count={total}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
            rowsPerPageOptions={[10, 20, 50]}
            labelRowsPerPage='Строк:'
          />
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth='md' fullWidth>
        <DialogTitle>
          Детали выполнения
          <IconButton
            onClick={() => setDetailOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <i className='ri-close-line' />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : selectedExecution ? (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant='subtitle2' color='text.secondary'>Сценарий</Typography>
                <Typography>{selectedExecution.scenario.name}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant='subtitle2' color='text.secondary'>Статус</Typography>
                <Chip 
                  label={getStatusLabel(selectedExecution.status)} 
                  color={getStatusColor(selectedExecution.status) as any}
                  size='small'
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant='subtitle2' color='text.secondary'>Создан</Typography>
                <Typography>{formatDateTime(selectedExecution.createdAt)}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant='subtitle2' color='text.secondary'>Завершён</Typography>
                <Typography>{formatDateTime(selectedExecution.completedAt)}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant='subtitle2' color='text.secondary'>Попытки</Typography>
                <Typography>{selectedExecution.attempts}/{selectedExecution.maxAttempts}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant='subtitle2' color='text.secondary'>Event ID</Typography>
                <Typography variant='body2' sx={{ wordBreak: 'break-all' }}>
                  {selectedExecution.eventId || '–'}
                </Typography>
              </Grid>
              {selectedExecution.error && (
                <Grid item xs={12}>
                  <Typography variant='subtitle2' color='error'>Ошибка</Typography>
                  <Typography color='error.main'>{selectedExecution.error}</Typography>
                </Grid>
              )}
              {selectedExecution.result && (
                <Grid item xs={12}>
                  <Typography variant='subtitle2' color='text.secondary'>Результат</Typography>
                  <Box 
                    component='pre' 
                    sx={{ 
                      bgcolor: 'action.hover', 
                      p: 2, 
                      borderRadius: 1, 
                      overflow: 'auto',
                      fontSize: '0.75rem'
                    }}
                  >
                    {JSON.stringify(selectedExecution.result, null, 2)}
                  </Box>
                </Grid>
              )}
              {selectedExecution.scenario.trigger && (
                <Grid item xs={12}>
                  <Typography variant='subtitle2' color='text.secondary'>Триггер</Typography>
                  <Box 
                    component='pre' 
                    sx={{ 
                      bgcolor: 'action.hover', 
                      p: 2, 
                      borderRadius: 1, 
                      overflow: 'auto',
                      fontSize: '0.75rem'
                    }}
                  >
                    {JSON.stringify(selectedExecution.scenario.trigger, null, 2)}
                  </Box>
                </Grid>
              )}
            </Grid>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Закрыть</Button>
          {selectedExecution?.status === 'failed' && canUpdate && (
            <Button 
              variant='contained'
              onClick={() => {
                handleRetry(selectedExecution.id)
                setDetailOpen(false)
              }}
            >
              Повторить отправку
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  )
}

export default NotificationExecutions





'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'

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
import Alert from '@mui/material/Alert'
import LinearProgress from '@mui/material/LinearProgress'
import { useTheme } from '@mui/material/styles'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'

import { usePermissions } from '@/hooks/usePermissions'

interface ExecutionByDay {
  date: string
  status: string
  count: number | bigint
}

interface Stats {
  period: { days: number; from: string }
  summary: {
    total: number
    successful: number
    failed: number
    pending: number
    successRate: number
  }
  recentExecutions: Array<{
    id: string
    scenarioId: string
    scenarioName: string
    status: string
    error: string | null
    createdAt: string
    completedAt: string | null
  }>
  executionsByDay: ExecutionByDay[]
  topScenarios: Array<{
    scenarioId: string
    name: string
    count: number
  }>
  channelStats: Record<string, number>
}

interface ChartDataPoint {
  date: string
  completed: number
  failed: number
  pending: number
  total: number
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
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    case 'processing':
      return 'info'
    case 'pending':
      return 'warning'
    default:
      return 'default'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'completed':
      return 'Успешно'
    case 'failed':
      return 'Ошибка'
    case 'processing':
      return 'Выполняется'
    case 'pending':
      return 'Ожидает'
    case 'cancelled':
      return 'Отменён'
    default:
      return status
  }
}

const getChannelIcon = (channel: string) => {
  switch (channel) {
    case 'email':
      return 'ri-mail-line'
    case 'sms':
      return 'ri-smartphone-line'
    case 'browser':
      return 'ri-notification-line'
    case 'telegram':
      return 'ri-telegram-line'
    default:
      return 'ri-notification-2-line'
  }
}

const CHART_COLORS = {
  completed: '#22c55e',
  failed: '#ef4444',
  pending: '#f59e0b',
  total: '#3b82f6'
}

const PIE_COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4']

const NotificationDashboard = () => {
  const { checkPermission, isLoading: permissionsLoading } = usePermissions()
  const theme = useTheme()

  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canRead = checkPermission('notificationScenarios', 'read')

  // Обработка данных для графика по дням
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!stats?.executionsByDay) return []

    // Группируем данные по дате
    const dataByDate: Record<string, ChartDataPoint> = {}
    
    // Создаём пустые записи для всех дней периода
    const days = stats.period.days
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      dataByDate[dateStr] = {
        date: new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' }).format(date),
        completed: 0,
        failed: 0,
        pending: 0,
        total: 0
      }
    }

    // Заполняем данными
    for (const item of stats.executionsByDay) {
      const dateStr = item.date.toString().split('T')[0]
      if (dataByDate[dateStr]) {
        const count = Number(item.count)
        ;(dataByDate[dateStr] as any)[item.status as keyof ChartDataPoint] = count
        dataByDate[dateStr].total += count
      }
    }

    return Object.values(dataByDate)
  }, [stats])

  // Данные для круговой диаграммы каналов
  const pieData = useMemo(() => {
    if (!stats?.channelStats) return []
    return Object.entries(stats.channelStats).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value
    }))
  }, [stats])

  const fetchStats = useCallback(async () => {
    if (!canRead) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/notifications/stats?days=7')
      if (!response.ok) throw new Error('Failed to load stats')
      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError('Ошибка загрузки статистики')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [canRead])

  useEffect(() => {
    if (!permissionsLoading) {
      fetchStats()
    }
  }, [fetchStats, permissionsLoading])

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
          <Typography>Нет доступа к статистике уведомлений</Typography>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert severity='error' action={
        <Button color='inherit' size='small' onClick={fetchStats}>
          Повторить
        </Button>
      }>
        {error}
      </Alert>
    )
  }

  if (!stats) return null

  return (
    <Grid container spacing={4}>
      {/* Stat Cards */}
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ 
                p: 1.5, 
                borderRadius: 2, 
                bgcolor: 'primary.lighter',
                color: 'primary.main',
                display: 'flex'
              }}>
                <i className='ri-send-plane-2-line' style={{ fontSize: '1.5rem' }} />
              </Box>
              <Box>
                <Typography variant='h4'>{stats.summary.total}</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Всего за 7 дней
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ 
                p: 1.5, 
                borderRadius: 2, 
                bgcolor: 'success.lighter',
                color: 'success.main',
                display: 'flex'
              }}>
                <i className='ri-check-double-line' style={{ fontSize: '1.5rem' }} />
              </Box>
              <Box>
                <Typography variant='h4'>{stats.summary.successful}</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Успешно
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ 
                p: 1.5, 
                borderRadius: 2, 
                bgcolor: 'error.lighter',
                color: 'error.main',
                display: 'flex'
              }}>
                <i className='ri-error-warning-line' style={{ fontSize: '1.5rem' }} />
              </Box>
              <Box>
                <Typography variant='h4'>{stats.summary.failed}</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Ошибки
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ 
                p: 1.5, 
                borderRadius: 2, 
                bgcolor: 'warning.lighter',
                color: 'warning.main',
                display: 'flex'
              }}>
                <i className='ri-time-line' style={{ fontSize: '1.5rem' }} />
              </Box>
              <Box>
                <Typography variant='h4'>{stats.summary.pending}</Typography>
                <Typography variant='body2' color='text.secondary'>
                  В очереди
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Chart - Executions by Day */}
      <Grid item xs={12}>
        <Card>
          <CardHeader 
            title='Динамика уведомлений' 
            subheader={`За последние ${stats.period.days} дней`}
          />
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width='100%' height={300}>
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id='colorCompleted' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='5%' stopColor={CHART_COLORS.completed} stopOpacity={0.8}/>
                      <stop offset='95%' stopColor={CHART_COLORS.completed} stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id='colorFailed' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='5%' stopColor={CHART_COLORS.failed} stopOpacity={0.8}/>
                      <stop offset='95%' stopColor={CHART_COLORS.failed} stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray='3 3' stroke={theme.palette.divider} />
                  <XAxis 
                    dataKey='date' 
                    stroke={theme.palette.text.secondary}
                    fontSize={12}
                  />
                  <YAxis 
                    stroke={theme.palette.text.secondary}
                    fontSize={12}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 8
                    }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        completed: 'Успешно',
                        failed: 'Ошибки',
                        pending: 'Ожидание'
                      }
                      return [value, labels[name] || name]
                    }}
                  />
                  <Area 
                    type='monotone' 
                    dataKey='completed' 
                    stroke={CHART_COLORS.completed} 
                    fillOpacity={1} 
                    fill='url(#colorCompleted)' 
                    name='completed'
                  />
                  <Area 
                    type='monotone' 
                    dataKey='failed' 
                    stroke={CHART_COLORS.failed} 
                    fillOpacity={1} 
                    fill='url(#colorFailed)' 
                    name='failed'
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant='body2' color='text.secondary'>
                  Нет данных для отображения графика
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Success Rate */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title='Успешность отправки' />
          <CardContent>
            <Box sx={{ mb: 2 }}>
              <Typography variant='h3' color='primary'>
                {stats.summary.successRate}%
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                за последние 7 дней
              </Typography>
            </Box>
            <LinearProgress 
              variant='determinate' 
              value={stats.summary.successRate} 
              sx={{ height: 10, borderRadius: 5 }}
              color={stats.summary.successRate >= 90 ? 'success' : stats.summary.successRate >= 70 ? 'warning' : 'error'}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Channel Stats with Pie Chart */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title='По каналам' />
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width='100%' height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx='50%'
                    cy='50%'
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey='value'
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 8
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant='body2' color='text.secondary'>
                    Нет данных о каналах
                  </Typography>
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Top Scenarios */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title='Топ сценариев' />
          <CardContent>
            {stats.topScenarios.length > 0 ? (
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Сценарий</TableCell>
                    <TableCell align='right'>Выполнений</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.topScenarios.map((scenario, idx) => (
                    <TableRow key={scenario.scenarioId}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip 
                            label={idx + 1} 
                            size='small' 
                            color={idx === 0 ? 'primary' : 'default'}
                          />
                          {scenario.name}
                        </Box>
                      </TableCell>
                      <TableCell align='right'>
                        <Chip label={scenario.count} size='small' variant='outlined' />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Typography variant='body2' color='text.secondary'>
                Нет данных
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Recent Executions */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader 
            title='Последние выполнения'
            action={
              <Button 
                size='small' 
                href='/admin/notifications/executions'
                endIcon={<i className='ri-arrow-right-line' />}
              >
                Все
              </Button>
            }
          />
          <CardContent sx={{ pt: 0 }}>
            {stats.recentExecutions.length > 0 ? (
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Сценарий</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Время</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.recentExecutions.slice(0, 5).map((exec) => (
                    <TableRow key={exec.id}>
                      <TableCell>
                        <Typography variant='body2' noWrap sx={{ maxWidth: 150 }}>
                          {exec.scenarioName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={getStatusLabel(exec.status)} 
                          size='small' 
                          color={getStatusColor(exec.status) as any}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant='caption'>
                          {formatDateTime(exec.createdAt)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Typography variant='body2' color='text.secondary'>
                Нет выполнений
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default NotificationDashboard


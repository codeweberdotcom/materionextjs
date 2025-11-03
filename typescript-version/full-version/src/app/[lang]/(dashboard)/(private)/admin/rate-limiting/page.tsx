'use client'

import { useState, useEffect } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Tab from '@mui/material/Tab'
import TabContext from '@mui/lab/TabContext'
import TabList from '@mui/lab/TabList'
import TabPanel from '@mui/lab/TabPanel'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid2'
import { useTheme } from '@mui/material/styles'
import { toast } from 'react-toastify'

// Third-party Imports
import type { ApexOptions } from 'apexcharts'

// Styled Component Imports
const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'))
import dynamic from 'next/dynamic'

// Components Imports
import OptionMenu from '@core/components/option-menu'
import CustomAvatar from '@core/components/mui/Avatar'

// Types Imports
import type { ThemeColor } from '@core/types'

interface RateLimitConfig {
  module: string
  maxRequests: number
  windowMs: number
  blockMs: number
}

interface RateLimitStats {
  module: string
  config: RateLimitConfig
  totalRequests: number
  blockedCount: number
  activeWindows: number
}

export default function RateLimitingPage() {
  // Hooks
  const theme = useTheme()

  const [configs, setConfigs] = useState<RateLimitConfig[]>([])
  const [stats, setStats] = useState<RateLimitStats[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Generate sample chart data for the last 7 days
  const chartData = [
    {
      name: 'Requests',
      data: [37, 57, 45, 75, 57, 40, stats.reduce((sum, stat) => sum + stat.totalRequests, 0) || 0]
    }
  ]

  const chartOptions: ApexOptions = {
    chart: {
      parentHeightOffset: 0,
      toolbar: { show: false }
    },
    plotOptions: {
      bar: {
        borderRadius: 7,
        distributed: true,
        columnWidth: '40%'
      }
    },
    stroke: {
      width: 2,
      colors: ['var(--mui-palette-background-paper)']
    },
    legend: { show: false },
    grid: {
      xaxis: { lines: { show: false } },
      strokeDashArray: 7,
      padding: { left: -9, top: -20, bottom: 13 },
      borderColor: 'var(--mui-palette-divider)'
    },
    dataLabels: { enabled: false },
    colors: [
      'var(--mui-palette-customColors-trackBg)',
      'var(--mui-palette-customColors-trackBg)',
      'var(--mui-palette-customColors-trackBg)',
      'var(--mui-palette-primary-main)',
      'var(--mui-palette-customColors-trackBg)',
      'var(--mui-palette-customColors-trackBg)',
      'var(--mui-palette-customColors-trackBg)'
    ],
    states: {
      hover: {
        filter: { type: 'none' }
      },
      active: {
        filter: { type: 'none' }
      }
    },
    xaxis: {
      categories: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      tickPlacement: 'on',
      labels: { show: false },
      axisTicks: { show: false },
      axisBorder: { show: false }
    },
    yaxis: {
      show: true,
      tickAmount: 4,
      labels: {
        offsetY: 2,
        offsetX: -17,
        style: { colors: 'var(--mui-palette-text-disabled)', fontSize: theme.typography.body2.fontSize as string },
        formatter: (value: number) => `${value > 999 ? `${(value / 1000).toFixed(0)}` : value}k`
      }
    },
    responsive: [
      {
        breakpoint: 1300,
        options: {
          plotOptions: { bar: { columnWidth: '65%' } },
          stroke: { width: 1 }
        }
      },
      {
        breakpoint: theme.breakpoints.values.lg,
        options: {
          plotOptions: { bar: { columnWidth: '45%' } }
        }
      }
    ],
    noData: {
      text: 'Нет данных для отображения',
      align: 'center',
      verticalAlign: 'middle',
      style: {
        color: 'var(--mui-palette-text-disabled)',
        fontSize: '14px'
      }
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const response = await fetch('/api/admin/rate-limits')
      if (response.ok) {
        const data = await response.json()
        setConfigs(data.configs || [])
        setStats(data.stats || [])
      } else {
        toast.error('Failed to load rate limiting data')
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error loading data')
    } finally {
      setLoading(false)
    }
  }

  const updateConfig = async (module: string, config: Partial<RateLimitConfig>) => {
    setSaving(module)
    try {
      const response = await fetch('/api/admin/rate-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, ...config })
      })

      if (response.ok) {
        toast.success('Configuration updated successfully')
        await loadData()
      } else {
        toast.error('Failed to update configuration')
      }
    } catch (error) {
      console.error('Error updating config:', error)
      toast.error('Error updating configuration')
    } finally {
      setSaving(null)
    }
  }

  const resetLimits = async (module?: string) => {
    try {
      const params = new URLSearchParams()
      if (module) params.set('module', module)

      const response = await fetch(`/api/admin/rate-limits?${params}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Rate limits reset successfully')
        await loadData()
      } else {
        toast.error('Failed to reset rate limits')
      }
    } catch (error) {
      console.error('Error resetting limits:', error)
      toast.error('Error resetting rate limits')
    }
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const getModuleDisplayName = (module: string) => {
    const names = {
      chat: 'Чат',
      ads: 'Объявления',
      upload: 'Загрузки файлов',
      auth: 'Авторизация'
    }
    return names[module as keyof typeof names] || module
  }

  const getModuleDescription = (module: string) => {
    const descriptions = {
      chat: 'Ограничение количества сообщений в чате',
      ads: 'Ограничение количества публикаций объявлений',
      upload: 'Ограничение количества загружаемых файлов',
      auth: 'Ограничение попыток входа в систему'
    }
    return descriptions[module as keyof typeof descriptions] || ''
  }

  const [tabValue, setTabValue] = useState('configs')

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setTabValue(newValue)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Typography variant="h6">Загрузка...</Typography>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Typography variant="h3" component="h1">Rate Limiting</Typography>
          <Typography variant="body1" color="text.secondary">
            Настройка ограничений для различных модулей системы
          </Typography>
        </div>
      </div>

      <TabContext value={tabValue}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <TabList onChange={handleTabChange}>
            <Tab label="Настройки" value="configs" />
            <Tab label="Статистика" value="stats" />
          </TabList>
        </Box>

        <TabPanel value="configs" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {configs.map((config) => (
              <Card key={config.module}>
                <CardHeader
                  title={
                    <div className="flex items-center justify-between">
                      <Typography variant="h5">{getModuleDisplayName(config.module)}</Typography>
                      <Chip label={config.module} variant="outlined" />
                    </div>
                  }
                  subheader={getModuleDescription(config.module)}
                />
                <CardContent>
                  <form onSubmit={e => e.preventDefault()}>
                    <Grid container spacing={5}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          type="number"
                          label='Макс. запросов'
                          value={config.maxRequests}
                          onChange={(e) => {
                            const newConfigs = configs.map(c =>
                              c.module === config.module
                                ? { ...c, maxRequests: parseInt(e.target.value) || 0 }
                                : c
                            )
                            setConfigs(newConfigs)
                          }}
                          helperText={`Текущее значение: ${config.maxRequests}`}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          type="number"
                          label='Окно времени (сек)'
                          value={config.windowMs / 1000} // в секундах
                          onChange={(e) => {
                            const newConfigs = configs.map(c =>
                              c.module === config.module
                                ? { ...c, windowMs: (parseInt(e.target.value) || 0) * 1000 }
                                : c
                            )
                            setConfigs(newConfigs)
                          }}
                          helperText={formatTime(config.windowMs)}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth
                          type="number"
                          label='Блокировка при превышении (сек)'
                          value={config.blockMs / 1000} // в секундах
                          onChange={(e) => {
                            const newConfigs = configs.map(c =>
                              c.module === config.module
                                ? { ...c, blockMs: (parseInt(e.target.value) || 0) * 1000 }
                                : c
                            )
                            setConfigs(newConfigs)
                          }}
                          helperText={formatTime(config.blockMs)}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <div className='flex items-center justify-between flex-wrap gap-5'>
                          <Button
                            onClick={() => updateConfig(config.module, config)}
                            disabled={saving === config.module}
                            variant="contained"
                            type="submit"
                          >
                            {saving === config.module ? 'Сохранение...' : 'Сохранить настройки'}
                          </Button>
                          <Button
                            onClick={() => resetLimits(config.module)}
                            variant="outlined"
                            color="error"
                          >
                            Сбросить счетчики
                          </Button>
                        </div>
                      </Grid>
                    </Grid>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabPanel>

        <TabPanel value="stats" className="space-y-4">
          <Card>
            <Grid container>
              <Grid size={{ xs: 12, sm: 7 }} className='border-be sm:border-be-0 sm:border-ie'>
                <CardHeader
                  title='Rate Limiting Statistics'
                  action={<OptionMenu iconClassName='text-textPrimary' options={['Refresh', 'Update', 'Delete']} />}
                />
                <CardContent sx={{ '& .apexcharts-xcrosshairs.apexcharts-active': { opacity: 0 } }}>
                  <AppReactApexCharts
                    type='bar'
                    height={201}
                    width='100%'
                    series={chartData}
                    options={chartOptions}
                  />
                  <div className='flex items-center mbe-4 gap-4'>
                    <Typography variant='h4'>{stats.reduce((sum, stat) => sum + (stat.totalRequests || 0), 0)}</Typography>
                    <Typography>Total requests across all modules</Typography>
                  </div>
                  <Button
                    onClick={() => resetLimits()}
                    fullWidth
                    variant='contained'
                    color='error'
                  >
                    Сбросить счетчики
                  </Button>
                </CardContent>
              </Grid>
              <Grid size={{ xs: 12, sm: 5 }}>
                <CardHeader
                  title={`${stats.reduce((sum, stat) => sum + stat.totalRequests, 0)}`}
                  subheader='Total requests across all modules'
                  action={
                    <Button onClick={loadData} size="small">
                      <i className="ri-more-2-line text-textPrimary" />
                    </Button>
                  }
                />
                <CardContent className='flex flex-col gap-4 !pbs-2.5'>
                  {stats.map((stat, index) => {
                    const moduleIcons = {
                      chat: 'ri-chat-1-line',
                      ads: 'ri-file-list-line',
                      upload: 'ri-upload-line',
                      auth: 'ri-shield-line'
                    }

                    const moduleColors: Record<string, ThemeColor> = {
                      chat: 'success',
                      ads: 'primary',
                      upload: 'secondary',
                      auth: 'warning'
                    }

                    const icon = moduleIcons[stat.module as keyof typeof moduleIcons] || 'ri-bar-chart-line'
                    const color = moduleColors[stat.module] || 'primary'

                    return (
                      <div key={stat.module} className='flex items-center gap-3'>
                        <CustomAvatar skin='light' variant='rounded' color={color}>
                          <i className={icon} />
                        </CustomAvatar>
                        <div className='flex flex-col gap-1'>
                              <Typography className='font-medium' color='text.primary'>
                                {stat.module === 'chat' ? (stat.totalRequests || 0) : 0}
                              </Typography>
                              <Typography>{getModuleDisplayName(stat.module)}</Typography>
                            </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Grid>
            </Grid>
          </Card>

          {/* Additional summary cards */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader
                title="Общая статистика"
                subheader="Сводная информация по всем модулям"
              />
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Typography variant="body1">Всего модулей:</Typography>
                    <Typography variant="h6">{stats.length}</Typography>
                  </div>
                  <div className="flex justify-between items-center">
                    <Typography variant="body1">Общие запросы:</Typography>
                    <Typography variant="h6">{stats.reduce((sum, stat) => sum + stat.totalRequests, 0)}</Typography>
                  </div>
                  <div className="flex justify-between items-center">
                    <Typography variant="body1">Всего заблокировано:</Typography>
                    <Typography variant="h6" color="error.main">
                      {stats.find(stat => stat.module === 'chat')?.blockedCount || 0}
                    </Typography>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabPanel>
      </TabContext>
    </div>
  )
}
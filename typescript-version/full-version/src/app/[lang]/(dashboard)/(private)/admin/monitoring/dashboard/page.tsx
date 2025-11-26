// React Imports
'use client'

import React, { useEffect, useState } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid2'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import CustomAvatar from '@core/components/mui/Avatar'

// Icons - используем Remix Icons через классы

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Импорт варианта дизайна
import { Variant1 } from './card-design-variants'

interface DashboardData {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'error'
  timestamp: string
  services: {
    database: {
      status: 'up' | 'down'
      latency: number
      activeConnections: number
    }
    redis: {
      status: 'up' | 'down'
      latency: number
      memory?: {
        used: number
        max: number
        keys: number
      }
    }
    socketio: {
      status: 'up' | 'down'
    }
  }
  keyMetrics: {
    http: {
      requestRate: number
      errorRate: number
      avgResponseTime: number
    }
    websocket: {
      activeConnections: number
      messagesSent: number
      messagesReceived: number
    }
    database: {
      avgQueryTime: number
      activeConnections: number
    }
    redis: {
      memoryUsed: number
      memoryMax: number
      keysCount: number
      latency: number
      hitRatio: number
    }
    system: {
      cpuUsage: number
      memoryUsage: number
      memoryTotal: number
      uptime: number
    }
  }
  systemMetrics: {
    memory: {
      heapUsed: number
      heapTotal: number
      rss: number
      external: number
    }
    cpu: {
      user: number
      system: number
    }
    uptime: number
    nodeVersion: string
    platform: string
    arch: string
    memoryUsagePercent: number
  }
  alerts: Array<{
    type: string
    severity: 'critical' | 'warning'
    message: string
  }>
  recentErrors: any[]
  version: string
  environment: string
  externalLinks: {
    grafana: string | null
    prometheus: string | null
    sentry: string | null
  }
}

const MonitoringDashboardPage = () => {
  const t = useTranslation()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/admin/monitoring/dashboard')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setDashboardData(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()

    // Автообновление каждые 30 секунд
    const interval = setInterval(fetchDashboardData, 30000)

    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
        return 'success'
      case 'degraded':
      case 'warning':
        return 'warning'
      case 'unhealthy':
      case 'down':
      case 'error':
        return 'error'
      default:
        return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
        return <i className='ri-checkbox-circle-line' />
      case 'degraded':
        return <i className='ri-error-warning-line' />
      case 'unhealthy':
      case 'down':
      case 'error':
        return <i className='ri-close-circle-line' />
      default:
        return null
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const formatDuration = (ms: number) => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`
    if (ms < 1000) return `${ms.toFixed(2)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  if (loading) {
    return (
      <Grid container spacing={6}>
        {/* Header Skeleton */}
        <Grid size={{ xs: 12 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="40%" height={40} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="60%" height={24} />
            </Box>
            <Skeleton variant="rectangular" width={100} height={32} sx={{ borderRadius: 1 }} />
          </Box>
        </Grid>

        {/* Key Metrics Skeleton - 4 cards */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Skeleton variant="circular" width={40} height={40} sx={{ mb: 2 }} />
              <Skeleton variant="text" width="60%" height={32} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="40%" height={24} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Skeleton variant="circular" width={40} height={40} sx={{ mb: 2 }} />
              <Skeleton variant="text" width="60%" height={32} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="40%" height={24} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Skeleton variant="circular" width={40} height={40} sx={{ mb: 2 }} />
              <Skeleton variant="text" width="60%" height={32} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="40%" height={24} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Skeleton variant="circular" width={40} height={40} sx={{ mb: 2 }} />
              <Skeleton variant="text" width="60%" height={32} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="40%" height={24} />
            </CardContent>
          </Card>
        </Grid>

        {/* System Status & Active Services Skeleton */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title={<Skeleton variant="text" width="40%" height={28} />} />
            <CardContent>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Skeleton variant="text" width="30%" height={24} />
                  <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 1 }} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Skeleton variant="text" width="30%" height={24} />
                  <Skeleton variant="text" width="40%" height={24} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Skeleton variant="text" width="30%" height={24} />
                  <Skeleton variant="text" width="40%" height={24} />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title={<Skeleton variant="text" width="40%" height={28} />} />
            <CardContent>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Skeleton variant="text" width="25%" height={24} />
                  <Box sx={{ display: 'flex', gap: 2, flex: 1, justifyContent: 'center' }}>
                    <Skeleton variant="text" width={60} height={20} />
                    <Skeleton variant="text" width={60} height={20} />
                  </Box>
                  <Skeleton variant="rectangular" width={50} height={24} sx={{ borderRadius: 1 }} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Skeleton variant="text" width="25%" height={24} />
                  <Box sx={{ display: 'flex', gap: 2, flex: 1, justifyContent: 'center' }}>
                    <Skeleton variant="text" width={60} height={20} />
                    <Skeleton variant="text" width={60} height={20} />
                    <Skeleton variant="text" width={60} height={20} />
                  </Box>
                  <Skeleton variant="rectangular" width={50} height={24} sx={{ borderRadius: 1 }} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Skeleton variant="text" width="25%" height={24} />
                  <Box sx={{ display: 'flex', gap: 2, flex: 1, justifyContent: 'center' }}>
                    <Skeleton variant="text" width={80} height={20} />
                  </Box>
                  <Skeleton variant="rectangular" width={50} height={24} sx={{ borderRadius: 1 }} />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* System Resources Skeleton */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title={<Skeleton variant="text" width="40%" height={28} />} />
            <CardContent>
              <Stack spacing={3}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                    <Skeleton variant="text" width="30%" height={20} />
                    <Skeleton variant="text" width="15%" height={28} />
                  </Box>
                  <Skeleton variant="rectangular" width="100%" height={10} sx={{ borderRadius: 5, mb: 1 }} />
                  <Skeleton variant="text" width="50%" height={20} />
                </Box>
                <Divider />
                <Box>
                  <Skeleton variant="text" width="30%" height={20} sx={{ mb: 1.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Skeleton variant="text" width="30%" height={20} />
                    <Skeleton variant="text" width="40%" height={20} />
                  </Box>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    )
  }

  if (error || !dashboardData) {
    return (
      <Grid container spacing={6}>
        <Grid size={{ xs: 12 }}>
          <Typography variant='h4' className='mbe-1'>
            Monitoring Dashboard
          </Typography>
          <Typography>
            Comprehensive overview of system monitoring and analytics
          </Typography>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Alert severity="error">
                <AlertTitle>Error loading dashboard</AlertTitle>
                {error || 'Failed to fetch dashboard data'}
              </Alert>
              <Button onClick={fetchDashboardData} sx={{ mt: 2 }}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    )
  }

  return (
    <Grid container spacing={6}>
      {/* Header */}
      <Grid size={{ xs: 12 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant='h4' className='mbe-1'>
              Monitoring Dashboard
            </Typography>
            <Typography color="text.secondary">
              Comprehensive overview of system monitoring and analytics
            </Typography>
          </Box>
          <Chip
            label={dashboardData.status.toUpperCase()}
            color={getStatusColor(dashboardData.status) as any}
            icon={
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                {getStatusIcon(dashboardData.status)}
              </Box>
            }
            sx={{
              fontWeight: 'bold',
              '& .MuiChip-icon': {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '4px',
                lineHeight: 1
              }
            }}
          />
        </Box>
      </Grid>

      {/* Критические алерты */}
      {dashboardData.alerts.length > 0 && (
        <Grid size={{ xs: 12 }}>
          <Stack spacing={2}>
            {dashboardData.alerts.map((alert, index) => (
              <Card
                key={index}
                sx={{
                  borderLeft: `4px solid`,
                  borderLeftColor: alert.severity === 'critical' ? 'error.main' : 'warning.main',
                  bgcolor: alert.severity === 'critical' ? 'error.lightOpacity' : 'warning.lightOpacity'
                }}
              >
                <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{
                      color: alert.severity === 'critical' ? 'error.main' : 'warning.main',
                      fontSize: '1.25rem',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      {alert.severity === 'critical' ? (
                        <i className='ri-error-warning-line' />
                      ) : (
                        <i className='ri-alert-line' />
                      )}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          color: alert.severity === 'critical' ? 'error.main' : 'warning.main',
                          mb: 0.5
                        }}
                      >
                        {alert.type}
                      </Typography>
                      <Typography variant="body2" color="text.primary">
                        {alert.message}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Grid>
      )}

      {/* Ключевые метрики - первый ряд */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card
          sx={{
            height: '100%',
            borderBottom: '2px solid',
            borderBottomColor: 'primary.darkerOpacity',
            transition: 'all 0.3s ease-in-out',
            '&:hover': {
              borderBottomWidth: '3px',
              borderBottomColor: 'primary.main',
              boxShadow: 6,
              marginBlockEnd: '-1px'
            }
          }}
        >
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CustomAvatar color='primary' skin='light' variant='rounded' size={40}>
                <i className='ri-global-line' style={{ fontSize: '22px' }} />
              </CustomAvatar>
              <Typography variant='h4' sx={{ fontWeight: 600 }}>
                {dashboardData.keyMetrics.http.requestRate.toFixed(0)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body1" color="text.primary" sx={{ fontWeight: 500 }}>
                HTTP Request Rate
              </Typography>
              <Typography variant="body2" color="text.secondary">
                requests/sec
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card
          sx={{
            height: '100%',
            borderBottom: '2px solid',
            borderBottomColor: 'info.darkerOpacity',
            transition: 'all 0.3s ease-in-out',
            '&:hover': {
              borderBottomWidth: '3px',
              borderBottomColor: 'info.main',
              boxShadow: 6,
              marginBlockEnd: '-1px'
            }
          }}
        >
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CustomAvatar color='info' skin='light' variant='rounded' size={40}>
                <i className='ri-time-line' style={{ fontSize: '22px' }} />
              </CustomAvatar>
              <Typography variant='h4' sx={{ fontWeight: 600 }}>
                {formatDuration(dashboardData.keyMetrics.http.avgResponseTime)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body1" color="text.primary" sx={{ fontWeight: 500 }}>
                Avg Response Time
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card
          sx={{
            height: '100%',
            borderBottom: '2px solid',
            borderBottomColor: dashboardData.keyMetrics.http.errorRate > 5 ? 'error.darkerOpacity' : 'warning.darkerOpacity',
            transition: 'all 0.3s ease-in-out',
            '&:hover': {
              borderBottomWidth: '3px',
              borderBottomColor: dashboardData.keyMetrics.http.errorRate > 5 ? 'error.main' : 'warning.main',
              boxShadow: 6,
              marginBlockEnd: '-1px'
            }
          }}
        >
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CustomAvatar
                color={dashboardData.keyMetrics.http.errorRate > 5 ? 'error' : 'warning'}
                skin='light'
                variant='rounded'
                size={40}
              >
                <i className='ri-error-warning-line' style={{ fontSize: '22px' }} />
              </CustomAvatar>
              <Typography
                variant='h4'
                sx={{
                  fontWeight: 600,
                  color: dashboardData.keyMetrics.http.errorRate > 5 ? 'error.main' : 'text.primary'
                }}
              >
                {dashboardData.keyMetrics.http.errorRate.toFixed(2)}%
              </Typography>
            </Box>
            <Box>
              <Typography variant="body1" color="text.primary" sx={{ fontWeight: 500 }}>
                Error Rate
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card
          sx={{
            height: '100%',
            borderBottom: '2px solid',
            borderBottomColor: 'success.darkerOpacity',
            transition: 'all 0.3s ease-in-out',
            '&:hover': {
              borderBottomWidth: '3px',
              borderBottomColor: 'success.main',
              boxShadow: 6,
              marginBlockEnd: '-1px'
            }
          }}
        >
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CustomAvatar color='success' skin='light' variant='rounded' size={40}>
                <i className='ri-wifi-line' style={{ fontSize: '22px' }} />
              </CustomAvatar>
              <Typography variant='h4' sx={{ fontWeight: 600 }}>
                {dashboardData.keyMetrics.websocket.activeConnections}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body1" color="text.primary" sx={{ fontWeight: 500 }}>
                WebSocket Connections
              </Typography>
              <Typography variant="body2" color="text.secondary">
                active
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Статус системы и Active Services */}
      <Variant1
        dashboardData={dashboardData}
        getStatusColor={getStatusColor}
        getStatusIcon={getStatusIcon}
        formatDuration={formatDuration}
        formatBytes={formatBytes}
      />

      {/* Системные метрики */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <CardHeader title="System Resources" />
          <CardContent sx={{ flexGrow: 1 }}>
            <Stack spacing={3}>
              {/* Memory Usage */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                    Memory Usage
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: dashboardData.systemMetrics.memoryUsagePercent > 90 ? 'error.main' :
                       dashboardData.systemMetrics.memoryUsagePercent > 75 ? 'warning.main' : 'text.primary' }}>
                    {dashboardData.systemMetrics.memoryUsagePercent.toFixed(1)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={dashboardData.systemMetrics.memoryUsagePercent}
                  color={dashboardData.systemMetrics.memoryUsagePercent > 90 ? 'error' :
                         dashboardData.systemMetrics.memoryUsagePercent > 75 ? 'warning' : 'primary'}
                  sx={{ height: 10, borderRadius: 5, mb: 1 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {formatBytes(dashboardData.systemMetrics.memory.heapUsed)} / {formatBytes(dashboardData.systemMetrics.memory.heapTotal)}
                </Typography>
              </Box>

              <Divider />

              {/* Uptime */}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, mb: 1.5, display: 'block' }}>
                  Uptime
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Uptime
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatUptime(dashboardData.systemMetrics.uptime)}
                  </Typography>
                </Box>
              </Box>

              <Divider />

              {/* Node.js Version */}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, mb: 1.5, display: 'block' }}>
                  Node.js Version
                </Typography>
                <Stack spacing={1.5}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Version
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {dashboardData.systemMetrics.nodeVersion}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Platform
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {dashboardData.systemMetrics.platform} {dashboardData.systemMetrics.arch}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Быстрые ссылки */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <CardHeader title="External Dashboards" />
          <CardContent sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {dashboardData.externalLinks.grafana && (
                <Link
                  href={dashboardData.externalLinks.grafana}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none' }}
                >
                  <i className='ri-external-link-line' />
                  <Typography>Grafana Dashboard</Typography>
                </Link>
              )}
              {dashboardData.externalLinks.prometheus && (
                <Link
                  href={dashboardData.externalLinks.prometheus}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none' }}
                >
                  <i className='ri-external-link-line' />
                  <Typography>Prometheus UI</Typography>
                </Link>
              )}
              {dashboardData.externalLinks.sentry && (
                <Link
                  href={dashboardData.externalLinks.sentry}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none' }}
                >
                  <i className='ri-external-link-line' />
                  <Typography>Sentry Dashboard</Typography>
                </Link>
              )}
              {!dashboardData.externalLinks.grafana &&
               !dashboardData.externalLinks.prometheus &&
               !dashboardData.externalLinks.sentry && (
                <Typography variant="body2" color="text.secondary">
                  No external dashboards configured
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default MonitoringDashboardPage


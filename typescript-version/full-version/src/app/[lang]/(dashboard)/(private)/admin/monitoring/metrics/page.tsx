'use client'

import { useEffect, useState } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid2'
import Skeleton from '@mui/material/Skeleton'
import CustomAvatar from '@core/components/mui/Avatar'
import { Variant1 } from './system-metrics-variants'

interface MetricData {
  name: string
  help: string
  type: string
  value?: number
  labels?: Record<string, string>
  buckets?: Array<{ le: string; count: number }>
  sum?: number
  count?: number
}

interface ParsedMetrics {
  httpRequests: MetricData[]
  websocketConnections: MetricData[]
  databaseQueries: MetricData[]
  systemMetrics: MetricData[]
}

const MonitoringMetricsPage = () => {
  const [metrics, setMetrics] = useState<ParsedMetrics>({
    httpRequests: [],
    websocketConnections: [],
    databaseQueries: [],
    systemMetrics: []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rawMetrics, setRawMetrics] = useState<string>('')

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Запрашиваем метрики из API
        const response = await fetch('/api/metrics')
        if (!response.ok) {
          throw new Error(`Failed to fetch metrics: ${response.statusText}`)
        }

        const metricsText = await response.text()
        setRawMetrics(metricsText)

        // Парсим метрики
        const parsed = parsePrometheusMetrics(metricsText)
        
        // Отладочное логирование (только в development)
        if (process.env.NODE_ENV === 'development') {
          // Находим все метрики, которые могут быть HTTP/WebSocket/Database
          const allMetricNames = metricsText.split('\n')
            .filter(line => !line.startsWith('#') && line.trim())
            .map(line => {
              const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)/)
              return match ? match[1] : null
            })
            .filter((name): name is string => name !== null)
          
          const httpMetrics = allMetricNames.filter(name => 
            name.toLowerCase().includes('http') || name.toLowerCase().includes('request')
          )
          const wsMetrics = allMetricNames.filter(name => 
            name.toLowerCase().includes('websocket') || name.toLowerCase().includes('socket')
          )
          const dbMetrics = allMetricNames.filter(name => 
            name.toLowerCase().includes('database') || name.toLowerCase().includes('query')
          )
          
          console.group('[Metrics] Parsed metrics')
          console.log('Categories:', {
            http: parsed.httpRequests.length,
            websocket: parsed.websocketConnections.length,
            database: parsed.databaseQueries.length,
            system: parsed.systemMetrics.length
          })
          console.log('Found in raw HTTP metrics:', httpMetrics)
          console.log('Found in raw WebSocket metrics:', wsMetrics)
          console.log('Found in raw Database metrics:', dbMetrics)
          console.log('First 30 metric names:', allMetricNames.slice(0, 30))
          
          // Показываем примеры метрик для отладки
          if (httpMetrics.length > 0) {
            console.log('Example HTTP metric names:', httpMetrics)
          }
          if (wsMetrics.length > 0) {
            console.log('Example WebSocket metric names:', wsMetrics)
          }
          if (dbMetrics.length > 0) {
            console.log('Example Database metric names:', dbMetrics)
          }
          if (parsed.httpRequests.length > 0) {
            console.log('HTTP Requests:', parsed.httpRequests.map(m => ({ name: m.name, count: m.count, sum: m.sum, value: m.value })))
          }
          if (parsed.websocketConnections.length > 0) {
            console.log('WebSocket Connections:', parsed.websocketConnections.map(m => ({ name: m.name, value: m.value })))
          }
          if (parsed.databaseQueries.length > 0) {
            console.log('Database Queries:', parsed.databaseQueries.map(m => ({ name: m.name, count: m.count, sum: m.sum })))
          }
          console.groupEnd()
        }
        
        setMetrics(parsed)
      } catch (err) {
        console.error('Error fetching metrics:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch metrics')
      } finally {
        setIsLoading(false)
      }
    }

    fetchMetrics()

    // Автообновление каждые 60 секунд
    const interval = setInterval(fetchMetrics, 60000)
    return () => clearInterval(interval)
  }, [])

  const parsePrometheusMetrics = (text: string): ParsedMetrics => {
    const lines = text.split('\n').filter(line => line.trim())
    const metrics: ParsedMetrics = {
      httpRequests: [],
      websocketConnections: [],
      databaseQueries: [],
      systemMetrics: []
    }

    // Хранилище для HELP и TYPE комментариев
    const metricMetadata: Record<string, { help: string; type: string }> = {}

    // Сначала собираем метаданные (HELP и TYPE)
    for (const line of lines) {
      if (line.startsWith('# HELP ')) {
        const parts = line.substring(7).split(' ')
        const name = parts[0]
        const help = parts.slice(1).join(' ')
        if (!metricMetadata[name]) {
          metricMetadata[name] = { help: '', type: 'unknown' }
        }
        metricMetadata[name].help = help
      } else if (line.startsWith('# TYPE ')) {
        const parts = line.substring(7).split(' ')
        const name = parts[0]
        const type = parts[1]
        if (!metricMetadata[name]) {
          metricMetadata[name] = { help: '', type: 'unknown' }
        }
        metricMetadata[name].type = type
      }
    }

    // Парсим метрики
    for (const line of lines) {
      if (line.startsWith('#') || !line.trim()) continue

      // Парсим строки вида: metric_name{labels} value или metric_name value
      // Пример: http_request_duration_seconds_count{method="GET",route="/api",status_code="200"} 42
      const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]+)\})?\s+(.+)$/)
      if (match) {
        const [, metricName, labelsStr, valueStr] = match
        const value = parseFloat(valueStr.trim())
        if (isNaN(value)) continue

        // Парсим labels
        const labels: Record<string, string> = {}
        if (labelsStr) {
          // Улучшенный парсинг labels с учетом кавычек и запятых внутри значений
          const labelRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*"([^"]*)"|([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*'([^']*)'|([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([^,}]+)/g
          let match
          while ((match = labelRegex.exec(labelsStr)) !== null) {
            const key = match[1] || match[3] || match[5]
            const val = match[2] || match[4] || match[6]
            if (key && val) {
              labels[key.trim()] = val.trim().replace(/^["']|["']$/g, '')
            }
          }
        }

        // Получаем метаданные
        const baseName = metricName.replace(/_count$/, '').replace(/_sum$/, '').replace(/_bucket$/, '')
        const metadata = metricMetadata[baseName] || metricMetadata[metricName] || { help: '', type: 'unknown' }

        // Определяем категорию метрики ПО baseName (без суффиксов)
        // ВАЖНО: Проверяем системные метрики ПЕРВЫМИ, чтобы они не попали в другие категории
        const normalizedBase = baseName.toLowerCase()
        const normalizedMetricName = metricName.toLowerCase()
        let metricCategory: 'http' | 'websocket' | 'database' | 'system' | null = null
        
        // System метрики: materio_nodejs_*, materio_process_*, nodejs_*, process_*
        // Проверяем ПЕРВЫМИ, чтобы materio_nodejs_active_requests не попал в HTTP
        if (normalizedBase.includes('materio_nodejs') || 
            normalizedBase.includes('materio_process') || 
            normalizedBase.includes('nodejs') || 
            normalizedBase.includes('process') ||
            normalizedMetricName.includes('materio_nodejs') ||
            normalizedMetricName.includes('materio_process') ||
            normalizedMetricName.includes('nodejs') || 
            normalizedMetricName.includes('process')) {
          metricCategory = 'system'
        }
        // HTTP метрики: http_request_duration_seconds (НЕ просто "request"!)
        else if (normalizedBase.includes('http_request_duration') || 
                 normalizedBase.includes('http_request') ||
                 normalizedMetricName.includes('http_request_duration') || 
                 normalizedMetricName.includes('http_request')) {
          metricCategory = 'http'
        } 
        // WebSocket метрики: websocket_active_connections
        else if (normalizedBase.includes('websocket_active_connections') || 
                 normalizedBase.includes('websocket_active') ||
                 normalizedBase.includes('websocket') ||
                 normalizedMetricName.includes('websocket_active_connections') || 
                 normalizedMetricName.includes('websocket_active') ||
                 normalizedMetricName.includes('websocket')) {
          metricCategory = 'websocket'
        } 
        // Database метрики: database_query_duration_seconds
        else if (normalizedBase.includes('database_query_duration') || 
                 normalizedBase.includes('database_query') ||
                 normalizedBase.includes('database') ||
                 normalizedMetricName.includes('database_query_duration') || 
                 normalizedMetricName.includes('database_query') ||
                 normalizedMetricName.includes('database')) {
          metricCategory = 'database'
        }

        const metric: MetricData = {
          name: metricName,
          help: metadata.help,
          type: metadata.type,
          value,
          labels: Object.keys(labels).length > 0 ? labels : undefined
        }

        // Для Histogram метрик обрабатываем _count, _sum, _bucket отдельно
        if (metricName.endsWith('_count')) {
          metric.name = baseName
          metric.type = 'histogram'
          metric.count = value
        } else if (metricName.endsWith('_sum')) {
          metric.name = baseName
          metric.type = 'histogram'
          metric.sum = value
        } else if (metricName.endsWith('_bucket')) {
          // Для buckets создаем отдельные записи или пропускаем
          continue
        }

        // Распределяем метрики по категориям
        // Пропускаем _bucket метрики (они уже обработаны выше)
        if (metricName.endsWith('_bucket')) {
          continue
        }


        if (metricCategory === 'http') {
          // Для HTTP метрик группируем по route и method
          // Используем baseName для группировки _count и _sum
          const groupKey = `${baseName}-${metric.labels?.route || ''}-${metric.labels?.method || ''}`
          const existing = metrics.httpRequests.find(
            m => {
              const mBaseName = (m as any).originalName || m.name.split(' (')[0]
              const mGroupKey = `${mBaseName}-${m.labels?.route || ''}-${m.labels?.method || ''}`
              return mGroupKey === groupKey
            }
          )
          if (existing) {
            // Объединяем _count и _sum для Histogram
            if (metric.count !== undefined) {
              existing.count = (existing.count || 0) + metric.count
            }
            if (metric.sum !== undefined) {
              existing.sum = (existing.sum || 0) + metric.sum
            }
            if (metric.value !== undefined && !metric.count && !metric.sum) {
              existing.value = (existing.value || 0) + metric.value
            }
          } else {
            const httpMetric: MetricData & { originalName?: string } = {
              ...metric,
              name: baseName, // Используем baseName для единообразия
              originalName: baseName
            }
            metrics.httpRequests.push(httpMetric)
          }
        } else if (metricCategory === 'websocket') {
          // Для WebSocket метрик проверяем на дубликаты
          const existing = metrics.websocketConnections.find(
            m => {
              const mBaseName = (m as any).originalName || m.name.split(' (')[0]
              return mBaseName === baseName
            }
          )
          if (!existing) {
            const wsMetric: MetricData & { originalName?: string } = {
              ...metric,
              name: baseName,
              originalName: baseName
            }
            metrics.websocketConnections.push(wsMetric)
          } else {
            // Обновляем значение, если метрика уже существует
            if (metric.value !== undefined) {
              existing.value = metric.value
            }
          }
        } else if (metricCategory === 'database') {
          // Для Database метрик группируем по operation и table
          const groupKey = `${baseName}-${metric.labels?.operation || ''}-${metric.labels?.table || ''}`
          const existing = metrics.databaseQueries.find(
            m => {
              const mBaseName = (m as any).originalName || m.name.split(' (')[0]
              const mGroupKey = `${mBaseName}-${m.labels?.operation || ''}-${m.labels?.table || ''}`
              return mGroupKey === groupKey
            }
          )
          if (existing) {
            // Объединяем _count и _sum для Histogram
            if (metric.count !== undefined) {
              existing.count = (existing.count || 0) + metric.count
            }
            if (metric.sum !== undefined) {
              existing.sum = (existing.sum || 0) + metric.sum
            }
            if (metric.value !== undefined && !metric.count && !metric.sum) {
              existing.value = (existing.value || 0) + metric.value
            }
          } else {
            const dbMetric: MetricData & { originalName?: string } = {
              ...metric,
              name: baseName,
              originalName: baseName
            }
            metrics.databaseQueries.push(dbMetric)
          }
        } else if (metricCategory === 'system') {
          // Для системных метрик обрабатываем дубликаты
          const baseMetricName = metricName.split('{')[0] // Базовое имя без labels
          const normalizedBaseName = baseMetricName.toLowerCase()
          
          // Для heap space метрик (с space_type) агрегируем значения
          const isHeapSpaceMetric = normalizedBaseName.includes('heap') && 
                                    (normalizedBaseName.includes('space') || normalizedBaseName.includes('heap_space')) &&
                                    metric.labels?.space_type
          
          if (isHeapSpaceMetric) {
            // Для heap space метрик суммируем значения по всем space_type
            const existing = metrics.systemMetrics.find(m => {
              const existingBaseName = (m as any).originalName || m.name.split(' (')[0]
              return existingBaseName === baseMetricName
            })
            
            if (existing) {
              // Суммируем значения
              if (metric.value !== undefined) {
                existing.value = (existing.value || 0) + (metric.value || 0)
              }
            } else {
              // Создаем новую агрегированную метрику без space_type в названии
              const aggregatedMetric: MetricData & { originalName?: string } = {
                ...metric,
                name: baseMetricName, // Используем базовое имя без labels
                labels: undefined, // Убираем labels, так как мы агрегируем
                originalName: baseMetricName
              }
              metrics.systemMetrics.push(aggregatedMetric)
            }
          } else {
            // Для остальных метрик показываем отдельно, но без технических labels в названии
            const uniqueKey = metricName + (metric.labels ? JSON.stringify(metric.labels) : '')
            
            // Проверяем, не существует ли уже метрика с таким же именем и labels
            const existing = metrics.systemMetrics.find(m => {
              const existingBaseName = (m as any).originalName || m.name.split(' (')[0]
              const existingLabels = (m as any).originalLabels || m.labels
              const existingKey = existingBaseName + (existingLabels ? JSON.stringify(existingLabels) : '')
              return existingKey === uniqueKey
            })
            
            if (!existing) {
              // Для метрик без heap space просто используем базовое имя
              const displayMetric: MetricData & { originalName?: string; originalLabels?: Record<string, string> } = {
                ...metric,
                name: baseMetricName, // Используем базовое имя без labels
                labels: undefined, // Убираем labels для упрощения отображения
                originalName: baseMetricName,
                originalLabels: metric.labels ? { ...metric.labels } : undefined
              }
              metrics.systemMetrics.push(displayMetric)
            }
          }
        }
      }
    }

    // Вычисляем средние значения для Histogram метрик
    metrics.httpRequests.forEach(metric => {
      if (metric.type === 'histogram' && metric.count && metric.sum) {
        metric.value = metric.count > 0 ? metric.sum / metric.count : 0
      }
    })

    metrics.databaseQueries.forEach(metric => {
      if (metric.type === 'histogram' && metric.count && metric.sum) {
        metric.value = metric.count > 0 ? metric.sum / metric.count : 0
      }
    })

    return metrics
  }

  const formatValue = (value: number): string => {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(2) + 'M'
    } else if (value >= 1000) {
      return (value / 1000).toFixed(2) + 'K'
    } else if (value < 1 && value > 0) {
      return value.toFixed(3)
    } else {
      return value.toFixed(2)
    }
  }

  const formatDuration = (seconds: number): string => {
    if (seconds < 1) {
      return (seconds * 1000).toFixed(0) + 'ms'
    } else {
      return seconds.toFixed(2) + 's'
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 6 }}>
        {/* Header Skeleton */}
        <Box sx={{ mb: 6 }}>
          <Skeleton animation="wave" variant="text" width="30%" height={40} sx={{ mb: 1 }} />
          <Skeleton animation="wave" variant="text" width="50%" height={24} />
        </Box>

        {/* HTTP Requests Section */}
        <Box sx={{ mb: 6 }}>
          <Skeleton animation="wave" variant="text" width="15%" height={28} sx={{ mb: 3 }} />
          <Grid container spacing={4}>
            {[1, 2, 3].map((i) => (
              <Grid key={`http-${i}`} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card sx={{ 
                  borderBottom: '2px solid',
                  borderBottomColor: 'action.hover'
                }}>
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Skeleton animation="wave" variant="rounded" width={40} height={40} />
                      <Skeleton animation="wave" variant="text" width={80} height={36} />
                    </Box>
                    <Box>
                      <Skeleton animation="wave" variant="text" width="70%" height={24} sx={{ mb: 0.5 }} />
                      <Skeleton animation="wave" variant="text" width="50%" height={20} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* WebSocket Section */}
        <Box sx={{ mb: 6 }}>
          <Skeleton animation="wave" variant="text" width="20%" height={28} sx={{ mb: 3 }} />
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ 
                borderBottom: '2px solid',
                borderBottomColor: 'action.hover'
              }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Skeleton animation="wave" variant="rounded" width={40} height={40} />
                    <Skeleton animation="wave" variant="text" width={60} height={36} />
                  </Box>
                  <Box>
                    <Skeleton animation="wave" variant="text" width="60%" height={24} sx={{ mb: 0.5 }} />
                    <Skeleton animation="wave" variant="text" width="40%" height={20} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>

        {/* Database Section */}
        <Box sx={{ mb: 6 }}>
          <Skeleton animation="wave" variant="text" width="22%" height={28} sx={{ mb: 3 }} />
          <Grid container spacing={4}>
            {[1, 2].map((i) => (
              <Grid key={`db-${i}`} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card sx={{ 
                  borderBottom: '2px solid',
                  borderBottomColor: 'action.hover'
                }}>
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Skeleton animation="wave" variant="rounded" width={40} height={40} />
                      <Skeleton animation="wave" variant="text" width={70} height={36} />
                    </Box>
                    <Box>
                      <Skeleton animation="wave" variant="text" width="65%" height={24} sx={{ mb: 0.5 }} />
                      <Skeleton animation="wave" variant="text" width="45%" height={20} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* System Metrics Section */}
        <Box sx={{ mb: 6 }}>
          <Skeleton animation="wave" variant="text" width="18%" height={28} sx={{ mb: 3 }} />
          <Grid container spacing={4}>
            {['CPU', 'Memory', 'Process', 'Node.js'].map((category) => (
              <Grid key={category} size={{ xs: 12, md: 6 }}>
                <Card sx={{ height: '100%' }}>
                  <CardHeader
                    title={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Skeleton animation="wave" variant="circular" width={32} height={32} />
                        <Skeleton animation="wave" variant="text" width={100} height={28} />
                      </Box>
                    }
                  />
                  <CardContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {[1, 2, 3, 4].map((j) => (
                        <Box key={j}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Skeleton animation="wave" variant="text" width="55%" height={22} />
                            <Skeleton animation="wave" variant="text" width="25%" height={22} />
                          </Box>
                          {j < 4 && <Skeleton animation="wave" variant="rectangular" width="100%" height={1} sx={{ my: 0.5 }} />}
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Raw Metrics Section */}
        <Box sx={{ mb: 6 }}>
          <Skeleton animation="wave" variant="text" width="25%" height={28} sx={{ mb: 3 }} />
          <Card>
            <CardContent>
              <Skeleton 
                animation="wave" 
                variant="rectangular" 
                width="100%" 
                height={200} 
                sx={{ borderRadius: 1 }} 
              />
            </CardContent>
          </Card>
        </Box>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 6 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Ошибка загрузки метрик</Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
        <Button variant="contained" color="error" onClick={() => window.location.reload()}>
          Перезагрузить
        </Button>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 6 }}>
      <Box sx={{ mb: 6 }}>
        <Typography variant='h4' className='mbe-1'>
          Метрики системы
        </Typography>
        <Typography color="text.secondary">
          Детальная информация о производительности системы
        </Typography>
      </Box>

      {/* HTTP Requests Summary */}
      <Grid container spacing={4} sx={{ mb: 6 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
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
                  {metrics.httpRequests.length > 0
                    ? metrics.httpRequests.reduce((sum, m) => sum + (m.count || 0), 0)
                    : 0}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body1" color="text.primary" sx={{ fontWeight: 500 }}>
                  HTTP Запросы
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {metrics.httpRequests.length > 0 ? 'Всего запросов' : 'Метрики не собираются'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
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
                  {metrics.httpRequests.length > 0
                    ? formatDuration(
                        metrics.httpRequests.reduce((sum, m) => {
                          const avg = m.type === 'histogram' && m.count && m.sum ? m.sum / m.count : (m.value || 0)
                          return sum + avg
                        }, 0) / metrics.httpRequests.length
                      )
                    : '0ms'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body1" color="text.primary" sx={{ fontWeight: 500 }}>
                  Среднее время ответа
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
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
                  <i className='ri-checkbox-circle-line' style={{ fontSize: '22px' }} />
                </CustomAvatar>
                <Typography variant='h4' sx={{ fontWeight: 600 }}>
                  {metrics.httpRequests.length > 0
                    ? Math.round(
                        (metrics.httpRequests.filter(m => {
                          const statusCode = m.labels?.status_code || ''
                          return statusCode.startsWith('2')
                        }).reduce((sum, m) => sum + (m.count || 0), 0) /
                          metrics.httpRequests.reduce((sum, m) => sum + (m.count || 0), 0)) *
                          100
                      )
                    : 0}%
                </Typography>
              </Box>
              <Box>
                <Typography variant="body1" color="text.primary" sx={{ fontWeight: 500 }}>
                  Успешные запросы
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* WebSocket Connections Summary */}
      <Grid container spacing={4} sx={{ mb: 6 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
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
                  {metrics.websocketConnections.find(m => m.name.includes('active_connections'))?.value || 0}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body1" color="text.primary" sx={{ fontWeight: 500 }}>
                  WebSocket Соединения
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {metrics.websocketConnections.length > 0 ? 'активные' : 'Метрики не собираются'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Database Queries Summary */}
      <Grid container spacing={4} sx={{ mb: 6 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
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
                  <i className='ri-database-2-line' style={{ fontSize: '22px' }} />
                </CustomAvatar>
                <Typography variant='h4' sx={{ fontWeight: 600 }}>
                  {metrics.databaseQueries.reduce((sum, m) => sum + (m.count || 0), 0)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body1" color="text.primary" sx={{ fontWeight: 500 }}>
                  Запросы к БД
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {metrics.databaseQueries.length > 0 ? 'Всего запросов' : 'Метрики не собираются'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card
            sx={{
              height: '100%',
              borderBottom: '2px solid',
              borderBottomColor: 'warning.darkerOpacity',
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                borderBottomWidth: '3px',
                borderBottomColor: 'warning.main',
                boxShadow: 6,
                marginBlockEnd: '-1px'
              }
            }}
          >
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CustomAvatar color='warning' skin='light' variant='rounded' size={40}>
                  <i className='ri-time-line' style={{ fontSize: '22px' }} />
                </CustomAvatar>
                <Typography variant='h4' sx={{ fontWeight: 600 }}>
                  {metrics.databaseQueries.length > 0
                    ? formatDuration(
                        metrics.databaseQueries.reduce((sum, m) => {
                          const avg = m.type === 'histogram' && m.count && m.sum ? m.sum / m.count : (m.value || 0)
                          return sum + avg
                        }, 0) / metrics.databaseQueries.length
                      )
                    : '0ms'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body1" color="text.primary" sx={{ fontWeight: 500 }}>
                  Среднее время запроса
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* System Metrics */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
          Системные метрики
        </Typography>
        {metrics.systemMetrics.length === 0 ? (
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                Нет данных о системных метриках
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Variant1 metrics={metrics.systemMetrics} formatValue={formatValue} />
        )}
      </Box>

      {/* Raw Metrics */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
          Сырые метрики (Prometheus формат)
        </Typography>
        <Card>
          <CardContent>
            <Box
              sx={{
                bgcolor: 'action.hover',
                p: 3,
                borderRadius: 1,
                overflowX: 'auto',
                maxHeight: '400px',
                overflowY: 'auto'
              }}
            >
              <Typography
                component="pre"
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  m: 0
                }}
              >
                {rawMetrics || 'Нет данных'}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}

export default MonitoringMetricsPage
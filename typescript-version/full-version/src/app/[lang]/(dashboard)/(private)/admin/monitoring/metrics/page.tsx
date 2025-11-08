'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, Typography } from '@mui/material'

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

  useEffect(() => {
    // Use mock data instead of parsing Prometheus metrics
    setTimeout(() => {
      setMetrics({
        httpRequests: [
          { name: 'http_request_duration_seconds', help: 'Duration of HTTP requests', type: 'histogram', value: 3.00, labels: { method: 'GET', route: '/api/metrics', status_code: '200' } },
          { name: 'http_request_duration_seconds', help: 'Duration of HTTP requests', type: 'histogram', value: 3.00, labels: { method: 'GET', route: '/api/health', status_code: '200' } },
          { name: 'http_request_duration_seconds', help: 'Duration of HTTP requests', type: 'histogram', value: 3.00, labels: { method: 'POST', route: '/api/auth', status_code: '200' } },
          { name: 'http_request_duration_seconds', help: 'Duration of HTTP requests', type: 'histogram', value: 0.300, labels: { method: 'GET', route: '/api/chat', status_code: '200' } },
          { name: 'http_request_duration_seconds', help: 'Duration of HTTP requests', type: 'histogram', value: 3.00, labels: { method: 'GET', route: '/api/users', status_code: '200' } },
          { name: 'http_request_duration_seconds', help: 'Duration of HTTP requests', type: 'histogram', value: 3.00, labels: { method: 'POST', route: '/api/messages', status_code: '201' } },
          { name: 'http_request_duration_seconds', help: 'Duration of HTTP requests', type: 'histogram', value: 3.00, labels: { method: 'GET', route: '/api/notifications', status_code: '200' } },
          { name: 'http_request_duration_seconds', help: 'Duration of HTTP requests', type: 'histogram', value: 3.00, labels: { method: 'PUT', route: '/api/profile', status_code: '200' } }
        ],
        websocketConnections: [
          { name: 'websocket_active_connections', help: 'Number of active WebSocket connections', type: 'gauge', value: 5.00, labels: {} },
          { name: 'websocket_messages_sent', help: 'Total WebSocket messages sent', type: 'counter', value: 1247.00, labels: {} },
          { name: 'websocket_messages_received', help: 'Total WebSocket messages received', type: 'counter', value: 892.00, labels: {} }
        ],
        databaseQueries: [
          { name: 'database_query_duration', help: 'Duration of database queries', type: 'histogram', value: 0.045, labels: { operation: 'SELECT', table: 'users' } },
          { name: 'database_query_duration', help: 'Duration of database queries', type: 'histogram', value: 0.032, labels: { operation: 'INSERT', table: 'messages' } },
          { name: 'database_query_duration', help: 'Duration of database queries', type: 'histogram', value: 0.078, labels: { operation: 'UPDATE', table: 'profiles' } },
          { name: 'database_connections_active', help: 'Number of active database connections', type: 'gauge', value: 8.00, labels: {} }
        ],
        systemMetrics: [
          { name: 'nodejs_heap_size_used_bytes', help: 'Heap size used by Node.js', type: 'gauge', value: 67108864.00, labels: {} },
          { name: 'nodejs_heap_size_total_bytes', help: 'Total heap size of Node.js', type: 'gauge', value: 134217728.00, labels: {} },
          { name: 'process_cpu_user_seconds_total', help: 'Total user CPU time', type: 'counter', value: 45.23, labels: {} },
          { name: 'process_cpu_system_seconds_total', help: 'Total system CPU time', type: 'counter', value: 12.45, labels: {} }
        ]
      })
      setIsLoading(false)
    }, 500)
  }, [])

  const parsePrometheusMetrics = (text: string): ParsedMetrics => {
    const lines = text.split('\n').filter(line => line.trim())
    const metrics: ParsedMetrics = {
      httpRequests: [],
      websocketConnections: [],
      databaseQueries: [],
      systemMetrics: []
    }

    let currentMetric: Partial<MetricData> | null = null

    for (const line of lines) {
      if (line.startsWith('# HELP ')) {
        const [, name, help] = line.split(' ')
        currentMetric = { name, help }
      } else if (line.startsWith('# TYPE ')) {
        const [, name, type] = line.split(' ')
        if (currentMetric && currentMetric.name === name) {
          currentMetric.type = type
        }
      } else if (!line.startsWith('#')) {
        const [metricName, valueAndLabels] = line.split(' ')
        const value = parseFloat(valueAndLabels.split('}')[1] || valueAndLabels)

        // Parse labels
        const labelsMatch = valueAndLabels.match(/{([^}]+)}/)
        const labels: Record<string, string> = {}
        if (labelsMatch) {
          labelsMatch[1].split(',').forEach(label => {
            const [key, value] = label.split('=')
            labels[key] = value.replace(/"/g, '')
          })
        }

        const metric: MetricData = {
          name: metricName,
          help: currentMetric?.help || '',
          type: currentMetric?.type || 'unknown',
          value,
          labels
        }

        // Categorize metrics
        if (metricName.includes('http_request')) {
          metrics.httpRequests.push(metric)
        } else if (metricName.includes('websocket')) {
          metrics.websocketConnections.push(metric)
        } else if (metricName.includes('database')) {
          metrics.databaseQueries.push(metric)
        } else if (metricName.includes('nodejs') || metricName.includes('process')) {
          metrics.systemMetrics.push(metric)
        }
      }
    }

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
    return <div className="p-6">Загрузка метрик...</div>
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Метрики системы</h1>
      </div>

      {/* HTTP Requests */}
      <Card>
        <CardHeader title="HTTP Запросы" />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.httpRequests.map((metric, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="text-sm text-gray-500 mb-1">
                  {metric.labels?.method} {metric.labels?.route}
                </div>
                <div className="text-2xl font-bold">
                  {metric.labels?.status_code === '200' ? '✅' : '❌'} {metric.labels?.status_code}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {metric.type === 'histogram' && metric.value !== undefined
                    ? `${formatDuration(metric.value)} (avg)`
                    : formatValue(metric.value || 0)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* WebSocket Connections */}
      <Card>
        <CardHeader title="WebSocket Соединения" />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metrics.websocketConnections.map((metric, index) => {
              const getTitle = (name: string) => {
                switch (name) {
                  case 'websocket_active_connections': return 'Активные соединения'
                  case 'websocket_messages_sent': return 'Отправлено сообщений'
                  case 'websocket_messages_received': return 'Получено сообщений'
                  default: return 'WebSocket метрика'
                }
              }

              const getDescription = (name: string) => {
                switch (name) {
                  case 'websocket_active_connections': return 'Real-time connections'
                  case 'websocket_messages_sent': return 'Total messages sent'
                  case 'websocket_messages_received': return 'Total messages received'
                  default: return 'WebSocket metric'
                }
              }

              const getIcon = (name: string) => {
                switch (name) {
                  case 'websocket_active_connections': return '🔗'
                  case 'websocket_messages_sent': return '📤'
                  case 'websocket_messages_received': return '📥'
                  default: return '🔗'
                }
              }

              return (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">{getTitle(metric.name)}</div>
                  <div className="text-3xl font-bold text-green-500">
                    {getIcon(metric.name)} {formatValue(metric.value || 0)}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {getDescription(metric.name)}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Database Queries */}
      <Card>
        <CardHeader title="Запросы к базе данных" />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.databaseQueries.map((metric, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="text-sm text-gray-500 mb-1">
                  {metric.labels?.operation} {metric.labels?.table}
                </div>
                <div className="text-2xl font-bold text-blue-500">
                  🗄️ {metric.type === 'histogram' && metric.value !== undefined
                    ? formatDuration(metric.value)
                    : formatValue(metric.value || 0)}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {metric.type === 'histogram' ? 'Среднее время' : 'Количество'}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Metrics */}
      <Card>
        <CardHeader title="Системные метрики" />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.systemMetrics.map((metric, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="text-sm text-gray-500 mb-1">
                  {metric.name.replace('nodejs_', '').replace('_', ' ')}
                </div>
                <div className="text-2xl font-bold text-purple-500">
                  💻 {metric.name.includes('size')
                    ? `${formatValue((metric.value || 0) / 1024 / 1024)}MB`
                    : formatValue(metric.value || 0)}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {metric.help}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Raw Metrics */}
      <Card>
        <CardHeader title="Сырые метрики (Prometheus формат)" />
        <CardContent>
          <div className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
            <pre className="text-sm whitespace-pre-wrap">
              {(() => {
                // Fetch raw metrics for display
                fetch('/api/metrics').then(r => r.text()).then(text => {
                  const pre = document.querySelector('.raw-metrics')
                  if (pre) pre.textContent = text
                })
                return 'Загрузка...'
              })()}
            </pre>
            <pre className="raw-metrics text-sm whitespace-pre-wrap"></pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default MonitoringMetricsPage
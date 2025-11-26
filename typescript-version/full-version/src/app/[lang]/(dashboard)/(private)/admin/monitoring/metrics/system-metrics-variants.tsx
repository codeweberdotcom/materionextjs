/**
 * ВАРИАНТЫ ОТОБРАЖЕНИЯ СИСТЕМНЫХ МЕТРИК
 * Группировка по типам: CPU, Memory, Process, Node.js
 */

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid2'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import CustomAvatar from '@core/components/mui/Avatar'

interface MetricData {
  name: string
  help: string
  type: string
  value?: number
  labels?: Record<string, string>
}

interface GroupedMetrics {
  cpu: MetricData[]
  memory: MetricData[]
  process: MetricData[]
  nodejs: MetricData[]
  other: MetricData[]
}

const groupMetrics = (metrics: MetricData[]): GroupedMetrics => {
  const grouped: GroupedMetrics = {
    cpu: [],
    memory: [],
    process: [],
    nodejs: [],
    other: []
  }

  // Используем Set для отслеживания уже добавленных метрик
  const addedMetrics = new Set<string>()

  metrics.forEach(metric => {
    // Создаем уникальный ключ для метрики (name + labels)
    const uniqueKey = metric.name + (metric.labels ? JSON.stringify(metric.labels) : '')
    
    // Пропускаем, если метрика уже была добавлена
    if (addedMetrics.has(uniqueKey)) {
      return
    }

    const name = metric.name.toLowerCase()
    
    // Приоритетная группировка: сначала проверяем более специфичные категории
    if (name.includes('cpu') && !name.includes('nodejs') && !name.includes('process')) {
      grouped.cpu.push(metric)
      addedMetrics.add(uniqueKey)
    } else if ((name.includes('memory') || name.includes('heap') || name.includes('rss')) && 
               !name.includes('nodejs') && !name.includes('process')) {
      grouped.memory.push(metric)
      addedMetrics.add(uniqueKey)
    } else if (name.includes('process_') || name.includes('materio_process')) {
      grouped.process.push(metric)
      addedMetrics.add(uniqueKey)
    } else if (name.includes('nodejs') || name.includes('materio_nodejs')) {
      // Для nodejs метрик дополнительно проверяем, не является ли это memory метрикой
      if (name.includes('heap') || name.includes('memory') || name.includes('rss')) {
        grouped.memory.push(metric)
      } else {
        grouped.nodejs.push(metric)
      }
      addedMetrics.add(uniqueKey)
    } else {
      grouped.other.push(metric)
      addedMetrics.add(uniqueKey)
    }
  })

  return grouped
}

const formatSizeValue = (value: number): string => {
  if (value >= 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`
  } else if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MB`
  } else if (value >= 1024) {
    return `${(value / 1024).toFixed(2)} KB`
  }
  return `${value.toFixed(2)} B`
}

const getDisplayName = (name: string): string => {
  return name
    .replace('materio_', '')
    .replace('nodejs_', '')
    .replace('process_', '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}

// ============================================
// ВАРИАНТ 1: Группировка по категориям в отдельных карточках
// ============================================
export const Variant1 = ({ metrics, formatValue: formatValueFn }: { metrics: MetricData[], formatValue: (value: number) => string }) => {
  const grouped = groupMetrics(metrics)

  const renderGroup = (title: string, icon: string, color: 'primary' | 'success' | 'info' | 'warning' | 'error' | 'secondary', groupMetrics: MetricData[]) => {
    if (groupMetrics.length === 0) return null

    return (
      <Grid size={{ xs: 12, md: 6 }}>
        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <CardHeader
            title={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CustomAvatar color={color} skin='light' variant='rounded' size={32}>
                  <i className={icon} style={{ fontSize: '18px' }} />
                </CustomAvatar>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {title}
                </Typography>
              </Box>
            }
          />
          <CardContent sx={{ flexGrow: 1 }}>
            <Stack spacing={2}>
              {groupMetrics.map((metric, index) => {
                const isSize = metric.name.includes('size') || metric.name.includes('bytes') || 
                              metric.name.includes('heap') || metric.name.includes('rss')
                const displayValue = isSize
                  ? formatSizeValue(metric.value || 0)
                  : formatValueFn(metric.value || 0)

                // Создаем уникальный ключ
                const uniqueKey = `${metric.name}-${index}-${metric.labels ? JSON.stringify(metric.labels) : ''}`

                return (
                  <Box key={uniqueKey}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
                        {getDisplayName(metric.name)}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {displayValue}
                      </Typography>
                    </Box>
                    {metric.help && (
                      <Typography variant="caption" color="text.secondary">
                        {metric.help}
                      </Typography>
                    )}
                    {index < groupMetrics.length - 1 && <Divider sx={{ mt: 2 }} />}
                  </Box>
                )
              })}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    )
  }

  return (
    <Grid container spacing={4}>
      {renderGroup('CPU', 'ri-cpu-line', 'primary', grouped.cpu)}
      {renderGroup('Memory', 'ri-database-2-line', 'success', grouped.memory)}
      {renderGroup('Process', 'ri-terminal-box-line', 'info', grouped.process)}
      {renderGroup('Node.js', 'ri-nodejs', 'warning', grouped.nodejs)}
      {renderGroup('Other', 'ri-settings-3-line', 'secondary', grouped.other)}
    </Grid>
  )
}



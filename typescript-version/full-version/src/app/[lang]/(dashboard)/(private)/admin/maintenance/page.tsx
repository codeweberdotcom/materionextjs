'use client'

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'

type RetentionStatus = {
  lastRunAt: string | null
  lastSuccessAt: string | null
  lastResult: string | null
  lastCount: number | null
}

type RetentionResponse = {
  retentionDays: number
  status: RetentionStatus | null
}

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

const MaintenancePage = () => {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [data, setData] = useState<RetentionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/maintenance/retention', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load status')
      const json = (await res.json()) as RetentionResponse
      setData(json)
      setError(null)
    } catch (err) {
      setError('Не удалось загрузить статус')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchStatus()
  }, [])

  const runCleanup = async () => {
    try {
      setRunning(true)
      const res = await fetch('/api/admin/maintenance/retention', {
        method: 'POST',
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to run cleanup')
      await fetchStatus()
    } catch (err) {
      setError('Не удалось запустить очистку')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Box className='grid grid-cols-1 gap-6'>
      <Card>
        <CardHeader
          title='Retention (RateLimitEvent)'
          subheader='Удаление событий старше заданного срока'
          action={
            <Button variant='contained' onClick={runCleanup} disabled={running}>
              {running ? 'Запуск...' : 'Запустить'}
            </Button>
          }
        />
        <CardContent className='flex flex-col gap-2'>
          {loading ? (
            <Box className='flex flex-col gap-1'>
              <Skeleton height={20} width='60%' />
              <Skeleton height={20} width='50%' />
              <Skeleton height={20} width='40%' />
            </Box>
          ) : error ? (
            <Typography color='error'>{error}</Typography>
          ) : data ? (
            <>
              <Typography variant='body2'>Срок хранения: {data.retentionDays} дней</Typography>
              <Typography variant='body2'>
                Последний запуск: {formatDate(data.status?.lastRunAt || null)}
              </Typography>
              <Typography variant='body2'>
                Успешный запуск: {formatDate(data.status?.lastSuccessAt || null)}
              </Typography>
              <Typography variant='body2'>
                Результат: {data.status?.lastResult || '—'}
                {data.status?.lastCount != null ? ` (удалено ${data.status.lastCount})` : ''}
              </Typography>
            </>
          ) : null}
          <Typography variant='caption' color='text.secondary'>
            Cron/CI: раз в неделю вызывает `pnpm retention:cleanup`. Этот экран показывает состояние и позволяет запустить вручную.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}

export default MaintenancePage

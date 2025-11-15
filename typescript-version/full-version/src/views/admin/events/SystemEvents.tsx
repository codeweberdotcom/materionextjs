'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import Grid from '@mui/material/Grid2'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableBody from '@mui/material/TableBody'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import IconButton from '@mui/material/IconButton'

import { toast } from 'react-toastify'

import { usePermissions } from '@/hooks/usePermissions'
import { useTranslation } from '@/contexts/TranslationContext'

type EventEntry = {
  id: string
  source: string
  module: string
  type: string
  severity: string
  actorType: string | null
  actorId: string | null
  subjectType: string | null
  subjectId: string | null
  key: string | null
  message: string
  payload: Record<string, any> | null
  metadata: Record<string, any> | null
  createdAt: string
}

type ApiResponse = {
  items: EventEntry[]
  nextCursor?: string
}

const SOURCE_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'rate_limit', label: 'rate_limit' },
  { value: 'moderation', label: 'moderation' },
  { value: 'block', label: 'block' },
  { value: 'auth', label: 'auth' },
  { value: 'registration', label: 'registration' },
  { value: 'chat', label: 'chat' },
  { value: 'ads', label: 'ads' },
  { value: 'notifications', label: 'notifications' },
  { value: 'system', label: 'system' }
]

const SEVERITY_OPTIONS = [
  { value: '', label: 'All severities' },
  { value: 'info', label: 'info' },
  { value: 'warning', label: 'warning' },
  { value: 'error', label: 'error' },
  { value: 'critical', label: 'critical' }
]

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '–'
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value))
  } catch {
    return value
  }
}

const stringifyJson = (value: Record<string, any> | null) => {
  if (!value) {
    return '—'
  }

  return JSON.stringify(value, null, 2)
}

const SystemEvents = () => {
  const { checkPermission, isLoading: permissionsLoading } = usePermissions()
  const dictionary = useTranslation()
  const t = dictionary.eventsJournal

  const [source, setSource] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [severity, setSeverity] = useState('')
  const [type, setType] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [events, setEvents] = useState<EventEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [selectedEvent, setSelectedEvent] = useState<EventEntry | null>(null)

  const hasAccess = useMemo(() => checkPermission('events', 'read'), [checkPermission])

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput), 400)

    return () => clearTimeout(handle)
  }, [searchInput])

  const buildQuery = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams()

      if (source) params.set('source', source)
      if (moduleFilter) params.set('module', moduleFilter)
      if (severity) params.set('severity', severity)
      if (type) params.set('type', type)
      if (search) params.set('search', search)
      if (from) {
        const date = new Date(from)
        if (!Number.isNaN(date.getTime())) {
          params.set('from', date.toISOString())
        }
      }
      if (to) {
        const date = new Date(to)
        if (!Number.isNaN(date.getTime())) {
          params.set('to', date.toISOString())
        }
      }
      if (cursor) params.set('cursor', cursor)

      return params.toString()
    },
    [from, moduleFilter, search, severity, source, to, type]
  )

  const fetchEvents = useCallback(
    async (options?: { append?: boolean; cursor?: string }) => {
      if (!hasAccess) {
        setInitialLoading(false)
        return
      }

      setLoading(true)

      try {
        const query = buildQuery(options?.cursor)
        const response = await fetch(`/api/admin/events${query ? `?${query}` : ''}`)

        if (!response.ok) {
          throw new Error('Failed to load events')
        }

        const data: ApiResponse = await response.json()

        setEvents(prev => (options?.append ? [...prev, ...data.items] : data.items))
        setNextCursor(data.nextCursor)
      } catch (error) {
        toast.error(t.noData)
        console.error(error)
      } finally {
        setLoading(false)
        setInitialLoading(false)
      }
    },
    [buildQuery, hasAccess, t.noData]
  )

  useEffect(() => {
    if (permissionsLoading) {
      return
    }

    void fetchEvents()
  }, [fetchEvents, permissionsLoading, source, moduleFilter, severity, type, search, from, to])

  const resetFilters = () => {
    setSource('')
    setModuleFilter('')
    setSeverity('')
    setType('')
    setSearchInput('')
    setSearch('')
    setFrom('')
    setTo('')
  }

  if (permissionsLoading || initialLoading) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress />
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <Card>
        <CardContent>
          <Typography>{t.noAccess}</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader
          title={t.title}
          subheader={t.description}
          action={
            <Button variant='outlined' onClick={() => fetchEvents()} disabled={loading}>
              {t.refresh}
            </Button>
          }
        />
        <CardContent>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <TextField select fullWidth label={t.sourceLabel} value={source} onChange={e => setSource(e.target.value)}>
                {SOURCE_OPTIONS.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <TextField
                fullWidth
                label={t.moduleLabel}
                value={moduleFilter}
                onChange={e => setModuleFilter(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <TextField select fullWidth label={t.severityLabel} value={severity} onChange={e => setSeverity(e.target.value)}>
                {SEVERITY_OPTIONS.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <TextField fullWidth label={t.typeLabel} value={type} onChange={e => setType(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <TextField
                fullWidth
                label={t.searchPlaceholder}
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <Button variant='text' color='secondary' onClick={resetFilters}>
                {t.resetFilters}
              </Button>
            </Grid>
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <TextField
                fullWidth
                label={t.fromLabel}
                type='datetime-local'
                InputLabelProps={{ shrink: true }}
                value={from}
                onChange={e => setFrom(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <TextField
                fullWidth
                label={t.toLabel}
                type='datetime-local'
                InputLabelProps={{ shrink: true }}
                value={to}
                onChange={e => setTo(e.target.value)}
              />
            </Grid>
          </Grid>
        </CardContent>
        <CardContent>
          {events.length === 0 ? (
            <Typography variant='body2' color='text.secondary'>
              {t.noData}
            </Typography>
          ) : (
            <>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t.tableColumnTimestamp}</TableCell>
                    <TableCell>{t.tableColumnSource}</TableCell>
                    <TableCell>{t.tableColumnModule}</TableCell>
                    <TableCell>{t.tableColumnType}</TableCell>
                    <TableCell>{t.tableColumnSeverity}</TableCell>
                    <TableCell>{t.tableColumnKey}</TableCell>
                    <TableCell>{t.tableColumnActor}</TableCell>
                    <TableCell>{t.tableColumnSubject}</TableCell>
                    <TableCell>{t.tableColumnMessage}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {events.map(event => (
                    <TableRow
                      hover
                      key={event.id}
                      className='cursor-pointer'
                      onClick={() => setSelectedEvent(event)}
                    >
                      <TableCell>{formatDateTime(event.createdAt)}</TableCell>
                      <TableCell>{event.source}</TableCell>
                      <TableCell>{event.module}</TableCell>
                      <TableCell>{event.type}</TableCell>
                      <TableCell>
                        <Chip
                          size='small'
                          label={event.severity}
                          color={
                            event.severity === 'critical'
                              ? 'error'
                              : event.severity === 'error'
                                ? 'warning'
                                : event.severity === 'warning'
                                  ? 'info'
                                  : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell>{event.key || '—'}</TableCell>
                      <TableCell>
                        {event.actorType ? `${event.actorType}${event.actorId ? `#${event.actorId}` : ''}` : '—'}
                      </TableCell>
                      <TableCell>
                        {event.subjectType ? `${event.subjectType}${event.subjectId ? `#${event.subjectId}` : ''}` : '—'}
                      </TableCell>
                      <TableCell className='max-w-[220px] truncate'>{event.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className='flex justify-between items-center mt-4'>
                <Typography variant='body2'>
                  {events.length} {events.length === 1 ? 'event' : 'events'}
                </Typography>
                <div className='flex gap-2 items-center'>
                  {loading && <CircularProgress size={20} />}
                  {nextCursor && (
                    <Button variant='outlined' onClick={() => fetchEvents({ append: true, cursor: nextCursor })} disabled={loading}>
                      {t.loadMore}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedEvent} onClose={() => setSelectedEvent(null)} maxWidth='md' fullWidth>
        {selectedEvent && (
          <>
            <DialogTitle className='flex justify-between items-center'>
              {t.detailsTitle}
              <IconButton size='small' onClick={() => setSelectedEvent(null)}>
                <i className='ri-close-line' />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant='subtitle2' className='mb-2'>
                {selectedEvent.message}
              </Typography>
              <Typography variant='body2' color='text.secondary' className='mb-4'>
                {formatDateTime(selectedEvent.createdAt)} · {selectedEvent.source} → {selectedEvent.module}
              </Typography>
              <Typography variant='subtitle2'>{t.detailsPayload}</Typography>
              <pre className='bg-actionHover rounded p-4 text-sm overflow-auto mbe-4'>{stringifyJson(selectedEvent.payload)}</pre>
              <Typography variant='subtitle2'>{t.detailsMetadata}</Typography>
              <pre className='bg-actionHover rounded p-4 text-sm overflow-auto'>{stringifyJson(selectedEvent.metadata)}</pre>
            </DialogContent>
          </>
        )}
      </Dialog>
    </>
  )
}

export default SystemEvents

'use client'

import { forwardRef, useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react'

import Grid from '@mui/material/Grid2'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField, { type TextFieldProps } from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Skeleton from '@mui/material/Skeleton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'

import { formatDistanceToNow } from 'date-fns'
import { enUS, fr, ru, ar as arLocale } from 'date-fns/locale'
import { useParams } from 'next/navigation'
import { toast } from 'react-toastify'

import { usePermissions } from '@/hooks/usePermissions'
import { useTranslation } from '@/contexts/TranslationContext'
import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'

type EventEntry = {
  id: string
  module: string
  key: string
  userId: string | null
  email: string | null
  ipAddress: string | null
  eventType: 'warning' | 'block'
  mode: 'monitor' | 'enforce'
  count: number
  maxRequests: number
  windowStart: string
  windowEnd: string
  blockedUntil: string | null
  createdAt: string
  user?: {
    id: string
    name?: string | null
    email?: string | null
  } | null
}

type EventListResponse = {
  items: EventEntry[]
  total: number
  nextCursor?: string
}

type ManualBlockForm = {
  module: string
  targetUser: boolean
  targetEmail: boolean
  targetIp: boolean
  userId: string
  email: string
  ipAddress: string
  reason: string
  durationMinutes: string
  notes: string
}

type FilterState = {
  eventType: string
  mode: string
  from: Date | null
  to: Date | null
}

type RateLimitConfigEntry = {
  module?: string | null
}

const DateFilterInput = forwardRef<HTMLInputElement, TextFieldProps>(({ label, ...props }, ref) => (
  <TextField
    fullWidth
    label={label}
    inputRef={ref}
    InputLabelProps={{ shrink: true }}
    {...props}
  />
))
DateFilterInput.displayName = 'DateFilterInput'

const formatDateParam = (date: Date | null) => (date ? date.toISOString() : undefined)

const DEFAULT_MODULES = ['chat', 'ads', 'upload', 'auth', 'email', 'notifications', 'registration']

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

const getModuleLabel = (
  moduleName: string,
  navigation: Record<string, string | undefined>,
  allLabel?: string
) => {
  if (moduleName === 'all') {
    return allLabel || 'All modules'
  }

  const fallbackMap: Record<string, string | undefined> = {
    chat: navigation.chat,
    ads: navigation.ads,
    upload: navigation.upload,
    auth: navigation.auth,
    email: navigation.email,
    notifications: navigation.notifications,
    registration: navigation.registrationModule
  }

  return fallbackMap[moduleName] || moduleName
}

const RateLimitEvents = () => {
  const { checkPermission, isSuperadmin, isLoading: permissionsLoading } = usePermissions()
  const dictionary = useTranslation()
  const params = useParams()
  const langParam = typeof params?.lang === 'string' ? params.lang : Array.isArray(params?.lang) ? params.lang[0] : undefined
  const localeMap = {
    en: enUS,
    fr,
    ru,
    ar: arLocale
  }
  const dateFnsLocale = localeMap[(langParam as keyof typeof localeMap) ?? 'en'] ?? enUS

  const [events, setEvents] = useState<EventEntry[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [totalEvents, setTotalEvents] = useState(0)
  const [modules, setModules] = useState<string[]>(DEFAULT_MODULES)
  const [activeModuleTab, setActiveModuleTab] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null)
  const [manualBlockDialogOpen, setManualBlockDialogOpen] = useState(false)
  const [creatingBlock, setCreatingBlock] = useState(false)
  const [manualBlockForm, setManualBlockForm] = useState<ManualBlockForm>({
    module: 'all',
    targetUser: true,
    targetEmail: false,
    targetIp: false,
    userId: '',
    email: '',
    ipAddress: '',
    reason: '',
    durationMinutes: '60',
    notes: ''
  })
  const [filters, setFilters] = useState<FilterState>({
    eventType: 'all',
    mode: 'all',
    from: null,
    to: null
  })

  const t = dictionary.rateLimitEvents ?? {}
  const formatRelativeTime = useCallback(
    (value?: string | null) => {
      if (!value) return null
      try {
        return formatDistanceToNow(new Date(value), { addSuffix: true, locale: dateFnsLocale })
      } catch {
        return null
      }
    },
    [dateFnsLocale]
  )
  const renderEventSkeletonRows = () => (
    <>
      {[0, 1, 2].map(index => (
        <TableRow key={`event-skeleton-${index}`}>
          <TableCell>
            <Skeleton width={140} />
          </TableCell>
          <TableCell>
            <Skeleton width={120} />
            <Skeleton width={100} />
          </TableCell>
          <TableCell>
            <Skeleton width={110} />
            <Skeleton width={90} />
          </TableCell>
          <TableCell>
            <Skeleton width={80} />
          </TableCell>
          <TableCell>
            <Skeleton width={100} />
          </TableCell>
          <TableCell>
            <Skeleton width={120} />
          </TableCell>
          <TableCell>
            <Skeleton width={140} />
          </TableCell>
          <TableCell align='right'>
            <Skeleton width={100} height={36} />
          </TableCell>
        </TableRow>
      ))}
    </>
  )

  const renderFiltersSkeleton = () => (
    <Grid size={{ xs: 12 }}>
      <Card>
        <CardHeader
          title={<Skeleton width='40%' />}
          subheader={<Skeleton width='60%' />}
          action={<Skeleton variant='rectangular' width={180} height={36} />}
        />
        <CardContent>
          <Grid container spacing={4}>
            {[0, 1, 2, 3, 4, 5].map(index => (
              <Grid key={`filter-skeleton-${index}`} size={{ xs: 12, md: 3 }}>
                <Skeleton height={56} />
              </Grid>
            ))}
            <Grid size={{ xs: 12, md: 3 }}>
              <Skeleton height={38} width={140} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Grid>
  )
  const navigationLabels = dictionary.navigation ?? {}

  const hasAccess = isSuperadmin || checkPermission('rateLimitManagement', 'read')
  const canModify =
    isSuperadmin ||
    checkPermission('rateLimitManagement', 'update') ||
    checkPermission('rateLimitManagement', 'delete')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400)
    return () => clearTimeout(timer)
  }, [search])

  const fetchModules = useCallback(async () => {
    if (permissionsLoading || !hasAccess) {
      return
    }

    try {
      const response = await fetch('/api/admin/rate-limits')
      if (!response.ok) {
        throw new Error('Failed to load configs')
      }

      const data = await response.json().catch(() => null)
      if (Array.isArray(data?.configs) && data.configs.length) {
        const configs = data.configs as RateLimitConfigEntry[]
        const moduleNames = configs.reduce<string[]>((acc, config) => {
          if (typeof config.module === 'string' && config.module.length > 0) {
            acc.push(config.module)
          }
          return acc
        }, [])
        const uniqueModules = Array.from(new Set<string>(moduleNames))
        if (uniqueModules.length) {
          setModules(uniqueModules)
          setManualBlockForm(prev => ({
            ...prev,
            module: uniqueModules[0] || prev.module
          }))
        }
      }
    } catch (error) {
      console.error(error)
    }
  }, [hasAccess, permissionsLoading])

  useEffect(() => {
    fetchModules()
  }, [fetchModules])

  const fetchEvents = useCallback(
    async ({ append = false, cursor }: { append?: boolean; cursor?: string } = {}) => {
      if (permissionsLoading || !hasAccess) {
        return
      }

      setLoading(true)

      try {
        const params = new URLSearchParams()
        const moduleFilter = activeModuleTab
        if (moduleFilter !== 'all') {
          params.set('module', moduleFilter)
        }
        if (filters.eventType !== 'all') {
          params.set('eventType', filters.eventType)
        }
        if (filters.mode !== 'all') {
          params.set('mode', filters.mode)
        }
        const fromParam = formatDateParam(filters.from)
        const toParam = formatDateParam(filters.to)
        if (fromParam) {
          params.set('from', fromParam)
        }
        if (toParam) {
          params.set('to', toParam)
        }
        if (debouncedSearch) {
          params.set('search', debouncedSearch)
        }
        if (cursor) {
          params.set('cursor', cursor)
        }
        params.set('limit', '25')

        const response = await fetch(`/api/admin/rate-limits/events?${params.toString()}`, {
          credentials: 'include'
        })
        if (!response.ok) {
          throw new Error('Failed to load events')
        }

        const data: EventListResponse = await response.json()

        setEvents(prev => (append ? [...prev, ...data.items] : data.items))
        setNextCursor(data.nextCursor)
        setTotalEvents(data.total)
      } catch (error) {
        console.error(error)
        toast.error(t.loadError || 'Failed to load events')
      } finally {
        setLoading(false)
        setInitialLoading(false)
      }
    },
    [activeModuleTab, debouncedSearch, filters, hasAccess, permissionsLoading, t.loadError]
  )

  useEffect(() => {
    fetchEvents({ append: false })
  }, [fetchEvents])

  const resetFilters = () => {
    setFilters({
      eventType: 'all',
      mode: 'all',
      from: null,
      to: null
    })
    setSearch('')
  }

  const openManualBlockDialog = (prefill?: Partial<ManualBlockForm>) => {
    setManualBlockForm({
      module: prefill?.module ?? 'all',
      targetUser: prefill?.targetUser ?? true,
      targetEmail: prefill?.targetEmail ?? false,
      targetIp: prefill?.targetIp ?? false,
      userId: prefill?.userId ?? '',
      email: prefill?.email ?? '',
      ipAddress: prefill?.ipAddress ?? '',
      reason: prefill?.reason ?? '',
      durationMinutes: prefill?.durationMinutes ?? '60',
      notes: prefill?.notes ?? ''
    })
    setManualBlockDialogOpen(true)
  }

  const closeManualBlockDialog = () => {
    if (creatingBlock) {
      return
    }

    setManualBlockDialogOpen(false)
    setManualBlockForm({
      module: 'all',
      targetUser: true,
      targetEmail: false,
      targetIp: false,
      userId: '',
      email: '',
      ipAddress: '',
      reason: '',
      durationMinutes: '60',
      notes: ''
    })
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!canModify) {
      return
    }

    setDeleteEventId(eventId)
    try {
      const response = await fetch(`/api/admin/rate-limits/events/${eventId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete event')
      }

      toast.success(t.deleteSuccess || 'Event removed')
      setEvents(prev => prev.filter(event => event.id !== eventId))
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : t.deleteError || 'Failed to delete event')
    } finally {
      setDeleteEventId(null)
    }
  }

  const handleManualBlockChange = (field: keyof ManualBlockForm, value: ManualBlockForm[keyof ManualBlockForm]) => {
    setManualBlockForm(prev => ({
      ...prev,
      ...((field === 'targetUser' || field === 'targetEmail' || field === 'targetIp') && value === true
        ? {
            targetUser: field === 'targetUser',
            targetEmail: field === 'targetEmail',
            targetIp: field === 'targetIp'
          }
        : {}),
      [field]: value
    }))
  }

  const submitManualBlock = async () => {
    if (!canModify) {
      return
    }

    const { module, targetUser, targetEmail, targetIp, userId, email, ipAddress, reason, durationMinutes, notes } = manualBlockForm

    if (!module) {
      toast.error(t.manualBlockValidationModule || 'Module is required')
      return
    }

    if (!reason.trim()) {
      toast.error(t.manualBlockValidationReason || 'Reason is required')
      return
    }

    if (!targetUser && !targetEmail && !targetIp) {
      toast.error(t.manualBlockValidationTarget || 'Select at least one target (user, email, IP)')
      return
    }

    if (targetUser && !userId.trim()) {
      toast.error(t.manualBlockValidationUser || 'User ID is required')
      return
    }

    if (targetEmail && !email.trim()) {
      toast.error(t.manualBlockValidationEmail || 'Email is required')
      return
    }

    if (targetIp && !ipAddress.trim()) {
      toast.error(t.manualBlockValidationIp || 'IP address is required')
      return
    }

    const duration = Number(durationMinutes)
    if (durationMinutes && (Number.isNaN(duration) || duration < 0)) {
      toast.error(t.manualBlockValidationDuration || 'Duration must be a positive number')
      return
    }

    setCreatingBlock(true)

    try {
      const response = await fetch('/api/admin/rate-limits/blocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          module,
          targetType: targetUser ? 'user' : targetEmail ? 'email' : targetIp ? 'ip' : 'user',
          userId: targetUser ? userId.trim() || undefined : undefined,
          email: targetEmail ? email.trim() || undefined : undefined,
          ipAddress: targetIp ? ipAddress.trim() || undefined : undefined,
          reason: reason.trim(),
          durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
          notes
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create block')
      }

      toast.success(t.manualBlockSuccess || 'Manual block created')
      closeManualBlockDialog()
      fetchEvents({ append: false })
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : t.manualBlockError || 'Failed to create block')
    } finally {
      setCreatingBlock(false)
    }
  }

  const eventRows = useMemo(() => events, [events])

  const moduleOptions = useMemo(() => ['all', ...modules], [modules])
  const handleModuleTabChange = (_event: SyntheticEvent, value: string) => {
    setActiveModuleTab(value)
    setEvents([])
    setNextCursor(undefined)
    fetchEvents({ append: false })
  }

  return (
    <>
      <Grid container spacing={6}>
        {initialLoading ? (
          renderFiltersSkeleton()
        ) : (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader
                title={
                  t.title ||
                  dictionary.navigation.rateLimitEvents ||
                  dictionary.navigation.rateLimitManagement
                }
                subheader={t.description || 'Inspect warning/block events and manage manual bans.'}
                action={
                  <Box className='flex flex-wrap gap-2'>
                    <Button
                      variant='outlined'
                      startIcon={<i className='ri-refresh-line' />}
                      onClick={() => fetchEvents({ append: false })}
                      disabled={loading}
                    >
                      {t.refresh || 'Refresh'}
                    </Button>
                    {canModify ? (
                      <Button
                        variant='contained'
                        startIcon={<i className='ri-user-forbid-line' />}
                        onClick={() => openManualBlockDialog({ module: activeModuleTab })}
                      >
                        {t.manualBlockButton || 'Manual block'}
                      </Button>
                    ) : null}
                  </Box>
                }
              />
              <CardContent className='flex flex-col gap-4'>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs
                    value={activeModuleTab}
                    onChange={handleModuleTabChange}
                    variant='scrollable'
                    scrollButtons='auto'
                  >
                    {moduleOptions.map(option => (
                      <Tab
                        key={option}
                        value={option}
                        label={option === 'all' ? (t.filterModuleAll || 'All modules') : getModuleLabel(option, navigationLabels)}
                      />
                    ))}
                  </Tabs>
                </Box>
                <Grid container spacing={4}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    select
                    fullWidth
                    label={t.filterEventType || 'Event type'}
                    value={filters.eventType}
                    onChange={event => setFilters(prev => ({ ...prev, eventType: event.target.value }))}
                  >
                    <MenuItem value='all'>{t.filterEventAll || 'All events'}</MenuItem>
                    <MenuItem value='warning'>{t.filterEventWarning || 'Warnings'}</MenuItem>
                    <MenuItem value='block'>{t.filterEventBlock || 'Blocks'}</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    select
                    fullWidth
                    label={t.filterMode || 'Mode'}
                    value={filters.mode}
                    onChange={event => setFilters(prev => ({ ...prev, mode: event.target.value }))}
                  >
                    <MenuItem value='all'>{t.filterModeAll || 'All modes'}</MenuItem>
                    <MenuItem value='monitor'>{t.filterModeMonitor || 'Monitoring'}</MenuItem>
                    <MenuItem value='enforce'>{t.filterModeEnforce || 'Blocking'}</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    label={t.searchPlaceholder || 'Search user, IP or email'}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <AppReactDatepicker
                    selected={filters.from}
                    maxDate={filters.to || undefined}
                    isClearable
                    customInput={<DateFilterInput label={t.filterFrom || 'From'} />}
                    onChange={(date: Date | null) => setFilters(prev => ({ ...prev, from: date }))}
                  />
                </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <AppReactDatepicker
                      selected={filters.to}
                      minDate={filters.from || undefined}
                      isClearable
                      customInput={<DateFilterInput label={t.filterTo || 'To'} />}
                      onChange={(date: Date | null) => setFilters(prev => ({ ...prev, to: date }))}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Button variant='text' color='secondary' onClick={resetFilters}>
                      {t.resetFilters || 'Reset filters'}
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardHeader
              title={t.tableTitle || 'Events'}
              subheader={
                t.tableSubtitle
                  ? t.tableSubtitle.replace('${count}', totalEvents.toString())
                  : `Total events: ${totalEvents}`
              }
            />
            {loading && !initialLoading ? <LinearProgress /> : null}
            <CardContent className='p-0'>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t.columnCreatedAt || 'Timestamp'}</TableCell>
                    <TableCell>{t.columnActor || 'User / Key'}</TableCell>
                    <TableCell>{t.columnModule || 'Module'}</TableCell>
                    <TableCell>{t.columnEvent || 'Event'}</TableCell>
                    <TableCell>{t.columnUsage || 'Usage'}</TableCell>
                    <TableCell>{t.columnIp || 'IP'}</TableCell>
                    <TableCell>{t.columnBlockedUntil || 'Blocked until'}</TableCell>
                    <TableCell align='right'>{t.columnActions || 'Actions'}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {initialLoading ? (
                    renderEventSkeletonRows()
                  ) : (
                    <>
                      {eventRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8}>
                            <Box className='flex flex-col items-center gap-2 py-10 text-center'>
                              <i className='ri-time-line text-4xl text-textSecondary' />
                              <Typography color='text.secondary'>
                                {t.noData || 'No events for selected filters.'}
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {eventRows.map(event => {
                        const displayName =
                          event.user?.name ||
                          event.user?.email ||
                          (event.userId ? `${t.userIdLabel || 'User'}: ${event.userId}` : '')
                    const displayKey = event.key || event.userId || event.email || event.ipAddress || '—'
                    const isBlock = event.eventType === 'block'
                    const blockedUntilLabel = event.blockedUntil
                      ? formatRelativeTime(event.blockedUntil) || '—'
                      : '—'
                    const usageLabel = `${event.count.toLocaleString()} / ${event.maxRequests.toLocaleString()}`

                    return (
                      <TableRow key={event.id}>
                        <TableCell>
                          <Typography variant='body2'>{formatDateTime(event.createdAt)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant='subtitle2'>{displayName || '—'}</Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {displayKey}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography>
                            {event.module === 'all'
                              ? (t.filterModuleAll || 'All modules')
                              : getModuleLabel(event.module, navigationLabels)}
                          </Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {event.mode === 'monitor'
                              ? t.modeMonitorLabel || 'Monitoring'
                              : t.modeEnforceLabel || 'Blocking'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size='small'
                            color={isBlock ? 'error' : 'warning'}
                            variant='tonal'
                            label={
                              isBlock
                                ? t.eventTypeBlock || 'Block'
                                : t.eventTypeWarning || 'Warning'
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2'>{usageLabel}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2'>{event.ipAddress || '—'}</Typography>
                        </TableCell>
                        <TableCell>
                          {event.blockedUntil ? (
                            <Tooltip title={formatDateTime(event.blockedUntil)}>
                              <Chip
                                size='small'
                                color='error'
                                variant='tonal'
                                label={blockedUntilLabel}
                              />
                            </Tooltip>
                          ) : (
                            <Typography variant='body2'>
                              {event.mode === 'monitor'
                                ? t.monitorNoBlock || 'Monitoring'
                                : t.blockedUntilNotSet || 'Not scheduled'}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align='right'>
                          <Box className='flex items-center justify-end gap-1'>
                            {canModify ? (
                              <Tooltip title={t.prefillBlock || 'Block user/IP'}>
                                <span>
                                  <IconButton
                                    size='small'
                                    onClick={() =>
                                      openManualBlockDialog({
                                        module: event.module,
                                        targetUser: Boolean(event.userId),
                                        targetEmail: Boolean(event.email),
                                        targetIp: Boolean(event.ipAddress),
                                        userId: event.userId || '',
                                        email: event.email || '',
                                        ipAddress: event.ipAddress || '',
                                        reason:
                                          event.eventType === 'warning'
                                            ? t.prefillReasonWarning || 'Warning threshold reached'
                                            : t.prefillReasonBlock || 'User blocked by rate limit',
                                        durationMinutes: manualBlockForm.durationMinutes
                                      })
                                    }
                                  >
                                    <i className='ri-user-forbid-line' />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            ) : null}
                            {canModify ? (
                              <Tooltip title={t.deleteEvent || 'Delete event'}>
                                <span>
                                  <IconButton
                                    size='small'
                                    color='error'
                                    disabled={deleteEventId === event.id}
                                    onClick={() => handleDeleteEvent(event.id)}
                                  >
                                    {deleteEventId === event.id ? (
                                      <CircularProgress size={16} />
                                    ) : (
                                      <i className='ri-delete-bin-line' />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            ) : null}
                          </Box>
                        </TableCell>
                      </TableRow>
                    )
                      })}
                    </>
                  )}
                </TableBody>
              </Table>
              {loading && initialLoading ? (
                <Box className='flex justify-center py-10'>
                  <CircularProgress />
                </Box>
              ) : null}
              <Divider />
              <Box className='flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between'>
                <Typography variant='body2' color='text.secondary'>
                  {t.viewingLabel
                    ? t.viewingLabel
                        .replace('${count}', events.length.toString())
                        .replace('${total}', totalEvents.toString())
                    : `Showing ${events.length} of ${totalEvents}`}
                </Typography>
                {nextCursor ? (
                  <Button
                    variant='contained'
                    startIcon={<i className='ri-arrow-down-line' />}
                    onClick={() => fetchEvents({ append: true, cursor: nextCursor })}
                    disabled={loading}
                  >
                    {t.loadMore || 'Load more'}
                  </Button>
                ) : null}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={manualBlockDialogOpen} onClose={closeManualBlockDialog} fullWidth maxWidth='sm'>
        <DialogTitle>{t.manualBlockDialogTitle || 'Manual block'}</DialogTitle>
        <DialogContent className='flex flex-col gap-4'>
          <TextField
            select
            label={t.filterModule || 'Module'}
            value={manualBlockForm.module}
            onChange={event => handleManualBlockChange('module', event.target.value)}
            fullWidth
          >
            {moduleOptions.map(option => (
              <MenuItem key={option} value={option}>
                {option === 'all'
                  ? (t.filterModuleAll || 'All modules')
                  : getModuleLabel(option, navigationLabels)}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={manualBlockForm.targetUser}
                  onChange={event => handleManualBlockChange('targetUser', event.target.checked)}
                />
              }
              label={t.manualBlockTargetUser || 'User ID'}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={manualBlockForm.targetEmail}
                  onChange={event => handleManualBlockChange('targetEmail', event.target.checked)}
                />
              }
              label={t.manualBlockTargetEmail || 'Email'}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={manualBlockForm.targetIp}
                  onChange={event => handleManualBlockChange('targetIp', event.target.checked)}
                />
              }
              label={t.manualBlockTargetIp || 'IP address'}
            />
          </Box>
          {manualBlockForm.targetEmail ? (
            <TextField
              label={t.manualBlockEmailLabel || 'Email'}
              value={manualBlockForm.email}
              onChange={event => handleManualBlockChange('email', event.target.value)}
              fullWidth
            />
          ) : null}
          {manualBlockForm.targetIp ? (
            <TextField
              label={t.manualBlockIpLabel || 'IP address'}
              value={manualBlockForm.ipAddress}
              onChange={event => handleManualBlockChange('ipAddress', event.target.value)}
              fullWidth
            />
          ) : null}
          {manualBlockForm.targetUser ? (
            <TextField
              label={t.manualBlockUserLabel || 'User ID'}
              value={manualBlockForm.userId}
              onChange={event => handleManualBlockChange('userId', event.target.value)}
              fullWidth
            />
          ) : null}
          <TextField
            label={t.manualBlockReasonLabel || 'Reason'}
            value={manualBlockForm.reason}
            onChange={event => handleManualBlockChange('reason', event.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
          <TextField
            label={t.manualBlockDurationLabel || 'Duration (minutes)'}
            type='number'
            value={manualBlockForm.durationMinutes}
            onChange={event => handleManualBlockChange('durationMinutes', event.target.value)}
            helperText={
              t.manualBlockDurationHint ||
              'Leave empty or set 0 for indefinite block.'
            }
            fullWidth
          />
          <TextField
            label={t.manualBlockNotes || 'Notes'}
            value={manualBlockForm.notes}
            onChange={event => handleManualBlockChange('notes', event.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button variant='outlined' onClick={closeManualBlockDialog} disabled={creatingBlock}>
            {t.manualBlockCancel || dictionary.navigation.cancel || 'Cancel'}
          </Button>
          <Button variant='contained' onClick={submitManualBlock} disabled={creatingBlock}>
            {creatingBlock ? t.manualBlockSaving || 'Saving...' : t.manualBlockSave || 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default RateLimitEvents

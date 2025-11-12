'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import Grid from '@mui/material/Grid2'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import CustomAvatar from '@core/components/mui/Avatar'

import { formatDistanceToNow } from 'date-fns'
import { toast } from 'react-toastify'

import { usePermissions } from '@/hooks/usePermissions'
import { useTranslation } from '@/contexts/TranslationContext'
import type { ThemeColor } from '@core/types'

type RateLimitConfig = {
  module: string
  maxRequests: number
  windowMs: number
  blockMs?: number | null
  warnThreshold?: number | null
  isActive?: boolean | null
}

type RateLimitStats = {
  module: string
  config: RateLimitConfig
  totalRequests: number
  blockedCount: number
  activeWindows: number
}

type RateLimitStateEntry = {
  id: string
  key: string
  module: string
  count: number
  windowStart: string
  windowEnd: string
  blockedUntil?: string | null
  remaining: number
  config: RateLimitConfig
  source: 'state' | 'manual'
  user?: {
    id: string
    name?: string | null
    email?: string | null
  } | null
  activeBlock?: {
    id: string
    reason: string
    blockedAt: string
    unblockedAt?: string | null
  } | null
}

type ModuleDetailRow = {
  label: string
  value: string
  icon: string
  color: ThemeColor
}

type RateLimitStatesResponse = {
  items: RateLimitStateEntry[]
  total: number
  nextCursor?: string
}

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

const isEntryBlocked = (entry: RateLimitStateEntry): boolean => {
  const now = Date.now()

  if (entry.blockedUntil) {
    return new Date(entry.blockedUntil).getTime() > now
  }

  if (entry.activeBlock?.unblockedAt) {
    return new Date(entry.activeBlock.unblockedAt).getTime() > now
  }

  return Boolean(entry.activeBlock)
}

const getModuleLabel = (
  moduleName: string,
  navigation: Record<string, string | undefined>
): string => {
  const fallbackMap: Record<string, string | undefined> = {
    chat: navigation.chat,
    ads: navigation.ads,
    upload: navigation.upload,
    auth: navigation.auth,
    email: navigation.email,
    notifications: navigation.notifications
  }

  return fallbackMap[moduleName] || moduleName
}

const formatUsagePercentage = (count: number, max: number) => {
  if (!max) {
    return 0
  }

  return Math.min(100, Math.round((count / max) * 100))
}

const RateLimitManagement = () => {
  const { checkPermission, isSuperadmin } = usePermissions()
  const dictionary = useTranslation()

  const [states, setStates] = useState<RateLimitStateEntry[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [onlyBlocked, setOnlyBlocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [summary, setSummary] = useState<{ configs: RateLimitConfig[]; stats: RateLimitStats[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [clearingId, setClearingId] = useState<string | null>(null)
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [configForm, setConfigForm] = useState({
    module: '',
    maxRequests: '',
    windowMinutes: '',
    blockMinutes: '',
    warnThreshold: ''
  })
  const [savingConfig, setSavingConfig] = useState(false)
  const [statusSavingModule, setStatusSavingModule] = useState<string | null>(null)

  const hasAccess = isSuperadmin || checkPermission('rateLimitManagement', 'read')
  const canModify =
    isSuperadmin ||
    checkPermission('rateLimitManagement', 'update') ||
    checkPermission('rateLimitManagement', 'delete')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400)

    return () => clearTimeout(timer)
  }, [search])

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/rate-limits', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load summary')
      }

      const data = await response.json()
      setSummary({
        configs: data.configs ?? [],
        stats: (data.stats ?? []).filter(Boolean)
      })
    } catch (err) {
      console.error(err)
      toast.error(dictionary.rateLimit?.loadSummaryError ?? 'Failed to load rate limit summary')
    }
  }, [dictionary.rateLimit?.loadSummaryError])

  const fetchStates = useCallback(
    async (options?: { cursor?: string; append?: boolean }) => {
      try {
        if (!options?.append) {
          setLoading(true)
        }

        setError(null)
        const params = new URLSearchParams({
          view: 'states',
          limit: '25'
        })

        if (moduleFilter !== 'all') {
          params.set('module', moduleFilter)
        }

        if (options?.cursor) {
          params.set('cursor', options.cursor)
        }

        if (debouncedSearch) {
          params.set('search', debouncedSearch)
        }

        const response = await fetch(`/api/admin/rate-limits?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error('Failed to load rate limit states')
        }

        const data: RateLimitStatesResponse = await response.json()
        setNextCursor(data.nextCursor)
        setTotalCount(data.total)

        if (options?.append) {
          setStates(prev => [...prev, ...data.items])
        } else {
          setStates(data.items)
        }
      } catch (err) {
        console.error(err)
        setError(dictionary.rateLimit?.loadError ?? 'Failed to load rate limit data')
        toast.error(dictionary.rateLimit?.loadError ?? 'Failed to load rate limit data')
      } finally {
        setLoading(false)
        setInitialLoading(false)
      }
    },
    [debouncedSearch, dictionary.rateLimit?.loadError, moduleFilter]
  )

  useEffect(() => {
    if (!hasAccess) {
      return
    }

    fetchSummary()
  }, [fetchSummary, hasAccess])

  useEffect(() => {
    if (!hasAccess) {
      return
    }

    setInitialLoading(true)
    fetchStates({ append: false })
  }, [fetchStates, hasAccess])

  const visibleStates = useMemo(() => {
    if (!onlyBlocked) {
      return states
    }

    return states.filter(entry => isEntryBlocked(entry))
  }, [onlyBlocked, states])

  const moduleOptions = useMemo(() => {
    const fromSummary = summary?.configs?.map(config => config.module) ?? []
    const fromStates = states.map(state => state.module)

    return Array.from(new Set([...fromSummary, ...fromStates])).sort()
  }, [states, summary?.configs])

  const statsMap = useMemo(() => {
    if (!summary?.stats) {
      return new Map<string, RateLimitStats>()
    }

    return new Map(summary.stats.map(stat => [stat.module, stat]))
  }, [summary?.stats])

  const modulesToRender = useMemo(() => {
    if (summary?.configs?.length) {
      return summary.configs
    }

    return summary?.stats?.map(stat => stat.config) ?? []
  }, [summary?.configs, summary?.stats])

  const openConfigDialog = useCallback((config: RateLimitConfig) => {
    if (!canModify) return

    setConfigForm({
      module: config.module,
      maxRequests: config.maxRequests ? String(config.maxRequests) : '',
      windowMinutes: String(Math.max(1, Math.round((config.windowMs || 60000) / 60000))),
      blockMinutes: String(Math.max(1, Math.round(((config.blockMs ?? config.windowMs) || 60000) / 60000))),
      warnThreshold: config.warnThreshold != null ? String(config.warnThreshold) : ''
    })
    setConfigDialogOpen(true)
  }, [canModify])

  const closeConfigDialog = useCallback(() => {
    if (savingConfig) return
    setConfigDialogOpen(false)
  }, [savingConfig])

  const handleClearState = async (stateId: string) => {
    if (!canModify) {
      return
    }

    setClearingId(stateId)

    try {
      const response = await fetch(`/api/admin/rate-limits/${stateId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to clear rate limit state')
      }

      toast.success(dictionary.rateLimit?.clearSuccess ?? 'Rate limit has been reset')
      await fetchStates({ append: false })
    } catch (err) {
      console.error(err)
      toast.error(dictionary.rateLimit?.clearError ?? 'Failed to reset rate limit')
    } finally {
      setClearingId(null)
    }
  }

  const handleConfigInputChange = (field: keyof typeof configForm, value: string) => {
    setConfigForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSaveConfig = async () => {
    if (!canModify) {
      return
    }

    if (!configForm.module) {
      toast.error(dictionary.rateLimit?.configValidationError || 'Module not selected')
      return
    }

    const maxRequests = Number(configForm.maxRequests)
    const windowMinutes = Number(configForm.windowMinutes)
    const blockMinutes = Number(configForm.blockMinutes)
    const warnThreshold = configForm.warnThreshold ? Number(configForm.warnThreshold) : 0

    if (
      !Number.isFinite(maxRequests) || maxRequests <= 0 ||
      !Number.isFinite(windowMinutes) || windowMinutes <= 0 ||
      !Number.isFinite(blockMinutes) || blockMinutes <= 0
    ) {
      toast.error(dictionary.rateLimit?.configValidationError || 'Please provide valid positive numbers')
      return
    }

    setSavingConfig(true)

    try {
      const response = await fetch('/api/admin/rate-limits', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          module: configForm.module,
          maxRequests,
          windowMs: windowMinutes * 60000,
          blockMs: blockMinutes * 60000,
          warnThreshold: Number.isFinite(warnThreshold) && warnThreshold >= 0 ? warnThreshold : 0
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update config')
      }

      toast.success(dictionary.rateLimit?.configUpdateSuccess || 'Rate limit updated')
      setConfigDialogOpen(false)
      await fetchSummary()
    } catch (err) {
      console.error(err)
      toast.error(dictionary.rateLimit?.configUpdateError || 'Failed to update rate limit')
    } finally {
      setSavingConfig(false)
    }
  }

  const handleToggleModuleStatus = async (moduleName: string, nextStatus: boolean) => {
    if (!canModify) return

    setStatusSavingModule(moduleName)

    try {
      const response = await fetch('/api/admin/rate-limits', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          module: moduleName,
          isActive: nextStatus
        })
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || t.configStatusError || 'Failed to update status')
      }

      toast.success(t.configStatusSuccess || 'Rate limit status updated')
      await fetchSummary()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : t.configStatusError || 'Failed to update status')
    } finally {
      setStatusSavingModule(null)
    }
  }

  if (!hasAccess) {
    return (
      <Alert severity='warning'>
        {dictionary.rateLimit?.noAccess ?? 'You do not have access to this section.'}
      </Alert>
    )
  }

  const t = dictionary.rateLimit ?? {}

  return (
    <>
      <Grid container spacing={6}>
        <Grid size={{ xs: 12 }}>
          <Box className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <Typography variant='h4' className='mbe-1'>
                {t.title || dictionary.navigation.rateLimitManagement}
              </Typography>
              <Typography color='text.secondary'>
                {t.description || 'Monitor throttling windows, active blocks, and reset users when needed.'}
              </Typography>
            </div>
            <Button
              variant='outlined'
              startIcon={<i className='ri-refresh-line' />}
              onClick={() => {
                fetchSummary()
                fetchStates({ append: false })
              }}
              disabled={loading}
            >
              {t.refresh || 'Refresh'}
            </Button>
          </Box>
        </Grid>

        {modulesToRender.length ? (
          <Grid size={{ xs: 12 }}>
            <Grid container spacing={4}>
              {modulesToRender.map(config => {
                const moduleLabel = getModuleLabel(config.module, dictionary.navigation)
                const stat = statsMap.get(config.module)
                const windowMinutes = Math.max(1, Math.round((config.windowMs || 60000) / 60000))
                const blockMinutes = Math.max(1, Math.round(((config.blockMs ?? config.windowMs) || 60000) / 60000))
                const warnThresholdDisplay = config.warnThreshold ?? 0
                const isActive = config.isActive ?? true
                const statusLabel = isActive ? (t.configStatusActive || 'Active') : (t.configStatusInactive || 'Inactive')
                const minutesLabel = t.minutesShort || 'min'
                const warnValue =
                  warnThresholdDisplay > 0
                    ? warnThresholdDisplay.toLocaleString()
                    : t.configWarnDisabled || 'Disabled'

                const detailRows: ModuleDetailRow[] = [
                  {
                    label: t.configStatusLabel || 'Status',
                    value: statusLabel,
                    icon: isActive ? 'ri-checkbox-circle-line' : 'ri-close-circle-line',
                    color: isActive ? 'success' : 'secondary'
                  },
                  {
                    label: t.configMaxRequests || 'Max requests',
                    value: config.maxRequests.toLocaleString(),
                    icon: 'ri-speed-up-line',
                    color: 'primary'
                  },
                  {
                    label: t.configWindowMinutes || 'Window (minutes)',
                    value: `${windowMinutes} ${minutesLabel}`,
                    icon: 'ri-timer-line',
                    color: 'info'
                  },
                  {
                    label: t.configBlockMinutes || 'Block duration (minutes)',
                    value: `${blockMinutes} ${minutesLabel}`,
                    icon: 'ri-lock-time-line',
                    color: 'warning'
                  },
                  {
                    label: t.configWarnThreshold || 'Warning threshold',
                    value: warnValue,
                    icon: 'ri-alert-line',
                    color: 'error'
                  }
                ]

                return (
                  <Grid key={config.module} size={{ xs: 12, md: 4 }}>
                    <Card className='h-full flex flex-col'>
                      <CardHeader
                        title={moduleLabel}
                        subheader={t.summaryHeading || 'Module summary'}
                        action={
                          canModify ? (
                            <div className='flex items-center gap-1'>
                              <Tooltip title={statusLabel}>
                                <Switch
                                  checked={isActive}
                                  onChange={(_, checked) => handleToggleModuleStatus(config.module, checked)}
                                  size='small'
                                  disabled={statusSavingModule === config.module}
                                  inputProps={{ 'aria-label': statusLabel }}
                                />
                              </Tooltip>
                              <Tooltip title={t.configEditButton || 'Edit limits'}>
                                <IconButton
                                  color='primary'
                                  size='small'
                                  onClick={() => openConfigDialog(config)}
                                  disabled={statusSavingModule === config.module}
                                >
                                  <i className='ri-edit-line' />
                                </IconButton>
                              </Tooltip>
                            </div>
                          ) : (
                            <Chip
                              size='small'
                              variant='tonal'
                              color={isActive ? 'success' : 'secondary'}
                              label={statusLabel}
                            />
                          )
                        }
                      />
                      <CardContent className='flex flex-col gap-5 grow'>
                        <div className='flex flex-wrap justify-between gap-4'>
                          <div>
                            <Typography variant='h4'>
                              {stat ? stat.totalRequests.toLocaleString() : '—'}
                            </Typography>
                            <Typography variant='body2' color='text.secondary'>
                              {t.summaryRequests || 'Requests per window'}
                            </Typography>
                          </div>
                          <div className='flex flex-col items-end gap-1'>
                            <Chip
                              variant='tonal'
                              color={stat && stat.blockedCount ? 'error' : 'success'}
                              label={`${(stat?.blockedCount ?? 0).toLocaleString()} ${t.summaryBlocked || 'Blocked users'}`}
                              size='small'
                            />
                            <Typography variant='caption' color='text.secondary'>
                              {(t.summaryWindows || 'Active windows') + ': ' + (stat ? stat.activeWindows : 0)}
                            </Typography>
                          </div>
                        </div>
                        <Divider />
                        <div className='flex flex-col gap-4'>
                          {detailRows.map(row => (
                            <div key={row.label} className='flex items-center gap-3'>
                              <CustomAvatar skin='light' color={row.color} variant='rounded'>
                                <i className={row.icon} />
                              </CustomAvatar>
                              <div className='flex items-center justify-between gap-4 is-full'>
                                <Typography className='font-medium' color='text.primary'>
                                  {row.label}
                                </Typography>
                                <Typography className='font-semibold' color='text.primary'>
                                  {row.value}
                                </Typography>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>
          </Grid>
        ) : null}

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={t.blockListTitle || 'Rate limit states'}
            subheader={t.blockListSubtitle || 'Active windows, queued messages and manual blocks'}
          />
          {loading && (
            <LinearProgress color='primary' />
          )}
          <CardContent className='flex flex-col gap-4'>
            <Box className='flex flex-col gap-4 lg:flex-row lg:items-end'>
              <TextField
                label={t.searchPlaceholder || 'Search user, id or IP'}
                placeholder='cmhr...'
                value={search}
                onChange={event => setSearch(event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position='start'>
                      <i className='ri-search-2-line text-textSecondary' />
                    </InputAdornment>
                  )
                }}
                className='flex-1 min-w-[200px]'
              />
              <FormControl className='min-w-[160px]'>
                <InputLabel>{t.moduleFilter || 'Module'}</InputLabel>
                <Select
                  value={moduleFilter}
                  label={t.moduleFilter || 'Module'}
                  onChange={event => setModuleFilter(event.target.value)}
                >
                  <MenuItem value='all'>{t.moduleAll || 'All modules'}</MenuItem>
                  {moduleOptions.map(module => (
                    <MenuItem key={module} value={module}>
                      {getModuleLabel(module, dictionary.navigation)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Switch checked={onlyBlocked} onChange={(_, checked) => setOnlyBlocked(checked)} />
                }
                label={t.onlyBlocked || 'Only blocked'}
              />
            </Box>

            {error ? (
              <Alert severity='error'>{error}</Alert>
            ) : null}

            {initialLoading && !visibleStates.length ? (
              <Box className='py-16 flex justify-center'>
                <CircularProgress />
              </Box>
            ) : null}

            {!visibleStates.length && !initialLoading ? (
              <Alert severity='info'>
                {t.noData || 'No rate limit entries for the selected filters.'}
              </Alert>
            ) : null}

            {visibleStates.length ? (
              <div className='overflow-x-auto'>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t.columnUser || 'User / Key'}</TableCell>
                      <TableCell>{t.columnModule || 'Module'}</TableCell>
                      <TableCell>{t.columnUsage || 'Usage'}</TableCell>
                      <TableCell>{t.columnWindow || 'Window'}</TableCell>
                      <TableCell>{t.columnStatus || 'Status'}</TableCell>
                      <TableCell align='right'>{t.columnActions || dictionary.navigation.actions || 'Actions'}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleStates.map(entry => {
                      const blocked = isEntryBlocked(entry)
                      const moduleLabel = getModuleLabel(entry.module, dictionary.navigation)
                      const usagePercent = formatUsagePercentage(entry.count, entry.config.maxRequests)

                      return (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <Typography fontWeight={600}>
                              {entry.user?.name || entry.user?.email || entry.key}
                            </Typography>
                            <Typography variant='body2' color='text.secondary'>
                              {entry.user?.email || (entry.user ? entry.user.id : entry.key)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={moduleLabel} size='small' variant='tonal' />
                          </TableCell>
                          <TableCell>
                            {entry.source === 'manual' ? (
                              <Typography variant='body2' color='text.secondary'>
                                {entry.activeBlock?.reason || t.manualUsage || 'Manual block'}
                              </Typography>
                            ) : (
                              <Box className='flex flex-col gap-1 min-w-[180px]'>
                                <Typography variant='body2'>
                                  {entry.count.toLocaleString()} / {entry.config.maxRequests.toLocaleString()}
                                </Typography>
                                <LinearProgress
                                  variant='determinate'
                                  value={usagePercent}
                                  color={usagePercent > 90 ? 'error' : usagePercent > 70 ? 'warning' : 'primary'}
                                  sx={{ height: 6, borderRadius: 999 }}
                                />
                              </Box>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant='body2'>
                              {formatDateTime(entry.windowStart)}
                            </Typography>
                            <Typography variant='body2' color='text.secondary'>
                              {formatDateTime(entry.windowEnd)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {blocked ? (
                              <Box className='flex flex-col gap-1'>
                                <Tooltip
                                  title={
                                    entry.blockedUntil
                                      ? formatDateTime(entry.blockedUntil)
                                      : entry.activeBlock?.reason || 'Blocked'
                                  }
                                >
                                  <Chip
                                    color='error'
                                    label={
                                      entry.blockedUntil
                                        ? t.statusBlockedWithTimer
                                          ? t.statusBlockedWithTimer.replace(
                                              '${time}',
                                              formatDistanceToNow(new Date(entry.blockedUntil), { addSuffix: true })
                                            )
                                          : `${t.statusBlocked || 'Blocked'} • ${formatDistanceToNow(new Date(entry.blockedUntil), { addSuffix: true })}`
                                        : t.statusBlocked || 'Blocked'
                                    }
                                  />
                                </Tooltip>
                                {entry.activeBlock?.reason ? (
                                  <Typography variant='caption' color='text.secondary'>
                                    {t.manualReasonLabel
                                      ? `${t.manualReasonLabel}: ${entry.activeBlock.reason}`
                                      : `Reason: ${entry.activeBlock.reason}`}
                                  </Typography>
                                ) : null}
                              </Box>
                            ) : (
                              <Chip color='success' label={t.statusActive || 'Active'} variant='tonal' />
                            )}
                          </TableCell>
                          <TableCell align='right'>
                            <Button
                              variant='outlined'
                              size='small'
                              startIcon={clearingId === entry.id ? <CircularProgress size={14} /> : <i className='ri-eraser-line' />}
                              disabled={!canModify || clearingId === entry.id}
                              onClick={() => handleClearState(entry.id)}
                            >
                              {t.actionClear || 'Clear block'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            <Box className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <Typography variant='body2' color='text.secondary'>
                {t.viewingLabel
                  ? t.viewingLabel
                      .replace('${count}', visibleStates.length.toString())
                      .replace('${total}', totalCount.toString())
                  : `Showing ${visibleStates.length} of ${totalCount}`}
              </Typography>

              {nextCursor ? (
                <Button
                  variant='contained'
                  onClick={() => fetchStates({ append: true, cursor: nextCursor })}
                  startIcon={<i className='ri-arrow-down-line' />}
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
      <Dialog open={configDialogOpen} onClose={closeConfigDialog} fullWidth maxWidth='sm'>
        <DialogTitle>{t.configDialogTitle || 'Edit rate limit'}</DialogTitle>
        <DialogContent className='flex flex-col gap-4 pbs-2'>
          <Typography variant='body2' color='text.secondary'>
            {t.configDialogSubtitle || 'Adjust throttling parameters for the selected module.'}
          </Typography>
          <TextField
            label={t.moduleFilter || 'Module'}
            value={configForm.module}
            disabled
            fullWidth
          />
          <TextField
            label={t.configMaxRequests || 'Max requests'}
            type='number'
            value={configForm.maxRequests}
            onChange={event => handleConfigInputChange('maxRequests', event.target.value)}
            inputProps={{ min: 1 }}
            fullWidth
          />
          <div className='grid gap-4 grid-cols-1 sm:grid-cols-2'>
            <TextField
              label={t.configWindowMinutes || 'Window (minutes)'}
              type='number'
              value={configForm.windowMinutes}
              onChange={event => handleConfigInputChange('windowMinutes', event.target.value)}
              inputProps={{ min: 1 }}
              fullWidth
            />
            <TextField
              label={t.configBlockMinutes || 'Block duration (minutes)'}
              type='number'
              value={configForm.blockMinutes}
              onChange={event => handleConfigInputChange('blockMinutes', event.target.value)}
              inputProps={{ min: 1 }}
              fullWidth
            />
          </div>
          <TextField
            label={t.configWarnThreshold || 'Warning threshold'}
            type='number'
            value={configForm.warnThreshold}
            onChange={event => handleConfigInputChange('warnThreshold', event.target.value)}
            inputProps={{ min: 0 }}
            helperText={t.configWarnThresholdHint || 'Optional: show warning when remaining messages <= value'}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button variant='outlined' color='secondary' onClick={closeConfigDialog} disabled={savingConfig}>
            {t.configCancel || dictionary.navigation.cancel || 'Cancel'}
          </Button>
          <Button variant='contained' onClick={handleSaveConfig} disabled={savingConfig}>
            {savingConfig ? t.configSaving || 'Saving...' : t.configSave || dictionary.navigation.save || 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default RateLimitManagement

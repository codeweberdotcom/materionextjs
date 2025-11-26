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
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import CustomAvatar from '@core/components/mui/Avatar'
import Skeleton from '@mui/material/Skeleton'

import { formatDistanceToNow } from 'date-fns'
import { enUS, fr, ru, ar as arLocale } from 'date-fns/locale'
import { useParams } from 'next/navigation'
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
  mode?: 'monitor' | 'enforce' | null
  storeEmailInEvents?: boolean | null
  storeIpInEvents?: boolean | null
  isFallback?: boolean | null
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
  targetIp?: string | null
  targetEmail?: string | null
  targetMailDomain?: string | null
  targetCidr?: string | null
  targetAsn?: string | null
  reason?: string | null
  violationNumber?: number | null
}


type RateLimitStatesResponse = {
  items: RateLimitStateEntry[]
  totalStates?: number
  totalManual?: number
  total: number
  nextCursor?: string
}

type ConfigFormState = {
  module: string
  maxRequests: string
  windowMinutes: string
  blockMinutes: string
  warnThreshold: string
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
  navigation: Record<string, string | undefined>,
  moduleLabels?: Record<string, string | undefined>
): string => {
  if (moduleLabels?.[moduleName]) {
    return moduleLabels[moduleName] as string
  }

  const registrationLabel = navigation.registrationModule || 'Registration'

  if (moduleName === 'registration') {
    return registrationLabel
  }

  if (moduleName === 'registration-ip') {
    return `${registrationLabel} · IP`
  }

  if (moduleName === 'registration-domain') {
    return `${registrationLabel} · Domain`
  }

  if (moduleName === 'registration-email') {
    return `${registrationLabel} · Email`
  }

  const fallbackMap: Record<string, string | undefined> = {
    chat: navigation.chat,
    ads: navigation.ads,
    upload: navigation.upload,
    auth: navigation.auth,
    registration: navigation.registrationModule,
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
  const [configForm, setConfigForm] = useState<ConfigFormState>({
    module: '',
    maxRequests: '',
    windowMinutes: '',
    blockMinutes: '',
    warnThreshold: ''
  })
  const [savingConfig, setSavingConfig] = useState(false)
  const [statusSavingModule, setStatusSavingModule] = useState<string | null>(null)
  const [modeSavingModule, setModeSavingModule] = useState<string | null>(null)
  const [infoConfig, setInfoConfig] = useState<RateLimitConfig | null>(null)
  const [instructionsOpen, setInstructionsOpen] = useState(false)

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
        setTotalCount(typeof data.total === 'number' ? data.total : data.items.length)

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
    if (permissionsLoading || !hasAccess) {
      return
    }

    fetchSummary()
  }, [fetchSummary, hasAccess, permissionsLoading])

  useEffect(() => {
    if (permissionsLoading || !hasAccess) {
      return
    }

    setInitialLoading(true)
    fetchStates({ append: false })
  }, [fetchStates, hasAccess, permissionsLoading])

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

  const handleClearState = async (entry: RateLimitStateEntry) => {
    if (!canModify) {
      return
    }

    setClearingId(entry.id)

    try {
      let response: Response
      
      // Для manual блоков используем другой endpoint
      if (entry.source === 'manual' && entry.activeBlock?.id) {
        response = await fetch(`/api/admin/rate-limits/blocks/${entry.activeBlock.id}`, {
          method: 'DELETE'
        })
      } else {
        // Для state используем стандартный endpoint
        response = await fetch(`/api/admin/rate-limits/${entry.id}`, {
          method: 'DELETE'
        })
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to clear rate limit state')
      }

      toast.success(dictionary.rateLimit?.clearSuccess ?? 'Rate limit has been reset')
      await fetchStates({ append: false })
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : (dictionary.rateLimit?.clearError ?? 'Failed to reset rate limit'))
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

  const handleToggleModuleMode = async (moduleName: string, nextMode: 'monitor' | 'enforce') => {
    if (!canModify) {
      return
    }

    setModeSavingModule(moduleName)

    try {
      const response = await fetch('/api/admin/rate-limits', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          module: moduleName,
          mode: nextMode
        })
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || t.configModeError || 'Failed to update mode')
      }

      toast.success(t.configModeSuccess || 'Rate limit mode updated')
      await fetchSummary()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : t.configModeError || 'Failed to update mode')
    } finally {
      setModeSavingModule(null)
    }
  }

  const t = dictionary.rateLimit ?? {}
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

  const renderModuleSkeletons = () => (
    <Grid size={{ xs: 12 }}>
      <Grid container spacing={4}>
        {[0, 1, 2].map(index => (
          <Grid key={`module-skeleton-${index}`} size={{ xs: 12, md: 4 }}>
            <Card className='h-full flex flex-col'>
              <CardHeader
                title={<Skeleton variant='text' width='60%' />}
                subheader={<Skeleton variant='text' width='40%' />}
              />
              <CardContent className='flex flex-col gap-4 grow'>
                <div className='flex justify-between gap-4'>
                  <Skeleton variant='text' width='40%' height={32} />
                  <Skeleton variant='rectangular' width={90} height={32} />
                </div>
                <Skeleton variant='rectangular' height={80} />
                <div className='flex flex-col gap-2'>
                  <Skeleton variant='text' width='70%' />
                  <Skeleton variant='text' width='50%' />
                </div>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Grid>
  )

  const renderStatesSkeleton = () => (
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
          {[0, 1, 2].map(index => (
            <TableRow key={`state-skeleton-${index}`}>
              <TableCell>
                <Skeleton width='60%' />
                <Skeleton width='40%' />
              </TableCell>
              <TableCell>
                <Skeleton width={80} />
              </TableCell>
              <TableCell>
                <Skeleton width={140} height={20} />
                <Skeleton variant='rectangular' height={10} width={160} />
              </TableCell>
              <TableCell>
                <Skeleton width={120} />
                <Skeleton width={100} />
              </TableCell>
              <TableCell>
                <Skeleton width={90} />
              </TableCell>
              <TableCell align='right'>
                <Skeleton width={120} height={36} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )

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

        {initialLoading ? (
          renderModuleSkeletons()
        ) : modulesToRender.length ? (
          <Grid size={{ xs: 12 }}>
            <Grid container spacing={4}>
              {modulesToRender.map(config => {
                const moduleLabel = getModuleLabel(
                  config.module,
                  dictionary.navigation,
                  dictionary.rateLimit?.moduleLabels
                )
                const stat = statsMap.get(config.module)
                const windowMinutes = Math.max(1, Math.round((config.windowMs || 60000) / 60000))
                const blockMinutes = Math.max(1, Math.round(((config.blockMs ?? config.windowMs) || 60000) / 60000))
                const warnThresholdDisplay = config.warnThreshold ?? 0
                const isActive = config.isActive ?? true
                const statusLabel = isActive ? (t.configStatusActive || 'Active') : (t.configStatusInactive || 'Inactive')
                const minutesLabel = t.minutesShort || 'min'
                const currentMode: 'monitor' | 'enforce' = config.mode === 'monitor' ? 'monitor' : 'enforce'
                const modeLabel =
                  currentMode === 'monitor'
                    ? (t.configModeMonitor || 'Monitoring')
                    : (t.configModeEnforce || 'Blocking')
                const warnValue =
                  warnThresholdDisplay > 0
                    ? warnThresholdDisplay.toLocaleString()
                    : t.configWarnDisabled || 'Disabled'

                // Debug logging
                console.log(`Module ${config.module}: warnThreshold=${config.warnThreshold}, warnThresholdDisplay=${warnThresholdDisplay}`)
                const isModePending = modeSavingModule === config.module

                return (
                  <Grid key={config.module} size={{ xs: 12, md: 4 }}>
                    <Card className='h-full flex flex-col'>
                      <CardHeader
                        title={moduleLabel}
                        subheader={
                          <Typography variant='caption' color='text.secondary'>
                            {currentMode === 'monitor'
                              ? (t.modeMonitorHint || 'Monitoring logs warnings without blocking users.')
                              : (t.modeEnforceHint || 'Blocking enforces the limit and stops further requests.')}
                          </Typography>
                        }
                        action={
                          canModify ? (
                            <div className='flex flex-col items-end gap-2'>
                              <ToggleButtonGroup
                                size='small'
                                color='primary'
                                exclusive
                                value={currentMode}
                                onChange={(_, value) => {
                                  if (!value || value === currentMode) {
                                    return
                                  }
                                  handleToggleModuleMode(config.module, value)
                                }}
                                disabled={isModePending}
                              >
                                <ToggleButton value='monitor'>
                                  {t.configModeMonitorShort || t.configModeMonitor || 'Monitor'}
                                </ToggleButton>
                                <ToggleButton value='enforce'>
                                  {t.configModeEnforceShort || t.configModeEnforce || 'Block'}
                                </ToggleButton>
                              </ToggleButtonGroup>
                              <div className='flex items-center gap-1'>
                                <Tooltip title={statusLabel}>
                                  <Switch
                                    checked={isActive}
                                    onChange={(_, checked) => handleToggleModuleStatus(config.module, checked)}
                                    size='small'
                                    disabled={statusSavingModule === config.module || isModePending}
                                    inputProps={{ 'aria-label': statusLabel }}
                                  />
                                </Tooltip>
                                <Tooltip title={t.configInfoTooltip || 'How the parameters work'}>
                                  <IconButton
                                    color='info'
                                    size='small'
                                    aria-label={t.configInfoTooltip || 'How the parameters work'}
                                    className='text-textSecondary'
                                    onClick={() => setInstructionsOpen(true)}
                                  >
                                    <i className='ri-information-line' />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={t.configViewButton || 'View details'}>
                                  <IconButton
                                    color='info'
                                    size='small'
                                    onClick={() => setInfoConfig(config)}
                                    disabled={statusSavingModule === config.module || isModePending}
                                  >
                                    <i className='ri-eye-line' />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={t.configEditButton || 'Edit limits'}>
                                  <IconButton
                                    color='primary'
                                    size='small'
                                    onClick={() => openConfigDialog(config)}
                                    disabled={statusSavingModule === config.module || isModePending}
                                  >
                                    <i className='ri-edit-line' />
                                  </IconButton>
                                </Tooltip>
                              </div>
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
                      {getModuleLabel(module, dictionary.navigation, dictionary.rateLimit?.moduleLabels)}
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

            {initialLoading && !visibleStates.length ? renderStatesSkeleton() : null}

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
                      const moduleLabel = getModuleLabel(entry.module, dictionary.navigation, dictionary.rateLimit?.moduleLabels)
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
                                              formatRelativeTime(entry.blockedUntil) ?? ''
                                            )
                                          : `${t.statusBlocked || 'Blocked'} • ${formatRelativeTime(entry.blockedUntil) ?? ''}`
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
                              onClick={() => handleClearState(entry)}
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
          <div className='grid gap-4 grid-cols-1 sm:grid-cols-2'>
            <TextField
              label={t.configMaxRequests || 'Max requests'}
              type='number'
              value={configForm.maxRequests}
              onChange={event => handleConfigInputChange('maxRequests', event.target.value)}
              inputProps={{ min: 1 }}
              sx={{ width: '100%' }}
            />
            <TextField
              label={t.configWindowMinutes || 'Window (minutes)'}
              type='number'
              value={configForm.windowMinutes}
              onChange={event => handleConfigInputChange('windowMinutes', event.target.value)}
              inputProps={{ min: 1 }}
              sx={{ width: '100%' }}
            />
          </div>
          <div className='grid gap-4 grid-cols-1 sm:grid-cols-2'>
            <TextField
              label={t.configBlockMinutes || 'Block duration (minutes)'}
              type='number'
              value={configForm.blockMinutes}
              onChange={event => handleConfigInputChange('blockMinutes', event.target.value)}
              inputProps={{ min: 1 }}
              sx={{ width: '100%' }}
            />
            <TextField
              label={t.configWarnThreshold || 'Warning threshold'}
              type='number'
              value={configForm.warnThreshold}
              onChange={event => handleConfigInputChange('warnThreshold', event.target.value)}
              inputProps={{ min: 0 }}
              helperText={t.configWarnThresholdHint || 'Optional: show warning when remaining messages <= value'}
              sx={{ width: '100%' }}
            />
          </div>
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
      <Dialog open={Boolean(infoConfig)} onClose={() => setInfoConfig(null)} fullWidth maxWidth='sm'>
        <DialogTitle className='flex items-center justify-between'>
          {t.configDetailsTitle || 'Rate limit configuration details'}
          <IconButton
            aria-label='close'
            onClick={() => setInfoConfig(null)}
            sx={{ color: 'grey.500' }}
          >
            <i className='ri-close-line' />
          </IconButton>
        </DialogTitle>
        <DialogContent className='flex flex-col gap-4 pbs-2'>
          {infoConfig && (
            <div className='flex flex-col gap-4'>
              <div className='flex items-center gap-3'>
                <CustomAvatar skin='light' color='primary' variant='rounded'>
                  <i className='ri-speed-up-line' />
                </CustomAvatar>
                <div className='flex items-center justify-between gap-4 is-full'>
                  <Typography className='font-medium' color='text.primary'>
                    {t.configMaxRequests || 'Max requests'}
                  </Typography>
                  <Typography className='font-semibold' color='text.primary'>
                    {infoConfig.maxRequests.toLocaleString()}
                  </Typography>
                </div>
              </div>
              <div className='flex items-center gap-3'>
                <CustomAvatar skin='light' color='info' variant='rounded'>
                  <i className='ri-timer-line' />
                </CustomAvatar>
                <div className='flex items-center justify-between gap-4 is-full'>
                  <Typography className='font-medium' color='text.primary'>
                    {t.configWindowMinutes || 'Window (minutes)'}
                  </Typography>
                  <Typography className='font-semibold' color='text.primary'>
                    {Math.max(1, Math.round((infoConfig.windowMs || 60000) / 60000))} {t.minutesShort || 'min'}
                  </Typography>
                </div>
              </div>
              <div className='flex items-center gap-3'>
                <CustomAvatar skin='light' color='warning' variant='rounded'>
                  <i className='ri-time-line' />
                </CustomAvatar>
                <div className='flex items-center justify-between gap-4 is-full'>
                  <Typography className='font-medium' color='text.primary'>
                    {t.configBlockMinutes || 'Block duration (minutes)'}
                  </Typography>
                  <Typography className='font-semibold' color='text.primary'>
                    {Math.max(1, Math.round(((infoConfig.blockMs ?? infoConfig.windowMs) || 60000) / 60000))} {t.minutesShort || 'min'}
                  </Typography>
                </div>
              </div>
              <div className='flex items-center gap-3'>
                <CustomAvatar skin='light' color='error' variant='rounded'>
                  <i className='ri-alert-line' />
                </CustomAvatar>
                <div className='flex items-center justify-between gap-4 is-full'>
                  <Typography className='font-medium' color='text.primary'>
                    {t.configWarnThreshold || 'Warning threshold'}
                  </Typography>
                  <Typography className='font-semibold' color='text.primary'>
                    {infoConfig.warnThreshold && infoConfig.warnThreshold > 0
                      ? infoConfig.warnThreshold.toLocaleString()
                      : (t.configWarnDisabled || 'Disabled')
                    }
                  </Typography>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={instructionsOpen} onClose={() => setInstructionsOpen(false)} fullWidth maxWidth='md'>
        <DialogTitle className='flex items-center justify-between'>
          Как работают лимиты запросов
          <IconButton
            aria-label='close'
            onClick={() => setInstructionsOpen(false)}
            sx={{ color: 'grey.500' }}
          >
            <i className='ri-close-line' />
          </IconButton>
        </DialogTitle>
        <DialogContent className='flex flex-col gap-4 pbs-2'>
          <Typography variant='body1' paragraph>
            Ограничение частоты запросов помогает защитить ваше приложение от злоупотреблений, контролируя количество запросов, которые пользователи могут отправлять в течение временного окна.
          </Typography>

          <div className='flex flex-col gap-3'>
            <div>
              <Typography variant='h6' gutterBottom>
                Максимальное количество запросов
              </Typography>
              <Typography variant='body2'>
                Максимальное количество запросов, разрешенное для одного пользователя в течение указанного временного окна. При превышении этого лимита пользователь может быть заблокирован или предупрежден в зависимости от режима.
              </Typography>
            </div>

            <div>
              <Typography variant='h6' gutterBottom>
                Временное окно
              </Typography>
              <Typography variant='body2'>
                Период времени, в течение которого подсчитываются запросы. После истечения этого окна счетчик сбрасывается, и пользователь может снова отправлять запросы.
              </Typography>
            </div>

            <div>
              <Typography variant='h6' gutterBottom>
                Длительность блокировки
              </Typography>
              <Typography variant='body2'>
                Как долго пользователь остается заблокированным после превышения лимита. В течение этого времени все его запросы отклоняются.
              </Typography>
            </div>

            <div>
              <Typography variant='h6' gutterBottom>
                Порог предупреждения
              </Typography>
              <Typography variant='body2'>
                Необязательный порог для показа предупреждений перед блокировкой. Когда количество оставшихся запросов опускается ниже этого числа, пользователи получают предупреждение.
              </Typography>
            </div>

            <div>
              <Typography variant='h6' gutterBottom>
                Режимы работы
              </Typography>
              <Typography variant='body2' paragraph>
                <strong>Мониторинг:</strong> Записывает предупреждения, но позволяет пользователям продолжать отправку запросов. Полезно для сбора данных перед введением строгих ограничений.
              </Typography>
              <Typography variant='body2'>
                <strong>Блокировка:</strong> Строго соблюдает лимиты, блокируя пользователей, которые их превышают. Рекомендуется для рабочих сред.
              </Typography>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default RateLimitManagement




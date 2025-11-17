'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { differenceInSeconds, formatDuration, intervalToDuration } from 'date-fns'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { toast } from 'react-toastify'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'

import { usePermissions } from '@/hooks/usePermissions'
import { useTranslation } from '@/contexts/TranslationContext'

type StateEntry = {
  id: string
  key: string
  module: string
  count: number
  remaining: number
  windowEnd: string
  blockedUntil: string | null
  source: 'state' | 'manual'
  reason?: string | null
  violationNumber?: number | null
  targetIp?: string | null
  targetEmail?: string | null
  targetCidr?: string | null
  targetAsn?: string | null
  blockedBy?: string | null
  blockedByUser?: { id: string; email: string | null } | null
  activeBlock?: {
    id: string
    reason: string
    blockedAt: string
    unblockedAt: string | null
    notes?: string | null
    blockedBy?: string | null
  } | null
  notes?: string | null
  blockedBy?: string | null
  user?: {
    email?: string | null
  } | null
}

type StateListResponse = {
  items: StateEntry[]
  total: number
  nextCursor?: string
}

type EventEntry = {
  id: string
  module: string
  key: string
  eventType: 'warning' | 'block'
  mode: 'monitor' | 'enforce'
  count: number
  maxRequests: number
  windowStart: string
  windowEnd: string
  blockedUntil: string | null
  createdAt: string
}

type EventsResponse = {
  items: EventEntry[]
  total: number
}

type ManualBlockForm = {
  module: string
  target: 'user' | 'email' | 'ip' | 'cidr' | 'asn'
  userId: string
  email: string
  ipAddress: string
  cidr: string
  asn: string
  reason: string
  durationMinutes: string
  notes: string
}

const DEFAULT_MODULES = ['all', 'chat', 'ads', 'upload', 'auth', 'email', 'notifications', 'registration']

const moduleLabelMap: Record<
  string,
  Record<
    string,
    string
  >
> = {
  ru: {
    all: 'Все модули',
    chat: 'Чат',
    ads: 'Объявления',
    upload: 'Загрузка',
    auth: 'Аутентификация',
    email: 'Email',
    notifications: 'Уведомления',
    registration: 'Регистрация'
  },
  en: {
    all: 'All modules',
    chat: 'Chat',
    ads: 'Ads',
    upload: 'Upload',
    auth: 'Auth',
    email: 'Email',
    notifications: 'Notifications',
    registration: 'Registration'
  },
  fr: {
    all: 'Tous les modules',
    chat: 'Chat',
    ads: 'Annonces',
    upload: 'Téléchargement',
    auth: 'Auth',
    email: 'Email',
    notifications: 'Notifications',
    registration: 'Inscription'
  },
  ar: {
    all: 'كل الوحدات',
    chat: 'الدردشة',
    ads: 'الإعلانات',
    upload: 'رفع',
    auth: 'تسجيل الدخول',
    email: 'البريد',
    notifications: 'الإشعارات',
    registration: 'التسجيل'
  }
}

const uiText: Record<
  string,
  {
    title: string
    subtitle: string
    search: string
    moduleFilter: string
    refresh: string
    key: string
    module: string
    source: string
    violation: string
    counter: string
    window: string
    reason: string
    actions: string
    noRecords: string
    loadMore: string
  }
> = {
  ru: {
    title: 'Блокировки',
    subtitle: 'Ручные и автоматические блоки по модулям',
    search: 'Поиск (user/email/IP hash)',
    moduleFilter: 'Фильтр модуля',
    refresh: 'Обновить',
    key: 'Ключ',
    module: 'Модуль',
    source: 'Источник',
    violation: '№',
    counter: 'Счётчик',
    window: 'Окно / блокировка',
    reason: 'Причина',
    actions: 'Действия',
    noRecords: 'Нет записей',
    loadMore: 'Загрузить ещё',
    permanent: 'Навсегда',
    target: 'Цель',
    author: 'Автор',
    sourceFilter: 'Источник',
    sourceAll: 'Все',
    sourceAuto: 'Авто',
    sourceManual: 'Ручные',
    activeOnly: 'Только активные',
    keyFilter: 'Фильтр по ключу',
    targetFilter: 'Фильтр по цели',
    reasonFilter: 'Фильтр по причине',
    authorFilter: 'Фильтр по автору'
  },
  en: {
    title: 'Blocks',
    subtitle: 'Manual and automatic blocks by module',
    search: 'Search (user/email/IP hash)',
    moduleFilter: 'Module filter',
    module: 'Module',
    source: 'Source',
    violation: '#',
    counter: 'Counter',
    window: 'Window / block',
    actions: 'Actions',
    noRecords: 'No records',
    loadMore: 'Load more',
    permanent: 'Forever',
    target: 'Target',
    author: 'Author',
    sourceFilter: 'Source',
    sourceAll: 'All',
    sourceAuto: 'Auto',
    sourceManual: 'Manual',
    activeOnly: 'Active only',
    targetFilter: 'Filter by target',
    reasonFilter: 'Filter by reason',
    authorFilter: 'Filter by author'
  },
  fr: {
    title: 'Blocages',
    subtitle: 'Blocages manuels et automatiques par module',
    search: 'Recherche (user/email/IP hash)',
    moduleFilter: 'Filtre module',
    refresh: 'Rafraîchir',
    key: 'Clé',
    module: 'Module',
    source: 'Source',
    violation: 'N°',
    counter: 'Compteur',
    window: 'Fenêtre / blocage',
    reason: 'Raison',
    actions: 'Actions',
    noRecords: 'Aucun enregistrement',
    loadMore: 'Charger plus',
    permanent: 'Permanent',
    target: 'Cible',
    author: 'Auteur',
    sourceFilter: 'Source',
    sourceAll: 'Tous',
    sourceAuto: 'Auto',
    sourceManual: 'Manuels',
    activeOnly: 'Actifs uniquement',
    keyFilter: 'Filtrer par clé',
    targetFilter: 'Filtrer par cible',
    reasonFilter: 'Filtrer par raison',
    authorFilter: 'Filtrer par auteur'
  },
  ar: {
    title: 'الحظر',
    subtitle: 'حظر يدوي وتلقائي حسب الوحدة',
    search: 'بحث (user/email/IP hash)',
    moduleFilter: 'تصفية الوحدة',
    refresh: 'تحديث',
    key: 'المفتاح',
    module: 'الوحدة',
    source: 'المصدر',
    violation: 'رقم',
    counter: 'العداد',
    window: 'النافذة / الحظر',
    reason: 'السبب',
    actions: 'إجراءات',
    noRecords: 'لا توجد سجلات',
    loadMore: 'تحميل المزيد',
    permanent: 'دائم',
    target: 'الهدف',
    author: 'المنشئ',
    sourceFilter: 'المصدر',
    sourceAll: 'الكل',
    sourceAuto: 'تلقائي',
    sourceManual: 'يدوي',
    activeOnly: 'نشط فقط',
    keyFilter: 'تصفية حسب المفتاح',
    targetFilter: 'تصفية حسب الهدف',
    reasonFilter: 'تصفية حسب السبب',
    authorFilter: 'تصفية حسب المنشئ'
  }
}

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value))
  } catch {
    return value
  }
}

const BlocksPage = () => {
  const { hasAccess, isLoading: permissionsLoading } = usePermissions()
  const t = (useTranslation().rateLimitEvents ?? {}) as Record<string, string>
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams<{ lang?: string }>()
  const currentLang = params?.lang ?? 'ru'

  const [moduleFilter, setModuleFilter] = useState<string>(() => searchParams.get('module') ?? 'all')
  const [states, setStates] = useState<StateEntry[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewEntry, setViewEntry] = useState<StateEntry | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [events, setEvents] = useState<EventEntry[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<'all' | 'state' | 'manual'>('all')
  const [columnFilters, setColumnFilters] = useState({
    target: '',
    reason: '',
    author: ''
  })
  const [manualBlockDialogOpen, setManualBlockDialogOpen] = useState(false)
  const [manualBlockForm, setManualBlockForm] = useState<ManualBlockForm>({
    module: 'all',
    target: 'user',
    userId: '',
    email: '',
    ipAddress: '',
    cidr: '',
    asn: '',
    reason: '',
    durationMinutes: '60',
    notes: ''
  })
  const [creatingBlock, setCreatingBlock] = useState(false)
  const [overwriteDialogOpen, setOverwriteDialogOpen] = useState(false)
  const [conflictPayloads, setConflictPayloads] = useState<Record<string, unknown>[]>([])
  const [helpOpen, setHelpOpen] = useState(false)

  const modules = useMemo(() => DEFAULT_MODULES, [])

  const moduleLabel = (mod: string) => {
    const langMap = moduleLabelMap[currentLang] || moduleLabelMap.ru
    return langMap[mod] || mod
  }

  const targetLabel = (entry: StateEntry) =>
    entry.user?.email ||
    entry.targetEmail ||
    entry.targetCidr ||
    entry.targetAsn ||
    entry.targetIp ||
    entry.key

  const text = uiText[currentLang] || uiText.ru

  const humanizeWindow = (windowMs: number) => {
    if (windowMs % (60 * 60 * 1000) === 0) {
      const hours = Math.round(windowMs / (60 * 60 * 1000))
      return hours === 1 ? '1 ч' : `${hours} ч`
    }
    if (windowMs % (60 * 1000) === 0) {
      const minutes = Math.round(windowMs / (60 * 1000))
      return minutes === 1 ? '1 мин' : `${minutes} мин`
    }
    return `${Math.round(windowMs / 1000)} сек`
  }

  const sourceLabel = (source: 'state' | 'manual') => {
    const labels: Record<string, { auto: string; manual: string }> = {
      ru: { auto: 'Авто', manual: 'Ручная' },
      en: { auto: 'Auto', manual: 'Manual' },
      fr: { auto: 'Auto', manual: 'Manuel' },
      ar: { auto: 'تلقائي', manual: 'يدوي' }
    }
    const dict = labels[currentLang] || labels.ru
    return source === 'manual' ? dict.manual : dict.auto
  }

  const filteredStates = useMemo(() => {
    const targetMatch = (entry: StateEntry) =>
      targetLabel(entry).toLowerCase().includes(columnFilters.target.toLowerCase())
    const reasonMatch = (entry: StateEntry) => {
      const text =
        entry.reason ||
        entry.activeBlock?.reason ||
        entry.notes ||
        (entry.source === 'manual' ? sourceLabel('manual') : sourceLabel('state'))
      return text.toLowerCase().includes(columnFilters.reason.toLowerCase())
    }
    const authorMatch = (entry: StateEntry) => {
      const author =
        entry.blockedByUser?.email ||
        entry.blockedBy ||
        entry.activeBlock?.blockedBy ||
        ''
      return author.toLowerCase().includes(columnFilters.author.toLowerCase())
    }

    return states.filter(item => {
      if (moduleFilter !== 'all' && item.module !== moduleFilter) return false
      if (sourceFilter !== 'all' && item.source !== sourceFilter) return false
      if (columnFilters.target && !targetMatch(item)) return false
      if (columnFilters.reason && !reasonMatch(item)) return false
      if (columnFilters.author && !authorMatch(item)) return false
      return true
    })
  }, [states, sourceFilter, columnFilters, currentLang, moduleFilter])

  const fetchEvents = async (moduleName: string, key: string) => {
    try {
      setEventsLoading(true)
      const params = new URLSearchParams()
      params.set('view', 'events')
      params.set('module', moduleName)
      params.set('key', key)
      params.set('eventType', 'block')
      params.set('limit', '10')
      const res = await fetch(`/api/admin/rate-limits?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load history')
      const data = (await res.json()) as EventsResponse
      setEvents(data.items || [])
    } catch (error) {
      console.error(error)
      setEvents([])
    } finally {
      setEventsLoading(false)
    }
  }

  const handleManualBlockChange = <K extends keyof ManualBlockForm>(field: K, value: ManualBlockForm[K]) => {
    setManualBlockForm(prev => ({ ...prev, [field]: value }))
  }

  const openManualBlockDialog = (prefill?: Partial<ManualBlockForm>) => {
    setManualBlockForm(prev => ({ ...prev, ...prefill }))
    setManualBlockDialogOpen(true)
  }

  const closeManualBlockDialog = () => {
    if (creatingBlock) return
    setManualBlockDialogOpen(false)
    setConflictPayloads([])
    setOverwriteDialogOpen(false)
  }

  const submitManualBlock = async () => {
    try {
      setCreatingBlock(true)
      const target = manualBlockForm.target
      const reason = manualBlockForm.reason.trim()
      if (!reason) {
        toast.error('Reason is required')
        return
      }

      const splitValues = (text: string) =>
        text
          .split('\n')
          .map(v => v.trim())
          .filter(Boolean)

      let values: string[] = []
      if (target === 'user') values = splitValues(manualBlockForm.userId)
      if (target === 'email') values = splitValues(manualBlockForm.email)
      if (target === 'ip') values = splitValues(manualBlockForm.ipAddress)
      if (target === 'cidr') values = splitValues(manualBlockForm.cidr)
      if (target === 'asn') values = splitValues(manualBlockForm.asn)

      if (!values.length) {
        toast.error('Введите хотя бы одно значение (по одному в строке)')
        return
      }

      const localConflicts: Record<string, unknown>[] = []
      let successCount = 0

      for (const value of values) {
        const payload: Record<string, unknown> = {
          module: manualBlockForm.module,
          targetType: target,
          userId: target === 'user' ? value : undefined,
          email: target === 'email' ? value : undefined,
          ipAddress: target === 'ip' ? value : undefined,
          cidr: target === 'cidr' ? value : undefined,
          asn: target === 'asn' ? value : undefined,
          reason,
          durationMinutes: manualBlockForm.durationMinutes ? Number(manualBlockForm.durationMinutes) : undefined,
          notes: manualBlockForm.notes?.trim() || undefined
        }

        const res = await fetch('/api/admin/rate-limits/blocks', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          if (res.status === 409 && err?.code === 'block_exists') {
            localConflicts.push(payload)
            continue
          }
          throw new Error(err?.error || 'Failed to create block')
        } else {
          successCount += 1
        }
      }

      if (successCount > 0) {
        toast.success(successCount > 1 ? `Создано блокировок: ${successCount}` : 'Блокировка создана')
      }

      if (localConflicts.length) {
        setConflictPayloads(localConflicts)
        setOverwriteDialogOpen(true)
        return
      }

      setManualBlockDialogOpen(false)
      await fetchStates({ append: false })
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Не удалось создать блокировку')
    } finally {
      setCreatingBlock(false)
    }
  }

  const confirmOverwrite = async () => {
    if (!conflictPayloads.length) {
      setOverwriteDialogOpen(false)
      return
    }
    try {
      setCreatingBlock(true)
      let overwritten = 0
      for (const payload of conflictPayloads) {
        const res = await fetch('/api/admin/rate-limits/blocks', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, overwrite: true })
        })
        if (res.ok) overwritten++
      }
      if (overwritten > 0) {
        toast.success(overwritten > 1 ? `Перезаписано блокировок: ${overwritten}` : 'Блокировка обновлена')
      }
      setOverwriteDialogOpen(false)
      setManualBlockDialogOpen(false)
      setConflictPayloads([])
      await fetchStates({ append: false })
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Не удалось создать блокировку')
    } finally {
      setCreatingBlock(false)
    }
  }

  useEffect(() => {
    if (!viewOpen || !viewEntry?.blockedUntil) {
      setCountdown(null)
      return
    }

    const updateCountdown = () => {
      const end = new Date(viewEntry.blockedUntil!)
      const now = new Date()
      const diffSec = differenceInSeconds(end, now)
      if (diffSec <= 0) {
        setCountdown('—')
        return
      }
      const duration = intervalToDuration({ start: now, end })
      const formatted = formatDuration(duration, {
        format: ['days', 'hours', 'minutes', 'seconds'],
        zero: false,
        delimiter: ' '
      })
      setCountdown(formatted || '—')
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [viewOpen, viewEntry?.blockedUntil])

  // синхронизация модуля из URL
  useEffect(() => {
    const moduleParam = searchParams.get('module')
    if (moduleParam && moduleParam !== moduleFilter) {
      setModuleFilter(moduleParam)
      setNextCursor(undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(handler)
  }, [search])

  const fetchStates = async (opts?: { append?: boolean; cursor?: string }) => {
    if (permissionsLoading) return
    setLoading(true)
    try {
      setFetchError(null)
      const params = new URLSearchParams()
      params.set('view', 'states')
      if (moduleFilter !== 'all') params.set('module', moduleFilter)
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (opts?.cursor) params.set('cursor', opts.cursor)
      params.set('limit', '50')

      const res = await fetch(`/api/admin/rate-limits?${params.toString()}`, {
        credentials: 'include'
      })
      if (res.status === 401 || res.status === 403) {
        setFetchError('Нет доступа')
        setStates([])
        return
      }
      if (!res.ok) throw new Error('Failed to load blocks')
      const data = (await res.json()) as unknown as StateListResponse
      setStates(prev => (opts?.append ? [...prev, ...data.items] : data.items))
      setNextCursor(data.nextCursor)
      setTotal(data.total)
    } catch (error) {
      console.error(error)
      setFetchError('Не удалось загрузить блокировки')
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }

  useEffect(() => {
    fetchStates({ append: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleFilter, debouncedSearch, permissionsLoading, hasAccess])

  const moduleButtons = (
    <ButtonGroup size='small' variant='outlined'>
      {modules.map(mod => (
        <Button
          key={mod}
          variant={moduleFilter === mod ? 'contained' : 'outlined'}
          onClick={() => {
            setModuleFilter(mod)
            setNextCursor(undefined)
            const newParams = new URLSearchParams(searchParams.toString())
            if (mod === 'all') {
              newParams.delete('module')
            } else {
              newParams.set('module', mod)
            }
            router.push(`?${newParams.toString()}`)
          }}
        >
          {mod === 'all' ? (t.filterModuleAll || moduleLabel(mod)) : moduleLabel(mod)}
        </Button>
      ))}
    </ButtonGroup>
  )

  const handleDelete = async (id: string, source: 'state' | 'manual') => {
    try {
      setDeletingId(id)
      const endpoint = source === 'manual' ? `/api/admin/rate-limits/blocks/${id}` : `/api/admin/rate-limits/${id}?view=states`
      const res = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!res.ok) {
        throw new Error('Failed to delete block')
      }
      setStates(prev => prev.filter(item => item.id !== id))
      toast.success('Блокировка удалена')
    } catch (error) {
      console.error(error)
      setFetchError('Не удалось удалить блокировку')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title={text.title}
          subheader={text.subtitle}
          action={
            <Box className='flex items-center gap-2 flex-wrap justify-end'>
              {moduleButtons}
              <Button
                size='small'
                variant='contained'
                startIcon={<i className='ri-user-forbid-line' />}
                onClick={() => openManualBlockDialog({ module: moduleFilter === 'all' ? 'all' : moduleFilter })}
              >
                {t.manualBlockDialogTitle || 'Manual block'}
              </Button>
            </Box>
          }
        />
        <CardContent>
          <Box className='flex flex-wrap gap-3 mb-3 items-center'>
            <TextField
              label={text.search}
              value={search}
              onChange={event => setSearch(event.target.value)}
              size='small'
            />
            <TextField
              label={text.targetFilter}
              value={columnFilters.target}
              onChange={event => setColumnFilters(prev => ({ ...prev, target: event.target.value }))}
              size='small'
            />
            <TextField
              label={text.reasonFilter}
              value={columnFilters.reason}
              onChange={event => setColumnFilters(prev => ({ ...prev, reason: event.target.value }))}
              size='small'
            />
            <TextField
              label={text.authorFilter}
              value={columnFilters.author}
              onChange={event => setColumnFilters(prev => ({ ...prev, author: event.target.value }))}
              size='small'
            />
            <TextField
              select
              label={text.sourceFilter}
              size='small'
              value={sourceFilter}
              onChange={event => setSourceFilter(event.target.value as typeof sourceFilter)}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value='all'>{text.sourceAll}</MenuItem>
              <MenuItem value='state'>{text.sourceAuto}</MenuItem>
              <MenuItem value='manual'>{text.sourceManual}</MenuItem>
            </TextField>
            <Box className='ml-auto'>
              <IconButton
                color='primary'
                onClick={() => fetchStates({ append: false })}
                disabled={loading}
              >
                <i className='ri-refresh-line' />
              </IconButton>
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {initialLoading ? (
            <Box className='flex flex-col gap-2'>
              {[0, 1, 2].map(i => (
                <Skeleton key={`state-skel-${i}`} height={48} />
              ))}
            </Box>
          ) : fetchError ? (
            <Typography color='error' variant='body2'>
              {fetchError}
            </Typography>
          ) : (
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>{text.target}</TableCell>
                  <TableCell>{text.module}</TableCell>
                  <TableCell>{text.source}</TableCell>
                  <TableCell>{text.violation}</TableCell>
                  <TableCell>{text.counter}</TableCell>
                  <TableCell>{text.window}</TableCell>
                  <TableCell>{text.author}</TableCell>
                  <TableCell align='right'>{text.actions}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
              {filteredStates.length ? (
                filteredStates.map(state => {
                  const totalCount = state.count + state.remaining
                  return (
                    <TableRow key={`${state.id}-${state.source}`}>
                      <TableCell>
                        <Typography variant='body2'>{targetLabel(state)}</Typography>
                      </TableCell>
                      <TableCell>{moduleLabel(state.module)}</TableCell>
                      <TableCell>
                        <Chip
                          size='small'
                          color={state.source === 'manual' ? 'warning' : 'default'}
                            label={sourceLabel(state.source)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2'>
                            {state.violationNumber != null ? state.violationNumber : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2'>
                            {state.count}/{totalCount}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2'>
                            {formatDate(state.windowEnd)}{' '}
                            {state.source === 'manual' && !state.blockedUntil
                              ? `• ${text.permanent}`
                              : state.blockedUntil
                                ? `• блок до ${formatDate(state.blockedUntil)}`
                                : ''}
                          </Typography>
                        </TableCell>
                        <TableCell>
                        <Typography variant='body2'>
                          {state.source === 'state' ? (
                            <Link
                              href={`/${currentLang}/admin/rate-limits/events`}
                              className='text-primary'
                              target='_blank'
                              rel='noreferrer'
                            >
                              Ratelimit
                            </Link>
                          ) : state.blockedByUser?.email ? (
                            <Link
                              href={`/${currentLang}/apps/user/view?id=${state.blockedByUser.id}`}
                              className='text-primary'
                              target='_blank'
                              rel='noreferrer'
                            >
                              {state.blockedByUser.email}
                            </Link>
                          ) : state.blockedBy || state.activeBlock?.blockedBy || '—'}
                        </Typography>
                        </TableCell>
                        <TableCell align='right'>
                          <Box className='flex items-center gap-1 justify-end'>
                            <Tooltip title='Просмотр'>
                              <IconButton
                                size='small'
                                onClick={() => {
                                  setViewEntry(state)
                                  setViewOpen(true)
                                  void fetchEvents(state.module, state.key)
                                }}
                              >
                                <i className='ri-eye-line' />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title='Редактировать'>
                              <IconButton size='small'>
                                <i className='ri-edit-line' />
                              </IconButton>
                            </Tooltip>
                            {state.source === 'manual' ? (
                              <Tooltip title='Удалить'>
                                <span>
                                  <IconButton
                                    size='small'
                                    color='error'
                                    onClick={() => handleDelete(state.id, state.source)}
                                    disabled={deletingId === state.id}
                                  >
                                    {deletingId === state.id ? (
                                      <i className='ri-loader-4-line animate-spin' />
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
                  })
              ) : (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography variant='body2' color='text.secondary'>
                      {text.noRecords}
                    </Typography>
                  </TableCell>
                </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          <Divider sx={{ my: 2 }} />

          <Box className='flex items-center justify-between'>
            <Typography variant='body2'>Показано {states.length} из {total}</Typography>
            {nextCursor ? (
              <Button
                variant='contained'
                startIcon={<i className='ri-arrow-down-line' />}
                onClick={() => fetchStates({ append: true, cursor: nextCursor })}
                disabled={loading}
              >
                {text.loadMore}
              </Button>
            ) : null}
          </Box>
        </CardContent>
      </Card>

      <Dialog fullWidth maxWidth='sm' open={viewOpen} onClose={() => setViewOpen(false)}>
        <DialogTitle>Детали блокировки</DialogTitle>
        <DialogContent dividers>
          {viewEntry ? (
            <Stack spacing={1.5}>
              <Typography variant='body2'><strong>Ключ:</strong> {viewEntry.key}</Typography>
              {viewEntry.user?.email || viewEntry.targetEmail || viewEntry.targetIp ? (
                <Typography variant='body2'>
                  <strong>Пользователь:</strong>{' '}
                  {viewEntry.user?.id ? (
                    <Link
                      href={`/${currentLang}/apps/user/view?id=${viewEntry.user.id}`}
                      className='text-primary'
                      target='_blank'
                      rel='noreferrer'
                    >
                      {viewEntry.user.email || viewEntry.targetEmail || viewEntry.targetIp}
                    </Link>
                  ) : (
                    viewEntry.user?.email || viewEntry.targetEmail || viewEntry.targetIp
                  )}
                </Typography>
              ) : null}
              <Typography variant='body2'><strong>Модуль:</strong> {moduleLabel(viewEntry.module)}</Typography>
              <Typography variant='body2'><strong>Источник:</strong> {sourceLabel(viewEntry.source)}</Typography>
              <Typography variant='body2'><strong>Счётчик:</strong> {viewEntry.count}</Typography>
              <Typography variant='body2'><strong>Нарушение №:</strong> {viewEntry.violationNumber ?? '—'}</Typography>
              <Typography variant='body2'><strong>Осталось:</strong> {viewEntry.remaining}</Typography>
              <Typography variant='body2'><strong>Окно до:</strong> {formatDate(viewEntry.windowEnd)}</Typography>
              <Typography variant='body2'>
                <strong>Блокировка до:</strong>{' '}
                {viewEntry.source === 'manual' && !viewEntry.blockedUntil
                  ? text.permanent
                  : viewEntry.blockedUntil
                    ? formatDate(viewEntry.blockedUntil)
                    : '—'}
              </Typography>
              {viewEntry.blockedUntil && countdown ? (
                <Typography variant='body2' color='error'><strong>До окончания:</strong> {countdown ?? '—'}</Typography>
              ) : null}
              {viewEntry.reason || viewEntry.activeBlock?.reason ? (
                <Typography variant='body2'>
                  <strong>Причина:</strong> {viewEntry.reason || viewEntry.activeBlock?.reason}
                </Typography>
              ) : null}
              {viewEntry.notes || viewEntry.activeBlock?.notes ? (
                <Typography variant='body2'>
                  <strong>Заметка:</strong> {viewEntry.notes || viewEntry.activeBlock?.notes}
                </Typography>
              ) : null}
              {viewEntry.blockedByUser?.email ||
              viewEntry.blockedBy ||
              viewEntry.activeBlock?.blockedBy ? (
                <Typography variant='body2'>
                  <strong>Автор блокировки:</strong>{' '}
                  {viewEntry.source === 'state' ? (
                    <Link
                      href={`/${currentLang}/admin/rate-limits/events`}
                      className='text-primary'
                      target='_blank'
                      rel='noreferrer'
                    >
                      Ratelimit
                    </Link>
                  ) : viewEntry.blockedByUser?.email ? (
                    <Link
                      href={`/${currentLang}/apps/user/view?id=${viewEntry.blockedByUser.id}`}
                      className='text-primary'
                      target='_blank'
                      rel='noreferrer'
                    >
                      {viewEntry.blockedByUser.email}
                    </Link>
                  ) : (
                    viewEntry.blockedBy || viewEntry.activeBlock?.blockedBy
                  )}
                </Typography>
              ) : null}
              {viewEntry.activeBlock ? (
                <>
                  <Typography variant='body2'><strong>Заблокирован:</strong> {formatDate(viewEntry.activeBlock.blockedAt)}</Typography>
                  <Typography variant='body2'><strong>Разблокирован:</strong> {viewEntry.activeBlock.unblockedAt ? formatDate(viewEntry.activeBlock.unblockedAt) : '—'}</Typography>
                </>
              ) : null}
            </Stack>
          ) : null}
          <Divider sx={{ my: 2 }} />
          <Typography variant='subtitle2'>История блокировок</Typography>
          {eventsLoading ? (
            <Box className='flex flex-col gap-1 mt-1'>
              {[0, 1, 2].map(i => (
                <Skeleton key={`ev-skel-${i}`} height={28} />
              ))}
            </Box>
          ) : events.length ? (
            <Stack spacing={2} className='mt-2'>
              {events.map(ev => {
                const windowMs = new Date(ev.windowEnd).getTime() - new Date(ev.windowStart).getTime()
                const overText =
                  ev.module === 'chat'
                    ? `Превышен лимит сообщений. Из разрешенных ${ev.maxRequests} за ${humanizeWindow(windowMs)}, отправлено ${ev.count}.`
                    : `Превышен лимит: ${ev.count}/${ev.maxRequests} за ${humanizeWindow(windowMs)}.`
                return (
                  <Box key={ev.id} className='border border-solid border-divider rounded-md p-2'>
                    <Typography variant='body2' fontWeight={600}>
                      {formatDate(ev.createdAt)}
                    </Typography>
                    <Typography variant='body2' className='mt-1'>
                      {overText}
                    </Typography>
                    <Typography variant='caption' color='text.secondary' className='mt-0.5 block'>
                      Окно до {formatDate(ev.windowEnd)}
                      {ev.blockedUntil ? ` • блок до ${formatDate(ev.blockedUntil)}` : ''}
                    </Typography>
                  </Box>
                )
              })}
            </Stack>
          ) : (
            <Typography variant='body2' color='text.secondary' className='mt-2'>История пуста</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={manualBlockDialogOpen} onClose={closeManualBlockDialog} fullWidth maxWidth='sm'>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          {t.manualBlockDialogTitle || 'Manual block'}
          <IconButton size='small' onClick={() => setHelpOpen(true)}>
            <i className='ri-information-line' />
          </IconButton>
        </DialogTitle>
        <DialogContent className='flex flex-col gap-4'>
          <TextField
            select
            label={t.filterModule || 'Module'}
            value={manualBlockForm.module}
            onChange={event => handleManualBlockChange('module', event.target.value)}
            fullWidth
          >
            {modules.map(option => (
              <MenuItem key={option} value={option}>
                {option === 'all' ? (t.filterModuleAll || moduleLabel(option)) : moduleLabel(option)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t.manualBlockTarget || 'Target'}
            value={manualBlockForm.target}
            onChange={event => handleManualBlockChange('target', event.target.value as ManualBlockForm['target'])}
            fullWidth
          >
            <MenuItem value='user'>{t.manualBlockTargetUser || 'User ID'}</MenuItem>
            <MenuItem value='email'>{t.manualBlockTargetEmail || 'Email'}</MenuItem>
            <MenuItem value='ip'>{t.manualBlockTargetIp || 'IP address'}</MenuItem>
            <MenuItem value='cidr'>CIDR</MenuItem>
            <MenuItem value='asn'>ASN</MenuItem>
          </TextField>
          {manualBlockForm.target === 'email' ? (
            <TextField
              label={t.manualBlockEmailLabel || 'Email'}
              value={manualBlockForm.email}
              onChange={event => handleManualBlockChange('email', event.target.value)}
              fullWidth
              multiline
              minRows={3}
              placeholder='One per line'
            />
          ) : null}
          {manualBlockForm.target === 'ip' ? (
            <TextField
              label={t.manualBlockIpLabel || 'IP address'}
              value={manualBlockForm.ipAddress}
              onChange={event => handleManualBlockChange('ipAddress', event.target.value)}
              fullWidth
              multiline
              minRows={3}
              placeholder='One per line'
            />
          ) : null}
          {manualBlockForm.target === 'cidr' ? (
            <TextField
              label='CIDR (e.g. 192.168.0.0/24)'
              value={manualBlockForm.cidr}
              onChange={event => handleManualBlockChange('cidr', event.target.value)}
              fullWidth
              multiline
              minRows={3}
              placeholder='One per line'
            />
          ) : null}
          {manualBlockForm.target === 'asn' ? (
            <TextField
              label='ASN (e.g. AS12345)'
              value={manualBlockForm.asn}
              onChange={event => handleManualBlockChange('asn', event.target.value)}
              fullWidth
              multiline
              minRows={3}
              placeholder='One per line'
            />
          ) : null}
          {manualBlockForm.target === 'user' ? (
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
            helperText={t.manualBlockDurationHint || 'Leave empty or set 0 for indefinite block.'}
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
            {t.manualBlockCancel || 'Cancel'}
          </Button>
          <Button variant='contained' onClick={submitManualBlock} disabled={creatingBlock}>
            {creatingBlock ? (t.manualBlockSaving || 'Saving...') : (t.manualBlockSave || 'Save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Инструкция</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <Typography variant='body2'>User ID / Email / IP / CIDR / ASN — по одному в строке.</Typography>
            <Typography variant='body2'>CIDR: например 192.168.0.0/24, 10.0.0.0/8.</Typography>
            <Typography variant='body2'>ASN: например AS12345.</Typography>
            <Typography variant='body2'>Reason обязательно. Пустая длительность = бессрочно.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpOpen(false)}>OK</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={overwriteDialogOpen} onClose={() => setOverwriteDialogOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>Потвердите перезапись</DialogTitle>
        <DialogContent>
          <Typography variant='body2'>Блокировка уже существует. Перезаписать её?</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant='outlined' onClick={() => { setOverwriteDialogOpen(false); setPendingPayload(null) }} disabled={creatingBlock}>
            Отмена
          </Button>
          <Button variant='contained' onClick={confirmOverwrite} disabled={creatingBlock}>
            Перезаписать
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default BlocksPage

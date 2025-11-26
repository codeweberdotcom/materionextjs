'use client'

import { useCallback, useEffect, useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
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
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Grid from '@mui/material/Grid'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import Box from '@mui/material/Box'

import { toast } from 'react-toastify'

import { usePermissions } from '@/hooks/usePermissions'

// Типы
interface EmailTemplate {
  id: string
  name: string
  subject: string
}

interface EventTrigger {
  source?: string
  type?: string
  module?: string
  severity?: string[]
}

interface ScenarioAction {
  type: 'notification'
  channel: 'email' | 'sms' | 'browser' | 'telegram'
  to?: string
  toField?: string
  templateId?: string
  subject?: string
  content?: string
  delay?: number
}

interface NotificationScenario {
  id: string
  name: string
  description?: string
  enabled: boolean
  trigger: EventTrigger
  actions: ScenarioAction[]
  conditions?: Record<string, any>
  priority: number
  createdAt: string
  updatedAt: string
  createdBy?: string
}

// Константы
const EVENT_SOURCES = [
  { value: 'registration', label: 'Регистрация' },
  { value: 'auth', label: 'Авторизация' },
  { value: 'order', label: 'Заказы' },
  { value: 'payment', label: 'Платежи' },
  { value: 'chat', label: 'Чат' },
  { value: 'moderation', label: 'Модерация' },
  { value: 'system', label: 'Система' },
]

const EVENT_TYPES = [
  { value: 'user.registered', label: 'Пользователь зарегистрирован' },
  { value: 'user.login', label: 'Вход в систему' },
  { value: 'user.password_reset', label: 'Сброс пароля' },
  { value: 'user.email_verified', label: 'Email подтверждён' },
  { value: 'order.created', label: 'Заказ создан' },
  { value: 'order.paid', label: 'Заказ оплачен' },
  { value: 'payment.received', label: 'Платёж получен' },
]

const CHANNELS = [
  { value: 'email', label: 'Email', icon: 'ri-mail-line' },
  { value: 'sms', label: 'SMS', icon: 'ri-smartphone-line' },
  { value: 'browser', label: 'Браузер', icon: 'ri-notification-line' },
  { value: 'telegram', label: 'Telegram', icon: 'ri-telegram-line' },
]

const formatDateTime = (value?: string | null) => {
  if (!value) return '–'
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value))
  } catch {
    return value
  }
}

const NotificationScenarios = () => {
  const { checkPermission, isLoading: permissionsLoading } = usePermissions()

  // Состояния
  const [scenarios, setScenarios] = useState<NotificationScenario[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingScenario, setEditingScenario] = useState<NotificationScenario | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingScenario, setDeletingScenario] = useState<NotificationScenario | null>(null)
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)

  // Форма
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    enabled: true,
    triggerSource: '',
    triggerType: '',
    triggerModule: '',
    actionChannel: 'email' as 'email' | 'sms' | 'browser' | 'telegram',
    actionToField: 'user.email',
    actionTemplateId: '', // ID шаблона email
    actionSubject: '',
    actionContent: '',
    actionDelay: 0,
    priority: 0,
    sendToChannel: false, // Для Telegram канала
  })

  // Права доступа
  const canRead = checkPermission('notificationScenarios', 'read')
  const canCreate = checkPermission('notificationScenarios', 'create')
  const canUpdate = checkPermission('notificationScenarios', 'update')
  const canDelete = checkPermission('notificationScenarios', 'delete')

  // Загрузка сценариев
  const fetchScenarios = useCallback(async () => {
    if (!canRead) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/notification-scenarios')
      if (!response.ok) throw new Error('Failed to load scenarios')
      const data = await response.json()
      setScenarios(data.scenarios || [])
    } catch (error) {
      toast.error('Ошибка загрузки сценариев')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [canRead])

  // Загрузка email шаблонов
  const fetchEmailTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    try {
      const response = await fetch('/api/settings/email-templates')
      if (response.ok) {
        const data = await response.json()
        setEmailTemplates(data || [])
      }
    } catch (error) {
      console.error('Error loading email templates:', error)
    } finally {
      setTemplatesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!permissionsLoading) {
      fetchScenarios()
    }
  }, [fetchScenarios, permissionsLoading])

  // Обработчики формы
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      enabled: true,
      triggerSource: '',
      triggerType: '',
      triggerModule: '',
      actionChannel: 'email',
      actionToField: 'user.email',
      actionTemplateId: '',
      actionSubject: '',
      actionContent: '',
      actionDelay: 0,
      priority: 0,
      sendToChannel: false,
    })
    setEditingScenario(null)
  }

  const openCreateDialog = () => {
    resetForm()
    fetchEmailTemplates()
    setDialogOpen(true)
  }

  const openEditDialog = (scenario: NotificationScenario) => {
    setEditingScenario(scenario)
    fetchEmailTemplates()
    const action = scenario.actions[0] || {}
    setFormData({
      name: scenario.name,
      description: scenario.description || '',
      enabled: scenario.enabled,
      triggerSource: scenario.trigger?.source || '',
      triggerType: scenario.trigger?.type || '',
      triggerModule: scenario.trigger?.module || '',
      actionChannel: action.channel || 'email',
      actionToField: action.toField || 'user.email',
      actionTemplateId: action.templateId || '',
      actionSubject: action.subject || '',
      actionContent: action.content || '',
      actionDelay: action.delay || 0,
      priority: scenario.priority,
      sendToChannel: action.channel === 'telegram' && !action.toField,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Введите название сценария')
      return
    }

    setSaving(true)

    try {
      const scenarioData = {
        name: formData.name,
        description: formData.description,
        enabled: formData.enabled,
        trigger: {
          source: formData.triggerSource || undefined,
          type: formData.triggerType || undefined,
          module: formData.triggerModule || undefined,
        },
        actions: [{
          type: 'notification' as const,
          channel: formData.actionChannel,
          toField: formData.sendToChannel ? undefined : (formData.actionToField || undefined),
          templateId: formData.actionTemplateId || undefined,
          subject: formData.actionSubject || undefined,
          content: formData.actionContent || undefined,
          delay: formData.actionDelay || undefined,
        }],
        priority: formData.priority,
      }

      const url = editingScenario
        ? `/api/admin/notification-scenarios/${editingScenario.id}`
        : '/api/admin/notification-scenarios'
      
      const response = await fetch(url, {
        method: editingScenario ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenarioData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save')
      }

      toast.success(editingScenario ? 'Сценарий обновлён' : 'Сценарий создан')
      setDialogOpen(false)
      resetForm()
      fetchScenarios()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEnabled = async (scenario: NotificationScenario) => {
    try {
      const response = await fetch(`/api/admin/notification-scenarios/${scenario.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !scenario.enabled }),
      })

      if (!response.ok) throw new Error('Failed to update')

      setScenarios(prev =>
        prev.map(s =>
          s.id === scenario.id ? { ...s, enabled: !s.enabled } : s
        )
      )
      toast.success(scenario.enabled ? 'Сценарий отключён' : 'Сценарий включён')
    } catch (error) {
      toast.error('Ошибка обновления')
    }
  }

  const handleDelete = async () => {
    if (!deletingScenario) return

    try {
      const response = await fetch(`/api/admin/notification-scenarios/${deletingScenario.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete')

      toast.success('Сценарий удалён')
      setDeleteDialogOpen(false)
      setDeletingScenario(null)
      fetchScenarios()
    } catch (error) {
      toast.error('Ошибка удаления')
    }
  }

  const getChannelIcon = (channel: string) => {
    const ch = CHANNELS.find(c => c.value === channel)
    return ch ? <i className={ch.icon} /> : null
  }

  const getChannelLabel = (channel: string) => {
    const ch = CHANNELS.find(c => c.value === channel)
    return ch?.label || channel
  }

  // Рендер
  if (permissionsLoading || loading) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress />
      </div>
    )
  }

  if (!canRead) {
    return (
      <Card>
        <CardContent>
          <Typography>Нет доступа к управлению сценариями уведомлений</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Сценарии уведомлений"
          subheader="Автоматическая отправка уведомлений на основе событий системы"
          action={
            <div className='flex gap-2'>
              <Button variant='outlined' onClick={fetchScenarios} disabled={loading}>
                <i className='ri-refresh-line mr-2' />
                Обновить
              </Button>
              {canCreate && (
                <Button variant='contained' onClick={openCreateDialog}>
                  <i className='ri-add-line mr-2' />
                  Создать сценарий
                </Button>
              )}
            </div>
          }
        />
        <CardContent>
          {scenarios.length === 0 ? (
            <Alert severity="info">
              Сценарии не найдены. Создайте первый сценарий для автоматической отправки уведомлений.
            </Alert>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Статус</TableCell>
                  <TableCell>Название</TableCell>
                  <TableCell>Триггер</TableCell>
                  <TableCell>Канал</TableCell>
                  <TableCell>Приоритет</TableCell>
                  <TableCell>Обновлён</TableCell>
                  <TableCell align='right'>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scenarios.map(scenario => (
                  <TableRow key={scenario.id} hover>
                    <TableCell>
                      <Switch
                        checked={scenario.enabled}
                        onChange={() => handleToggleEnabled(scenario)}
                        disabled={!canUpdate}
                        size='small'
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2' fontWeight={500}>
                        {scenario.name}
                      </Typography>
                      {scenario.description && (
                        <Typography variant='caption' color='text.secondary'>
                          {scenario.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {scenario.trigger?.source && (
                          <Chip size='small' label={scenario.trigger.source} variant='outlined' />
                        )}
                        {scenario.trigger?.type && (
                          <Chip size='small' label={scenario.trigger.type} color='primary' variant='outlined' />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {scenario.actions.map((action, idx) => (
                        <Chip
                          key={idx}
                          size='small'
                          icon={getChannelIcon(action.channel) || undefined}
                          label={getChannelLabel(action.channel)}
                          color={action.channel === 'email' ? 'info' : action.channel === 'telegram' ? 'primary' : 'default'}
                        />
                      ))}
                    </TableCell>
                    <TableCell>
                      <Chip size='small' label={scenario.priority} />
                    </TableCell>
                    <TableCell>
                      <Typography variant='caption'>
                        {formatDateTime(scenario.updatedAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align='right'>
                      <Tooltip title='Редактировать'>
                        <IconButton
                          size='small'
                          onClick={() => openEditDialog(scenario)}
                          disabled={!canUpdate}
                        >
                          <i className='ri-edit-line' />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title='Удалить'>
                        <IconButton
                          size='small'
                          color='error'
                          onClick={() => {
                            setDeletingScenario(scenario)
                            setDeleteDialogOpen(true)
                          }}
                          disabled={!canDelete}
                        >
                          <i className='ri-delete-bin-line' />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Диалог создания/редактирования */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='md' fullWidth>
        <DialogTitle>
          {editingScenario ? 'Редактировать сценарий' : 'Создать сценарий'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            {/* Основные данные */}
            <Grid item xs={12}>
              <Typography variant='subtitle2' gutterBottom>
                Основные настройки
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='Название'
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='Приоритет'
                type='number'
                value={formData.priority}
                onChange={e => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                helperText='Больше = выше приоритет'
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label='Описание'
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.enabled}
                    onChange={e => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                  />
                }
                label='Сценарий включён'
              />
            </Grid>

            {/* Триггер */}
            <Grid item xs={12}>
              <Typography variant='subtitle2' gutterBottom sx={{ mt: 2 }}>
                Триггер (когда срабатывает)
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                select
                label='Источник события'
                value={formData.triggerSource}
                onChange={e => setFormData(prev => ({ ...prev, triggerSource: e.target.value }))}
              >
                <MenuItem value=''>Любой</MenuItem>
                {EVENT_SOURCES.map(s => (
                  <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                select
                label='Тип события'
                value={formData.triggerType}
                onChange={e => setFormData(prev => ({ ...prev, triggerType: e.target.value }))}
              >
                <MenuItem value=''>Любой</MenuItem>
                {EVENT_TYPES.map(t => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label='Модуль'
                value={formData.triggerModule}
                onChange={e => setFormData(prev => ({ ...prev, triggerModule: e.target.value }))}
                helperText='Например: user, order'
              />
            </Grid>

            {/* Действие */}
            <Grid item xs={12}>
              <Typography variant='subtitle2' gutterBottom sx={{ mt: 2 }}>
                Действие (что отправить)
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label='Канал'
                value={formData.actionChannel}
                onChange={e => setFormData(prev => ({ 
                  ...prev, 
                  actionChannel: e.target.value as any,
                  actionToField: e.target.value === 'telegram' ? '' : 'user.email',
                }))}
              >
                {CHANNELS.map(c => (
                  <MenuItem key={c.value} value={c.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <i className={c.icon} />
                      {c.label}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='Задержка (мс)'
                type='number'
                value={formData.actionDelay}
                onChange={e => setFormData(prev => ({ ...prev, actionDelay: parseInt(e.target.value) || 0 }))}
                helperText='0 = немедленно'
              />
            </Grid>

            {/* Специфичные настройки для Telegram */}
            {formData.actionChannel === 'telegram' && (
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.sendToChannel}
                      onChange={e => setFormData(prev => ({ ...prev, sendToChannel: e.target.checked }))}
                    />
                  }
                  label='Отправить в Telegram канал (для мониторинга)'
                />
              </Grid>
            )}

            {!formData.sendToChannel && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label='Поле получателя из события'
                  value={formData.actionToField}
                  onChange={e => setFormData(prev => ({ ...prev, actionToField: e.target.value }))}
                  helperText={
                    formData.actionChannel === 'email' ? 'Например: user.email, payload.email' :
                    formData.actionChannel === 'sms' ? 'Например: user.phone, payload.phone' :
                    formData.actionChannel === 'telegram' ? 'Например: user.telegramChatId' :
                    'Например: user.id (для браузерных уведомлений)'
                  }
                />
              </Grid>
            )}

            {/* Выбор шаблона (только для email) */}
            {formData.actionChannel === 'email' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label='Email шаблон'
                  value={formData.actionTemplateId}
                  onChange={e => {
                    const templateId = e.target.value
                    const template = emailTemplates.find(t => t.id === templateId)
                    setFormData(prev => ({
                      ...prev,
                      actionTemplateId: templateId,
                      // Автозаполнение темы из шаблона
                      actionSubject: template?.subject || prev.actionSubject,
                    }))
                  }}
                  disabled={templatesLoading}
                  helperText={
                    templatesLoading
                      ? 'Загрузка шаблонов...'
                      : emailTemplates.length === 0
                        ? 'Шаблоны не найдены. Создайте в разделе "Email шаблоны"'
                        : 'Выберите шаблон или оставьте пустым для кастомного содержимого'
                  }
                >
                  <MenuItem value=''>
                    <em>Без шаблона (кастомное содержимое)</em>
                  </MenuItem>
                  {emailTemplates.map(t => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                label='Тема сообщения'
                value={formData.actionSubject}
                onChange={e => setFormData(prev => ({ ...prev, actionSubject: e.target.value }))}
                helperText='Поддерживаются переменные: {{userName}}, {{email}} и т.д.'
                disabled={formData.actionChannel === 'email' && !!formData.actionTemplateId}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label='Содержимое'
                value={formData.actionContent}
                onChange={e => setFormData(prev => ({ ...prev, actionContent: e.target.value }))}
                multiline
                rows={4}
                helperText={
                  formData.actionChannel === 'email' && formData.actionTemplateId
                    ? 'Содержимое берётся из шаблона. Здесь можно добавить дополнительный текст.'
                    : 'Поддерживаются переменные из события: {{user.name}}, {{payload.orderId}} и т.д.'
                }
                disabled={formData.actionChannel === 'email' && !!formData.actionTemplateId}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={handleSave} variant='contained' disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог подтверждения удаления */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Удалить сценарий?</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите удалить сценарий "{deletingScenario?.name}"?
            Это действие нельзя отменить.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleDelete} color='error' variant='contained'>
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default NotificationScenarios




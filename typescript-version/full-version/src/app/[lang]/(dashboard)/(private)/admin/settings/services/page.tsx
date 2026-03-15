'use client'

/**
 * Страница управления внешними сервисами
 * 
 * @module app/[lang]/(dashboard)/admin/settings/services/page
 */

import { useState, useEffect, useCallback } from 'react'

import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Skeleton,
  Tooltip,
  Box,
  CircularProgress,
  Divider,
  InputAdornment
} from '@mui/material'

// Remix Icons components (проект использует Remix Icons)
// Стиль для вертикального выравнивания иконок
const iconStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }

const AddIcon = () => <i className='ri-add-line' style={iconStyle} />
const EditIcon = () => <i className='ri-pencil-line' style={iconStyle} />
const DeleteIcon = () => <i className='ri-delete-bin-line' style={iconStyle} />
const RefreshIcon = () => <i className='ri-refresh-line' style={iconStyle} />

const CheckCircleIcon = ({ fontSize }: { color?: string; fontSize?: string }) => (
  <i className='ri-checkbox-circle-fill' style={{ ...iconStyle, color: 'inherit', fontSize: fontSize === 'small' ? '16px' : undefined }} />
)

const ErrorIcon = ({ fontSize }: { color?: string; fontSize?: string }) => (
  <i className='ri-error-warning-fill' style={{ ...iconStyle, color: 'inherit', fontSize: fontSize === 'small' ? '16px' : undefined }} />
)

const WarningIcon = ({ fontSize }: { color?: string; fontSize?: string }) => (
  <i className='ri-alert-fill' style={{ ...iconStyle, color: 'inherit', fontSize: fontSize === 'small' ? '16px' : undefined }} />
)

const HelpIcon = ({ fontSize }: { color?: string; fontSize?: string }) => (
  <i className='ri-question-line' style={{ ...iconStyle, color: 'inherit', fontSize: fontSize === 'small' ? '16px' : undefined }} />
)

const VisibilityIcon = () => <i className='ri-eye-line' style={iconStyle} />
const VisibilityOffIcon = () => <i className='ri-eye-off-line' style={iconStyle} />
const StorageIcon = () => <i className='ri-server-line' style={iconStyle} />

// Типы
interface ServiceConfig {
  id: string
  name: string
  displayName: string
  type: string
  host: string
  port: number | null
  protocol: string | null
  username: string | null
  tlsEnabled: boolean
  enabled: boolean
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'UNKNOWN'
  lastCheck: string | null
  lastError: string | null
  hasPassword: boolean
  hasToken: boolean
  metadata: string | null
  createdAt: string
  updatedAt: string
}

interface ServiceFormData {
  name: string
  displayName: string
  type: string
  host: string
  port: string
  protocol: string
  username: string
  password: string
  token: string
  tlsEnabled: boolean
  enabled: boolean

  // S3 specific
  s3Region: string
  s3Bucket: string
  s3StorageType: string
  s3ForcePathStyle: boolean

  // PostgreSQL specific
  pgDatabase: string
}

const SERVICE_TYPES = [
  { value: 'REDIS', label: 'Redis', icon: '🔴' },
  { value: 'POSTGRESQL', label: 'PostgreSQL', icon: '🐘' },
  { value: 'PROMETHEUS', label: 'Prometheus', icon: '🔥' },
  { value: 'LOKI', label: 'Loki', icon: '📋' },
  { value: 'GRAFANA', label: 'Grafana', icon: '📊' },
  { value: 'SENTRY', label: 'Sentry', icon: '🐛' },
  { value: 'S3', label: 'S3 / MinIO', icon: '📦' },
  { value: 'SMTP', label: 'SMTP', icon: '📧' },
  { value: 'ELASTICSEARCH', label: 'Elasticsearch', icon: '🔍' },
  { value: 'FIRECRAWL', label: 'Firecrawl', icon: '🔥' }
]

const DEFAULT_PORTS: Record<string, number> = {
  REDIS: 6379,
  POSTGRESQL: 5432,
  PROMETHEUS: 9090,
  LOKI: 3100,
  GRAFANA: 3000,
  S3: 9000,
  SMTP: 587,
  ELASTICSEARCH: 9200,
  FIRECRAWL: 443
}

const DEFAULT_PROTOCOLS: Record<string, string> = {
  REDIS: 'redis://',
  POSTGRESQL: 'postgresql://',
  PROMETHEUS: 'http://',
  LOKI: 'http://',
  GRAFANA: 'http://',
  SENTRY: 'https://',
  S3: 'http://',
  SMTP: 'smtp://',
  ELASTICSEARCH: 'http://',
  FIRECRAWL: 'https://'
}

const S3_STORAGE_TYPES = [
  { value: 'minio', label: 'MinIO', host: 'localhost', port: 9000 },
  { value: 'aws', label: 'AWS S3', host: 's3.amazonaws.com', port: 443 },
  { value: 'digitalocean', label: 'DigitalOcean Spaces', host: 'nyc3.digitaloceanspaces.com', port: 443 },
  { value: 'yandex', label: 'Yandex Object Storage', host: 'storage.yandexcloud.net', port: 443 },
  { value: 'selectel', label: 'Selectel S3', host: 's3.selcdn.ru', port: 443 },
  { value: 'custom', label: 'Custom S3-compatible', host: '', port: 9000 }
]

const S3_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU (Ireland)' },
  { value: 'eu-central-1', label: 'EU (Frankfurt)' },
  { value: 'ru-central1', label: 'Russia (Yandex)' },
  { value: 'ru-1', label: 'Russia (Selectel)' },
  { value: 'nyc3', label: 'NYC3 (DigitalOcean)' },
  { value: 'custom', label: 'Custom region' }
]

const initialFormData: ServiceFormData = {
  name: '',
  displayName: '',
  type: 'REDIS',
  host: 'localhost',
  port: '6379',
  protocol: 'redis://',
  username: '',
  password: '',
  token: '',
  tlsEnabled: false,
  enabled: true,

  // S3 specific
  s3Region: 'us-east-1',
  s3Bucket: '',
  s3StorageType: 'minio',
  s3ForcePathStyle: true,

  // PostgreSQL specific
  pgDatabase: 'postgres'
}

export default function ExternalServicesPage() {
  const [services, setServices] = useState<ServiceConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [formData, setFormData] = useState<ServiceFormData>(initialFormData)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingService, setDeletingService] = useState<ServiceConfig | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Test connection
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null)

  // Password visibility
  const [showPassword, setShowPassword] = useState(false)
  const [showToken, setShowToken] = useState(false)

  // Track if credentials are already set (for edit mode)
  const [existingCredentials, setExistingCredentials] = useState({
    hasPassword: false,
    hasToken: false
  })

  // Fetch services
  const fetchServices = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/settings/services')
      const data = await response.json()

      if (data.success) {
        setServices(data.data)
        setError(null)
      } else {
        setError(data.error || 'Ошибка загрузки')
      }
    } catch (err) {
      setError('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchServices()
  }, [fetchServices])

  // Handle type change
  const handleTypeChange = (type: string) => {
    const newData: Partial<ServiceFormData> = {
      type,
      port: DEFAULT_PORTS[type]?.toString() || '',
      protocol: DEFAULT_PROTOCOLS[type] || 'http://'
    }

    // Reset S3 specific fields when switching to S3
    if (type === 'S3') {
      newData.s3StorageType = 'minio'
      newData.s3Region = 'us-east-1'
      newData.s3ForcePathStyle = true
      newData.host = 'localhost'
      newData.port = '9000'
      newData.tlsEnabled = false
    }

    // Reset PostgreSQL specific fields
    if (type === 'POSTGRESQL') {
      newData.pgDatabase = 'postgres'
    }

    // Reset Firecrawl specific fields
    if (type === 'FIRECRAWL') {
      newData.host = 'api.firecrawl.dev'
      newData.port = '443'
      newData.protocol = 'https://'
      newData.tlsEnabled = true
    }

    setFormData(prev => ({ ...prev, ...newData }))
  }

  // Handle S3 storage type change
  const handleS3StorageTypeChange = (storageType: string) => {
    const preset = S3_STORAGE_TYPES.find(t => t.value === storageType)
    
    setFormData(prev => ({
      ...prev,
      s3StorageType: storageType,
      host: preset?.host || prev.host,
      port: preset?.port?.toString() || prev.port,
      tlsEnabled: preset?.port === 443,
      s3ForcePathStyle: storageType === 'minio' || storageType === 'selectel' || storageType === 'custom'
    }))
  }

  // Open create dialog
  const handleOpenCreate = () => {
    setFormData(initialFormData)
    setExistingCredentials({ hasPassword: false, hasToken: false })
    setDialogMode('create')
    setFormError(null)
    setDialogOpen(true)
  }

  // Open edit dialog
  const handleOpenEdit = async (service: ServiceConfig) => {
    try {
      const response = await fetch(`/api/admin/settings/services/${service.id}`)
      const data = await response.json()
      const fullService = data.data || service
      const metadata = fullService.metadata ? JSON.parse(fullService.metadata) : {}

      setFormData({
        name: service.name,
        displayName: service.displayName,
        type: service.type,
        host: service.host,
        port: service.port?.toString() || '',
        protocol: service.protocol || '',
        username: fullService.username || '',
        password: '',
        token: '',
        tlsEnabled: service.tlsEnabled,
        enabled: service.enabled,
        s3Region: metadata.region || 'us-east-1',
        s3Bucket: metadata.bucket || '',
        s3StorageType: metadata.storageType || 'minio',
        s3ForcePathStyle: metadata.forcePathStyle ?? true,
        pgDatabase: metadata.database || 'postgres'
      })

      // Track existing credentials for placeholder display
      setExistingCredentials({
        hasPassword: fullService.hasPassword || false,
        hasToken: fullService.hasToken || false
      })
    } catch {
      setFormData({
        ...initialFormData,
        name: service.name,
        displayName: service.displayName,
        type: service.type,
        host: service.host,
        port: service.port?.toString() || '',
        protocol: service.protocol || '',
        tlsEnabled: service.tlsEnabled,
        enabled: service.enabled,
      })
      setExistingCredentials({
        hasPassword: service.hasPassword || false,
        hasToken: service.hasToken || false
      })
    }

    setEditingId(service.id)
    setDialogMode('edit')
    setFormError(null)
    setDialogOpen(true)
  }

  // Save service
  const handleSave = async () => {
    try {
      setSaving(true)
      setFormError(null)

      const payload: any = {
        displayName: formData.displayName,
        type: formData.type,
        host: formData.host,
        port: formData.port ? parseInt(formData.port) : undefined,
        protocol: formData.protocol || undefined,
        username: formData.username || undefined,
        tlsEnabled: formData.tlsEnabled,
        enabled: formData.enabled
      }

      // Добавляем credentials только если заполнены
      if (formData.password) payload.password = formData.password
      if (formData.token) payload.token = formData.token

      // Добавляем metadata для S3
      if (formData.type === 'S3') {
        payload.metadata = {
          region: formData.s3Region,
          bucket: formData.s3Bucket || undefined,
          storageType: formData.s3StorageType,
          forcePathStyle: formData.s3ForcePathStyle
        }
      }

      // Добавляем metadata для PostgreSQL
      if (formData.type === 'POSTGRESQL') {
        payload.metadata = {
          database: formData.pgDatabase || 'postgres'
        }
      }

      if (dialogMode === 'create') {
        payload.name = formData.name

        const response = await fetch('/api/admin/settings/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Ошибка создания')
        }
      } else {
        const response = await fetch(`/api/admin/settings/services/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Ошибка обновления')
        }
      }

      setDialogOpen(false)
      fetchServices()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  // Delete service
  const handleDelete = async () => {
    if (!deletingService) return

    try {
      setDeleting(true)

      const response = await fetch(`/api/admin/settings/services/${deletingService.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()

        throw new Error(data.error || 'Ошибка удаления')
      }

      setDeleteDialogOpen(false)
      setDeletingService(null)
      fetchServices()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
    } finally {
      setDeleting(false)
    }
  }

  // Test connection
  const handleTestConnection = async (id: string) => {
    try {
      setTestingId(id)
      setTestResult(null)

      const response = await fetch(`/api/admin/settings/services/${id}/test`, {
        method: 'POST'
      })

      const data = await response.json()

      setTestResult({
        id,
        success: data.data?.success || false,
        message: data.data?.success
          ? `Подключено! Версия: ${data.data.version || 'N/A'}, Latency: ${data.data.latency}ms`
          : `Ошибка: ${data.data?.error || 'Неизвестная ошибка'}`
      })

      // Обновляем список для отображения нового статуса
      fetchServices()
    } catch (err) {
      setTestResult({
        id,
        success: false,
        message: 'Ошибка сети'
      })
    } finally {
      setTestingId(null)
    }
  }

  // Toggle enabled
  const handleToggleEnabled = async (id: string) => {
    try {
      await fetch(`/api/admin/settings/services/${id}/toggle`, {
        method: 'POST'
      })
      fetchServices()
    } catch (err) {
      setError('Ошибка переключения')
    }
  }

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CONNECTED':
        return <CheckCircleIcon color='success' fontSize='small' />
      case 'ERROR':
        return <ErrorIcon color='error' fontSize='small' />
      case 'DISCONNECTED':
        return <WarningIcon color='warning' fontSize='small' />
      default:
        return <HelpIcon color='disabled' fontSize='small' />
    }
  }

  // Get status chip
  const getStatusChip = (status: string) => {
    const colors: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
      CONNECTED: 'success',
      ERROR: 'error',
      DISCONNECTED: 'warning',
      UNKNOWN: 'default'
    }

    const labels: Record<string, string> = {
      CONNECTED: 'Подключено',
      ERROR: 'Ошибка',
      DISCONNECTED: 'Отключено',
      UNKNOWN: 'Неизвестно'
    }

    return <Chip icon={getStatusIcon(status)} label={labels[status] || status} color={colors[status] || 'default'} size='small' />
  }

  // Get type icon
  const getTypeIcon = (type: string) => {
    const found = SERVICE_TYPES.find(t => t.value === type)

    
return found?.icon || '🔧'
  }

  return (
    <Card>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StorageIcon />
            <Typography variant='h5'>Внешние сервисы</Typography>
          </Box>
        }
        subheader='Управление подключениями к Redis, PostgreSQL, Prometheus, Grafana и другим сервисам'
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button startIcon={<RefreshIcon />} onClick={fetchServices} disabled={loading}>
              Обновить
            </Button>
            <Button variant='contained' startIcon={<AddIcon />} onClick={handleOpenCreate}>
              Добавить
            </Button>
          </Box>
        }
      />
      <CardContent>
        {error && (
          <Alert severity='error' sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {testResult && (
          <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mb: 2 }} onClose={() => setTestResult(null)}>
            {testResult.message}
          </Alert>
        )}

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Сервис</TableCell>
                <TableCell>Тип</TableCell>
                <TableCell>Хост</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Последняя проверка</TableCell>
                <TableCell>Активен</TableCell>
                <TableCell align='right'>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : services.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align='center'>
                    <Typography color='textSecondary' sx={{ py: 4 }}>
                      Нет настроенных сервисов. Нажмите "Добавить" для создания.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                services.map(service => (
                  <TableRow key={service.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant='subtitle2'>{service.displayName}</Typography>
                        <Typography variant='caption' color='textSecondary'>
                          {service.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        icon={<span style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>{getTypeIcon(service.type)}</span>} 
                        label={service.type} 
                        size='small' 
                        variant='outlined' 
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2'>
                        {service.host}
                        {service.port && `:${service.port}`}
                      </Typography>
                      {service.tlsEnabled && (
                        <Chip label='TLS' size='small' color='info' sx={{ ml: 1 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusChip(service.status)}
                      {service.lastError && (
                        <Tooltip title={service.lastError}>
                          <span style={{ marginLeft: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                            <ErrorIcon color='error' fontSize='small' />
                          </span>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      {service.lastCheck ? new Date(service.lastCheck).toLocaleString('ru-RU') : 'Никогда'}
                    </TableCell>
                    <TableCell>
                      <Switch checked={service.enabled} onChange={() => handleToggleEnabled(service.id)} size='small' />
                    </TableCell>
                    <TableCell align='right'>
                      <Tooltip title='Тестировать подключение'>
                        <IconButton onClick={() => handleTestConnection(service.id)} disabled={testingId === service.id}>
                          {testingId === service.id ? <CircularProgress size={20} /> : <RefreshIcon />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title='Редактировать'>
                        <IconButton onClick={() => handleOpenEdit(service)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title='Удалить'>
                        <IconButton
                          color='error'
                          onClick={() => {
                            setDeletingService(service)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{dialogMode === 'create' ? 'Добавить сервис' : 'Редактировать сервис'}</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity='error' sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {dialogMode === 'create' && (
              <TextField
                label='Системное имя'
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                helperText='Уникальный идентификатор (например: redis, postgresql-main)'
              />
            )}

            <TextField
              label='Отображаемое имя'
              value={formData.displayName}
              onChange={e => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
              required
              helperText='Название для отображения (например: Основной Redis)'
            />

            <FormControl fullWidth>
              <InputLabel>Тип сервиса</InputLabel>
              <Select
                value={formData.type}
                onChange={e => handleTypeChange(e.target.value)}
                label='Тип сервиса'
                disabled={dialogMode === 'edit'}
              >
                {SERVICE_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label='Хост'
                value={formData.host}
                onChange={e => setFormData(prev => ({ ...prev, host: e.target.value }))}
                required
                sx={{ flex: 2 }}
              />
              <TextField
                label='Порт'
                value={formData.port}
                onChange={e => setFormData(prev => ({ ...prev, port: e.target.value }))}
                type='number'
                sx={{ flex: 1 }}
              />
            </Box>

            <TextField
              label='Протокол'
              value={formData.protocol}
              onChange={e => setFormData(prev => ({ ...prev, protocol: e.target.value }))}
              helperText='Например: redis://, https://, postgresql://'
            />

            {/* S3 Specific Fields */}
            {formData.type === 'S3' && (
              <>
                <Divider />
                <Typography variant='subtitle2' color='textSecondary'>
                  Настройки S3
                </Typography>

                <FormControl fullWidth>
                  <InputLabel>Тип хранилища</InputLabel>
                  <Select
                    value={formData.s3StorageType}
                    onChange={e => handleS3StorageTypeChange(e.target.value)}
                    label='Тип хранилища'
                  >
                    {S3_STORAGE_TYPES.map(type => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Регион</InputLabel>
                  <Select
                    value={formData.s3Region}
                    onChange={e => setFormData(prev => ({ ...prev, s3Region: e.target.value }))}
                    label='Регион'
                  >
                    {S3_REGIONS.map(region => (
                      <MenuItem key={region.value} value={region.value}>
                        {region.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label='Bucket'
                  value={formData.s3Bucket}
                  onChange={e => setFormData(prev => ({ ...prev, s3Bucket: e.target.value }))}
                  helperText='Имя бакета для хранения файлов'
                  required
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.s3ForcePathStyle}
                      onChange={e => setFormData(prev => ({ ...prev, s3ForcePathStyle: e.target.checked }))}
                    />
                  }
                  label='Path-style URLs (для MinIO и custom S3)'
                />
              </>
            )}

            {/* PostgreSQL Specific Fields */}
            {formData.type === 'POSTGRESQL' && (
              <>
                <Divider />
                <Typography variant='subtitle2' color='textSecondary'>
                  Настройки PostgreSQL
                </Typography>

                <TextField
                  label='База данных'
                  value={formData.pgDatabase}
                  onChange={e => setFormData(prev => ({ ...prev, pgDatabase: e.target.value }))}
                  helperText='Имя базы данных для подключения'
                />
              </>
            )}

            {/* Firecrawl Specific Fields */}
            {formData.type === 'FIRECRAWL' && (
              <>
                <Divider />
                <Typography variant='subtitle2' color='textSecondary'>
                  Настройки Firecrawl
                </Typography>

                <Alert severity='info' sx={{ mb: 1 }}>
                  Получите API ключ на{' '}
                  <a href='https://www.firecrawl.dev/' target='_blank' rel='noopener noreferrer'>
                    firecrawl.dev
                  </a>
                </Alert>
              </>
            )}

            <Divider />
            <Typography variant='subtitle2' color='textSecondary'>
              Аутентификация {formData.type === 'S3' || formData.type === 'FIRECRAWL' ? '' : '(опционально)'}
            </Typography>

            {formData.type !== 'FIRECRAWL' && (
              <TextField
                label={formData.type === 'S3' ? 'Access Key ID' : 'Имя пользователя'}
                value={formData.username}
                onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                required={formData.type === 'S3'}
              />
            )}

            {formData.type !== 'FIRECRAWL' && (
              <TextField
                label={formData.type === 'S3' ? 'Secret Access Key' : 'Пароль'}
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder={dialogMode === 'edit' && existingCredentials.hasPassword ? '••••••••••••' : ''}
                helperText={
                  dialogMode === 'edit' 
                    ? existingCredentials.hasPassword 
                      ? '✓ Установлен. Введите новый для замены или оставьте пустым' 
                      : 'Не установлен'
                    : ''
                }
                required={formData.type === 'S3' && dialogMode === 'create'}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position='end'>
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge='end'>
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            )}

            <TextField
              label={formData.type === 'FIRECRAWL' ? 'API Key' : 'API Токен'}
              type={showToken ? 'text' : 'password'}
              value={formData.token}
              onChange={e => setFormData(prev => ({ ...prev, token: e.target.value }))}
              placeholder={dialogMode === 'edit' && existingCredentials.hasToken ? '••••••••••••' : ''}
              helperText={
                formData.type === 'FIRECRAWL'
                  ? 'API ключ из личного кабинета Firecrawl (fc-...)'
                  : dialogMode === 'edit' 
                    ? existingCredentials.hasToken 
                      ? '✓ Установлен. Введите новый для замены или оставьте пустым' 
                      : 'Не установлен'
                    : ''
              }
              required={formData.type === 'FIRECRAWL'}
              InputProps={{
                endAdornment: (
                  <InputAdornment position='end'>
                    <IconButton onClick={() => setShowToken(!showToken)} edge='end'>
                      {showToken ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <Divider />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.tlsEnabled}
                  onChange={e => setFormData(prev => ({ ...prev, tlsEnabled: e.target.checked }))}
                />
              }
              label='Использовать TLS/SSL'
            />

            <FormControlLabel
              control={
                <Switch checked={formData.enabled} onChange={e => setFormData(prev => ({ ...prev, enabled: e.target.checked }))} />
              }
              label='Сервис активен'
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
          <Button variant='contained' onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : dialogMode === 'create' ? 'Создать' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Удалить сервис?</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите удалить конфигурацию{' '}
            <strong>{deletingService?.displayName}</strong>?
          </Typography>
          <Typography color='textSecondary' variant='body2' sx={{ mt: 1 }}>
            Это действие нельзя отменить. Приложение будет использовать конфигурацию из переменных окружения или
            значения по умолчанию.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Отмена</Button>
          <Button variant='contained' color='error' onClick={handleDelete} disabled={deleting}>
            {deleting ? <CircularProgress size={20} /> : 'Удалить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}


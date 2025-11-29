'use client'

/**
 * Синхронизация медиа - управление задачами синхронизации
 */

import { useState, useEffect, useCallback } from 'react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Skeleton from '@mui/material/Skeleton'

import { toast } from 'react-toastify'

interface SyncResult {
  mediaId: string
  success: boolean
  operation: string
  error?: string
  s3Key?: string
  localPath?: string
}

interface SyncJob {
  id: string
  operation: string
  scope: string
  entityType?: string
  s3Bucket?: string
  status: string
  totalFiles: number
  processedFiles: number
  failedFiles: number
  totalBytes: number
  processedBytes: number
  deleteSource: boolean
  error?: string
  results?: string // JSON string of SyncResult[]
  createdAt: string
  startedAt?: string
  completedAt?: string
  createdBy?: string
  creator?: {
    id: string
    email: string
    name?: string | null
  } | null
  // Batch processing fields
  isParent?: boolean
  parentJobId?: string | null
  batchIndex?: number | null
  batchSize?: number | null
  childJobs?: Array<{
    id: string
    status: string
    processedFiles: number
    failedFiles: number
    batchIndex?: number
  }>
}

const OPERATIONS = [
  { value: 'upload_to_s3_with_delete', label: '☁️ Выгрузить на S3 и удалить локальные', color: 'warning' },
  { value: 'upload_to_s3_keep_local', label: '☁️ Выгрузить на S3 (сохранить локальные)', color: 'info' },
  { value: 'download_from_s3', label: '💾 Загрузить из S3 в локальное', color: 'success' },
  { value: 'download_from_s3_delete_s3', label: '💾 Загрузить из S3 и удалить из S3', color: 'warning' },
  { value: 'delete_local_only', label: '🗑️ Удалить только локальные', color: 'error' },
  { value: 'delete_s3_only', label: '🗑️ Удалить только из S3', color: 'error' },
  { value: 'purge_s3', label: '⚠️ ОЧИСТИТЬ S3 (удалить ВСЕ файлы из bucket)', color: 'error' },
  { value: 'verify_status', label: '🔍 Проверить статусы (сверка с S3)', color: 'info' },
]

const SCOPES = [
  { value: 'all', label: 'Все файлы' },
  { value: 'entity_type', label: 'По типу сущности' },
]

const ENTITY_TYPES = [
  { value: 'user_avatar', label: 'Аватары' },
  { value: 'company_logo', label: 'Логотипы' },
  { value: 'company_banner', label: 'Баннеры' },
  { value: 'company_photo', label: 'Фото компаний' },
  { value: 'listing_image', label: 'Фото объявлений' },
  { value: 'site_logo', label: 'Логотип сайта' },
  { value: 'watermark', label: 'Водяные знаки' },
  { value: 'document', label: 'Документы' },
]

const getStatusColor = (status: string): 'default' | 'warning' | 'success' | 'error' | 'info' => {
  switch (status) {
    case 'pending': return 'default'
    case 'processing': return 'warning'
    case 'completed': return 'success'
    case 'failed': return 'error'
    case 'cancelled': return 'info'
    default: return 'default'
  }
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatDuration = (startedAt?: string, completedAt?: string): string => {
  if (!startedAt) return '-'
  const start = new Date(startedAt).getTime()
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const duration = end - start
  
  if (duration < 1000) return `${duration}ms`
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`
  return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`
}

export default function MediaSync() {
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  
  // New job dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newAction, setNewAction] = useState('')
  const [newScope, setNewScope] = useState('all')
  const [newEntityType, setNewEntityType] = useState('')
  const [creating, setCreating] = useState(false)
  
  // Error details dialog
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<SyncJob | null>(null)
  
  // Verification results dialog
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{
    total: number
    verified: number
    updated: number
    errors: number
    details: Array<{
      mediaId: string
      oldStatus: string
      newStatus: string
      s3Exists: boolean
      localExists: boolean
    }>
  } | null>(null)

  // Dangerous operation confirmation dialog
  const [confirmDangerOpen, setConfirmDangerOpen] = useState(false)
  const [pendingDangerAction, setPendingDangerAction] = useState('')

  // Purge results dialog
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false)
  const [purgeResult, setPurgeResult] = useState<{
    deletedFiles: number
    deletedBytes: number
    errors: number
    details: string[]
  } | null>(null)

  const [accessDenied, setAccessDenied] = useState(false)
  
  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/media/sync?limit=50')
      
      if (response.status === 403) {
        setAccessDenied(true)
        setJobs([])
        return
      }
      
      if (!response.ok) throw new Error('Failed to fetch jobs')
      
      const data = await response.json()
      setJobs(data.jobs)
      setTotal(data.total)
      setAccessDenied(false)
    } catch (error) {
      // Показываем toast только один раз при первой загрузке
      if (loading) {
        toast.error('Ошибка загрузки задач')
      }
    } finally {
      setLoading(false)
    }
  }, [loading])

  useEffect(() => {
    fetchJobs()
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchJobs, 5000)
    return () => clearInterval(interval)
  }, [fetchJobs])

  const createJob = async () => {
    if (!newAction) {
      toast.error('Выберите действие')
      return
    }
    
    if (newScope === 'entity_type' && !newEntityType) {
      toast.error('Выберите тип сущности')
      return
    }

    // Дополнительное подтверждение для опасных операций
    if (newAction === 'purge_s3') {
      setPendingDangerAction(newAction)
      setConfirmDangerOpen(true)
      return
    }
    
    executeCreateJob(newAction)
  }

  const executeCreateJob = async (action: string) => {
    setCreating(true)
    setConfirmDangerOpen(false)
    try {
      const response = await fetch('/api/admin/media/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action,
          scope: newScope,
          entityType: newScope === 'entity_type' ? newEntityType : undefined,
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create job')
      }
      
      const data = await response.json()
      
      // Сохраняем action до сброса состояния
      const actionWas = action
      
      // Закрываем диалог сразу после успешного создания задачи
      setDialogOpen(false)
      
      // Сбрасываем форму
      setNewAction('')
      setNewScope('all')
      setNewEntityType('')
      
      // Для верификации показываем результаты в отдельном диалоге
      if (actionWas === 'verify_status' && data.verification) {
        setVerifyResult(data.verification)
        setVerifyDialogOpen(true)
        toast.success(`Проверено: ${data.verification.total}, обновлено: ${data.verification.updated}`)
      } else if (actionWas === 'purge_s3' && data.purge) {
        setPurgeResult(data.purge)
        setPurgeDialogOpen(true)
        toast.success(`Удалено ${data.purge.deletedFiles} файлов из S3`)
      } else {
        toast.success('Задача создана и запущена')
      }
      
      // Обновляем список задач
      fetchJobs()
    } catch (error: any) {
      toast.error(error.message || 'Ошибка создания задачи')
    } finally {
      setCreating(false)
    }
  }

  const cancelJob = async (jobId: string) => {
    if (!confirm('Отменить эту задачу?')) return
    
    try {
      const response = await fetch(`/api/admin/media/sync/${jobId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to cancel job')
      
      toast.success('Задача отменена')
      fetchJobs()
    } catch (error) {
      toast.error('Ошибка отмены задачи')
    }
  }

  const getOperationLabel = (operation: string): string => {
    const op = OPERATIONS.find(o => o.value === operation)
    return op?.label || operation
  }

  if (loading) {
    return (
      <Grid container spacing={6}>
        {/* Stats skeletons */}
        <Grid item xs={12}>
          <Grid container spacing={4}>
            {[...Array(4)].map((_, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Card>
                  <CardContent>
                    <Skeleton variant="text" width={100} height={20} />
                    <Skeleton variant="text" width={60} height={40} />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>
        
        {/* Jobs list skeleton */}
        <Grid item xs={12}>
          <Card>
            <CardHeader 
              title={<Skeleton variant="text" width={200} height={32} />}
              action={<Skeleton variant="rounded" width={140} height={36} />}
            />
            <CardContent>
              <Table>
                <TableHead>
                  <TableRow>
                    {['Операция', 'Область', 'Статус', 'Прогресс', 'Длительность', 'Создана', 'Автор', ''].map((_, i) => (
                      <TableCell key={i}>
                        <Skeleton variant="text" width={80} />
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton variant="text" width={150} /></TableCell>
                      <TableCell><Skeleton variant="rounded" width={80} height={24} /></TableCell>
                      <TableCell><Skeleton variant="rounded" width={80} height={24} /></TableCell>
                      <TableCell><Skeleton variant="text" width={100} /></TableCell>
                      <TableCell><Skeleton variant="text" width={60} /></TableCell>
                      <TableCell><Skeleton variant="text" width={120} /></TableCell>
                      <TableCell><Skeleton variant="text" width={60} /></TableCell>
                      <TableCell><Skeleton variant="circular" width={32} height={32} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    )
  }

  if (accessDenied) {
    return (
      <Grid container spacing={6}>
        <Grid item xs={12}>
          <Alert severity="warning">
            Доступ запрещён. Для работы с синхронизацией медиа требуются права SUPERADMIN.
          </Alert>
        </Grid>
      </Grid>
    )
  }

  return (
    <Grid container spacing={6}>
      {/* Stats */}
      <Grid item xs={12}>
        <Grid container spacing={4}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>Всего задач</Typography>
                <Typography variant="h4">{total}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>В обработке</Typography>
                <Typography variant="h4" color="warning.main">
                  {jobs.filter(j => j.status === 'processing').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>Завершено</Typography>
                <Typography variant="h4" color="success.main">
                  {jobs.filter(j => j.status === 'completed').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>Ошибки</Typography>
                <Typography variant="h4" color="error.main">
                  {jobs.filter(j => j.status === 'failed').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Grid>

      {/* Jobs list */}
      <Grid item xs={12}>
        <Card>
          <CardHeader 
            title="Задачи синхронизации"
            action={
              <Button 
                variant="contained" 
                startIcon={<i className="ri-add-line" />}
                onClick={() => setDialogOpen(true)}
              >
                Создать задачу
              </Button>
            }
          />
          <CardContent>
            {jobs.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography color="text.secondary">Нет задач</Typography>
              </Box>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Операция</TableCell>
                    <TableCell>Область</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Прогресс</TableCell>
                    <TableCell>Длительность</TableCell>
                    <TableCell>Создана</TableCell>
                    <TableCell>Автор</TableCell>
                    <TableCell align="right">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {jobs.map(job => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2">
                              {getOperationLabel(job.operation)}
                            </Typography>
                            {job.isParent && (
                              <Chip 
                                label={`${job.childJobs?.length || 0} batch`} 
                                size="small" 
                                color="info"
                                variant="outlined"
                              />
                            )}
                          </Box>
                          {job.s3Bucket && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                              bucket: {job.s3Bucket}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={job.scope === 'entity_type' ? job.entityType : job.scope} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={job.status} 
                          size="small" 
                          color={getStatusColor(job.status)}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 200 }}>
                        {(() => {
                          // Для parent job агрегируем из children
                          const processedFiles = job.isParent && job.childJobs
                            ? job.childJobs.reduce((sum, c) => sum + c.processedFiles, 0)
                            : job.processedFiles
                          const failedFiles = job.isParent && job.childJobs
                            ? job.childJobs.reduce((sum, c) => sum + c.failedFiles, 0)
                            : job.failedFiles
                          
                          return job.status === 'processing' ? (
                            <Box>
                              <LinearProgress 
                                variant="determinate" 
                                value={job.totalFiles > 0 ? (processedFiles / job.totalFiles) * 100 : 0}
                                sx={{ mb: 0.5 }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {processedFiles}/{job.totalFiles} файлов
                              </Typography>
                            </Box>
                          ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" component="span">
                                {processedFiles}/{job.totalFiles}
                              </Typography>
                              {failedFiles > 0 && (
                                <Chip 
                                  label={`${failedFiles} ошибок`} 
                                  size="small" 
                                  color="error" 
                                />
                              )}
                            </Box>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        {formatDuration(job.startedAt, job.completedAt)}
                      </TableCell>
                      <TableCell>
                        {new Date(job.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {job.creator ? (
                          <a
                            href={`/en/apps/user/view?id=${job.creator.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ 
                              color: 'var(--mui-palette-primary-main)',
                              textDecoration: 'none',
                              fontSize: '0.75rem'
                            }}
                          >
                            {job.creator.name || job.creator.email}
                          </a>
                        ) : (
                          <Typography variant="caption" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {job.status === 'processing' && (
                          <Tooltip title="Отменить">
                            <IconButton color="error" onClick={() => cancelJob(job.id)}>
                              <i className="ri-stop-circle-line" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {(job.error || job.status === 'failed' || job.failedFiles > 0) && (
                          <Tooltip title="Подробности">
                            <IconButton 
                              color="error" 
                              onClick={() => {
                                setSelectedJob(job)
                                setErrorDialogOpen(true)
                              }}
                            >
                              <i className="ri-information-line" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Create job dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Создать задачу синхронизации</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Alert severity="warning" sx={{ mb: 3 }}>
              ⚠️ Операции синхронизации могут быть необратимы.
            </Alert>
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Операция</InputLabel>
              <Select
                value={newAction}
                label="Операция"
                onChange={e => setNewAction(e.target.value)}
              >
                {OPERATIONS.map(op => (
                  <MenuItem key={op.value} value={op.value}>
                    {op.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Область</InputLabel>
              <Select
                value={newScope}
                label="Область"
                onChange={e => setNewScope(e.target.value)}
              >
                {SCOPES.map(s => (
                  <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {newScope === 'entity_type' && (
              <FormControl fullWidth>
                <InputLabel>Тип сущности</InputLabel>
                <Select
                  value={newEntityType}
                  label="Тип сущности"
                  onChange={e => setNewEntityType(e.target.value)}
                >
                  {ENTITY_TYPES.map(t => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        </DialogContent>
        <DialogActions disableSpacing sx={{ 
          px: 3, 
          pb: 3, 
          gap: '0.5rem',
          '& .MuiButtonBase-root:not(:first-of-type)': { marginInlineStart: 0 }
        }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined" disabled={creating}>
            Отмена
          </Button>
          <Button 
            variant="contained" 
            onClick={createJob}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Создать
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error details dialog */}
      <Dialog 
        open={errorDialogOpen} 
        onClose={() => {
          setErrorDialogOpen(false)
          setSelectedJob(null)
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <i className="ri-error-warning-line" style={{ color: 'var(--mui-palette-error-main)' }} />
          Детали задачи
        </DialogTitle>
        <DialogContent>
          {selectedJob && (
            <Box sx={{ mt: 1 }}>
              {/* Job Info */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">ID задачи</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {selectedJob.id}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Статус</Typography>
                  <Box>
                    <Chip 
                      label={selectedJob.status} 
                      size="small" 
                      color={getStatusColor(selectedJob.status)}
                    />
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Операция</Typography>
                  <Typography variant="body2">{getOperationLabel(selectedJob.operation)}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Область</Typography>
                  <Typography variant="body2">
                    {selectedJob.scope === 'entity_type' ? selectedJob.entityType : selectedJob.scope}
                  </Typography>
                </Grid>
              </Grid>

              {/* Progress */}
              <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Grid container spacing={2}>
                  <Grid item xs={selectedJob.isParent ? 3 : 4}>
                    <Typography variant="caption" color="text.secondary">Всего файлов</Typography>
                    <Typography variant="h6">{selectedJob.totalFiles}</Typography>
                  </Grid>
                  <Grid item xs={selectedJob.isParent ? 3 : 4}>
                    <Typography variant="caption" color="text.secondary">Обработано</Typography>
                    <Typography variant="h6" color="success.main">
                      {selectedJob.isParent && selectedJob.childJobs
                        ? selectedJob.childJobs.reduce((sum, c) => sum + c.processedFiles, 0)
                        : selectedJob.processedFiles}
                    </Typography>
                  </Grid>
                  <Grid item xs={selectedJob.isParent ? 3 : 4}>
                    <Typography variant="caption" color="text.secondary">{t?.errors ?? 'Errors'}</Typography>
                    <Typography variant="h6" color="error.main">
                      {selectedJob.isParent && selectedJob.childJobs
                        ? selectedJob.childJobs.reduce((sum, c) => sum + c.failedFiles, 0)
                        : selectedJob.failedFiles}
                    </Typography>
                  </Grid>
                  {selectedJob.isParent && selectedJob.childJobs && (
                    <Grid item xs={3}>
                      <Typography variant="caption" color="text.secondary">Batch'и</Typography>
                      <Typography variant="h6" color="primary.main">
                        {selectedJob.childJobs.filter(c => c.status === 'completed' || c.status === 'failed').length}
                        /{selectedJob.childJobs.length}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
                
                {/* Batch Progress */}
                {selectedJob.isParent && selectedJob.childJobs && selectedJob.childJobs.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      Прогресс по batch'ам
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {selectedJob.childJobs
                        .sort((a, b) => (a.batchIndex || 0) - (b.batchIndex || 0))
                        .map((child, idx) => (
                          <Box
                            key={child.id}
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: 0.5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 10,
                              fontWeight: 600,
                              bgcolor: child.status === 'completed' 
                                ? 'success.main'
                                : child.status === 'failed'
                                  ? 'error.main'
                                  : child.status === 'processing'
                                    ? 'primary.main'
                                    : 'action.selected',
                              color: ['completed', 'failed', 'processing'].includes(child.status) 
                                ? 'white' 
                                : 'text.secondary',
                            }}
                            title={`Batch ${idx + 1}: ${child.status}`}
                          >
                            {idx + 1}
                          </Box>
                        ))}
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Timestamps */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Создана</Typography>
                  <Typography variant="body2">
                    {new Date(selectedJob.createdAt).toLocaleString('ru-RU')}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Начата</Typography>
                  <Typography variant="body2">
                    {selectedJob.startedAt ? new Date(selectedJob.startedAt).toLocaleString('ru-RU') : '-'}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Завершена</Typography>
                  <Typography variant="body2">
                    {selectedJob.completedAt ? new Date(selectedJob.completedAt).toLocaleString('ru-RU') : '-'}
                  </Typography>
                </Grid>
              </Grid>

              {/* Error Message */}
              {selectedJob.error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Сообщение об ошибке:</Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontFamily: 'monospace', 
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      fontSize: '0.8rem'
                    }}
                  >
                    {selectedJob.error}
                  </Typography>
                </Alert>
              )}

              {/* Individual file errors from results */}
              {selectedJob.results && (() => {
                try {
                  const results: SyncResult[] = JSON.parse(selectedJob.results)
                  const failedResults = results.filter(r => !r.success)
                  if (failedResults.length > 0) {
                    return (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          Детали по файлам ({failedResults.length} ошибок):
                        </Typography>
                        <Box 
                          sx={{ 
                            maxHeight: 200, 
                            overflow: 'auto', 
                            bgcolor: 'grey.900', 
                            p: 1.5, 
                            borderRadius: 1 
                          }}
                        >
                          {failedResults.map((r, i) => (
                            <Box key={i} sx={{ mb: 1, pb: 1, borderBottom: i < failedResults.length - 1 ? '1px solid' : 'none', borderColor: 'grey.700' }}>
                              <Typography 
                                variant="caption" 
                                sx={{ color: 'grey.400', fontFamily: 'monospace', display: 'block' }}
                              >
                                Media ID: {r.mediaId}
                              </Typography>
                              <Typography 
                                variant="body2" 
                                sx={{ color: 'error.light', fontFamily: 'monospace', fontSize: '0.75rem' }}
                              >
                                {r.error || 'Unknown error'}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    )
                  }
                  return null
                } catch {
                  return null
                }
              })()}

              {/* No error but has failed files */}
              {!selectedJob.error && selectedJob.failedFiles > 0 && !selectedJob.results && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    {selectedJob.failedFiles} файл(ов) не удалось обработать. 
                    Проверьте логи сервера для детальной информации.
                  </Typography>
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => {
              setErrorDialogOpen(false)
              setSelectedJob(null)
            }} 
            variant="outlined"
          >
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dangerous operation confirmation dialog */}
      <Dialog
        open={confirmDangerOpen}
        onClose={() => {
          setConfirmDangerOpen(false)
          setPendingDangerAction('')
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
          <i className="ri-error-warning-line" />
          Подтверждение опасной операции
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
              ⚠️ ВНИМАНИЕ!
            </Typography>
            <Typography variant="body2">
              Это действие удалит <strong>ВСЕ файлы</strong> из S3 bucket безвозвратно!
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: '0.5rem', '& .MuiButtonBase-root:not(:first-of-type)': { marginInlineStart: 0 } }} disableSpacing>
          <Button
            variant="outlined"
            onClick={() => {
              setConfirmDangerOpen(false)
              setPendingDangerAction('')
            }}
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => executeCreateJob(pendingDangerAction)}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <i className="ri-delete-bin-line" />}
          >
            Удалить всё
          </Button>
        </DialogActions>
      </Dialog>

      {/* Purge results dialog */}
      <Dialog 
        open={purgeDialogOpen} 
        onClose={() => {
          setPurgeDialogOpen(false)
          setPurgeResult(null)
        }} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <i className="ri-delete-bin-line" style={{ color: 'var(--mui-palette-error-main)' }} />
          Результаты очистки S3
        </DialogTitle>
        <DialogContent>
          {purgeResult && (
            <Box sx={{ mt: 1 }}>
              {/* Summary */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={4}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.main', color: 'white', borderRadius: 1 }}>
                    <Typography variant="h4">{purgeResult.deletedFiles}</Typography>
                    <Typography variant="caption">Удалено файлов</Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'info.main', color: 'white', borderRadius: 1 }}>
                    <Typography variant="h4">{formatBytes(purgeResult.deletedBytes)}</Typography>
                    <Typography variant="caption">Освобождено</Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: purgeResult.errors > 0 ? 'error.main' : 'grey.500', color: 'white', borderRadius: 1 }}>
                    <Typography variant="h4">{purgeResult.errors}</Typography>
                    <Typography variant="caption">{t?.errors ?? 'Errors'}</Typography>
                  </Box>
                </Grid>
              </Grid>

              {purgeResult.deletedFiles === 0 && purgeResult.errors === 0 && (
                <Alert severity="info">
                  S3 bucket уже пуст. Файлов для удаления не найдено.
                </Alert>
              )}

              {purgeResult.deletedFiles > 0 && purgeResult.errors === 0 && (
                <Alert severity="success">
                  S3 bucket успешно очищен!
                </Alert>
              )}

              {purgeResult.errors > 0 && purgeResult.details.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Детали ({purgeResult.details.length}):
                  </Typography>
                  <Box sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'grey.900', p: 1.5, borderRadius: 1 }}>
                    {purgeResult.details.map((detail, i) => (
                      <Typography 
                        key={i} 
                        variant="body2" 
                        sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'grey.300', mb: 0.5 }}
                      >
                        {detail}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => {
              setPurgeDialogOpen(false)
              setPurgeResult(null)
            }} 
            variant="outlined"
          >
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>

      {/* Verification results dialog */}
      <Dialog 
        open={verifyDialogOpen} 
        onClose={() => {
          setVerifyDialogOpen(false)
          setVerifyResult(null)
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <i className="ri-search-eye-line" style={{ color: 'var(--mui-palette-info-main)' }} />
          Результаты проверки статусов
        </DialogTitle>
        <DialogContent>
          {verifyResult && (
            <Box sx={{ mt: 1 }}>
              {/* Summary */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="h4">{verifyResult.total}</Typography>
                    <Typography variant="caption" color="text.secondary">Всего файлов</Typography>
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.main', color: 'white', borderRadius: 1 }}>
                    <Typography variant="h4">{verifyResult.verified}</Typography>
                    <Typography variant="caption">Проверено</Typography>
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.main', color: 'white', borderRadius: 1 }}>
                    <Typography variant="h4">{verifyResult.updated}</Typography>
                    <Typography variant="caption">Обновлено</Typography>
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'error.main', color: 'white', borderRadius: 1 }}>
                    <Typography variant="h4">{verifyResult.errors}</Typography>
                    <Typography variant="caption">{t?.errors ?? 'Errors'}</Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Details of updated files */}
              {verifyResult.details.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Изменённые статусы ({verifyResult.details.length}):
                  </Typography>
                  <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Media ID</TableCell>
                          <TableCell>Было</TableCell>
                          <TableCell>Стало</TableCell>
                          <TableCell>Local</TableCell>
                          <TableCell>S3</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {verifyResult.details.map((d, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                {d.mediaId.substring(0, 12)}...
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip label={d.oldStatus} size="small" color="default" />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={d.newStatus} 
                                size="small" 
                                color={d.newStatus === 'synced' ? 'success' : d.newStatus === 'sync_error' ? 'error' : 'warning'}
                              />
                            </TableCell>
                            <TableCell>
                              {d.localExists ? '✅' : '❌'}
                            </TableCell>
                            <TableCell>
                              {d.s3Exists ? '✅' : '❌'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                </Box>
              )}

              {verifyResult.details.length === 0 && verifyResult.updated === 0 && (
                <Alert severity="success">
                  Все статусы корректны! Изменений не требуется.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => {
              setVerifyDialogOpen(false)
              setVerifyResult(null)
            }} 
            variant="outlined"
          >
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}


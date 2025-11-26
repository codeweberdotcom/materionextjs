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

interface SyncJob {
  id: string
  operation: string
  scope: string
  entityType?: string
  status: string
  totalFiles: number
  processedFiles: number
  failedFiles: number
  totalBytes: number
  processedBytes: number
  deleteSource: boolean
  error?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  createdBy?: string
}

const OPERATIONS = [
  { value: 'upload_to_s3_with_delete', label: '☁️ Выгрузить на S3 и удалить локальные', color: 'warning' },
  { value: 'upload_to_s3_keep_local', label: '☁️ Выгрузить на S3 (сохранить локальные)', color: 'info' },
  { value: 'download_from_s3', label: '💾 Загрузить из S3 в локальное', color: 'success' },
  { value: 'download_from_s3_delete_s3', label: '💾 Загрузить из S3 и удалить из S3', color: 'warning' },
  { value: 'delete_local_only', label: '🗑️ Удалить только локальные', color: 'error' },
  { value: 'delete_s3_only', label: '🗑️ Удалить только из S3', color: 'error' },
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

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/media/sync?limit=50')
      if (!response.ok) throw new Error('Failed to fetch jobs')
      
      const data = await response.json()
      setJobs(data.jobs)
      setTotal(data.total)
    } catch (error) {
      toast.error('Ошибка загрузки задач')
    } finally {
      setLoading(false)
    }
  }, [])

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
    
    setCreating(true)
    try {
      const response = await fetch('/api/admin/media/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: newAction,
          scope: newScope,
          entityType: newScope === 'entity_type' ? newEntityType : undefined,
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create job')
      }
      
      toast.success('Задача создана')
      setDialogOpen(false)
      setNewAction('')
      setNewScope('all')
      setNewEntityType('')
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
                    {['Операция', 'Область', 'Статус', 'Прогресс', 'Длительность', 'Создана', ''].map((_, i) => (
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
                    <TableCell align="right">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {jobs.map(job => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Typography variant="body2">
                          {getOperationLabel(job.operation)}
                        </Typography>
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
                        {job.status === 'processing' ? (
                          <Box>
                            <LinearProgress 
                              variant="determinate" 
                              value={job.totalFiles > 0 ? (job.processedFiles / job.totalFiles) * 100 : 0}
                              sx={{ mb: 0.5 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {job.processedFiles}/{job.totalFiles} файлов ({formatBytes(job.processedBytes)})
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2">
                            {job.processedFiles}/{job.totalFiles}
                            {job.failedFiles > 0 && (
                              <Chip 
                                label={`${job.failedFiles} ошибок`} 
                                size="small" 
                                color="error" 
                                sx={{ ml: 1 }}
                              />
                            )}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatDuration(job.startedAt, job.completedAt)}
                      </TableCell>
                      <TableCell>
                        {new Date(job.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        {job.status === 'processing' && (
                          <Tooltip title="Отменить">
                            <IconButton color="error" onClick={() => cancelJob(job.id)}>
                              <i className="ri-stop-circle-line" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {job.error && (
                          <Tooltip title={job.error}>
                            <IconButton color="error">
                              <i className="ri-error-warning-line" />
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
              ⚠️ Операции синхронизации могут быть необратимы. Убедитесь, что вы понимаете последствия.
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
        <DialogActions sx={{ px: 3, pb: 3, gap: 2 }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined">Отмена</Button>
          <Button 
            variant="contained" 
            onClick={createJob}
            disabled={creating}
          >
            {creating ? <CircularProgress size={20} /> : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}


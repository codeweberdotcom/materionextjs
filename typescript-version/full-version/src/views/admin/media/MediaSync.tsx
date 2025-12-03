'use client'

/**
 * Media Synchronization - sync task management
 */

import { useState, useEffect, useCallback, useMemo } from 'react'

import { useTranslationSafe } from '@/contexts/TranslationContext'

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
import Checkbox from '@mui/material/Checkbox'
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
import Divider from '@mui/material/Divider'

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

const OPERATION_VALUES = [
  'upload_to_s3_with_delete',
  'upload_to_s3_keep_local',
  'download_from_s3',
  'download_from_s3_delete_s3',
  'delete_local_only',
  'delete_s3_only',
  'purge_s3',
  'verify_status',
] as const

const SCOPE_VALUES = ['all', 'entity_type'] as const

const ENTITY_TYPE_VALUES = [
  'user_avatar',
  'company_logo',
  'company_banner',
  'company_photo',
  'listing_image',
  'site_logo',
  'watermark',
  'document',
] as const

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
  const dictionary = useTranslationSafe()
  const t = dictionary?.mediaSync
  
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

  // Row selection for bulk operations
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set())
  const [deleteLoading, setDeleteLoading] = useState(false)
  
  // Track cancelling jobs
  const [cancellingJobs, setCancellingJobs] = useState<Set<string>>(new Set())

  // Row selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobs(new Set(jobs.map(job => job.id)))
    } else {
      setSelectedJobs(new Set())
    }
  }

  const handleSelectJob = (jobId: string, checked: boolean) => {
    setSelectedJobs(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(jobId)
      } else {
        newSet.delete(jobId)
      }
      return newSet
    })
  }

  const isAllSelected = jobs.length > 0 && selectedJobs.size === jobs.length
  const isSomeSelected = selectedJobs.size > 0 && selectedJobs.size < jobs.length

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedJobs.size === 0) return
    
    if (!confirm(t?.confirmBulkDelete?.replace('{count}', String(selectedJobs.size)) || `Delete ${selectedJobs.size} selected tasks?`)) {
      return
    }

    setDeleteLoading(true)
    try {
      const response = await fetch('/api/admin/media/sync/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds: Array.from(selectedJobs) }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete jobs')
      }

      const result = await response.json()
      toast.success(t?.bulkDeleteSuccess?.replace('{count}', String(result.deleted)) || `Deleted ${result.deleted} tasks`)
      setSelectedJobs(new Set())
      fetchJobs()
    } catch (error: any) {
      toast.error(error.message || t?.bulkDeleteError || 'Error deleting tasks')
    } finally {
      setDeleteLoading(false)
    }
  }

  // Get translated operation label
  const getOperationLabel = useCallback((operation: string): string => {
    const operations = t?.operations as Record<string, string> | undefined
    return operations?.[operation] || operation
  }, [t])

  // Get translated scope label
  const getScopeLabel = useCallback((scope: string): string => {
    const scopes = t?.scopes as Record<string, string> | undefined
    return scopes?.[scope] || scope
  }, [t])

  // Get translated entity type label
  const getEntityTypeLabel = useCallback((entityType: string): string => {
    const entityTypes = t?.entityTypes as Record<string, string> | undefined
    return entityTypes?.[entityType] || entityType
  }, [t])

  // Get translated status label
  const getStatusLabel = useCallback((status: string): string => {
    const statuses = t?.statuses as Record<string, string> | undefined
    return statuses?.[status] || status
  }, [t])
  
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
      // Show toast only once on first load
      if (loading) {
        toast.error(t?.loadError || 'Error loading tasks')
      }
    } finally {
      setLoading(false)
    }
  }, [loading, t])

  useEffect(() => {
    fetchJobs()
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchJobs, 5000)
    return () => clearInterval(interval)
  }, [fetchJobs])

  // Abort controller for cancelling create request
  const [createAbortController, setCreateAbortController] = useState<AbortController | null>(null)

  const createJob = async () => {
    if (!newAction) {
      toast.error(t?.selectAction || 'Select an action')
      return
    }
    
    if (newScope === 'entity_type' && !newEntityType) {
      toast.error(t?.selectEntityTypeRequired || 'Select entity type')
      return
    }

    // Additional confirmation for dangerous operations
    if (newAction === 'purge_s3') {
      setPendingDangerAction(newAction)
      setConfirmDangerOpen(true)
      return
    }
    
    executeCreateJob(newAction)
  }

  const cancelCreateJob = () => {
    if (createAbortController) {
      createAbortController.abort()
      setCreateAbortController(null)
      setCreating(false)
      toast.info(t?.createCancelled || 'Task creation cancelled')
    }
  }

  const executeCreateJob = async (action: string) => {
    setCreating(true)
    setConfirmDangerOpen(false)
    
    // Create abort controller for this request
    const controller = new AbortController()
    setCreateAbortController(controller)
    try {
      const response = await fetch('/api/admin/media/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action,
          scope: newScope,
          entityType: newScope === 'entity_type' ? newEntityType : undefined,
        }),
        signal: controller.signal,
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create job')
      }
      
      const data = await response.json()
      
      // Save action before resetting state
      const actionWas = action
      
      // Close dialog immediately after successful task creation
      setDialogOpen(false)
      
      // Reset form
      setNewAction('')
      setNewScope('all')
      setNewEntityType('')
      
      // For verification show results in separate dialog
      if (actionWas === 'verify_status' && data.verification) {
        setVerifyResult(data.verification)
        setVerifyDialogOpen(true)
        const msg = (t?.verifiedCount || 'Verified: {total}, updated: {updated}')
          .replace('{total}', data.verification.total)
          .replace('{updated}', data.verification.updated)
        toast.success(msg)
      } else if (actionWas === 'purge_s3' && data.purge) {
        setPurgeResult(data.purge)
        setPurgeDialogOpen(true)
        const msg = (t?.deletedFromS3 || 'Deleted {count} files from S3')
          .replace('{count}', data.purge.deletedFiles)
        toast.success(msg)
      } else {
        toast.success(t?.taskCreated || 'Task created and started')
      }
      
      // Refresh task list
      fetchJobs()
    } catch (error: any) {
      // Don't show error toast if request was aborted
      if (error.name === 'AbortError') {
        return
      }
      toast.error(error.message || t?.createError || 'Error creating task')
    } finally {
      setCreating(false)
      setCreateAbortController(null)
    }
  }

  const cancelJob = async (jobId: string) => {
    setCancellingJobs(prev => new Set(prev).add(jobId))
    
    try {
      const response = await fetch(`/api/admin/media/sync/${jobId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to cancel job')
      
      toast.success(t?.taskCancelled || 'Task cancelled')
      fetchJobs()
    } catch (error) {
      toast.error(t?.cancelError || 'Error cancelling task')
    } finally {
      setCancellingJobs(prev => {
        const newSet = new Set(prev)
        newSet.delete(jobId)
        return newSet
      })
    }
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
                    {[...Array(8)].map((_, i) => (
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
            {t?.accessDenied || 'Access denied. SUPERADMIN rights are required to work with media synchronization.'}
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
                <Typography color="text.secondary" gutterBottom>{t?.totalTasks || 'Total tasks'}</Typography>
                <Typography variant="h4">{total}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>{t?.processing || 'Processing'}</Typography>
                <Typography variant="h4" color="warning.main">
                  {jobs.filter(j => j.status === 'processing').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>{t?.completed || 'Completed'}</Typography>
                <Typography variant="h4" color="success.main">
                  {jobs.filter(j => j.status === 'completed').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>{t?.errors || 'Errors'}</Typography>
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
            title={t?.pageTitle || 'Synchronization Tasks'}
            action={
              <Button 
                variant="contained" 
                startIcon={<i className="ri-add-line" />}
                onClick={() => setDialogOpen(true)}
              >
                {t?.createTask || 'Create Task'}
              </Button>
            }
          />
          {/* Bulk actions toolbar */}
          {selectedJobs.size > 0 && (
            <>
              <Divider />
              <Box sx={{ 
                px: 3, 
                py: 2, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                bgcolor: 'action.hover'
              }}>
                <Typography variant="body2" color="text.secondary">
                  {t?.selected || 'Selected'}: <strong>{selectedJobs.size}</strong>
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setSelectedJobs(new Set())}
                  >
                    {t?.clearSelection || 'Clear'}
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    onClick={handleBulkDelete}
                    disabled={deleteLoading}
                    startIcon={deleteLoading ? <CircularProgress size={16} color="inherit" /> : <i className="ri-delete-bin-line" />}
                  >
                    {deleteLoading ? (t?.deleting || 'Deleting...') : (t?.deleteSelected || 'Delete selected')}
                  </Button>
                </Box>
              </Box>
            </>
          )}
          <CardContent>
            {jobs.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography color="text.secondary">{t?.noTasks || 'No tasks'}</Typography>
              </Box>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isAllSelected}
                        indeterminate={isSomeSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </TableCell>
                    <TableCell>{t?.operation || 'Operation'}</TableCell>
                    <TableCell>{t?.scope || 'Scope'}</TableCell>
                    <TableCell>{t?.status || 'Status'}</TableCell>
                    <TableCell>{t?.progress || 'Progress'}</TableCell>
                    <TableCell>{t?.duration || 'Duration'}</TableCell>
                    <TableCell>{t?.created || 'Created'}</TableCell>
                    <TableCell>{t?.author || 'Author'}</TableCell>
                    <TableCell align="right">{t?.actions || 'Actions'}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {jobs.map(job => (
                    <TableRow 
                      key={job.id}
                      selected={selectedJobs.has(job.id)}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedJobs.has(job.id)}
                          onChange={(e) => handleSelectJob(job.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2">
                              {getOperationLabel(job.operation)}
                            </Typography>
                            {job.isParent && (
                              <Chip 
                                label={`${job.childJobs?.length || 0} ${t?.batch || 'batch'}`} 
                                size="small" 
                                color="info"
                                variant="outlined"
                              />
                            )}
                          </Box>
                          {job.s3Bucket && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                              {t?.bucket || 'bucket'}: {job.s3Bucket}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={job.scope === 'entity_type' ? getEntityTypeLabel(job.entityType || '') : getScopeLabel(job.scope)} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={getStatusLabel(job.status)} 
                          size="small" 
                          color={getStatusColor(job.status)}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 250 }}>
                        {(() => {
                          // For parent job aggregate from children
                          const processedFiles = job.isParent && job.childJobs
                            ? job.childJobs.reduce((sum, c) => sum + c.processedFiles, 0)
                            : job.processedFiles
                          const failedFiles = job.isParent && job.childJobs
                            ? job.childJobs.reduce((sum, c) => sum + c.failedFiles, 0)
                            : job.failedFiles
                          
                          const isCancelling = cancellingJobs.has(job.id)
                          
                          return job.status === 'processing' ? (
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <Box sx={{ flex: 1 }}>
                                  <LinearProgress 
                                    variant="determinate" 
                                    value={job.totalFiles > 0 ? (processedFiles / job.totalFiles) * 100 : 0}
                                  />
                                </Box>
                                <Button
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                  onClick={() => cancelJob(job.id)}
                                  disabled={isCancelling}
                                  startIcon={isCancelling ? <CircularProgress size={14} color="inherit" /> : <i className="ri-stop-circle-line" style={{ fontSize: 14 }} />}
                                  sx={{ 
                                    minWidth: 'auto', 
                                    px: 1,
                                    py: 0.25,
                                    fontSize: '0.7rem',
                                    lineHeight: 1.2
                                  }}
                                >
                                  {isCancelling ? (t?.cancelling || 'Cancelling...') : (t?.stop || 'Stop')}
                                </Button>
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                {processedFiles}/{job.totalFiles} {t?.files || 'files'}
                              </Typography>
                            </Box>
                          ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" component="span">
                                {processedFiles}/{job.totalFiles}
                              </Typography>
                              {failedFiles > 0 && (
                                <Chip 
                                  label={`${failedFiles} ${t?.errorsCount || 'errors'}`} 
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
                        <Tooltip title={t?.taskDetails || 'Task Details'}>
                          <IconButton 
                            color={(job.error || job.status === 'failed' || job.failedFiles > 0) ? 'error' : 'success'}
                            onClick={() => {
                              setSelectedJob(job)
                              setErrorDialogOpen(true)
                            }}
                          >
                            <i className="ri-information-line" />
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
      </Grid>

      {/* Create job dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t?.createTaskTitle || 'Create Sync Task'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Alert severity="warning" sx={{ mb: 3 }}>
              ⚠️ {t?.syncWarning || 'Sync operations may be irreversible.'}
            </Alert>
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>{t?.selectOperation || 'Operation'}</InputLabel>
              <Select
                value={newAction}
                label={t?.selectOperation || 'Operation'}
                onChange={e => setNewAction(e.target.value)}
              >
                {OPERATION_VALUES.map(op => (
                  <MenuItem key={op} value={op}>
                    {getOperationLabel(op)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>{t?.selectScope || 'Scope'}</InputLabel>
              <Select
                value={newScope}
                label={t?.selectScope || 'Scope'}
                onChange={e => setNewScope(e.target.value)}
              >
                {SCOPE_VALUES.map(s => (
                  <MenuItem key={s} value={s}>{getScopeLabel(s)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {newScope === 'entity_type' && (
              <FormControl fullWidth>
                <InputLabel>{t?.selectEntityType || 'Entity type'}</InputLabel>
                <Select
                  value={newEntityType}
                  label={t?.selectEntityType || 'Entity type'}
                  onChange={e => setNewEntityType(e.target.value)}
                >
                  {ENTITY_TYPE_VALUES.map(et => (
                    <MenuItem key={et} value={et}>{getEntityTypeLabel(et)}</MenuItem>
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
            {t?.cancel || 'Cancel'}
          </Button>
          {creating && (
            <Button 
              variant="outlined"
              color="error"
              onClick={cancelCreateJob}
              startIcon={<i className="ri-close-line" />}
            >
              {t?.stopOperation || 'Stop'}
            </Button>
          )}
          <Button 
            variant="contained" 
            onClick={createJob}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {creating ? (t?.creating || 'Creating...') : (t?.create || 'Create')}
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
          {t?.taskDetails || 'Task Details'}
        </DialogTitle>
        <DialogContent>
          {selectedJob && (
            <Box sx={{ mt: 1 }}>
              {/* Job Info */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">{t?.taskId || 'Task ID'}</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {selectedJob.id}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">{t?.status || 'Status'}</Typography>
                  <Box>
                    <Chip 
                      label={getStatusLabel(selectedJob.status)} 
                      size="small" 
                      color={getStatusColor(selectedJob.status)}
                    />
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">{t?.operation || 'Operation'}</Typography>
                  <Typography variant="body2">{getOperationLabel(selectedJob.operation)}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">{t?.scope || 'Scope'}</Typography>
                  <Typography variant="body2">
                    {selectedJob.scope === 'entity_type' ? getEntityTypeLabel(selectedJob.entityType || '') : getScopeLabel(selectedJob.scope)}
                  </Typography>
                </Grid>
              </Grid>

              {/* Progress */}
              <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Grid container spacing={2}>
                  <Grid item xs={selectedJob.isParent ? 3 : 4}>
                    <Typography variant="caption" color="text.secondary">{t?.totalFiles || 'Total files'}</Typography>
                    <Typography variant="h6">{selectedJob.totalFiles}</Typography>
                  </Grid>
                  <Grid item xs={selectedJob.isParent ? 3 : 4}>
                    <Typography variant="caption" color="text.secondary">{t?.processed || 'Processed'}</Typography>
                    <Typography variant="h6" color="success.main">
                      {selectedJob.isParent && selectedJob.childJobs
                        ? selectedJob.childJobs.reduce((sum, c) => sum + c.processedFiles, 0)
                        : selectedJob.processedFiles}
                    </Typography>
                  </Grid>
                  <Grid item xs={selectedJob.isParent ? 3 : 4}>
                    <Typography variant="caption" color="text.secondary">{t?.errors || 'Errors'}</Typography>
                    <Typography variant="h6" color="error.main">
                      {selectedJob.isParent && selectedJob.childJobs
                        ? selectedJob.childJobs.reduce((sum, c) => sum + c.failedFiles, 0)
                        : selectedJob.failedFiles}
                    </Typography>
                  </Grid>
                  {selectedJob.isParent && selectedJob.childJobs && (
                    <Grid item xs={3}>
                      <Typography variant="caption" color="text.secondary">{t?.batches || 'Batches'}</Typography>
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
                      {t?.batchProgress || 'Batch progress'}
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
                            title={`Batch ${idx + 1}: ${getStatusLabel(child.status)}`}
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
                  <Typography variant="caption" color="text.secondary">{t?.created || 'Created'}</Typography>
                  <Typography variant="body2">
                    {new Date(selectedJob.createdAt).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">{t?.startedAt || 'Started'}</Typography>
                  <Typography variant="body2">
                    {selectedJob.startedAt ? new Date(selectedJob.startedAt).toLocaleString() : '-'}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">{t?.completedAt || 'Completed'}</Typography>
                  <Typography variant="body2">
                    {selectedJob.completedAt ? new Date(selectedJob.completedAt).toLocaleString() : '-'}
                  </Typography>
                </Grid>
              </Grid>

              {/* Error Message */}
              {selectedJob.error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>{t?.errorMessage || 'Error message'}:</Typography>
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
                          {(t?.fileDetails || 'File details ({count} errors):').replace('{count}', String(failedResults.length))}
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
                    {selectedJob.failedFiles} {t?.fileErrors || 'files failed to process. Check server logs for details.'}
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
            {t?.close || 'Close'}
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
          {t?.dangerOperationTitle || 'Dangerous operation confirmation'}
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
              {t?.dangerOperationWarning || '⚠️ WARNING!'}
            </Typography>
            <Typography variant="body2">
              {t?.dangerOperationMessage || 'This action will delete ALL files from S3 bucket permanently!'}
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
            disabled={creating}
          >
            {t?.cancel || 'Cancel'}
          </Button>
          {creating && (
            <Button
              variant="outlined"
              color="warning"
              onClick={cancelCreateJob}
              startIcon={<i className="ri-close-line" />}
            >
              {t?.stopOperation || 'Stop'}
            </Button>
          )}
          <Button
            variant="contained"
            color="error"
            onClick={() => executeCreateJob(pendingDangerAction)}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <i className="ri-delete-bin-line" />}
          >
            {t?.deleteAll || 'Delete all'}
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
          {t?.purgeResults || 'S3 Purge Results'}
        </DialogTitle>
        <DialogContent>
          {purgeResult && (
            <Box sx={{ mt: 1 }}>
              {/* Summary */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={4}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.main', color: 'white', borderRadius: 1 }}>
                    <Typography variant="h4">{purgeResult.deletedFiles}</Typography>
                    <Typography variant="caption">{t?.deletedFiles || 'Deleted files'}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'info.main', color: 'white', borderRadius: 1 }}>
                    <Typography variant="h4">{formatBytes(purgeResult.deletedBytes)}</Typography>
                    <Typography variant="caption">{t?.freedSpace || 'Freed space'}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: purgeResult.errors > 0 ? 'error.main' : 'grey.500', color: 'white', borderRadius: 1 }}>
                    <Typography variant="h4">{purgeResult.errors}</Typography>
                    <Typography variant="caption">{t?.errors || 'Errors'}</Typography>
                  </Box>
                </Grid>
              </Grid>

              {purgeResult.deletedFiles === 0 && purgeResult.errors === 0 && (
                <Alert severity="info">
                  {t?.s3Empty || 'S3 bucket is already empty. No files to delete.'}
                </Alert>
              )}

              {purgeResult.deletedFiles > 0 && purgeResult.errors === 0 && (
                <Alert severity="success">
                  {t?.s3PurgeSuccess || 'S3 bucket successfully purged!'}
                </Alert>
              )}

              {purgeResult.errors > 0 && purgeResult.details.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {(t?.details || 'Details ({count}):').replace('{count}', String(purgeResult.details.length))}
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
            {t?.close || 'Close'}
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
          {t?.verifyResults || 'Status Verification Results'}
        </DialogTitle>
        <DialogContent>
          {verifyResult && (
            <Box sx={{ mt: 1 }}>
              {/* Summary */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="h4">{verifyResult.total}</Typography>
                    <Typography variant="caption" color="text.secondary">{t?.totalFiles || 'Total files'}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.main', color: 'white', borderRadius: 1 }}>
                    <Typography variant="h4">{verifyResult.verified}</Typography>
                    <Typography variant="caption">{t?.verified || 'Verified'}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.main', color: 'white', borderRadius: 1 }}>
                    <Typography variant="h4">{verifyResult.updated}</Typography>
                    <Typography variant="caption">{t?.updated || 'Updated'}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'error.main', color: 'white', borderRadius: 1 }}>
                    <Typography variant="h4">{verifyResult.errors}</Typography>
                    <Typography variant="caption">{t?.errors || 'Errors'}</Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Details of updated files */}
              {verifyResult.details.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {(t?.changedStatuses || 'Changed statuses ({count}):').replace('{count}', String(verifyResult.details.length))}
                  </Typography>
                  <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>{t?.mediaId || 'Media ID'}</TableCell>
                          <TableCell>{t?.was || 'Was'}</TableCell>
                          <TableCell>{t?.became || 'Became'}</TableCell>
                          <TableCell>{t?.local || 'Local'}</TableCell>
                          <TableCell>{t?.s3 || 'S3'}</TableCell>
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
                  {t?.allStatusesCorrect || 'All statuses are correct! No changes needed.'}
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
            {t?.close || 'Close'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

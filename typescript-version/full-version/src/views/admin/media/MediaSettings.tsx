'use client'

/**
 * Media Settings - global settings and entity-specific settings
 */

import { useState, useEffect } from 'react'

import { useTranslationSafe } from '@/contexts/TranslationContext'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Skeleton from '@mui/material/Skeleton'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import InputLabel from '@mui/material/InputLabel'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'

import { toast } from 'react-toastify'

import CustomAvatar from '@core/components/mui/Avatar'

interface GlobalSettings {
  id: string
  // S3 Settings
  s3Enabled: boolean
  s3ServiceId?: string | null
  // Storage Location
  storageLocation: string // 'local' | 's3' | 'both'
  // Sync Behavior
  syncMode: string // 'immediate' | 'background' | 'delayed' | 'manual'
  syncDelayMinutes: number
  // Trash Settings
  deleteMode: string
  trashRetentionDays: number
  s3DeleteWithLocal: boolean
  // Legacy S3 settings
  s3DefaultBucket?: string
  s3DefaultRegion?: string
  s3PublicUrlPrefix?: string
  // Local storage
  localUploadPath: string
  localPublicUrlPrefix: string
  // File organization
  organizeByDate: boolean
  organizeByEntityType: boolean
  // Limits
  globalMaxFileSize: number
  globalDailyUploadLimit?: number
  // Processing
  defaultQuality: number
  defaultConvertToWebP: boolean
  processingConcurrency: number
  // Legacy (deprecated)
  defaultStorageStrategy: string
  autoDeleteOrphans: boolean
  orphanRetentionDays: number
  autoSyncEnabled: boolean
  autoSyncDelayMinutes: number
  autoCleanupLocalEnabled: boolean
  keepLocalDays: number
  softDeleteRetentionDays: number
  autoCleanupEnabled: boolean
}

interface EntitySettings {
  id: string
  entityType: string
  displayName: string
  description?: string
  maxFileSize: number
  maxFilesPerEntity: number
  allowedMimeTypes: string
  variants: string
  convertToWebP: boolean
  stripMetadata: boolean
  quality: number
  watermarkEnabled: boolean
  watermarkPosition?: string
  watermarkOpacity: number
  watermarkScale: number
  storageStrategy: string
  namingStrategy: string
}

interface S3Bucket {
  name: string
  creationDate?: string
}

interface S3BucketsResponse {
  configured: boolean
  buckets: S3Bucket[]
  error?: string
}

interface BucketValidation {
  exists: boolean
  accessible: boolean
  error?: string
}

interface S3Service {
  id: string
  name: string
  displayName: string
  type: string
  enabled: boolean
  host?: string
}

interface OrphanStats {
  dbOrphans: number
  diskOrphans: number
  totalCount: number
  totalSize: number
  totalSizeFormatted: string
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

export default function MediaSettings() {
  const t = useTranslationSafe()?.mediaSettings
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null)
  const [entitySettings, setEntitySettings] = useState<EntitySettings[]>([])

  // S3 Bucket states
  const [s3Buckets, setS3Buckets] = useState<S3Bucket[]>([])
  const [s3Configured, setS3Configured] = useState(false)
  const [s3Error, setS3Error] = useState<string | null>(null)
  const [loadingBuckets, setLoadingBuckets] = useState(false)
  const [bucketValidation, setBucketValidation] = useState<BucketValidation | null>(null)
  const [validatingBucket, setValidatingBucket] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newBucketName, setNewBucketName] = useState('')
  const [creatingBucket, setCreatingBucket] = useState(false)

  // S3 Services
  const [s3Services, setS3Services] = useState<S3Service[]>([])
  const [loadingServices, setLoadingServices] = useState(false)

  // Orphan Stats
  const [orphanStats, setOrphanStats] = useState<OrphanStats | null>(null)
  const [loadingOrphans, setLoadingOrphans] = useState(false)

  useEffect(() => {
    fetchSettings()
    fetchBuckets()
    fetchS3Services()
    fetchOrphanStats()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/media/settings')
      if (!response.ok) throw new Error('Failed to fetch settings')

      const data = await response.json()
      setGlobalSettings(data.global)
      setEntitySettings(data.entitySettings)
    } catch (error) {
      toast.error(t?.loadError ?? 'Error loading settings')
    } finally {
      setLoading(false)
    }
  }

  const fetchBuckets = async () => {
    setLoadingBuckets(true)
    setS3Error(null)

    try {
      const response = await fetch('/api/admin/media/s3/buckets')
      if (!response.ok) throw new Error('Failed to fetch buckets')

      const data: S3BucketsResponse = await response.json()
      setS3Configured(data.configured)
      setS3Buckets(data.buckets)

      if (data.error) {
        setS3Error(data.error)
      }
    } catch (error) {
      setS3Error(t?.bucketsLoadError ?? 'Error loading bucket list')
    } finally {
      setLoadingBuckets(false)
    }
  }

  const fetchS3Services = async () => {
    setLoadingServices(true)
    try {
      const response = await fetch('/api/admin/settings/services?type=S3')
      if (!response.ok) throw new Error('Failed to fetch services')

      const data = await response.json()
      setS3Services(data.items || [])
    } catch (error) {
      console.error('Failed to fetch S3 services:', error)
    } finally {
      setLoadingServices(false)
    }
  }

  const fetchOrphanStats = async () => {
    setLoadingOrphans(true)
    try {
      const response = await fetch('/api/admin/media/orphans')
      if (!response.ok) throw new Error('Failed to fetch orphan stats')

      const data = await response.json()
      setOrphanStats(data.stats)
    } catch (error) {
      console.error('Failed to fetch orphan stats:', error)
    } finally {
      setLoadingOrphans(false)
    }
  }

  const validateBucket = async (bucketName: string) => {
    if (!bucketName) {
      setBucketValidation(null)
      return
    }

    setValidatingBucket(true)

    try {
      const response = await fetch('/api/admin/media/s3/buckets/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketName }),
      })

      const data: BucketValidation = await response.json()
      setBucketValidation(data)
    } catch (error) {
      setBucketValidation({ exists: false, accessible: false, error: t?.checkError ?? 'Check error' })
    } finally {
      setValidatingBucket(false)
    }
  }

  const createBucket = async () => {
    if (!newBucketName.trim()) {
      toast.error(t?.enterBucketName ?? 'Enter bucket name')
      return
    }

    setCreatingBucket(true)

    try {
      const response = await fetch('/api/admin/media/s3/buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketName: newBucketName.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || (t?.bucketCreateError ?? 'Error creating bucket'))
        return
      }

      toast.success(data.message || (t?.bucketCreated ?? 'Bucket created'))
      setCreateDialogOpen(false)
      setNewBucketName('')

      // Refresh list and select new bucket
      await fetchBuckets()
      updateGlobal('s3DefaultBucket', newBucketName.trim())
    } catch (error) {
      toast.error(t?.bucketCreateError ?? 'Error creating bucket')
    } finally {
      setCreatingBucket(false)
    }
  }

  const handleBucketChange = (bucketName: string) => {
    updateGlobal('s3DefaultBucket', bucketName)

    if (bucketName) {
      validateBucket(bucketName)
    } else {
      setBucketValidation(null)
    }
  }

  // Валидация текущего bucket при загрузке
  useEffect(() => {
    if (globalSettings?.s3DefaultBucket && s3Configured) {
      validateBucket(globalSettings.s3DefaultBucket)
    }
  }, [globalSettings?.s3DefaultBucket, s3Configured])

  const saveGlobalSettings = async () => {
    if (!globalSettings) return

    setSaving(true)
    try {
      const response = await fetch('/api/admin/media/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globalSettings),
      })

      if (!response.ok) throw new Error('Failed to save settings')

      toast.success(t?.saveSuccess ?? 'Settings saved')
    } catch (error) {
      toast.error(t?.saveError ?? 'Error saving settings')
    } finally {
      setSaving(false)
    }
  }

  const updateGlobal = (key: keyof GlobalSettings, value: any) => {
    if (!globalSettings) return
    setGlobalSettings({ ...globalSettings, [key]: value })
  }

  if (loading) {
    return (
      <Grid container spacing={6}>
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title={<Skeleton variant="text" width={200} height={32} />}
              action={<Skeleton variant="rounded" width={120} height={36} />}
            />
            <CardContent>
              <Grid container spacing={4}>
                <Grid item xs={12}>
                  <Skeleton variant="text" width={150} height={24} />
                  <Skeleton variant="rectangular" width="100%" height={1} sx={{ my: 2 }} />
                </Grid>
                {[...Array(3)].map((_, i) => (
                  <Grid item xs={12} md={4} key={i}>
                    <Skeleton variant="rounded" width="100%" height={56} />
                  </Grid>
                ))}
                <Grid item xs={12}>
                  <Skeleton variant="text" width={150} height={24} sx={{ mt: 2 }} />
                  <Skeleton variant="rectangular" width="100%" height={1} sx={{ my: 2 }} />
                </Grid>
                {[...Array(4)].map((_, i) => (
                  <Grid item xs={12} md={3} key={i}>
                    <Skeleton variant="rounded" width="100%" height={56} />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card>
            <CardHeader title={<Skeleton variant="text" width={250} height={32} />} />
            <CardContent>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} variant="rounded" width="100%" height={60} sx={{ mb: 1 }} />
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    )
  }

  return (
    <Grid container spacing={6}>
      {/* Global Settings */}
      <Grid item xs={12}>
        <Card>
          <CardHeader
            title={t?.globalSettings ?? 'Global Settings'}
            action={
              <Button
                variant="contained"
                onClick={saveGlobalSettings}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
              >
                {saving ? (t?.saving ?? 'Saving...') : (t?.save ?? 'Save')}
              </Button>
            }
          />
          <CardContent>
            {globalSettings && (
              <Grid container spacing={4}>
                {/* Storage */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <CustomAvatar color="primary" skin="light" size={38}>
                      <i className="ri-hard-drive-2-line" />
                    </CustomAvatar>
                    <Typography variant="subtitle1" fontWeight={500}>
                      {t?.storage ?? 'Storage'}
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label={t?.localPath ?? 'Local path'}
                    value={globalSettings.localUploadPath}
                    disabled
                    helperText={t?.localPathHelp ?? 'Fixed path: /uploads'}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label={t?.publicUrlPrefix ?? 'Public URL prefix'}
                    value={globalSettings.localPublicUrlPrefix}
                    disabled
                    helperText={t?.publicUrlPrefixHelp ?? 'Fixed prefix: /uploads'}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <Box>
                    <FormControl fullWidth>
                      <InputLabel id="s3-bucket-label">{t?.s3Bucket ?? 'S3 Bucket'}</InputLabel>
                      <Select
                        labelId="s3-bucket-label"
                        value={globalSettings.s3DefaultBucket || ''}
                        onChange={e => handleBucketChange(e.target.value)}
                        label={t?.s3Bucket ?? 'S3 Bucket'}
                        disabled={loadingBuckets}
                        endAdornment={
                          <Box sx={{ display: 'flex', mr: 5 }}>
                            {loadingBuckets && <CircularProgress size={16} />}
                            {!loadingBuckets && (
                              <>
                                <Tooltip title={t?.refreshList ?? 'Refresh list'}>
                                  <IconButton size="small" onClick={fetchBuckets}>
                                    <i className="ri-refresh-line" style={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={s3Configured ? (t?.createNewBucket ?? 'Create new bucket') : (t?.s3NotConfigured ?? 'S3 not configured')}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      onClick={() => setCreateDialogOpen(true)}
                                      disabled={!s3Configured}
                                    >
                                      <i className="ri-add-line" style={{ fontSize: 16 }} />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </>
                            )}
                          </Box>
                        }
                      >
                        <MenuItem value="">
                          <em>{t?.notSelected ?? 'Not selected (S3 disabled)'}</em>
                        </MenuItem>
                        {/* Current bucket if not in list */}
                        {globalSettings.s3DefaultBucket &&
                         !s3Buckets.some(b => b.name === globalSettings.s3DefaultBucket) && (
                          <MenuItem value={globalSettings.s3DefaultBucket}>
                            {globalSettings.s3DefaultBucket} ({t?.saved ?? 'saved'})
                          </MenuItem>
                        )}
                        {s3Buckets.map(bucket => (
                          <MenuItem key={bucket.name} value={bucket.name}>
                            {bucket.name}
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>
                        {!s3Configured && s3Error ? (
                          <Box component="span" sx={{ color: 'error.main' }}>
                            {s3Error}
                          </Box>
                        ) : validatingBucket ? (
                          t?.checking ?? 'Checking...'
                        ) : bucketValidation ? (
                          bucketValidation.accessible ? (
                            <Box component="span" sx={{ color: 'success.main' }}>
                              ✅ {t?.bucketAccessible ?? 'Bucket accessible'}
                            </Box>
                          ) : (
                            <Box component="span" sx={{ color: 'error.main' }}>
                              ❌ {bucketValidation.error || (t?.bucketNotAccessible ?? 'Bucket not accessible')}
                            </Box>
                          )
                        ) : !s3Configured ? (
                          <Box component="span" sx={{ color: 'warning.main' }}>
                            ⚠️ {t?.configureS3InEnv ?? 'Configure S3 in .env file'}
                          </Box>
                        ) : (
                          t?.selectOrCreateBucket ?? 'Select bucket or create new'
                        )}
                      </FormHelperText>
                    </FormControl>
                  </Box>
                </Grid>

                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={globalSettings.organizeByDate}
                        onChange={e => updateGlobal('organizeByDate', e.target.checked)}
                      />
                    }
                    label={t?.organizeByDate ?? 'Organize by date (2025/11/)'}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={globalSettings.organizeByEntityType}
                        onChange={e => updateGlobal('organizeByEntityType', e.target.checked)}
                      />
                    }
                    label={t?.organizeByEntityType ?? 'Organize by entity type'}
                  />
                </Grid>

                {/* Processing */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, mt: 2 }}>
                    <CustomAvatar color="info" skin="light" size={38}>
                      <i className="ri-image-edit-line" />
                    </CustomAvatar>
                    <Typography variant="subtitle1" fontWeight={500}>
                      {t?.processing ?? 'Processing'}
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                </Grid>

                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label={t?.maxFileSize ?? 'Max file size (MB)'}
                    value={globalSettings.globalMaxFileSize / (1024 * 1024)}
                    onChange={e => updateGlobal('globalMaxFileSize', parseInt(e.target.value) * 1024 * 1024)}
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label={t?.defaultQuality ?? 'Default quality'}
                    value={globalSettings.defaultQuality}
                    onChange={e => updateGlobal('defaultQuality', parseInt(e.target.value))}
                    inputProps={{ min: 1, max: 100 }}
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label={t?.parallelProcessing ?? 'Parallel processing'}
                    value={globalSettings.processingConcurrency}
                    onChange={e => updateGlobal('processingConcurrency', parseInt(e.target.value))}
                    inputProps={{ min: 1, max: 10 }}
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={globalSettings.defaultConvertToWebP}
                        onChange={e => updateGlobal('defaultConvertToWebP', e.target.checked)}
                      />
                    }
                    label={t?.convertToWebP ?? 'Convert to WebP'}
                  />
                </Grid>

                {/* S3 Settings */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, mt: 2 }}>
                    <CustomAvatar color="success" skin="light" size={38}>
                      <i className="ri-cloud-line" />
                    </CustomAvatar>
                    <Typography variant="subtitle1" fontWeight={500}>
                      {t?.s3Settings ?? 'S3 Storage'}
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                </Grid>

                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={globalSettings.s3Enabled}
                        onChange={e => updateGlobal('s3Enabled', e.target.checked)}
                      />
                    }
                    label={t?.enableS3 ?? 'Enable S3'}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <FormControl fullWidth disabled={!globalSettings.s3Enabled || loadingServices}>
                    <InputLabel>{t?.s3Server ?? 'S3 Server'}</InputLabel>
                    <Select
                      value={globalSettings.s3ServiceId || ''}
                      onChange={e => updateGlobal('s3ServiceId', e.target.value || null)}
                      label={t?.s3Server ?? 'S3 Server'}
                    >
                      <MenuItem value="">
                        <em>{t?.defaultEnv ?? 'Default (from .env)'}</em>
                      </MenuItem>
                      {s3Services.filter(s => s.enabled).map(service => (
                        <MenuItem key={service.id} value={service.id}>
                          {service.displayName} ({service.host})
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>
                      {loadingServices ? (t?.loading ?? 'Loading...') :
                       s3Services.length === 0 ? (t?.noS3Services ?? 'No S3 services configured') :
                       (t?.selectS3Server ?? 'Select S3 server or use default from .env')}
                    </FormHelperText>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={5}>
                  <FormControl fullWidth disabled={!globalSettings.s3Enabled}>
                    <InputLabel>{t?.storageLocation ?? 'Storage Location'}</InputLabel>
                    <Select
                      value={globalSettings.storageLocation}
                      onChange={e => updateGlobal('storageLocation', e.target.value)}
                      label={t?.storageLocation ?? 'Storage Location'}
                    >
                      <MenuItem value="local">{t?.localOnly ?? 'Local only'}</MenuItem>
                      <MenuItem value="s3">{t?.s3Only ?? 'S3 only (delete local after sync)'}</MenuItem>
                      <MenuItem value="both">{t?.localAndS3 ?? 'Local + S3 (keep both)'}</MenuItem>
                    </Select>
                    <FormHelperText>
                      {globalSettings.storageLocation === 'local' ? (t?.storageLocalHelp ?? 'Files stored only on local server') :
                       globalSettings.storageLocation === 's3' ? (t?.storageS3Help ?? 'Local files deleted after S3 sync') :
                       (t?.storageBothHelp ?? 'Files stored in both locations')}
                    </FormHelperText>
                  </FormControl>
                </Grid>

                {/* Sync Behavior */}
                {globalSettings.s3Enabled && globalSettings.storageLocation !== 'local' && (
                  <>
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, mt: 2 }}>
                        <CustomAvatar color="info" skin="light" size={38}>
                          <i className="ri-refresh-line" />
                        </CustomAvatar>
                        <Typography variant="subtitle1" fontWeight={500}>
                          {t?.syncBehavior ?? 'Sync Behavior'}
                        </Typography>
                      </Box>
                      <Divider sx={{ mb: 2 }} />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>{t?.syncMode ?? 'Sync Mode'}</InputLabel>
                        <Select
                          value={globalSettings.syncMode}
                          onChange={e => updateGlobal('syncMode', e.target.value)}
                          label={t?.syncMode ?? 'Sync Mode'}
                        >
                          <MenuItem value="immediate">{t?.syncImmediate ?? 'Immediate (sync in same request)'}</MenuItem>
                          <MenuItem value="background">{t?.syncBackground ?? 'Background (add to queue immediately)'}</MenuItem>
                          <MenuItem value="delayed">{t?.syncDelayed ?? 'Delayed (add to queue with delay)'}</MenuItem>
                          <MenuItem value="manual">{t?.syncManual ?? 'Manual (only via admin panel)'}</MenuItem>
                        </Select>
                        <FormHelperText>
                          {globalSettings.syncMode === 'immediate' ? (t?.syncImmediateHelp ?? 'Slowest upload, fastest availability on S3') :
                           globalSettings.syncMode === 'background' ? (t?.syncBackgroundHelp ?? 'Fast upload, sync happens in background') :
                           globalSettings.syncMode === 'delayed' ? (t?.syncDelayedHelp ?? 'Sync after specified delay') :
                           (t?.syncManualHelp ?? 'Sync only when triggered manually')}
                        </FormHelperText>
                      </FormControl>
                    </Grid>

                    {globalSettings.syncMode === 'delayed' && (
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label={t?.syncDelayMinutes ?? 'Sync delay (minutes)'}
                          value={globalSettings.syncDelayMinutes}
                          onChange={e => updateGlobal('syncDelayMinutes', parseInt(e.target.value) || 0)}
                          inputProps={{ min: 0, max: 1440 }}
                          helperText={t?.syncDelayHelp ?? 'How long to wait before syncing to S3'}
                        />
                      </Grid>
                    )}
                  </>
                )}

                {/* Trash / Deletion */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, mt: 2 }}>
                    <CustomAvatar color="error" skin="light" size={38}>
                      <i className="ri-delete-bin-line" />
                    </CustomAvatar>
                    <Typography variant="subtitle1" fontWeight={500}>
                      {t?.trashAndDeletion ?? 'Trash and deletion'}
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    select
                    fullWidth
                    label={t?.defaultDeleteMode ?? 'Default delete mode'}
                    value={globalSettings.deleteMode}
                    onChange={e => updateGlobal('deleteMode', e.target.value)}
                    SelectProps={{ native: true }}
                    helperText={t?.deleteModeHelp ?? 'soft = to trash, hard = permanently'}
                  >
                    <option value="soft">{t?.toTrash ?? 'To trash (soft)'}</option>
                    <option value="hard">{t?.permanently ?? 'Permanently (hard)'}</option>
                  </TextField>
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label={t?.trashRetentionDays ?? 'Trash retention (days)'}
                    value={globalSettings.trashRetentionDays}
                    onChange={e => updateGlobal('trashRetentionDays', parseInt(e.target.value) || 0)}
                    inputProps={{ min: 0, max: 365 }}
                    helperText={globalSettings.trashRetentionDays === 0
                      ? (t?.trashNeverDelete ?? 'Never auto-delete from trash')
                      : (t?.trashAutoDeleteAfter ?? `Auto-delete after ${globalSettings.trashRetentionDays} days`)}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={globalSettings.s3DeleteWithLocal}
                        onChange={e => updateGlobal('s3DeleteWithLocal', e.target.checked)}
                        disabled={!globalSettings.s3Enabled}
                      />
                    }
                    label={t?.deleteFromS3OnHardDelete ?? 'Delete from S3 on hard delete'}
                  />
                </Grid>

                {/* Cleanup */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, mt: 2 }}>
                    <CustomAvatar color="warning" skin="light" size={38}>
                      <i className="ri-file-shred-line" />
                    </CustomAvatar>
                    <Typography variant="subtitle1" fontWeight={500}>
                      {t?.orphanCleanup ?? 'Orphan file cleanup'}
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                </Grid>

                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={globalSettings.autoDeleteOrphans}
                        onChange={e => updateGlobal('autoDeleteOrphans', e.target.checked)}
                      />
                    }
                    label={t?.deleteOrphanFiles ?? 'Delete orphan files'}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label={t?.keepOrphans ?? 'Keep orphans (days)'}
                    value={globalSettings.orphanRetentionDays}
                    onChange={e => updateGlobal('orphanRetentionDays', parseInt(e.target.value))}
                    disabled={!globalSettings.autoDeleteOrphans}
                    helperText={t?.orphanFilesHelp ?? 'Files not linked to any entity'}
                  />
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Entity Settings */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title={t?.entityTypeSettings ?? 'Entity type settings'} />
          <CardContent>
            {entitySettings.map(settings => (
              <Accordion key={settings.id}>
                <AccordionSummary expandIcon={<i className="ri-arrow-down-s-line" />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                    <Typography variant="subtitle1">{settings.displayName}</Typography>
                    <Chip label={settings.entityType} size="small" variant="outlined" />
                    <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                      {settings.watermarkEnabled && (
                        <Chip label={`💧 ${t?.watermark ?? 'Watermark'}`} size="small" color="info" />
                      )}
                      <Chip label={formatBytes(settings.maxFileSize)} size="small" />
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {settings.description || (t?.noDescription ?? 'No description')}
                      </Typography>

                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell>{t?.maxFileSizeLabel ?? 'Max file size'}</TableCell>
                            <TableCell>{formatBytes(settings.maxFileSize)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>{t?.maxFiles ?? 'Max files'}</TableCell>
                            <TableCell>{settings.maxFilesPerEntity}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>{t?.mimeTypes ?? 'MIME types'}</TableCell>
                            <TableCell sx={{ wordBreak: 'break-all' }}>{settings.allowedMimeTypes}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>{t?.quality ?? 'Quality'}</TableCell>
                            <TableCell>{settings.quality}%</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>{t?.storageStrategy ?? 'Storage strategy'}</TableCell>
                            <TableCell>{settings.storageStrategy}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>{t?.convertToWebPLabel ?? 'WebP conversion'}</TableCell>
                            <TableCell>{settings.convertToWebP ? '✅' : '❌'}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>{t?.stripMetadata ?? 'Strip metadata'}</TableCell>
                            <TableCell>{settings.stripMetadata ? '✅' : '❌'}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>{t?.sizeVariants ?? 'Size variants'}</Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>{t?.name ?? 'Name'}</TableCell>
                            <TableCell>{t?.size ?? 'Size'}</TableCell>
                            <TableCell>{t?.fit ?? 'Fit'}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {JSON.parse(settings.variants || '[]').map((v: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell>{v.name}</TableCell>
                              <TableCell>{v.width}×{v.height}</TableCell>
                              <TableCell>{v.fit}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      {settings.watermarkEnabled && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                          {t?.watermark ?? 'Watermark'}: {settings.watermarkPosition}, opacity: {settings.watermarkOpacity}
                        </Alert>
                      )}
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}
          </CardContent>
        </Card>
      </Grid>

      {/* Create Bucket Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <i className="ri-add-circle-line" />
            {t?.createS3Bucket ?? 'Create new S3 Bucket'}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label={t?.bucketName ?? 'Bucket name'}
              value={newBucketName}
              onChange={e => setNewBucketName(e.target.value.toLowerCase())}
              placeholder={t?.bucketNamePlaceholder ?? 'my-media-bucket'}
              helperText={t?.bucketNameHelp ?? 'Only lowercase letters, numbers, dots and hyphens. Length 3-63 characters.'}
              disabled={creatingBucket}
            />

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>{t?.namingRules ?? 'Naming rules:'}</strong>
              </Typography>
              <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                <li>{t?.namingRule1 ?? 'Only lowercase letters (a-z), numbers (0-9), dots (.) and hyphens (-)'}</li>
                <li>{t?.namingRule2 ?? 'Must start and end with a letter or number'}</li>
                <li>{t?.namingRule3 ?? 'Length from 3 to 63 characters'}</li>
                <li>{t?.namingRule4 ?? 'Cannot use IP address format (e.g., 192.168.1.1)'}</li>
              </ul>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={creatingBucket}>
            {t?.cancel ?? 'Cancel'}
          </Button>
          <Button
            variant="contained"
            onClick={createBucket}
            disabled={creatingBucket || !newBucketName.trim()}
            startIcon={creatingBucket ? <CircularProgress size={16} color="inherit" /> : <i className="ri-add-line" />}
          >
            {creatingBucket ? (t?.creating ?? 'Creating...') : (t?.create ?? 'Create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}


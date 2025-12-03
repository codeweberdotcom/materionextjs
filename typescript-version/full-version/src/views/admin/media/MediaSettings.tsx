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
  pathOrganization: string // 'date' | 'hash' | 'flat'
  organizeByEntityType: boolean
  organizeByDate: boolean // @deprecated
  // Limits
  globalMaxFileSize: number
  globalDailyUploadLimit?: number
  // Processing
  defaultQuality: number
  outputFormat: string // 'webp' | 'jpeg' | 'original'
  processingConcurrency: number
  defaultConvertToWebP: boolean // @deprecated
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
  port?: number
  protocol?: string
  metadata?: string
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
  const [envDefaultBucket, setEnvDefaultBucket] = useState<string | null>(null)
  const [bucketPreConfigured, setBucketPreConfigured] = useState(false)

  // S3 Services
  const [s3Services, setS3Services] = useState<S3Service[]>([])
  const [loadingServices, setLoadingServices] = useState(false)

  // Orphan Stats
  const [orphanStats, setOrphanStats] = useState<OrphanStats | null>(null)
  const [loadingOrphans, setLoadingOrphans] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        // First fetch settings to get s3ServiceId
        const settingsRes = await fetch('/api/admin/media/settings')
        if (settingsRes.ok) {
          const data = await settingsRes.json()
          setGlobalSettings(data.global || {})
          setEntitySettings(Array.isArray(data.entities) ? data.entities : [])
          // Pass serviceId to fetch buckets from correct server
          fetchBuckets(data.global?.s3ServiceId || null)
        } else {
          throw new Error('Failed to fetch settings')
        }
      } catch (error) {
        toast.error(t?.loadError ?? 'Error loading settings')
      } finally {
        setLoading(false)
      }
      fetchS3Services()
      fetchOrphanStats()
    }
    init()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/media/settings')
      if (!response.ok) throw new Error('Failed to fetch settings')

      const data = await response.json()
      setGlobalSettings(data.global)
      setEntitySettings(Array.isArray(data.entities) ? data.entities : [])
      // Fetch buckets for configured service (or env if null)
      fetchBuckets(data.global?.s3ServiceId || null)
    } catch (error) {
      toast.error(t?.loadError ?? 'Error loading settings')
    } finally {
      setLoading(false)
    }
  }

  const fetchBuckets = async (serviceId?: string | null) => {
    setLoadingBuckets(true)
    setS3Error(null)

    try {
      // Build URL with optional serviceId
      const url = serviceId 
        ? `/api/admin/media/s3/buckets?serviceId=${serviceId}`
        : '/api/admin/media/s3/buckets'
      
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch buckets')

      const data = await response.json()
      setS3Configured(data.configured)
      setS3Buckets(data.buckets || [])
      setBucketPreConfigured(data.preConfigured || false)
      
      // Save default bucket from env (only when no serviceId)
      if (!serviceId && data.defaultBucket) {
        setEnvDefaultBucket(data.defaultBucket)
      }

      // If bucket is pre-configured in service, auto-select it and set public URL
      if (data.preConfigured && data.buckets?.length === 1) {
        const preConfiguredBucket = data.buckets[0].name
        const service = s3Services.find(s => s.id === serviceId)
        
        let publicUrl = ''
        if (service?.host) {
          const protocol = (service.protocol || 'https').replace(/:\/\/$/, '').replace(/:$/, '')
          const metadata = service.metadata ? JSON.parse(service.metadata) : {}
          const forcePathStyle = metadata.forcePathStyle ?? true
          
          const baseUrl = service.port 
            ? `${protocol}://${service.host}:${service.port}`
            : `${protocol}://${service.host}`
          
          publicUrl = forcePathStyle 
            ? `${baseUrl}/${preConfiguredBucket}`
            : `${protocol}://${preConfiguredBucket}.${service.host}${service.port ? ':' + service.port : ''}`
        }
        
        setGlobalSettings(prev => prev ? {
          ...prev,
          s3DefaultBucket: preConfiguredBucket,
          s3PublicUrlPrefix: publicUrl || prev.s3PublicUrlPrefix
        } : prev)
      }

      if (data.error) {
        setS3Error(data.error)
      }
    } catch (error) {
      setS3Error(t?.bucketsLoadError ?? 'Error loading bucket list')
    } finally {
      setLoadingBuckets(false)
    }
  }

  // Handle S3 server change
  const handleS3ServerChange = (value: string) => {
    const serviceId = value === 'default' ? null : value

    if (!globalSettings) return

    // Update settings - сбрасываем bucket и publicUrl при смене сервера
    setGlobalSettings({
      ...globalSettings,
      s3ServiceId: serviceId,
      s3DefaultBucket: '', // Reset bucket when server changes
      s3PublicUrlPrefix: '' // Reset public URL when server changes
    })

    // Clear current buckets and validation
    setS3Buckets([])
    setBucketValidation(null)
    setS3Error(null)
    setBucketPreConfigured(false)

    // Fetch buckets for selected server
    fetchBuckets(serviceId)
  }

  const fetchS3Services = async () => {
    setLoadingServices(true)
    try {
      const response = await fetch('/api/admin/settings/services?type=S3')
      if (!response.ok) throw new Error('Failed to fetch services')

      const result = await response.json()
      setS3Services(result.data || [])
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
        body: JSON.stringify({
          bucketName,
          serviceId: globalSettings?.s3ServiceId || undefined
        }),
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
        body: JSON.stringify({
          bucketName: newBucketName.trim(),
          serviceId: globalSettings?.s3ServiceId || undefined
        }),
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
      await fetchBuckets(globalSettings?.s3ServiceId)
      updateGlobal('s3DefaultBucket', newBucketName.trim())
    } catch (error) {
      toast.error(t?.bucketCreateError ?? 'Error creating bucket')
    } finally {
      setCreatingBucket(false)
    }
  }

  // Сформировать default S3 Public URL на основе сервера и bucket
  const buildDefaultS3PublicUrl = (serviceId: string | null, bucket: string): string => {
    if (!bucket) return ''
    
    // Если выбран внешний сервис
    if (serviceId) {
      const service = s3Services.find(s => s.id === serviceId)
      if (service?.host) {
        const protocol = (service.protocol || 'https').replace(/:\/\/$/, '').replace(/:$/, '')
        const metadata = service.metadata ? JSON.parse(service.metadata) : {}
        const forcePathStyle = metadata.forcePathStyle ?? true
        
        let baseUrl = service.port 
          ? `${protocol}://${service.host}:${service.port}`
          : `${protocol}://${service.host}`
        
        // Path-style: http://host:port/bucket
        if (forcePathStyle) {
          return `${baseUrl}/${bucket}`
        }
        // Virtual-hosted style: http://bucket.host:port
        return `${protocol}://${bucket}.${service.host}${service.port ? ':' + service.port : ''}`
      }
    }
    
    // Для ENV конфигурации - пустой (будет использоваться proxy)
    return ''
  }

  const handleBucketChange = (bucketName: string) => {
    updateGlobal('s3DefaultBucket', bucketName)

    if (bucketName) {
      validateBucket(bucketName)
      
      // Автозаполнение S3 Public URL если он пустой
      if (!globalSettings?.s3PublicUrlPrefix) {
        const defaultUrl = buildDefaultS3PublicUrl(globalSettings?.s3ServiceId || null, bucketName)
        if (defaultUrl) {
          updateGlobal('s3PublicUrlPrefix', defaultUrl)
        }
      }
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
                  <TextField
                    select
                    fullWidth
                    label={t?.pathOrganization ?? 'Path organization'}
                    value={globalSettings.pathOrganization || 'date'}
                    onChange={e => updateGlobal('pathOrganization', e.target.value)}
                    helperText={
                      globalSettings.pathOrganization === 'hash' 
                        ? (t?.pathHashHelp ?? 'Files organized by ID hash (hides date)')
                        : globalSettings.pathOrganization === 'flat'
                        ? (t?.pathFlatHelp ?? 'All files in one folder')
                        : (t?.pathDateHelp ?? 'Files organized by upload date')
                    }
                  >
                    <MenuItem value="date">{t?.organizeByDate ?? 'By date'} (2025/12/)</MenuItem>
                    <MenuItem value="hash">{t?.organizeByHash ?? 'By hash'} (3e/uB/)</MenuItem>
                    <MenuItem value="flat">{t?.organizeFlat ?? 'Flat'} ({t?.noSubfolders ?? 'no subfolders'})</MenuItem>
                  </TextField>
                </Grid>

                <Grid item xs={12} md={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={globalSettings.organizeByEntityType}
                        onChange={e => updateGlobal('organizeByEntityType', e.target.checked)}
                      />
                    }
                    label={t?.organizeByEntityType ?? 'By entity type'}
                  />
                  <FormHelperText sx={{ ml: 0 }}>
                    {t?.organizeByEntityTypeHelp ?? '/listings/, /avatars/'}
                  </FormHelperText>
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
                  <TextField
                    select
                    fullWidth
                    label={t?.outputFormat ?? 'Output format'}
                    value={globalSettings.outputFormat || 'webp'}
                    onChange={e => updateGlobal('outputFormat', e.target.value)}
                    helperText={
                      globalSettings.outputFormat === 'jpeg'
                        ? (t?.jpegHelp ?? 'Universal compatibility')
                        : globalSettings.outputFormat === 'original'
                        ? (t?.originalHelp ?? 'Keep PNG/JPEG as uploaded')
                        : (t?.webpHelp ?? 'Best compression, modern browsers')
                    }
                  >
                    <MenuItem value="webp">WebP ({t?.recommended ?? 'recommended'})</MenuItem>
                    <MenuItem value="jpeg">JPEG</MenuItem>
                    <MenuItem value="original">{t?.originalFormat ?? 'Original format'}</MenuItem>
                  </TextField>
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

                <Grid item xs={12}>
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

                <Grid item xs={12} md={3}>
                  <FormControl fullWidth disabled={!globalSettings?.s3Enabled || loadingServices}>
                    <InputLabel>{t?.s3Server ?? 'S3 Server'}</InputLabel>
                    <Select
                      value={globalSettings?.s3ServiceId ?? (s3Configured ? 'default' : '')}
                      onChange={e => handleS3ServerChange(e.target.value as string)}
                      label={t?.s3Server ?? 'S3 Server'}
                    >
                      {/* Show Default (from .env) only if S3 is configured in env */}
                      {s3Configured && (
                        <MenuItem value="default">{t?.defaultEnv ?? 'Default (from .env)'}</MenuItem>
                      )}
                      {/* Show placeholder if nothing configured */}
                      {!s3Configured && s3Services.length === 0 && (
                        <MenuItem value="" disabled>{t?.noS3Available ?? 'No S3 configured'}</MenuItem>
                      )}
                      {s3Services.map(service => (
                        <MenuItem
                          key={service.id}
                          value={service.id}
                          disabled={!service.enabled}
                        >
                          {service.displayName} ({service.host})
                          {!service.enabled && ' ⚠️ disabled'}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>
                      {loadingServices ? (t?.loading ?? 'Loading...') :
                        (!s3Configured && s3Services.length === 0) ? (t?.noS3Available ?? 'Configure S3 in .env or add External Service') :
                        (t?.selectS3Server ?? 'Select server')}
                    </FormHelperText>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={3}>
                  {/* When using Default (from .env), bucket is read-only from S3_BUCKET env */}
                  {!globalSettings.s3ServiceId && s3Configured ? (
                    <TextField
                      fullWidth
                      label={t?.s3Bucket ?? 'S3 Bucket'}
                      value={envDefaultBucket || ''}
                      disabled
                      helperText={envDefaultBucket 
                        ? (t?.bucketFromEnv ?? 'From .env (S3_BUCKET)') 
                        : (t?.noBucketInEnv ?? 'S3_BUCKET not set in .env')}
                      InputProps={{
                        startAdornment: envDefaultBucket ? (
                          <Box component="span" sx={{ color: 'success.main', mr: 1 }}>✅</Box>
                        ) : (
                          <Box component="span" sx={{ color: 'warning.main', mr: 1 }}>⚠️</Box>
                        )
                      }}
                    />
                  ) : !globalSettings.s3ServiceId && !s3Configured ? (
                    <TextField
                      fullWidth
                      label={t?.s3Bucket ?? 'S3 Bucket'}
                      value=""
                      disabled
                      helperText={t?.selectS3ServerFirst ?? 'Select S3 server first'}
                    />
                  ) : (
                    <FormControl fullWidth disabled={!globalSettings.s3Enabled || loadingBuckets}>
                      <InputLabel id="s3-bucket-label">{t?.s3Bucket ?? 'S3 Bucket'}</InputLabel>
                      <Select
                        labelId="s3-bucket-label"
                        value={globalSettings.s3DefaultBucket || ''}
                        onChange={e => handleBucketChange(e.target.value)}
                        label={t?.s3Bucket ?? 'S3 Bucket'}
                        disabled={bucketPreConfigured}
                        endAdornment={
                          <Box sx={{ display: 'flex', mr: 5 }}>
                            {loadingBuckets && <CircularProgress size={16} />}
                            {!loadingBuckets && !bucketPreConfigured && (
                              <>
                                <Tooltip title={t?.refreshList ?? 'Refresh'}>
                                  <IconButton size="small" onClick={() => fetchBuckets(globalSettings?.s3ServiceId)}>
                                    <i className="ri-refresh-line" style={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={s3Configured ? (t?.createNewBucket ?? 'Create') : (t?.s3NotConfigured ?? 'S3 not configured')}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      onClick={() => setCreateDialogOpen(true)}
                                      disabled={!s3Configured || !globalSettings.s3Enabled}
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
                        {!bucketPreConfigured && (
                          <MenuItem value="">
                            <em>{t?.notSelected ?? 'Not selected'}</em>
                          </MenuItem>
                        )}
                        {globalSettings.s3DefaultBucket &&
                         !s3Buckets.some(b => b.name === globalSettings.s3DefaultBucket) && (
                          <MenuItem value={globalSettings.s3DefaultBucket}>
                            {globalSettings.s3DefaultBucket} ({t?.saved ?? 'saved'})
                          </MenuItem>
                        )}
                        {s3Buckets.map(bucket => (
                          <MenuItem key={bucket.name} value={bucket.name}>
                            {bucket.name} {bucketPreConfigured && `(${t?.fixedInService ?? 'fixed'})`}
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>
                        {bucketPreConfigured ? (
                          <Box component="span" sx={{ color: 'info.main' }}>
                            🔒 {t?.bucketFixedInService ?? 'Bucket is fixed in service settings'}
                          </Box>
                        ) : !s3Configured && s3Error && !globalSettings.s3ServiceId && s3Services.length === 0 ? (
                          <Box component="span" sx={{ color: 'error.main' }}>{s3Error}</Box>
                        ) : validatingBucket ? (
                          t?.checking ?? 'Checking...'
                        ) : bucketValidation?.accessible ? (
                          <Box component="span" sx={{ color: 'success.main' }}>✅ {t?.bucketAccessible ?? 'OK'}</Box>
                        ) : bucketValidation ? (
                          <Box component="span" sx={{ color: 'error.main' }}>❌ {t?.bucketNotAccessible ?? 'Error'}</Box>
                        ) : (
                          t?.selectOrCreateBucket ?? 'Select bucket'
                        )}
                      </FormHelperText>
                    </FormControl>
                  )}
                </Grid>

                <Grid item xs={12} md={3}>
                  <FormControl fullWidth disabled={!globalSettings.s3Enabled}>
                    <InputLabel>{t?.storageLocation ?? 'Storage Location'}</InputLabel>
                    <Select
                      value={globalSettings.storageLocation}
                      onChange={e => updateGlobal('storageLocation', e.target.value)}
                      label={t?.storageLocation ?? 'Storage Location'}
                    >
                      <MenuItem value="local">{t?.localOnly ?? 'Local only'}</MenuItem>
                      <MenuItem value="s3">{t?.s3Only ?? 'S3 only'}</MenuItem>
                      <MenuItem value="both">{t?.localAndS3 ?? 'Local + S3'}</MenuItem>
                    </Select>
                    <FormHelperText>
                      {globalSettings.storageLocation === 'local' ? (t?.storageLocalHelp ?? 'Only local') :
                       globalSettings.storageLocation === 's3' ? (t?.storageS3Help ?? 'Delete local after sync') :
                       (t?.storageBothHelp ?? 'Keep both copies')}
                    </FormHelperText>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    sx={{ mt: 2 }}
                    control={
                      <Switch
                        checked={globalSettings.s3DeleteWithLocal}
                        onChange={e => updateGlobal('s3DeleteWithLocal', e.target.checked)}
                        disabled={!globalSettings.s3Enabled}
                      />
}
                    label={t?.deleteFromS3OnHardDelete ?? 'Delete S3 on hard delete'}
                  />
                </Grid>

                {/* S3 CDN / Public URL */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label={t?.s3PublicUrlPrefix ?? 'S3 Public URL / CDN'}
                    value={globalSettings.s3PublicUrlPrefix || ''}
                    onChange={e => updateGlobal('s3PublicUrlPrefix', e.target.value || null)}
                    disabled={!globalSettings.s3Enabled}
                    placeholder="https://cdn.example.com или http://localhost:9000/bucket"
                    helperText={t?.s3PublicUrlPrefixHelp ?? 'Public URL for images (CDN or direct S3). Leave empty to use proxy.'}
                    InputProps={{
                      endAdornment: globalSettings.s3Enabled && globalSettings.s3DefaultBucket && (
                        <Tooltip title={t?.resetToDefault ?? 'Reset to default'}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              const defaultUrl = buildDefaultS3PublicUrl(
                                globalSettings.s3ServiceId || null,
                                globalSettings.s3DefaultBucket || ''
                              )
                              updateGlobal('s3PublicUrlPrefix', defaultUrl || null)
                            }}
                          >
                            <i className="ri-refresh-line" style={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )
                    }}
                  />
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

                <Grid item xs={12} md={6}>
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

                <Grid item xs={12} md={6}>
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

                {/* Orphan Files Statistics */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, mt: 2 }}>
                    <CustomAvatar color="warning" skin="light" size={38}>
                      <i className="ri-file-shred-line" />
                    </CustomAvatar>
                    <Typography variant="subtitle1" fontWeight={500}>
                      {t?.orphanFiles ?? 'Orphan Files'}
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                </Grid>

                {loadingOrphans ? (
                  <Grid item xs={12}>
                    <Skeleton variant="rectangular" height={120} />
                  </Grid>
                ) : orphanStats ? (
                  <>
                    <Grid item xs={12} md={3}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {t?.dbOrphans ?? 'DB Orphans'}
                          </Typography>
                          <Typography variant="h5">
                            {orphanStats.dbOrphans}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {t?.diskOrphans ?? 'Disk Orphans'}
                          </Typography>
                          <Typography variant="h5">
                            {orphanStats.diskOrphans}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {t?.totalOrphans ?? 'Total'}
                          </Typography>
                          <Typography variant="h5">
                            {orphanStats.totalCount}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {t?.totalSize ?? 'Total Size'}
                          </Typography>
                          <Typography variant="h5">
                            {orphanStats.totalSizeFormatted}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                          variant="outlined"
                          onClick={() => fetchOrphanStats()}
                          startIcon={<i className="ri-refresh-line" />}
                        >
                          {t?.refresh ?? 'Refresh'}
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={() => {
                            // TODO: Open dialog with orphan files list
                            toast.info('Orphan files list view - coming soon')
                          }}
                          startIcon={<i className="ri-eye-line" />}
                        >
                          {t?.view ?? 'View'}
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={() => {
                            // TODO: Export orphan files list
                            toast.info('Export orphan files - coming soon')
                          }}
                          startIcon={<i className="ri-download-line" />}
                        >
                          {t?.export ?? 'Export'}
                        </Button>
                      </Box>
                    </Grid>
                  </>
                ) : (
                  <Grid item xs={12}>
                    <Alert severity="info">
                      {t?.noOrphanStats ?? 'Orphan statistics not available'}
                    </Alert>
                  </Grid>
                )}
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


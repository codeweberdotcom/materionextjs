'use client'

/**
 * Настройки медиа - глобальные настройки и настройки по сущностям
 */

import { useState, useEffect } from 'react'

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

import { toast } from 'react-toastify'

interface GlobalSettings {
  id: string
  defaultStorageStrategy: string
  s3DefaultBucket?: string
  s3DefaultRegion?: string
  s3PublicUrlPrefix?: string
  localUploadPath: string
  localPublicUrlPrefix: string
  organizeByDate: boolean
  organizeByEntityType: boolean
  globalMaxFileSize: number
  globalDailyUploadLimit?: number
  autoDeleteOrphans: boolean
  orphanRetentionDays: number
  autoSyncEnabled: boolean
  autoSyncDelayMinutes: number
  autoCleanupLocalEnabled: boolean
  keepLocalDays: number
  defaultQuality: number
  defaultConvertToWebP: boolean
  processingConcurrency: number
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

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

export default function MediaSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null)
  const [entitySettings, setEntitySettings] = useState<EntitySettings[]>([])

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/media/settings')
      if (!response.ok) throw new Error('Failed to fetch settings')
      
      const data = await response.json()
      setGlobalSettings(data.global)
      setEntitySettings(data.entitySettings)
    } catch (error) {
      toast.error('Ошибка загрузки настроек')
    } finally {
      setLoading(false)
    }
  }

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
      
      toast.success('Настройки сохранены')
    } catch (error) {
      toast.error('Ошибка сохранения настроек')
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
            title="Глобальные настройки"
            action={
              <Button 
                variant="contained" 
                onClick={saveGlobalSettings}
                disabled={saving}
              >
                {saving ? <CircularProgress size={20} /> : 'Сохранить'}
              </Button>
            }
          />
          <CardContent>
            {globalSettings && (
              <Grid container spacing={4}>
                {/* Storage */}
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    <i className="ri-hard-drive-2-line" style={{ marginRight: 8 }} />
                    Хранилище
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Локальный путь"
                    value={globalSettings.localUploadPath}
                    onChange={e => updateGlobal('localUploadPath', e.target.value)}
                    helperText="Путь относительно public/"
                  />
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Публичный URL префикс"
                    value={globalSettings.localPublicUrlPrefix}
                    onChange={e => updateGlobal('localPublicUrlPrefix', e.target.value)}
                  />
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="S3 Bucket"
                    value={globalSettings.s3DefaultBucket || ''}
                    onChange={e => updateGlobal('s3DefaultBucket', e.target.value)}
                    helperText="Оставьте пустым для отключения S3"
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={globalSettings.organizeByDate}
                        onChange={e => updateGlobal('organizeByDate', e.target.checked)}
                      />
                    }
                    label="Организовать по дате (2025/11/)"
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
                    label="Организовать по типу сущности"
                  />
                </Grid>

                {/* Processing */}
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                    <i className="ri-image-edit-line" style={{ marginRight: 8 }} />
                    Обработка
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Макс. размер файла (MB)"
                    value={globalSettings.globalMaxFileSize / (1024 * 1024)}
                    onChange={e => updateGlobal('globalMaxFileSize', parseInt(e.target.value) * 1024 * 1024)}
                  />
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Качество по умолчанию"
                    value={globalSettings.defaultQuality}
                    onChange={e => updateGlobal('defaultQuality', parseInt(e.target.value))}
                    inputProps={{ min: 1, max: 100 }}
                  />
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Параллельная обработка"
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
                    label="Конвертировать в WebP"
                  />
                </Grid>

                {/* Auto-sync */}
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                    <i className="ri-refresh-line" style={{ marginRight: 8 }} />
                    Автосинхронизация
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={globalSettings.autoSyncEnabled}
                        onChange={e => updateGlobal('autoSyncEnabled', e.target.checked)}
                      />
                    }
                    label="Автосинхронизация на S3"
                  />
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Задержка синхр. (мин)"
                    value={globalSettings.autoSyncDelayMinutes}
                    onChange={e => updateGlobal('autoSyncDelayMinutes', parseInt(e.target.value))}
                    disabled={!globalSettings.autoSyncEnabled}
                  />
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={globalSettings.autoCleanupLocalEnabled}
                        onChange={e => updateGlobal('autoCleanupLocalEnabled', e.target.checked)}
                      />
                    }
                    label="Авто-очистка локальных"
                  />
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Хранить локально (дней)"
                    value={globalSettings.keepLocalDays}
                    onChange={e => updateGlobal('keepLocalDays', parseInt(e.target.value))}
                    disabled={!globalSettings.autoCleanupLocalEnabled}
                  />
                </Grid>

                {/* Cleanup */}
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                    <i className="ri-delete-bin-line" style={{ marginRight: 8 }} />
                    Очистка
                  </Typography>
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
                    label="Удалять несвязанные файлы"
                  />
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Хранить orphans (дней)"
                    value={globalSettings.orphanRetentionDays}
                    onChange={e => updateGlobal('orphanRetentionDays', parseInt(e.target.value))}
                    disabled={!globalSettings.autoDeleteOrphans}
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
          <CardHeader title="Настройки по типам сущностей" />
          <CardContent>
            {entitySettings.map(settings => (
              <Accordion key={settings.id}>
                <AccordionSummary expandIcon={<i className="ri-arrow-down-s-line" />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                    <Typography variant="subtitle1">{settings.displayName}</Typography>
                    <Chip label={settings.entityType} size="small" variant="outlined" />
                    <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                      {settings.watermarkEnabled && (
                        <Chip label="💧 Водяной знак" size="small" color="info" />
                      )}
                      <Chip label={formatBytes(settings.maxFileSize)} size="small" />
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {settings.description || 'Нет описания'}
                      </Typography>
                      
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell>Макс. размер файла</TableCell>
                            <TableCell>{formatBytes(settings.maxFileSize)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Макс. файлов</TableCell>
                            <TableCell>{settings.maxFilesPerEntity}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>MIME типы</TableCell>
                            <TableCell sx={{ wordBreak: 'break-all' }}>{settings.allowedMimeTypes}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Качество</TableCell>
                            <TableCell>{settings.quality}%</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Стратегия хранения</TableCell>
                            <TableCell>{settings.storageStrategy}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Конвертация в WebP</TableCell>
                            <TableCell>{settings.convertToWebP ? '✅' : '❌'}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Очистка метаданных</TableCell>
                            <TableCell>{settings.stripMetadata ? '✅' : '❌'}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>Варианты размеров</Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Имя</TableCell>
                            <TableCell>Размер</TableCell>
                            <TableCell>Fit</TableCell>
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
                          Водяной знак: {settings.watermarkPosition}, opacity: {settings.watermarkOpacity}
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
    </Grid>
  )
}


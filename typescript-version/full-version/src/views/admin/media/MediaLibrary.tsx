'use client'

/**
 * Медиатека - список и управление медиа файлами
 */

import { useState, useEffect, useCallback } from 'react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import Pagination from '@mui/material/Pagination'
import Checkbox from '@mui/material/Checkbox'
import Tooltip from '@mui/material/Tooltip'
import Alert from '@mui/material/Alert'
import ImageList from '@mui/material/ImageList'
import ImageListItem from '@mui/material/ImageListItem'
import ImageListItemBar from '@mui/material/ImageListItemBar'
import Skeleton from '@mui/material/Skeleton'

import { toast } from 'react-toastify'

// Types
interface Media {
  id: string
  filename: string
  slug: string
  localPath?: string
  s3Key?: string
  storageStatus: string
  mimeType: string
  size: number
  width?: number
  height?: number
  entityType: string
  entityId?: string
  hasWatermark: boolean
  isProcessed: boolean
  alt?: string
  title?: string
  createdAt: string
}

interface MediaListResult {
  items: Media[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const ENTITY_TYPES = [
  { value: '', label: 'Все типы' },
  { value: 'user_avatar', label: 'Аватары' },
  { value: 'company_logo', label: 'Логотипы' },
  { value: 'company_banner', label: 'Баннеры' },
  { value: 'company_photo', label: 'Фото компаний' },
  { value: 'listing_image', label: 'Фото объявлений' },
  { value: 'site_logo', label: 'Логотип сайта' },
  { value: 'watermark', label: 'Водяные знаки' },
  { value: 'document', label: 'Документы' },
]

const STORAGE_STATUSES = [
  { value: '', label: 'Все статусы' },
  { value: 'local_only', label: 'Только локально' },
  { value: 'synced', label: 'Синхронизировано' },
  { value: 's3_only', label: 'Только S3' },
  { value: 'sync_pending', label: 'Ожидает синхр.' },
  { value: 'sync_error', label: 'Ошибка синхр.' },
]

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const getStorageStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
  switch (status) {
    case 'synced': return 'success'
    case 'local_only': return 'default'
    case 's3_only': return 'success'
    case 'sync_pending': return 'warning'
    case 'sync_error': return 'error'
    default: return 'default'
  }
}

export default function MediaLibrary() {
  const [media, setMedia] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  
  // Filters
  const [search, setSearch] = useState('')
  const [entityType, setEntityType] = useState('')
  const [storageStatus, setStorageStatus] = useState('')
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  // Detail dialog
  const [detailMedia, setDetailMedia] = useState<Media | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  
  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadEntityType, setUploadEntityType] = useState('other')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  
  // Scan dialog
  const [scanOpen, setScanOpen] = useState(false)
  const [scanStats, setScanStats] = useState<any>(null)
  const [scanning, setScanning] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)

  const fetchMedia = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '24',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
      
      if (search) params.set('search', search)
      if (entityType) params.set('entityType', entityType)
      if (storageStatus) params.set('storageStatus', storageStatus)
      
      const response = await fetch(`/api/admin/media?${params}`)
      if (!response.ok) throw new Error('Failed to fetch media')
      
      const data: MediaListResult = await response.json()
      setMedia(data.items)
      setTotalPages(data.totalPages)
      setTotal(data.total)
    } catch (error) {
      toast.error('Ошибка загрузки медиа')
    } finally {
      setLoading(false)
    }
  }, [page, search, entityType, storageStatus])

  useEffect(() => {
    fetchMedia()
  }, [fetchMedia])

  const handleSelectAll = () => {
    if (selectedIds.length === media.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(media.map(m => m.id))
    }
  }

  const handleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id) 
        : [...prev, id]
    )
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить этот файл?')) return
    
    try {
      const response = await fetch(`/api/admin/media/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete')
      
      toast.success('Файл удалён')
      fetchMedia()
    } catch (error) {
      toast.error('Ошибка удаления')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Удалить ${selectedIds.length} файлов?`)) return
    
    try {
      for (const id of selectedIds) {
        await fetch(`/api/admin/media/${id}`, { method: 'DELETE' })
      }
      toast.success(`Удалено ${selectedIds.length} файлов`)
      setSelectedIds([])
      fetchMedia()
    } catch (error) {
      toast.error('Ошибка удаления')
    }
  }

  const handleUpload = async () => {
    if (!uploadFile) return
    
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('entityType', uploadEntityType)
      
      const response = await fetch('/api/admin/media', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }
      
      toast.success('Файл загружен')
      setUploadOpen(false)
      setUploadFile(null)
      fetchMedia()
    } catch (error: any) {
      toast.error(error.message || 'Ошибка загрузки')
    } finally {
      setUploading(false)
    }
  }

  const openScanDialog = async () => {
    setScanOpen(true)
    setScanLoading(true)
    try {
      const response = await fetch('/api/admin/media/scan')
      if (response.ok) {
        const data = await response.json()
        setScanStats(data)
      }
    } catch (error) {
      toast.error('Ошибка получения статистики')
    } finally {
      setScanLoading(false)
    }
  }

  const handleScan = async () => {
    setScanning(true)
    try {
      const response = await fetch('/api/admin/media/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: '/uploads' }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Scan failed')
      }
      
      const result = await response.json()
      toast.success(`Импортировано ${result.imported} файлов`)
      setScanOpen(false)
      fetchMedia()
    } catch (error: any) {
      toast.error(error.message || 'Ошибка сканирования')
    } finally {
      setScanning(false)
    }
  }

  const openDetail = (m: Media) => {
    setDetailMedia(m)
    setDetailOpen(true)
  }

  const getMediaUrl = (m: Media) => {
    if (m.localPath) return m.localPath
    return `/api/admin/media/${m.id}/file`
  }

  return (
    <Grid container spacing={6}>
      <Grid item xs={12}>
        <Card>
          <CardHeader 
            title="Медиатека"
            subheader={`Всего файлов: ${total}`}
            action={
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button 
                  variant="outlined" 
                  startIcon={<i className="ri-folder-search-line" />}
                  onClick={openScanDialog}
                >
                  Сканировать
                </Button>
                <Button 
                  variant="contained" 
                  startIcon={<i className="ri-upload-2-line" />}
                  onClick={() => setUploadOpen(true)}
                >
                  Загрузить
                </Button>
              </Box>
            }
          />
          <CardContent>
            {/* Filters */}
            <Grid container spacing={4} sx={{ mb: 4 }}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Поиск по имени файла..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <i className="ri-search-line" />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Тип</InputLabel>
                  <Select
                    value={entityType}
                    label="Тип"
                    onChange={e => setEntityType(e.target.value)}
                  >
                    {ENTITY_TYPES.map(t => (
                      <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Статус</InputLabel>
                  <Select
                    value={storageStatus}
                    label="Статус"
                    onChange={e => setStorageStatus(e.target.value)}
                  >
                    {STORAGE_STATUSES.map(s => (
                      <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  onClick={() => {
                    setSearch('')
                    setEntityType('')
                    setStorageStatus('')
                    setPage(1)
                  }}
                >
                  Сбросить
                </Button>
              </Grid>
            </Grid>

            {/* Bulk actions */}
            {selectedIds.length > 0 && (
              <Alert 
                severity="info" 
                sx={{ mb: 4 }}
                action={
                  <Button color="error" size="small" onClick={handleBulkDelete}>
                    Удалить ({selectedIds.length})
                  </Button>
                }
              >
                Выбрано: {selectedIds.length} файлов
              </Alert>
            )}

            {/* Select all */}
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Checkbox
                checked={selectedIds.length === media.length && media.length > 0}
                indeterminate={selectedIds.length > 0 && selectedIds.length < media.length}
                onChange={handleSelectAll}
              />
              <Typography variant="body2">Выбрать все</Typography>
            </Box>

            {/* Media grid */}
            {loading ? (
              <ImageList cols={6} gap={16}>
                {[...Array(12)].map((_, index) => (
                  <ImageListItem key={index} sx={{ borderRadius: 1, overflow: 'hidden' }}>
                    <Skeleton variant="rectangular" width="100%" height={150} animation="wave" />
                    <Box sx={{ p: 1 }}>
                      <Skeleton variant="text" width="80%" height={20} />
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                        <Skeleton variant="rounded" width={50} height={18} />
                        <Skeleton variant="rounded" width={70} height={18} />
                      </Box>
                    </Box>
                  </ImageListItem>
                ))}
              </ImageList>
            ) : media.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography color="text.secondary">Нет файлов</Typography>
              </Box>
            ) : (
              <ImageList cols={6} gap={16}>
                {media.map(m => (
                  <ImageListItem 
                    key={m.id}
                    sx={{ 
                      position: 'relative',
                      border: selectedIds.includes(m.id) ? '2px solid' : '1px solid',
                      borderColor: selectedIds.includes(m.id) ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      '&:hover': { opacity: 0.9 }
                    }}
                  >
                    <Checkbox
                      checked={selectedIds.includes(m.id)}
                      onChange={() => handleSelect(m.id)}
                      sx={{ position: 'absolute', top: 4, left: 4, zIndex: 1 }}
                      onClick={e => e.stopPropagation()}
                    />
                    <img
                      src={getMediaUrl(m)}
                      alt={m.alt || m.filename}
                      loading="lazy"
                      style={{ 
                        width: '100%', 
                        height: 150, 
                        objectFit: 'cover' 
                      }}
                      onClick={() => openDetail(m)}
                    />
                    <ImageListItemBar
                      title={m.filename}
                      subtitle={
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          <Chip 
                            label={formatFileSize(m.size)} 
                            size="small" 
                            sx={{ height: 18, fontSize: '0.65rem' }}
                          />
                          <Chip 
                            label={m.storageStatus} 
                            size="small" 
                            color={getStorageStatusColor(m.storageStatus)}
                            sx={{ height: 18, fontSize: '0.65rem' }}
                          />
                        </Box>
                      }
                      actionIcon={
                        <Tooltip title="Удалить">
                          <IconButton
                            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(m.id)
                            }}
                          >
                            <i className="ri-delete-bin-line" />
                          </IconButton>
                        </Tooltip>
                      }
                    />
                  </ImageListItem>
                ))}
              </ImageList>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, value) => setPage(value)}
                  color="primary"
                />
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {detailMedia?.filename}
          <IconButton
            onClick={() => setDetailOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <i className="ri-close-line" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {detailMedia && (
            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <img
                  src={getMediaUrl(detailMedia)}
                  alt={detailMedia.alt || detailMedia.filename}
                  style={{ width: '100%', borderRadius: 8 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>Информация</Typography>
                <Box sx={{ '& > div': { mb: 1 } }}>
                  <div><strong>ID:</strong> {detailMedia.id}</div>
                  <div><strong>Slug:</strong> {detailMedia.slug}</div>
                  <div><strong>Тип:</strong> {detailMedia.entityType}</div>
                  <div><strong>MIME:</strong> {detailMedia.mimeType}</div>
                  <div><strong>Размер:</strong> {formatFileSize(detailMedia.size)}</div>
                  {detailMedia.width && detailMedia.height && (
                    <div><strong>Размеры:</strong> {detailMedia.width}×{detailMedia.height}</div>
                  )}
                  <div>
                    <strong>Хранение:</strong>{' '}
                    <Chip 
                      label={detailMedia.storageStatus} 
                      size="small"
                      color={getStorageStatusColor(detailMedia.storageStatus)}
                    />
                  </div>
                  <div>
                    <strong>Водяной знак:</strong>{' '}
                    {detailMedia.hasWatermark ? '✅ Да' : '❌ Нет'}
                  </div>
                  <div><strong>Создан:</strong> {new Date(detailMedia.createdAt).toLocaleString()}</div>
                </Box>
                {detailMedia.localPath && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">Локальный путь</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                      {detailMedia.localPath}
                    </Typography>
                  </Box>
                )}
                {detailMedia.s3Key && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">S3 Key</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                      {detailMedia.s3Key}
                    </Typography>
                  </Box>
                )}
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Закрыть</Button>
          <Button 
            color="error" 
            onClick={() => {
              if (detailMedia) handleDelete(detailMedia.id)
              setDetailOpen(false)
            }}
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Загрузить файл</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Тип сущности</InputLabel>
              <Select
                value={uploadEntityType}
                label="Тип сущности"
                onChange={e => setUploadEntityType(e.target.value)}
              >
                {ENTITY_TYPES.filter(t => t.value).map(t => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Button
              variant="outlined"
              component="label"
              fullWidth
              sx={{ height: 100 }}
            >
              {uploadFile ? uploadFile.name : 'Выберите файл'}
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={e => setUploadFile(e.target.files?.[0] || null)}
              />
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadOpen(false)}>Отмена</Button>
          <Button 
            variant="contained" 
            onClick={handleUpload}
            disabled={!uploadFile || uploading}
          >
            {uploading ? <CircularProgress size={20} /> : 'Загрузить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Scan Dialog */}
      <Dialog open={scanOpen} onClose={() => setScanOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Сканировать существующие файлы</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Сканирование найдёт все изображения в папке <code>public/uploads</code> и добавит их в медиатеку.
            </Alert>
            
            {scanLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : scanStats ? (
              <Box>
                <Typography variant="h6" gutterBottom>Статистика</Typography>
                <Box sx={{ '& > div': { mb: 1 } }}>
                  <div><strong>Найдено файлов:</strong> {scanStats.totalFiles}</div>
                  <div><strong>Уже в медиатеке:</strong> {scanStats.alreadyImported}</div>
                  <div><strong>Готовы к импорту:</strong> {scanStats.pendingImport}</div>
                </Box>
                
                {scanStats.byType && Object.keys(scanStats.byType).length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>По типам:</Typography>
                    {Object.entries(scanStats.byType).map(([type, stats]: [string, any]) => (
                      <Box key={type} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <span>{type}</span>
                        <span>
                          <Chip label={`${stats.pending} новых`} size="small" color="primary" sx={{ mr: 0.5 }} />
                          <Chip label={`${stats.imported} имп.`} size="small" variant="outlined" />
                        </span>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            ) : null}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScanOpen(false)}>Отмена</Button>
          <Button 
            variant="contained" 
            onClick={handleScan}
            disabled={scanning || !scanStats || scanStats.pendingImport === 0}
          >
            {scanning ? <CircularProgress size={20} /> : `Импортировать (${scanStats?.pendingImport || 0})`}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}


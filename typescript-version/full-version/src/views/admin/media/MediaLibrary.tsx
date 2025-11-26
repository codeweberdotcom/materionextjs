'use client'

/**
 * Медиатека - список и управление медиа файлами
 * Поддержка Drag & Drop и множественной загрузки
 */

import { useState, useEffect, useCallback, useRef } from 'react'

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
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Avatar from '@mui/material/Avatar'
import LinearProgress from '@mui/material/LinearProgress'

import { useDropzone } from 'react-dropzone'
import { toast } from 'react-toastify'

import MediaDetailSidebar from './MediaDetailSidebar'

// Upload file with progress tracking
interface UploadFile {
  file: File
  id: string
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  preview?: string
}

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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
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
  
  // Delete confirmation dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'bulk'; id?: string; count?: number } | null>(null)
  const [deleting, setDeleting] = useState(false)
  
  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadEntityType, setUploadEntityType] = useState('other')
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  
  // Refs for debounce
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)

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

  // Initial load
  useEffect(() => {
    fetchMedia()
  }, [])

  // Re-fetch when filters change
  useEffect(() => {
    fetchMedia()
  }, [page, entityType, storageStatus])

  // Debounced search
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }
    
    searchDebounceRef.current = setTimeout(() => {
      fetchMedia()
    }, 500)
    
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
    }
  }, [search])

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

  const openDeleteConfirm = (type: 'single' | 'bulk', id?: string) => {
    if (type === 'bulk' && selectedIds.length === 0) return
    setDeleteTarget({ 
      type, 
      id, 
      count: type === 'bulk' ? selectedIds.length : 1 
    })
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    
    setDeleting(true)
    try {
      if (deleteTarget.type === 'single' && deleteTarget.id) {
        const response = await fetch(`/api/admin/media/${deleteTarget.id}`, { method: 'DELETE' })
        if (!response.ok) throw new Error('Failed to delete')
        toast.success('Файл удалён')
      } else if (deleteTarget.type === 'bulk') {
        for (const id of selectedIds) {
          await fetch(`/api/admin/media/${id}`, { method: 'DELETE' })
        }
        toast.success(`Удалено ${selectedIds.length} файлов`)
        setSelectedIds([])
      }
      
      // Close detail dialog if deleting the currently viewed media
      if (detailMedia && deleteTarget.id === detailMedia.id) {
        setDetailOpen(false)
      }
      
      fetchMedia()
    } catch (error) {
      toast.error('Ошибка удаления')
    } finally {
      setDeleting(false)
      setDeleteConfirmOpen(false)
      setDeleteTarget(null)
    }
  }

  // Handle file drop from react-dropzone
  const MAX_PREVIEWS = 20 // Превью только для первых N файлов (экономия памяти)
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadFiles(prev => {
      const currentCount = prev.length
      const newFiles: UploadFile[] = acceptedFiles.map((file, index) => ({
        file,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        progress: 0,
        status: 'pending' as const,
        // Превью только для первых MAX_PREVIEWS файлов (экономия памяти)
        preview: (currentCount + index < MAX_PREVIEWS && file.type.startsWith('image/')) 
          ? URL.createObjectURL(file) 
          : undefined,
      }))
      return [...prev, ...newFiles]
    })
  }, [])

  // Remove file from upload list
  const removeUploadFile = (id: string) => {
    setUploadFiles(prev => {
      const file = prev.find(f => f.id === id)
      if (file?.preview) {
        URL.revokeObjectURL(file.preview)
      }
      return prev.filter(f => f.id !== id)
    })
  }

  // Clear all upload files
  const clearUploadFiles = () => {
    uploadFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview)
    })
    setUploadFiles([])
  }

  // Upload single file with progress (using XMLHttpRequest for progress)
  const uploadSingleFile = async (uploadFile: UploadFile): Promise<boolean> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', uploadFile.file)
      formData.append('entityType', uploadEntityType)

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          setUploadFiles(prev => 
            prev.map(f => f.id === uploadFile.id ? { ...f, progress, status: 'uploading' } : f)
          )
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadFiles(prev => 
            prev.map(f => f.id === uploadFile.id ? { ...f, progress: 100, status: 'success' } : f)
          )
          resolve(true)
        } else {
          let errorMsg = 'Ошибка загрузки'
          try {
            const response = JSON.parse(xhr.responseText)
            errorMsg = response.error || errorMsg
          } catch {}
          setUploadFiles(prev => 
            prev.map(f => f.id === uploadFile.id ? { ...f, status: 'error', error: errorMsg } : f)
          )
          resolve(false)
        }
      })

      xhr.addEventListener('error', () => {
        setUploadFiles(prev => 
          prev.map(f => f.id === uploadFile.id ? { ...f, status: 'error', error: 'Сетевая ошибка' } : f)
        )
        resolve(false)
      })

      xhr.open('POST', '/api/admin/media')
      xhr.send(formData)
    })
  }

  // Handle upload all files with parallel uploads
  const handleUpload = async () => {
    const pendingFiles = uploadFiles.filter(f => f.status === 'pending')
    if (pendingFiles.length === 0) return
    
    setUploading(true)
    
    let successCount = 0
    let errorCount = 0

    // Upload files in parallel batches
    const uploadBatch = async (batch: UploadFile[]) => {
      const results = await Promise.all(batch.map(uploadSingleFile))
      results.forEach(success => {
        if (success) successCount++
        else errorCount++
      })
    }

    // Split into chunks and upload in parallel
    for (let i = 0; i < pendingFiles.length; i += PARALLEL_UPLOADS) {
      const batch = pendingFiles.slice(i, i + PARALLEL_UPLOADS)
      await uploadBatch(batch)
    }

    setUploading(false)

    if (successCount > 0) {
      toast.success(`Загружено файлов: ${successCount}`)
      fetchMedia()
    }
    if (errorCount > 0) {
      toast.error(`Ошибок: ${errorCount}`)
    }

    // Close dialog if all successful
    if (errorCount === 0) {
      setTimeout(() => {
        clearUploadFiles()
        setUploadOpen(false)
      }, 1000)
    }
  }

  // Upload configuration
  const MAX_FILES_PER_UPLOAD = 50 // Лимит файлов за раз
  const PARALLEL_UPLOADS = 3 // Параллельных загрузок

  // Dropzone configuration
  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    onDrop: (acceptedFiles) => {
      // Лимит файлов
      if (uploadFiles.length + acceptedFiles.length > MAX_FILES_PER_UPLOAD) {
        const allowed = MAX_FILES_PER_UPLOAD - uploadFiles.length
        if (allowed <= 0) {
          toast.warning(`Максимум ${MAX_FILES_PER_UPLOAD} файлов за раз`)
          return
        }
        toast.warning(`Добавлено только ${allowed} из ${acceptedFiles.length} файлов (лимит: ${MAX_FILES_PER_UPLOAD})`)
        acceptedFiles = acceptedFiles.slice(0, allowed)
      }
      onDrop(acceptedFiles)
    },
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.svg'],
    },
    maxSize: 15 * 1024 * 1024, // 15MB
    multiple: true,
  })

  const openDetail = (m: Media) => {
    setDetailMedia(m)
    setDetailOpen(true)
  }

  const getMediaUrl = (m: Media) => {
    if (m.localPath) {
      // Исправляем путь: добавляем /uploads/ если нужно и убираем дубли
      let path = m.localPath
        .replace(/^public\//, '')
        .replace(/^\//, '')
      
      // Убираем все дублирующиеся uploads/ в начале
      while (path.startsWith('uploads/')) {
        path = path.substring(8)
      }
      
      return `/uploads/${path}`
    }
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(_, value) => value && setViewMode(value)}
                  size="small"
                  sx={{ height: 38 }}
                >
                  <ToggleButton value="grid" sx={{ px: 2 }}>
                    <i className="ri-grid-line" style={{ fontSize: 18 }} />
                  </ToggleButton>
                  <ToggleButton value="list" sx={{ px: 2 }}>
                    <i className="ri-list-check" style={{ fontSize: 18 }} />
                  </ToggleButton>
                </ToggleButtonGroup>
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
                  sx={{ height: 40 }}
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
            {/* Select all - only for grid view */}
            {viewMode === 'grid' && (
              <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Checkbox
                  checked={selectedIds.length === media.length && media.length > 0}
                  indeterminate={selectedIds.length > 0 && selectedIds.length < media.length}
                  onChange={handleSelectAll}
                />
                <Typography variant="body2">Выбрать все</Typography>
              </Box>
            )}

            {/* Media content */}
            {loading ? (
              viewMode === 'grid' ? (
                <Box sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(6, 1fr)', 
                  gap: 2 
                }}>
                  {[...Array(12)].map((_, index) => (
                    <Box key={index}>
                      <Skeleton variant="rectangular" width="100%" height={164} animation="wave" sx={{ borderRadius: 1 }} />
                      <Box sx={{ pt: 1 }}>
                        <Skeleton variant="text" width="90%" height={20} />
                        <Skeleton variant="text" width="60%" height={16} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox"><Skeleton variant="rectangular" width={20} height={20} /></TableCell>
                        <TableCell><Skeleton variant="text" width={60} /></TableCell>
                        <TableCell><Skeleton variant="text" width={100} /></TableCell>
                        <TableCell><Skeleton variant="text" width={80} /></TableCell>
                        <TableCell><Skeleton variant="text" width={60} /></TableCell>
                        <TableCell><Skeleton variant="text" width={80} /></TableCell>
                        <TableCell><Skeleton variant="text" width={40} /></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...Array(10)].map((_, index) => (
                        <TableRow key={index}>
                          <TableCell padding="checkbox"><Skeleton variant="rectangular" width={20} height={20} /></TableCell>
                          <TableCell><Skeleton variant="rectangular" width={48} height={48} /></TableCell>
                          <TableCell><Skeleton variant="text" width="80%" /></TableCell>
                          <TableCell><Skeleton variant="text" width={60} /></TableCell>
                          <TableCell><Skeleton variant="text" width={80} /></TableCell>
                          <TableCell><Skeleton variant="rectangular" width={70} height={24} /></TableCell>
                          <TableCell><Skeleton variant="circular" width={32} height={32} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )
            ) : media.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography color="text.secondary">Нет файлов</Typography>
              </Box>
            ) : viewMode === 'grid' ? (
              /* Grid View */
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(6, 1fr)', 
                gap: 2 
              }}>
                {media.map(m => (
                  <Box 
                    key={m.id}
                    sx={{ 
                      position: 'relative',
                      cursor: 'pointer',
                      minWidth: 0,
                      '&:hover img': { 
                        transform: 'scale(1.05)',
                        transition: 'transform 0.2s ease-in-out'
                      }
                    }}
                  >
                    <Checkbox
                      checked={selectedIds.includes(m.id)}
                      onChange={() => handleSelect(m.id)}
                      sx={{ 
                        position: 'absolute', 
                        top: 4, 
                        left: 4, 
                        zIndex: 1,
                        '& svg': {
                          filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.8)) drop-shadow(0 0 2px rgba(255,255,255,0.8))',
                        },
                        '& svg path[stroke]': {
                          stroke: 'rgba(255,255,255,0.95) !important',
                        },
                        '&.Mui-checked': {
                          color: 'primary.main',
                        },
                        '&.Mui-checked svg path[stroke]': {
                          stroke: 'currentColor !important',
                        },
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                    <Box
                      sx={{
                        position: 'relative',
                        overflow: 'hidden',
                        borderRadius: 1,
                        border: selectedIds.includes(m.id) ? '3px solid' : '1px solid',
                        borderColor: selectedIds.includes(m.id) ? 'primary.main' : 'divider',
                      }}
                    >
                      <img
                        src={getMediaUrl(m)}
                        alt={m.alt || m.filename}
                        loading="lazy"
                        style={{ 
                          width: '100%', 
                          height: 164, 
                          objectFit: 'cover',
                          display: 'block',
                          transition: 'transform 0.2s ease-in-out'
                        }}
                        onClick={() => openDetail(m)}
                      />
                    </Box>
                    <Box sx={{ pt: 1, minWidth: 0 }}>
                      <Typography 
                        variant="body2" 
                        noWrap 
                        sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}
                        title={m.filename}
                      >
                        {m.filename}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(m.size)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">•</Typography>
                        <Chip 
                          label={m.storageStatus === 'local_only' ? 'Локально' : m.storageStatus === 'synced' ? 'Синхр.' : m.storageStatus} 
                          size="small" 
                          color={getStorageStatusColor(m.storageStatus)}
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                        <Box sx={{ flexGrow: 1 }} />
                        <Tooltip title="Удалить">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation()
                              openDeleteConfirm('single', m.id)
                            }}
                            sx={{ p: 0.25 }}
                          >
                            <i className="ri-delete-bin-line" style={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              /* List/Table View */
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.length === media.length && media.length > 0}
                          indeterminate={selectedIds.length > 0 && selectedIds.length < media.length}
                          onChange={handleSelectAll}
                        />
                      </TableCell>
                      <TableCell sx={{ width: 64 }}>Превью</TableCell>
                      <TableCell>Имя файла</TableCell>
                      <TableCell>Размер</TableCell>
                      <TableCell>Тип</TableCell>
                      <TableCell>Статус</TableCell>
                      <TableCell>Дата</TableCell>
                      <TableCell sx={{ width: 80 }}>Действия</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {media.map(m => (
                      <TableRow 
                        key={m.id}
                        hover
                        selected={selectedIds.includes(m.id)}
                        sx={{ cursor: 'pointer' }}
                        onClick={() => openDetail(m)}
                      >
                        <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.includes(m.id)}
                            onChange={() => handleSelect(m.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Avatar
                            variant="rounded"
                            src={getMediaUrl(m)}
                            sx={{ width: 48, height: 48 }}
                          >
                            <i className="ri-image-line" />
                          </Avatar>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 250 }} title={m.filename}>
                            {m.filename}
                          </Typography>
                          {m.alt && (
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 250 }}>
                              {m.alt}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{formatFileSize(m.size)}</Typography>
                          {m.width && m.height && (
                            <Typography variant="caption" color="text.secondary">
                              {m.width}×{m.height}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip label={m.entityType} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={m.storageStatus === 'local_only' ? 'Локально' : m.storageStatus === 'synced' ? 'Синхр.' : m.storageStatus} 
                            size="small" 
                            color={getStorageStatusColor(m.storageStatus)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">
                            {new Date(m.createdAt).toLocaleDateString('ru-RU')}
                          </Typography>
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Tooltip title="Удалить">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => openDeleteConfirm('single', m.id)}
                            >
                              <i className="ri-delete-bin-line" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
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

      {/* Detail Sidebar */}
      <MediaDetailSidebar
        open={detailOpen}
        mediaId={detailMedia?.id || null}
        onClose={() => setDetailOpen(false)}
        onUpdate={fetchMedia}
        onDelete={(id) => {
          setDetailOpen(false)
          openDeleteConfirm('single', id)
        }}
      />

      {/* Upload Dialog */}
      <Dialog 
        open={uploadOpen} 
        onClose={() => !uploading && (clearUploadFiles(), setUploadOpen(false))} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <i className="ri-upload-cloud-2-line" style={{ fontSize: 24 }} />
              Загрузить файлы
            </Box>
            {uploadFiles.length > 0 && (
              <Chip 
                label={`${uploadFiles.length} файл(ов)`} 
                size="small" 
                color="primary"
                variant="outlined"
              />
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* Entity Type Select */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Тип сущности</InputLabel>
              <Select
                value={uploadEntityType}
                label="Тип сущности"
                onChange={e => setUploadEntityType(e.target.value)}
                disabled={uploading}
              >
                {ENTITY_TYPES.filter(t => t.value).map(t => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {/* Drag & Drop Zone */}
            <Box
              {...getRootProps()}
              sx={{
                border: '2px dashed',
                borderColor: isDragAccept 
                  ? 'success.main' 
                  : isDragReject 
                    ? 'error.main' 
                    : isDragActive 
                      ? 'primary.main' 
                      : 'divider',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: uploading ? 'not-allowed' : 'pointer',
                bgcolor: isDragActive ? 'action.hover' : 'background.paper',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  borderColor: uploading ? 'divider' : 'primary.main',
                  bgcolor: uploading ? 'background.paper' : 'action.hover',
                },
                opacity: uploading ? 0.6 : 1,
                mb: uploadFiles.length > 0 ? 3 : 0,
              }}
            >
              <input {...getInputProps()} disabled={uploading} />
              <Box sx={{ mb: 2 }}>
                <i 
                  className={isDragActive ? 'ri-download-line' : 'ri-image-add-line'} 
                  style={{ 
                    fontSize: 48, 
                    color: isDragAccept 
                      ? 'var(--mui-palette-success-main)' 
                      : isDragReject 
                        ? 'var(--mui-palette-error-main)'
                        : 'var(--mui-palette-primary-main)',
                  }} 
                />
              </Box>
              <Typography variant="h6" gutterBottom>
                {isDragActive 
                  ? isDragAccept 
                    ? 'Отпустите для загрузки' 
                    : 'Неподдерживаемый формат'
                  : 'Перетащите файлы сюда'
                }
              </Typography>
              <Typography variant="body2" color="text.secondary">
                или нажмите для выбора
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Поддерживаются: JPG, PNG, GIF, WebP, SVG (до 15 MB)
              </Typography>
            </Box>

            {/* File List */}
            {uploadFiles.length > 0 && (
              <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                {uploadFiles.map((uploadFile) => (
                  <Box
                    key={uploadFile.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      p: 1.5,
                      mb: 1,
                      borderRadius: 1,
                      bgcolor: uploadFile.status === 'error' 
                        ? 'error.lighter' 
                        : uploadFile.status === 'success'
                          ? 'success.lighter'
                          : 'action.hover',
                      border: '1px solid',
                      borderColor: uploadFile.status === 'error'
                        ? 'error.light'
                        : uploadFile.status === 'success'
                          ? 'success.light'
                          : 'divider',
                    }}
                  >
                    {/* Preview */}
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 1,
                        overflow: 'hidden',
                        bgcolor: 'background.paper',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {uploadFile.preview ? (
                        <img 
                          src={uploadFile.preview} 
                          alt={uploadFile.file.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <i className="ri-file-image-line" style={{ fontSize: 24, color: 'var(--mui-palette-text-secondary)' }} />
                      )}
                    </Box>

                    {/* File Info */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap title={uploadFile.file.name}>
                        {uploadFile.file.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(uploadFile.file.size)}
                        </Typography>
                        {uploadFile.status === 'uploading' && (
                          <Typography variant="caption" color="primary">
                            {uploadFile.progress}%
                          </Typography>
                        )}
                        {uploadFile.status === 'success' && (
                          <Typography variant="caption" color="success.main">
                            Загружен
                          </Typography>
                        )}
                        {uploadFile.status === 'error' && (
                          <Typography variant="caption" color="error.main">
                            {uploadFile.error}
                          </Typography>
                        )}
                      </Box>
                      {uploadFile.status === 'uploading' && (
                        <LinearProgress 
                          variant="determinate" 
                          value={uploadFile.progress} 
                          sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
                        />
                      )}
                    </Box>

                    {/* Status / Actions */}
                    <Box sx={{ flexShrink: 0 }}>
                      {uploadFile.status === 'pending' && (
                        <IconButton 
                          size="small" 
                          onClick={() => removeUploadFile(uploadFile.id)}
                          disabled={uploading}
                        >
                          <i className="ri-close-line" style={{ fontSize: 18 }} />
                        </IconButton>
                      )}
                      {uploadFile.status === 'uploading' && (
                        <CircularProgress size={20} />
                      )}
                      {uploadFile.status === 'success' && (
                        <i className="ri-check-line" style={{ fontSize: 20, color: 'var(--mui-palette-success-main)' }} />
                      )}
                      {uploadFile.status === 'error' && (
                        <IconButton 
                          size="small" 
                          onClick={() => removeUploadFile(uploadFile.id)}
                          color="error"
                        >
                          <i className="ri-close-line" style={{ fontSize: 18 }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 2 }}>
          {uploadFiles.length > 0 && !uploading && (
            <Button 
              onClick={clearUploadFiles} 
              variant="text" 
              color="inherit"
              sx={{ mr: 'auto' }}
            >
              Очистить
            </Button>
          )}
          <Button 
            onClick={() => { clearUploadFiles(); setUploadOpen(false) }} 
            variant="outlined"
            disabled={uploading}
          >
            {uploading ? 'Подождите...' : 'Отмена'}
          </Button>
          <Button 
            variant="contained" 
            onClick={handleUpload}
            disabled={uploadFiles.filter(f => f.status === 'pending').length === 0 || uploading}
            startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : <i className="ri-upload-2-line" />}
          >
            {uploading 
              ? `Загрузка (${uploadFiles.filter(f => f.status === 'success').length}/${uploadFiles.filter(f => f.status !== 'error').length})...` 
              : `Загрузить (${uploadFiles.filter(f => f.status === 'pending').length})`
            }
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteConfirmOpen} 
        onClose={() => !deleting && setDeleteConfirmOpen(false)}
        maxWidth="xs" 
        fullWidth
      >
        <DialogTitle sx={{ px: 6, pt: 5, pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box 
              sx={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%', 
                bgcolor: 'error.lighter',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <i className="ri-delete-bin-line" style={{ fontSize: 20, color: 'var(--mui-palette-error-main)' }} />
            </Box>
            Подтверждение удаления
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: 6, py: 2 }}>
          <Typography color="text.secondary">
            {deleteTarget?.type === 'bulk' 
              ? `Вы уверены, что хотите удалить ${deleteTarget.count} файлов? Это действие нельзя отменить.`
              : 'Вы уверены, что хотите удалить этот файл? Это действие нельзя отменить.'
            }
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 6, pb: 5, pt: 2, gap: 2 }}>
          <Button 
            onClick={() => setDeleteConfirmOpen(false)} 
            disabled={deleting}
            variant="outlined"
            fullWidth
          >
            Отмена
          </Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleting}
            fullWidth
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <i className="ri-delete-bin-line" />}
          >
            {deleting ? 'Удаление...' : 'Удалить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fixed Action Bar */}
      {selectedIds.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1100,
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 6,
            px: 3,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <Typography variant="body2" fontWeight={500}>
            Выбрано: {selectedIds.length}
          </Typography>
          <Button 
            color="error" 
            size="small" 
            variant="contained"
            startIcon={<i className="ri-delete-bin-line" />}
            onClick={() => openDeleteConfirm('bulk')}
          >
            Удалить
          </Button>
          <Button 
            size="small" 
            variant="outlined"
            onClick={() => setSelectedIds([])}
          >
            Отменить
          </Button>
        </Box>
      )}
    </Grid>
  )
}


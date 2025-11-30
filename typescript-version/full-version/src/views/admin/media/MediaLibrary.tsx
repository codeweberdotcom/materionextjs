'use client'

/**
 * Media Library - file list and management
 * Supports Drag & Drop and multi-file upload
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

import { useTranslationSafe } from '@/contexts/TranslationContext'

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
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Menu from '@mui/material/Menu'

import { useDropzone } from 'react-dropzone'
import { toast } from 'react-toastify'

import MediaDetailSidebar from './MediaDetailSidebar'
import { useBulkUpload, type QueuedFile } from '@/hooks/useBulkUpload'

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
  deletedAt?: string | null
  trashMetadata?: string | null
}

interface MediaListResult {
  items: Media[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// Entity types - labels will be translated in component
const ENTITY_TYPE_VALUES = ['', 'user_avatar', 'company_logo', 'company_banner', 'company_photo', 'listing_image', 'site_logo', 'watermark', 'document', 'other']

// Storage statuses - labels will be translated in component
const STORAGE_STATUS_VALUES = ['', 'local_only', 'synced', 's3_only', 'sync_pending', 'sync_error']

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
  // Translations
  const dictionary = useTranslationSafe()
  const t = dictionary?.mediaLibrary

  // Get translated storage status labels
  const getStorageStatusLabel = useCallback((status: string): string => {
    switch (status) {
      case 'local_only': return t?.local ?? 'Local'
      case 'synced': return t?.localAndS3 ?? 'Local + S3'
      case 's3_only': return t?.s3 ?? 'S3'
      case 'sync_pending': return t?.pending ?? 'Pending'
      case 'sync_error': return 'Error'
      default: return status
    }
  }, [t])

  // Get storage statuses with translated labels
  const STORAGE_STATUSES = useMemo(() => [
    { value: '', label: t?.allStatuses ?? 'All statuses' },
    { value: 'local_only', label: t?.localOnly ?? 'Local only' },
    { value: 'synced', label: t?.localAndS3 ?? 'Local + S3' },
    { value: 's3_only', label: t?.s3Only ?? 'S3 only' },
    { value: 'sync_pending', label: t?.pending ?? 'Pending' },
    { value: 'sync_error', label: 'Error' },
  ], [t])

  // Get entity types with translated labels
  const ENTITY_TYPES = useMemo(() => [
    { value: '', label: t?.entityTypes?.all ?? 'All types' },
    { value: 'user_avatar', label: t?.entityTypes?.user_avatar ?? 'Avatars' },
    { value: 'company_logo', label: t?.entityTypes?.company_logo ?? 'Logos' },
    { value: 'company_banner', label: t?.entityTypes?.company_banner ?? 'Banners' },
    { value: 'company_photo', label: t?.entityTypes?.company_photo ?? 'Company photos' },
    { value: 'listing_image', label: t?.entityTypes?.listing_image ?? 'Listing photos' },
    { value: 'site_logo', label: t?.entityTypes?.site_logo ?? 'Site logo' },
    { value: 'watermark', label: t?.entityTypes?.watermark ?? 'Watermarks' },
    { value: 'document', label: t?.entityTypes?.document ?? 'Documents' },
    { value: 'other', label: t?.entityTypes?.other ?? 'Other' },
  ], [t])

  const [media, setMedia] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Tabs: files / trash
  const [activeTab, setActiveTab] = useState<'files' | 'trash'>('files')
  const [trashCount, setTrashCount] = useState(0)

  // Storage status
  const [s3Enabled, setS3Enabled] = useState(false)
  const [localEnabled, setLocalEnabled] = useState(true) // Local storage always enabled by default
  
  // Max file size from settings (default 10MB, loaded from API)
  const [maxFileSize, setMaxFileSize] = useState(10 * 1024 * 1024)
  
  // Parallel upload limit from settings (default 5, loaded from API)
  const [parallelLimit, setParallelLimit] = useState(5)

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
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'single' | 'bulk'
    id?: string
    count?: number
    mode?: 'soft' | 'hard'  // NEW: delete mode
  } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Delete menu anchor (for dropdown)
  const [deleteMenuAnchor, setDeleteMenuAnchor] = useState<null | HTMLElement>(null)
  const [deleteMenuTarget, setDeleteMenuTarget] = useState<string | null>(null)

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadEntityType, setUploadEntityType] = useState('other')

  // useBulkUpload hook для массовой загрузки с Pause/Resume/Cancel/Retry
  // useAsyncUpload: true - файл сразу принимается, обработка в фоне
  const bulkUpload = useBulkUpload({
    entityType: uploadEntityType,
    parallelLimit, // Из настроек (processingConcurrency)
    maxFiles: 10000,
    maxFileSize, // Из настроек
    maxPreviews: 20,
    useAsyncUpload: true, // Async upload - мгновенный ответ, обработка в очереди
    onFileSuccess: () => {
      // Обновляем список после каждого успешного файла с debounce
      setTimeout(() => {
        fetchMedia()
      }, 1000)
    },
    onFileError: (file, error) => {
      console.warn('[MediaLibrary] Upload error:', file.file.name, error)
    },
    onComplete: (stats) => {
      // Финальное обновление списка после завершения всех загрузок
      if (stats.success > 0) {
        setTimeout(() => {
          fetchMedia()
        }, 1500)
      }
      // Не закрываем диалог автоматически - пользователь должен видеть результаты
    },
  })

  // Алиасы для совместимости с существующим кодом
  const uploadFiles = bulkUpload.files
  const uploading = bulkUpload.isUploading

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

      // Filter by tab: files show non-deleted, trash shows deleted
      if (activeTab === 'trash') {
        params.set('deleted', 'true')
      } else {
        params.set('deleted', 'false')
      }

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
  }, [page, search, entityType, storageStatus, activeTab])

  // Fetch trash count separately
  const fetchTrashCount = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/media?deleted=true&limit=1')
      if (response.ok) {
        const data = await response.json()
        setTrashCount(data.total || 0)
      }
    } catch {
      // Ignore errors
    }
  }, [])

  // Fetch S3 status
  const fetchS3Status = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/settings/services?type=S3')
      if (response.ok) {
        const result = await response.json()
        // S3 enabled = any S3 service is enabled (regardless of connection status)
        const enabledS3 = result.data?.find((s: any) => s.type === 'S3' && s.enabled)
        setS3Enabled(!!enabledS3)
      }
    } catch {
      // Ignore errors
    }
  }, [])

  // Fetch media settings (max file size, parallel limit)
  const fetchMediaSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/media/settings')
      if (response.ok) {
        const data = await response.json()
        if (data.global?.globalMaxFileSize) {
          setMaxFileSize(data.global.globalMaxFileSize)
        }
        if (data.global?.processingConcurrency) {
          setParallelLimit(data.global.processingConcurrency)
        }
      }
    } catch {
      // Use default
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchMedia()
    fetchTrashCount()
    fetchS3Status()
    fetchMediaSettings()
  }, [])

  // Re-fetch when filters change
  useEffect(() => {
    fetchMedia()
  }, [page, entityType, storageStatus, activeTab])

  // Reset page when switching tabs
  useEffect(() => {
    setPage(1)
    setSelectedIds([])
  }, [activeTab])

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

  // Выбрать все на текущей странице
  const handleSelectAll = () => {
    if (selectedIds.length === media.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(media.map(m => m.id))
    }
  }

  // Выбрать ВСЕ файлы во всей медиатеке (все страницы)
  const [selectingAll, setSelectingAll] = useState(false)
  const handleSelectAllPages = async () => {
    if (selectedIds.length === total) {
      setSelectedIds([])
      return
    }

    setSelectingAll(true)
    try {
      // Запрашиваем все ID с сервера
      const params = new URLSearchParams({
        limit: '10000', // Большой лимит чтобы получить все
        fields: 'id', // Только ID для экономии
      })

      if (search) params.set('search', search)
      if (entityType) params.set('entityType', entityType)
      if (storageStatus) params.set('storageStatus', storageStatus)
      if (activeTab === 'trash') {
        params.set('deleted', 'true')
      } else {
        params.set('deleted', 'false')
      }

      const response = await fetch(`/api/admin/media?${params}`)
      if (!response.ok) throw new Error('Failed to fetch all IDs')

      const data = await response.json()
      setSelectedIds(data.items.map((m: { id: string }) => m.id))
      toast.success(`Выбрано файлов: ${data.items.length}`)
    } catch (error) {
      toast.error('Не удалось выбрать все файлы')
    } finally {
      setSelectingAll(false)
    }
  }

  const handleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    )
  }

  // Open delete menu (dropdown with soft/hard options)
  const openDeleteMenu = (event: React.MouseEvent<HTMLElement>, id: string) => {
    event.stopPropagation()
    setDeleteMenuAnchor(event.currentTarget)
    setDeleteMenuTarget(id)
  }

  const closeDeleteMenu = () => {
    setDeleteMenuAnchor(null)
    setDeleteMenuTarget(null)
  }

  const openDeleteConfirm = (type: 'single' | 'bulk', mode: 'soft' | 'hard', id?: string) => {
    if (type === 'bulk' && selectedIds.length === 0) return
    setDeleteTarget({
      type,
      id,
      count: type === 'bulk' ? selectedIds.length : 1,
      mode
    })
    setDeleteConfirmOpen(true)
    closeDeleteMenu()
  }

  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 })

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    const isHardDelete = deleteTarget.mode === 'hard'
    const endpoint = isHardDelete ? '?hard=true' : ''

    try {
      if (deleteTarget.type === 'single' && deleteTarget.id) {
        const response = await fetch(`/api/admin/media/${deleteTarget.id}${endpoint}`, { method: 'DELETE' })
        if (!response.ok) throw new Error('Failed to delete')
        toast.success(isHardDelete ? 'Файл удалён навсегда' : 'Файл перемещён в корзину')
      } else if (deleteTarget.type === 'bulk') {
        const totalFiles = selectedIds.length
        let successCount = 0
        let errorCount = 0

        setDeleteProgress({ current: 0, total: totalFiles })

        // Удаляем параллельно батчами по 10
        const BATCH_SIZE = 10
        for (let i = 0; i < selectedIds.length; i += BATCH_SIZE) {
          const batch = selectedIds.slice(i, i + BATCH_SIZE)

          const results = await Promise.allSettled(
            batch.map(id =>
              fetch(`/api/admin/media/${id}${endpoint}`, { method: 'DELETE' })
                .then(res => {
                  if (!res.ok) throw new Error(`HTTP ${res.status}`)
                  return res
                })
            )
          )

          results.forEach(result => {
            if (result.status === 'fulfilled') {
              successCount++
            } else {
              errorCount++
              console.error('[MediaLibrary] Delete failed:', result.reason)
            }
          })

          setDeleteProgress({ current: i + batch.length, total: totalFiles })
        }

        if (errorCount === 0) {
          toast.success(
            isHardDelete
              ? `${t?.deletedPermanently ?? 'Deleted permanently'}: ${successCount}`
              : `${t?.movedToTrash ?? 'Moved to trash'}: ${successCount}`
          )
        } else {
          toast.warning(
            `Обработано: ${successCount} успешно, ${errorCount} с ошибками`
          )
        }

        setSelectedIds([])
      }

      // Close detail dialog if deleting the currently viewed media
      if (detailMedia && deleteTarget.id === detailMedia.id) {
        setDetailOpen(false)
      }

      fetchMedia()
      fetchTrashCount()
    } catch (error) {
      console.error('[MediaLibrary] Delete error:', error)
      toast.error('Ошибка удаления')
    } finally {
      setDeleting(false)
      setDeleteConfirmOpen(false)
      setDeleteTarget(null)
      setDeleteProgress({ current: 0, total: 0 })
    }
  }

  // Restore from trash
  const handleRestore = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/media/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' })
      })
      if (!response.ok) throw new Error('Failed to restore')
      toast.success(t?.fileRestored ?? 'File restored')
      fetchMedia()
      fetchTrashCount()
    } catch (error) {
      toast.error('Ошибка восстановления')
    }
  }

  // Bulk restore from trash
  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return
    try {
      for (const id of selectedIds) {
        await fetch(`/api/admin/media/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restore' })
        })
      }
      toast.success(t?.filesRestored?.replace('{count}', String(selectedIds.length)) ?? `Restored: ${selectedIds.length} files`)
      setSelectedIds([])
      fetchMedia()
      fetchTrashCount()
    } catch (error) {
      toast.error(t?.restoreError ?? 'Restore error')
    }
  }

  // Handle file drop - делегируем в useBulkUpload
  const onDrop = useCallback((acceptedFiles: File[]) => {
    bulkUpload.addFiles(acceptedFiles)
  }, [bulkUpload])

  // Алиасы для совместимости
  const removeUploadFile = bulkUpload.removeFile
  const clearUploadFiles = bulkUpload.clearQueue
  const handleUpload = bulkUpload.startUpload

  // Upload configuration
  const MAX_FILES_PER_UPLOAD = 10000

  // Dropzone configuration
  // Не используем maxSize в dropzone - проверка размера происходит в useBulkUpload
  // Это позволяет показывать файлы с превышенным размером в списке с ошибкой
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
    // maxSize убран - проверка в useBulkUpload показывает ошибку в UI
    multiple: true,
  })

  const openDetail = (m: Media) => {
    setDetailMedia(m)
    setDetailOpen(true)
  }

  const getMediaUrl = (m: Media) => {
    // Для файлов в корзине используем API (корзина недоступна публично)
    if (m.deletedAt && m.trashMetadata) {
      return `/api/admin/media/${m.id}/trash?variant=original`
    }

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
            title={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {t?.title ?? 'Media Library'}
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {localEnabled && (
                    <Chip
                      label="Local"
                      size="small"
                      color="warning"
                      icon={<i className="ri-hard-drive-2-line" />}
                      sx={{ pl: 0.5 }}
                    />
                  )}
                  {s3Enabled && (
                    <Chip
                      label="S3"
                      size="small"
                      color="success"
                      icon={<i className="ri-cloud-line" />}
                      sx={{ pl: 0.5 }}
                    />
                  )}
                </Box>
              </Box>
            }
            subheader={activeTab === 'trash' ? `${t?.inTrash ?? 'In trash'}: ${total}` : `${t?.totalFiles ?? 'Total files'}: ${total}`}
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
                {activeTab === 'files' && (
                  <Button
                    variant="contained"
                    startIcon={<i className="ri-upload-2-line" />}
                    onClick={() => setUploadOpen(true)}
                  >
                    {t?.upload ?? 'Upload'}
                  </Button>
                )}
              </Box>
            }
          />

          {/* Tabs: All Files / Trash */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
            <Tabs
              value={activeTab}
              onChange={(_, value) => setActiveTab(value)}
              aria-label="Media library tabs"
            >
              <Tab
                value="files"
                label={t?.allFiles ?? 'All files'}
                icon={<i className="ri-folder-image-line" style={{ fontSize: 18 }} />}
                iconPosition="start"
              />
              <Tab
                value="trash"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {t?.trash ?? 'Trash'}
                    {trashCount > 0 && (
                      <Chip
                        label={trashCount > 999 ? '999+' : trashCount}
                        size="small"
                        color="error"
                        sx={{
                          height: 20,
                          minWidth: 24,
                          fontSize: '0.7rem',
                          '& .MuiChip-label': { px: 0.75 }
                        }}
                      />
                    )}
                  </Box>
                }
                icon={<i className="ri-delete-bin-line" style={{ fontSize: 18 }} />}
                iconPosition="start"
              />
            </Tabs>
          </Box>
          <CardContent>
            {/* Filters */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '0.5rem', mb: 4 }}>
              <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={t?.searchPlaceholder ?? 'Search by filename...'}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <i className="ri-search-line" />
                      </InputAdornment>
                    ),
                    sx: { height: 41 }
                  }}
                />
              </Box>
              <Box sx={{ flex: '0 1 180px', minWidth: 150 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t?.type ?? 'Type'}</InputLabel>
                  <Select
                    value={entityType}
                    label={t?.type ?? 'Type'}
                    onChange={e => setEntityType(e.target.value)}
                  >
                    {ENTITY_TYPES.map(t => (
                      <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: '0 1 180px', minWidth: 150 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t?.status ?? 'Status'}</InputLabel>
                  <Select
                    value={storageStatus}
                    label={t?.status ?? 'Status'}
                    onChange={e => setStorageStatus(e.target.value)}
                  >
                    {STORAGE_STATUSES.map(s => (
                      <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: '0 0 auto' }}>
                <Button
                  variant="outlined"
                  sx={{ height: 41 }}
                  onClick={() => {
                    setSearch('')
                    setEntityType('')
                    setStorageStatus('')
                    setPage(1)
                  }}
                >
                  {t?.reset ?? 'Reset'}
                </Button>
              </Box>
            </Box>

            {/* Bulk actions - Select all */}
            <Box sx={{
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1,
              p: 1.5,
              bgcolor: 'action.hover',
              borderRadius: 1,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                {/* Чекбокс "На странице" */}
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Checkbox
                    checked={selectedIds.length === media.length && media.length > 0}
                    indeterminate={selectedIds.length > 0 && selectedIds.length < media.length}
                    onChange={handleSelectAll}
                    size="small"
                  />
                  <Typography
                    variant="body2"
                    sx={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={handleSelectAll}
                  >
                    {t?.onPage ?? 'On page'} ({media.length})
                  </Typography>
                </Box>

                {/* Чекбокс "Все страницы" */}
                {total > media.length && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Checkbox
                      checked={selectedIds.length === total}
                      onChange={handleSelectAllPages}
                      disabled={selectingAll}
                      size="small"
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        cursor: selectingAll ? 'wait' : 'pointer',
                        userSelect: 'none',
                        color: selectingAll ? 'text.disabled' : 'text.primary'
                      }}
                      onClick={selectingAll ? undefined : handleSelectAllPages}
                    >
                      {selectingAll ? (t?.processing ?? 'Processing...') : `${t?.allPages ?? 'All pages'} (${total})`}
                    </Typography>
                  </Box>
                )}

                {selectedIds.length > 0 && (
                  <Chip
                    size="small"
                    label={`${t?.selected ?? 'Selected'}: ${selectedIds.length}`}
                    color="primary"
                  />
                )}
              </Box>
              {selectedIds.length > 0 && (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setSelectedIds([])}
                  startIcon={<i className="ri-close-line" />}
                >
                  {t?.reset ?? 'Reset'}
                </Button>
              )}
            </Box>

            {/* Media content */}
            {loading ? (
              viewMode === 'grid' ? (
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, 1fr)',
                    sm: 'repeat(3, 1fr)',
                    md: 'repeat(4, 1fr)',
                    lg: 'repeat(5, 1fr)',
                    xl: 'repeat(6, 1fr)',
                  },
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
                <Typography color="text.secondary">{t?.noFiles ?? 'No files'}</Typography>
              </Box>
            ) : viewMode === 'grid' ? (
              /* Grid View */
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: 'repeat(4, 1fr)',
                  lg: 'repeat(5, 1fr)',
                  xl: 'repeat(6, 1fr)',
                },
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
                          label={getStorageStatusLabel(m.storageStatus)}
                          size="small"
                          color={getStorageStatusColor(m.storageStatus)}
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                        <Box sx={{ flexGrow: 1 }} />
                        {activeTab === 'files' ? (
                          <Tooltip title={t?.delete ?? 'Delete'}>
                            <IconButton
                              size="small"
                              onClick={(e) => openDeleteMenu(e, m.id)}
                              sx={{ p: 0.25 }}
                            >
                              <i className="ri-delete-bin-line" style={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title={t?.restore ?? 'Restore'}>
                              <IconButton
                                size="small"
                                color="success"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRestore(m.id)
                                }}
                                sx={{ p: 0.25 }}
                              >
                                <i className="ri-arrow-go-back-line" style={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t?.deletePermanently ?? 'Delete permanently'}>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openDeleteConfirm('single', 'hard', m.id)
                                }}
                                sx={{ p: 0.25 }}
                              >
                                <i className="ri-delete-bin-line" style={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
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
                      <TableCell sx={{ width: 64 }}>{t?.preview ?? 'Preview'}</TableCell>
                      <TableCell>{t?.table?.filename ?? t?.filename ?? 'Filename'}</TableCell>
                      <TableCell>{t?.table?.size ?? t?.size ?? 'Size'}</TableCell>
                      <TableCell>Тип</TableCell>
                      <TableCell>Статус</TableCell>
                      <TableCell>{t?.table?.date ?? t?.date ?? 'Date'}</TableCell>
                      <TableCell sx={{ width: 80 }}>{t?.table?.actions ?? t?.actions ?? 'Actions'}</TableCell>
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
                            label={getStorageStatusLabel(m.storageStatus)}
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
                          {activeTab === 'files' ? (
                            <Tooltip title={t?.delete ?? 'Delete'}>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => openDeleteMenu(e, m.id)}
                              >
                                <i className="ri-delete-bin-line" />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <Tooltip title={t?.restore ?? 'Restore'}>
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleRestore(m.id)}
                                >
                                  <i className="ri-arrow-go-back-line" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t?.deletePermanently ?? 'Delete permanently'}>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => openDeleteConfirm('single', 'hard', m.id)}
                                >
                                  <i className="ri-delete-bin-line" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
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
        onUpdate={() => {
          // Небольшая задержка чтобы БД успела обновиться
          setTimeout(() => {
            fetchMedia()
            fetchTrashCount()
          }, 300)
        }}
        onDelete={(id) => {
          setDetailOpen(false)
          openDeleteConfirm('single', 'soft', id)
        }}
        includeDeleted={activeTab === 'trash'}
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
              {t?.uploadFiles ?? 'Upload files'}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {uploadFiles.length > 0 && (
                <Chip
                  label={`${bulkUpload.stats.success}/${bulkUpload.stats.total}`}
                  size="small"
                  color={bulkUpload.stats.error > 0 ? 'warning' : 'primary'}
                  variant="outlined"
                />
              )}
              {uploading && (
                <Chip
                  icon={<i className="ri-stack-line" style={{ fontSize: 14 }} />}
                  label={`${bulkUpload.stats.uploading} поток${bulkUpload.stats.uploading === 1 ? '' : bulkUpload.stats.uploading < 5 ? 'а' : 'ов'}`}
                  size="small"
                  color="secondary"
                  variant="outlined"
                />
              )}
              {uploading && bulkUpload.stats.speed > 0 && (
                <Chip
                  icon={<i className="ri-speed-line" style={{ fontSize: 14 }} />}
                  label={`${formatFileSize(bulkUpload.stats.speed)}/с`}
                  size="small"
                  color="info"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
          {/* Общий прогресс */}
          {uploading && (
            <LinearProgress
              variant="determinate"
              value={bulkUpload.stats.progress}
              sx={{ mt: 1 }}
            />
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* Entity Type Select */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>{t?.entityType ?? 'Entity type'}</InputLabel>
              <Select
                value={uploadEntityType}
                label={t?.entityType ?? 'Entity type'}
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
                    ? (t?.dropToUpload ?? 'Drop to upload')
                    : (t?.unsupportedFormat ?? 'Unsupported format')
                  : (t?.dragFilesHere ?? 'Drag files here')
                }
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t?.orClickToSelect ?? 'or click to select'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                {(t?.supportedFormats ?? 'Supported: JPG, PNG, GIF, WebP, SVG (up to {maxSize} MB)').replace('{maxSize}', String(Math.round(maxFileSize / (1024 * 1024))))}
              </Typography>
            </Box>

            {/* Результаты загрузки */}
            {!uploading && uploadFiles.length > 0 && (bulkUpload.stats.success > 0 || bulkUpload.stats.error > 0) && (
              <Alert
                severity={bulkUpload.stats.error > 0 ? 'warning' : 'success'}
                sx={{ mb: 2, alignItems: 'center' }}
                icon={<i className={bulkUpload.stats.error > 0 ? 'ri-error-warning-line' : 'ri-checkbox-circle-line'} />}
                action={
                  bulkUpload.stats.error > 0 ? (
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={bulkUpload.retryFailed}
                      startIcon={<i className="ri-refresh-line" />}
                    >
                      {t?.retry ?? 'Retry'}
                    </Button>
                  ) : undefined
                }
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {t?.uploadComplete ?? 'Upload complete'}:
                  </Typography>
                  {bulkUpload.stats.success > 0 && (
                    <Chip
                      size="small"
                      color="success"
                      variant="outlined"
                      icon={<i className="ri-check-line" />}
                      label={`${bulkUpload.stats.success} успешно`}
                    />
                  )}
                  {bulkUpload.stats.error > 0 && (
                    <Chip
                      size="small"
                      color="error"
                      variant="outlined"
                      icon={<i className="ri-close-line" />}
                      label={`${bulkUpload.stats.error} ошибок`}
                    />
                  )}
                  {bulkUpload.stats.cancelled > 0 && (
                    <Chip
                      size="small"
                      color="warning"
                      variant="outlined"
                      icon={<i className="ri-forbid-line" />}
                      label={`${bulkUpload.stats.cancelled} отменено`}
                    />
                  )}
                </Box>
              </Alert>
            )}

            {/* File List - ошибки показываем первыми */}
            {uploadFiles.length > 0 && (
              <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                {[...uploadFiles]
                  .sort((a, b) => {
                    // Ошибки первыми, затем uploading, затем pending, затем success
                    const order = { error: 0, cancelled: 1, uploading: 2, pending: 3, success: 4 }
                    return (order[a.status] ?? 5) - (order[b.status] ?? 5)
                  })
                  .map((uploadFile) => (
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
                          : uploadFile.status === 'cancelled'
                            ? 'warning.lighter'
                            : 'action.hover',
                      border: '1px solid',
                      borderColor: uploadFile.status === 'error'
                        ? 'error.light'
                        : uploadFile.status === 'success'
                          ? 'success.light'
                          : uploadFile.status === 'cancelled'
                            ? 'warning.light'
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
                            {t?.uploaded ?? 'Uploaded'}
                          </Typography>
                        )}
                        {uploadFile.status === 'error' && (
                          <Typography variant="caption" color="error.main">
                            {uploadFile.error || (t?.error ?? 'Error')}
                          </Typography>
                        )}
                        {uploadFile.status === 'cancelled' && (
                          <Typography variant="caption" color="warning.main">
                            {t?.cancelled ?? 'Cancelled'}
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
                      {uploadFile.status === 'cancelled' && (
                        <IconButton
                          size="small"
                          onClick={() => removeUploadFile(uploadFile.id)}
                          color="warning"
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
        <DialogActions disableSpacing sx={{
          px: 3,
          pb: 3,
          gap: '0.5rem',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          '& .MuiButtonBase-root:not(:first-of-type)': { marginInlineStart: 0 }
        }}>
          <Box sx={{ display: 'flex', gap: '0.5rem' }}>
            {uploadFiles.length > 0 && !uploading && (
              <Button
                onClick={clearUploadFiles}
                variant="text"
                color="inherit"
                sx={{ height: 41 }}
              >
                {t?.clear ?? 'Clear'}
              </Button>
            )}
            {bulkUpload.stats.error > 0 && !uploading && (
              <Button
                onClick={bulkUpload.retryFailed}
                variant="text"
                color="warning"
                sx={{ height: 41 }}
                startIcon={<i className="ri-refresh-line" />}
              >
                {t?.retry ?? 'Retry'} ({bulkUpload.stats.error})
              </Button>
            )}
            {bulkUpload.stats.success > 0 && !uploading && (
              <Button
                onClick={bulkUpload.clearSuccess}
                variant="text"
                color="success"
                sx={{ height: 41 }}
              >
                {t?.clearCompleted ?? 'Clear completed'}
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: '0.5rem' }}>
            {uploading && !bulkUpload.isPaused && (
              <Button
                onClick={bulkUpload.pauseUpload}
                variant="outlined"
                color="warning"
                sx={{ height: 41 }}
                startIcon={<i className="ri-pause-line" />}
              >
                {t?.pause ?? 'Pause'}
              </Button>
            )}
            {uploading && bulkUpload.isPaused && (
              <Button
                onClick={bulkUpload.resumeUpload}
                variant="outlined"
                color="info"
                sx={{ height: 41 }}
                startIcon={<i className="ri-play-line" />}
              >
                {t?.resume ?? 'Resume'}
              </Button>
            )}
            {uploading && (
              <Button
                onClick={bulkUpload.cancelUpload}
                variant="outlined"
                color="error"
                sx={{ height: 41 }}
                startIcon={<i className="ri-close-circle-line" />}
              >
                {t?.cancel ?? 'Cancel'}
              </Button>
            )}
            {!uploading && (
              <Button
                onClick={() => { clearUploadFiles(); setUploadOpen(false) }}
                variant="outlined"
                sx={{ height: 41 }}
              >
                {t?.close ?? 'Close'}
              </Button>
            )}
            <Button
              variant="contained"
              sx={{ height: 41 }}
              onClick={handleUpload}
              disabled={bulkUpload.stats.pending === 0 || uploading}
              startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : <i className="ri-upload-2-line" />}
            >
              {uploading
                ? `${bulkUpload.stats.progress}%`
                : `${t?.upload ?? 'Upload'} (${bulkUpload.stats.pending})`
              }
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete Menu (dropdown for soft/hard delete) */}
      <Menu
        anchorEl={deleteMenuAnchor}
        open={Boolean(deleteMenuAnchor)}
        onClose={closeDeleteMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => deleteMenuTarget && openDeleteConfirm('single', 'soft', deleteMenuTarget)}>
          <i className="ri-inbox-archive-line" style={{ marginRight: 8 }} />
          {t?.moveToTrash ?? 'Move to trash'}
        </MenuItem>
        <MenuItem onClick={() => deleteMenuTarget && openDeleteConfirm('single', 'hard', deleteMenuTarget)} sx={{ color: 'error.main' }}>
          <i className="ri-delete-bin-line" style={{ marginRight: 8 }} />
          {t?.deletePermanently ?? 'Delete permanently'}
        </MenuItem>
      </Menu>

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
                bgcolor: deleteTarget?.mode === 'hard' ? 'error.lighter' : 'warning.lighter',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <i
                className={deleteTarget?.mode === 'hard' ? 'ri-delete-bin-line' : 'ri-inbox-archive-line'}
                style={{
                  fontSize: 20,
                  color: deleteTarget?.mode === 'hard'
                    ? 'var(--mui-palette-error-main)'
                    : 'var(--mui-palette-warning-main)'
                }}
              />
            </Box>
            {deleteTarget?.mode === 'hard' ? (t?.hardDeleteConfirmTitle ?? 'Delete permanently?') : (t?.deleteConfirmTitle ?? 'Move to trash?')}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: 6, py: 2 }}>
          {deleting && deleteProgress.total > 0 ? (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {t?.processing ?? 'Processing...'}: {deleteProgress.current} / {deleteProgress.total}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(deleteProgress.current / deleteProgress.total) * 100}
                sx={{ height: 8, borderRadius: 1 }}
              />
            </Box>
          ) : (
            <Typography color="text.secondary">
              {deleteTarget?.mode === 'hard'
                ? (t?.hardDeleteConfirmMessage ?? 'This action cannot be undone. File will be deleted from all storages')
                : (t?.deleteConfirmMessage ?? 'File will be moved to trash and can be restored later')
              }
            </Typography>
          )}
        </DialogContent>
        <DialogActions disableSpacing sx={{
          px: 6,
          pb: 5,
          pt: 2,
          gap: '0.5rem',
          '& .MuiButtonBase-root:not(:first-of-type)': { marginInlineStart: 0 }
        }}>
          <Button
            onClick={() => setDeleteConfirmOpen(false)}
            disabled={deleting}
            variant="outlined"
            fullWidth
          >
            {t?.cancel ?? 'Cancel'}
          </Button>
          <Button
            variant="contained"
            color={deleteTarget?.mode === 'hard' ? 'error' : 'warning'}
            onClick={handleConfirmDelete}
            disabled={deleting}
            fullWidth
            startIcon={
              deleting
                ? <CircularProgress size={16} color="inherit" />
                : <i className={deleteTarget?.mode === 'hard' ? 'ri-delete-bin-line' : 'ri-inbox-archive-line'} />
            }
          >
            {deleting
              ? (t?.processing ?? 'Processing...')
              : deleteTarget?.mode === 'hard'
                ? (t?.delete ?? 'Delete')
                : (t?.moveToTrash ?? 'Move to trash')
            }
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
            gap: 2,
          }}
        >
          <Typography variant="body2" fontWeight={500}>
            {t?.selected ?? 'Selected'}: {selectedIds.length}
          </Typography>

          {activeTab === 'files' ? (
            <>
              <Button
                color="warning"
                size="small"
                variant="contained"
                startIcon={<i className="ri-inbox-archive-line" />}
                onClick={() => openDeleteConfirm('bulk', 'soft')}
              >
                {t?.toTrash ?? 'To trash'}
              </Button>
              <Button
                color="error"
                size="small"
                variant="outlined"
                startIcon={<i className="ri-delete-bin-line" />}
                onClick={() => openDeleteConfirm('bulk', 'hard')}
              >
                {t?.deletePermanently ?? 'Delete permanently'}
              </Button>
            </>
          ) : (
            <>
              <Button
                color="success"
                size="small"
                variant="contained"
                startIcon={<i className="ri-arrow-go-back-line" />}
                onClick={handleBulkRestore}
              >
                {t?.restore ?? 'Restore'}
              </Button>
              <Button
                color="error"
                size="small"
                variant="outlined"
                startIcon={<i className="ri-delete-bin-line" />}
                onClick={() => openDeleteConfirm('bulk', 'hard')}
              >
                {t?.deletePermanently ?? 'Delete permanently'}
              </Button>
            </>
          )}

          <Button
            size="small"
            variant="text"
            onClick={() => setSelectedIds([])}
          >
            {t?.cancel ?? 'Cancel'}
          </Button>
        </Box>
      )}
    </Grid>
  )
}


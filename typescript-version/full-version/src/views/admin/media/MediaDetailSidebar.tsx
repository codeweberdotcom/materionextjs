'use client'

/**
 * Media details sidebar (WordPress-style)
 * Displays file info and allows editing SEO fields
 */

import { useState, useEffect } from 'react'

import { useTranslationSafe } from '@/contexts/TranslationContext'

import Drawer from '@mui/material/Drawer'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import Fade from '@mui/material/Fade'
import Grid from '@mui/material/Grid'

import { toast } from 'react-toastify'

interface MediaItem {
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
  alt?: string
  title?: string
  caption?: string
  description?: string
  createdAt: string
  deletedAt?: string | null
  trashMetadata?: string | null
  variants?: string // JSON string with variant info
  uploadedUser?: {
    id: string
    name: string
    image?: string
  }
}

interface VariantInfo {
  width: number
  height: number
  size?: number
}

interface MediaDetailSidebarProps {
  open: boolean
  mediaId: string | null
  onClose: () => void
  onUpdate?: () => void
  onDelete?: (id: string) => void
  includeDeleted?: boolean
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getStorageStatusColor = (status: string): 'success' | 'warning' | 'info' | 'error' | 'default' => {
  switch (status) {
    case 'synced':
      return 'success'
    case 's3_only':
      return 'info'
    case 'local_only':
      return 'warning'
    case 'sync_error':
      return 'error'
    case 'sync_pending':
      return 'info'
    default:
      return 'default'
  }
}

// Storage status labels will be translated inside component

export default function MediaDetailSidebar({
  open,
  mediaId,
  onClose,
  onUpdate,
  onDelete,
  includeDeleted = false,
}: MediaDetailSidebarProps) {
  // Translations
  const dictionary = useTranslationSafe()
  const t = dictionary?.mediaLibrary

  // Get storage status label with translations
  const getStorageStatusLabel = (status: string): string => {
    switch (status) {
      case 'synced':
        return t?.localAndS3 ?? 'Local + S3'
      case 's3_only':
        return t?.s3Only ?? 'S3 only'
      case 'local_only':
        return t?.localOnly ?? 'Local only'
      case 'sync_error':
        return t?.syncError ?? 'Sync error'
      case 'sync_pending':
        return t?.pending ?? 'Pending'
      default:
        return status
    }
  }

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [media, setMedia] = useState<MediaItem | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string>('')
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  // Editable fields
  const [alt, setAlt] = useState('')
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (open && mediaId) {
      fetchMedia()
    }
  }, [open, mediaId, includeDeleted])

  const fetchMedia = async () => {
    if (!mediaId) return

    setLoading(true)

    try {
      const url = includeDeleted 
        ? `/api/admin/media/${mediaId}?includeDeleted=true`
        : `/api/admin/media/${mediaId}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to fetch media')
      }

      const data = await response.json()

      setMedia(data.media)
      setUrls(data.urls || {})

      // Set form values
      setAlt(data.media.alt || '')
      setTitle(data.media.title || '')
      setCaption(data.media.caption || '')
      setDescription(data.media.description || '')
    } catch (error) {
      toast.error(t?.loadError ?? 'Failed to load data')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!mediaId) return

    setSaving(true)

    try {
      const response = await fetch(`/api/admin/media/${mediaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt, title, caption, description }),
      })

      if (!response.ok) {
        throw new Error('Failed to update')
      }

      toast.success(t?.changesSaved ?? 'Changes saved')
      onUpdate?.()
    } catch (error) {
      toast.error(t?.saveError ?? 'Save error')
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  const handleCopyUrl = (url: string) => {
    const fullUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}${url}` 
      : url
    navigator.clipboard.writeText(fullUrl)
    toast.success(t?.urlCopied ?? 'URL copied')
  }

  const handleCopyFilename = () => {
    if (media?.filename) {
      navigator.clipboard.writeText(media.filename)
      toast.success(t?.filenameCopied ?? 'Filename copied')
    }
  }

  const handleDelete = () => {
    if (mediaId && onDelete) {
      onDelete(mediaId)
    }
  }

  // Восстановить из корзины
  const handleRestore = async () => {
    if (!mediaId) return

    try {
      const response = await fetch(`/api/admin/media/${mediaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      })

      if (!response.ok) throw new Error('Failed to restore')

      toast.success(t?.fileRestored ?? 'File restored')
      onClose()
      onUpdate?.()
    } catch (error) {
      toast.error(t?.restoreError ?? 'Restore error')
      console.error(error)
    }
  }

  // Удалить навсегда
  const handleHardDelete = () => {
    setConfirmDeleteOpen(true)
  }

  const confirmHardDelete = async () => {
    if (!mediaId) return

    setConfirmDeleteOpen(false)

    try {
      const response = await fetch(`/api/admin/media/${mediaId}?hard=true`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete')

      toast.success(t?.fileDeletedPermanently ?? 'File deleted permanently')
      onClose()
      onUpdate?.()
    } catch (error) {
      toast.error(t?.deleteError ?? 'Delete error')
      console.error(error)
    }
  }

  const openLightbox = (url: string) => {
    setLightboxUrl(url)
    setLightboxOpen(true)
  }

  const handleSyncToS3 = async (forceOverwrite: boolean = false) => {
    if (!mediaId) return

    setSyncing(true)

    try {
      const response = await fetch('/api/admin/media/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload_to_s3_keep_local',
          scope: 'selected',
          mediaIds: [mediaId],
          overwrite: forceOverwrite,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to sync')
      }

      const data = await response.json()
      const jobId = data.job?.id

      // Ждём завершения задачи (polling)
      if (jobId) {
        let attempts = 0
        const maxAttempts = 30 // 30 секунд максимум
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          const statusResponse = await fetch(`/api/admin/media/sync?limit=1`)
          const statusData = await statusResponse.json()
          const job = statusData.jobs?.find((j: any) => j.id === jobId)
          
          if (job && (job.status === 'completed' || job.status === 'failed')) {
            if (job.status === 'failed') {
              throw new Error(job.error || 'Sync failed')
            }
            break
          }
          
          attempts++
        }
      }

      toast.success(forceOverwrite ? 'Файл перезалит на S3' : 'Файл выгружен на S3')
      fetchMedia() // Обновляем данные
      onUpdate?.()
    } catch (error) {
      toast.error(t?.s3UploadError ?? 'S3 upload error')
      console.error(error)
    } finally {
      setSyncing(false)
    }
  }

  // Исправляет двойной /uploads/uploads/ в пути
  const fixUploadsPath = (url: string): string => {
    if (!url) return ''
    return url.replace(/\/uploads\/uploads\//g, '/uploads/')
  }

  // Формируем URL изображения
  const getImageUrl = () => {
    // Для файлов в корзине используем API (корзина недоступна публично)
    if (media?.deletedAt && media?.trashMetadata) {
      return `/api/admin/media/${media.id}/trash?variant=original`
    }
    
    if (urls.thumbnail) return fixUploadsPath(urls.thumbnail)
    if (urls.original) return fixUploadsPath(urls.original)
    
    if (media?.localPath) {
      let path = media.localPath
        .replace(/^public\//, '')
        .replace(/^\//, '')
      
      while (path.startsWith('uploads/')) {
        path = path.substring(8)
      }
      
      return `/uploads/${path}`
    }
    
    // Для файлов на S3 используем API endpoint
    if (media?.s3Key) {
      return `/api/admin/media/${media.id}/file`
    }
    
    return ''
  }
  
  // Получить путь к файлу для отображения
  const getFilePath = (): string => {
    if (media?.deletedAt && media?.trashMetadata) {
      try {
        const trashMeta = JSON.parse(media.trashMetadata)
        return trashMeta.trashPath || 'Корзина'
      } catch {
        return 'Корзина'
      }
    }
    return media?.localPath || media?.s3Key || '-'
  }
  
  // Проверка, находится ли файл в корзине
  const isInTrash = !!media?.deletedAt
  
  const imageUrl = getImageUrl()

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{ '& .MuiDrawer-paper': { width: { xs: '100%', sm: 500, md: 700, lg: 900 } } }}
    >
      {/* Header */}
      <div className='flex items-center justify-between pli-6 plb-4 border-be'>
        <Typography variant='h5'>{t?.fileDetails ?? 'File Details'}</Typography>
        <IconButton size='small' onClick={onClose}>
          <i className='ri-close-line text-2xl' />
        </IconButton>
      </div>

      {/* Content */}
      <div className='p-6'>
        {loading ? (
          // Skeleton Loading
          <div className='flex flex-col gap-6'>
            <Skeleton variant='rectangular' height={420} className='rounded-lg' />
            <Grid container spacing={6}>
              <Grid item xs={12} md={6}>
                <Skeleton variant='text' width='40%' height={28} className='mbe-4' />
                <div className='flex flex-col gap-3'>
                  <Skeleton variant='text' height={24} />
                  <Skeleton variant='text' height={24} />
                  <Skeleton variant='text' height={24} />
                  <Skeleton variant='text' height={24} />
                  <Skeleton variant='text' height={24} />
                </div>
              </Grid>
              <Grid item xs={12} md={6}>
                <Skeleton variant='text' width='40%' height={28} className='mbe-4' />
                <div className='flex flex-col gap-2'>
                  <Skeleton variant='rounded' height={56} />
                  <Skeleton variant='rounded' height={56} />
                  <Skeleton variant='rounded' height={80} />
                  <Skeleton variant='rounded' height={100} />
                </div>
              </Grid>
            </Grid>
          </div>
        ) : media ? (
          <div className='flex flex-col gap-6'>
            {/* Preview - Full Width */}
            {media.mimeType.startsWith('image/') && imageUrl && (
              <div
                onClick={() => openLightbox(imageUrl)}
                className='relative rounded-lg overflow-hidden bg-actionHover cursor-pointer group'
              >
                <div className='flex justify-center items-center min-bs-[200px]'>
                  <img
                    src={imageUrl}
                    alt={media.alt || media.filename}
                    style={{
                      maxWidth: '100%',
                      maxHeight: 320,
                      objectFit: 'contain',
                    }}
                  />
                </div>
                <div className='absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity'>
                  <i className='ri-add-line text-white text-4xl font-bold' />
                </div>
              </div>
            )}

            {/* Two Column Layout */}
            <Grid container spacing={6}>
              {/* Column 1 - File Info */}
              <Grid item xs={12} md={6}>
                <Typography variant='h6' className='mbe-4'>
                  {t?.fileInfo ?? 'File information'}
                </Typography>
                
                <div className='flex flex-col gap-4'>
                  {/* Filename */}
                  <div className='flex items-center justify-between'>
                    <Typography variant='body2' color='text.secondary'>
                      {t?.filename ?? 'Filename'}
                    </Typography>
                    <div className='flex items-center gap-1 max-is-[60%]'>
                      <Typography variant='body2' noWrap title={media.filename}>
                        {media.filename}
                      </Typography>
                      <Tooltip title={t?.copy ?? 'Copy'} arrow>
                        <IconButton size='small' onClick={handleCopyFilename}>
                          <i className='ri-file-copy-line text-lg' />
                        </IconButton>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Size */}
                  <div className='flex items-center justify-between'>
                    <Typography variant='body2' color='text.secondary'>
                      {t?.size ?? 'Size'}
                    </Typography>
                    <Typography variant='body2'>
                      {formatFileSize(media.size)}
                    </Typography>
                  </div>

                  {/* Resolution */}
                  {media.width && media.height && (
                    <div className='flex items-center justify-between'>
                      <Typography variant='body2' color='text.secondary'>
                        {t?.dimensions ?? 'Dimensions'}
                      </Typography>
                      <Typography variant='body2'>
                        {media.width} × {media.height} px
                      </Typography>
                    </div>
                  )}

                  {/* Type */}
                  <div className='flex items-center justify-between'>
                    <Typography variant='body2' color='text.secondary'>
                      {t?.mimeType ?? 'MIME type'}
                    </Typography>
                    <Typography variant='body2'>
                      {media.mimeType}
                    </Typography>
                  </div>

                  {/* Date */}
                  <div className='flex items-center justify-between'>
                    <Typography variant='body2' color='text.secondary'>
                      {t?.uploadDate ?? 'Upload date'}
                    </Typography>
                    <Typography variant='body2'>
                      {formatDate(media.createdAt)}
                    </Typography>
                  </div>

                  {/* Storage */}
                  <div className='flex items-center justify-between'>
                    <Typography variant='body2' color='text.secondary'>
                      {t?.storage ?? 'Storage'}
                    </Typography>
                    <Chip
                      label={getStorageStatusLabel(media.storageStatus)}
                      size='small'
                      color={getStorageStatusColor(media.storageStatus)}
                    />
                  </div>

                  {/* Author */}
                  {media.uploadedUser && (
                    <div className='flex items-center justify-between'>
                      <Typography variant='body2' color='text.secondary'>
                        {t?.uploadedBy ?? 'Uploaded by'}
                      </Typography>
                      <div className='flex items-center gap-2'>
                        <Avatar src={media.uploadedUser.image} sx={{ width: 28, height: 28 }}>
                          {media.uploadedUser.name?.[0]}
                        </Avatar>
                        <Typography variant='body2'>
                          {media.uploadedUser.name}
                        </Typography>
                      </div>
                    </div>
                  )}

                  {/* File Path */}
                  <div className='flex items-start justify-between'>
                    <Typography variant='body2' color='text.secondary'>
                      {t?.path ?? 'Path'}
                    </Typography>
                    <Typography 
                      variant='body2' 
                      sx={{ 
                        maxWidth: '60%', 
                        wordBreak: 'break-all',
                        textAlign: 'right',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem'
                      }}
                    >
                      {getFilePath()}
                    </Typography>
                  </div>

                  {/* Trash indicator */}
                  {isInTrash && (
                    <div className='flex items-center justify-between'>
                      <Typography variant='body2' color='text.secondary'>
                        {t?.status ?? 'Status'}
                      </Typography>
                      <Chip
                        label={t?.inTrash ?? 'In trash'}
                        size='small'
                        color="warning"
                        icon={<i className='ri-delete-bin-line' style={{ fontSize: 14 }} />}
                      />
                    </div>
                  )}
                </div>

                {/* Available Sizes Section */}
                {Object.keys(urls).length > 0 && (
                  <div className='mbs-6'>
                    <Typography variant='h6' className='mbe-4'>
                      {t?.variants ?? 'Variants'}
                    </Typography>
                    <div className='flex flex-col gap-2'>
                      {/* Original */}
                      {urls.original && (
                        <div className='flex items-center justify-between p-2 rounded border border-divider'>
                          <div className='flex items-center gap-2'>
                            <Chip label={t?.original ?? 'Original'} size="small" color="primary" />
                            {media.width && media.height && (
                              <Typography variant='caption' color='text.secondary'>
                                {media.width}×{media.height}
                              </Typography>
                            )}
                          </div>
                          <div className='flex items-center gap-1'>
                            <Tooltip title='Открыть' arrow>
                              <IconButton size='small' onClick={() => openLightbox(urls.original)}>
                                <i className='ri-eye-line' />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t?.copyUrl ?? 'Copy URL'} arrow>
                              <IconButton size='small' onClick={() => handleCopyUrl(urls.original)}>
                                <i className='ri-file-copy-line' />
                              </IconButton>
                            </Tooltip>
                          </div>
                        </div>
                      )}
                      
                      {/* Variants */}
                      {Object.entries(urls)
                        .filter(([key]) => key !== 'original')
                        .map(([name, url]) => {
                          const variants = media.variants ? JSON.parse(media.variants) : {}
                          const variantInfo = variants[name] as VariantInfo | undefined
                          
                          return (
                            <div key={name} className='flex items-center justify-between p-2 rounded border border-divider'>
                              <div className='flex items-center gap-2'>
                                <Chip 
                                  label={name.charAt(0).toUpperCase() + name.slice(1)} 
                                  size="small" 
                                  variant="outlined"
                                />
                                {variantInfo && (
                                  <Typography variant='caption' color='text.secondary'>
                                    {variantInfo.width}×{variantInfo.height}
                                  </Typography>
                                )}
                              </div>
                              <div className='flex items-center gap-1'>
                                <Tooltip title='Открыть' arrow>
                                  <IconButton size='small' onClick={() => openLightbox(url)}>
                                    <i className='ri-eye-line' />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={t?.copyUrl ?? 'Copy URL'} arrow>
                                  <IconButton size='small' onClick={() => handleCopyUrl(url)}>
                                    <i className='ri-file-copy-line' />
                                  </IconButton>
                                </Tooltip>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}
              </Grid>

              {/* Column 2 - SEO Fields (скрыты для файлов в корзине) */}
              {!isInTrash && (
              <Grid item xs={12} md={6}>
                <Typography variant='h6' className='mbe-4'>
                    {t?.seoSettings ?? 'SEO Settings'}
                </Typography>

                <div className='flex flex-col gap-2'>
                  <TextField
                    fullWidth
                      label={t?.altText ?? 'Alt text'}
                      placeholder={dictionary?.navigation?.altTextPlaceholder ?? 'Image description for search engines'}
                    value={alt}
                    onChange={(e) => setAlt(e.target.value)}
                  />

                  <TextField
                    fullWidth
                      label={t?.titleText ?? 'Title'}
                      placeholder={dictionary?.navigation?.titlePlaceholder ?? 'Image title'}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />

                  <TextField
                    fullWidth
                      label={t?.caption ?? 'Caption'}
                      placeholder={dictionary?.navigation?.captionPlaceholder ?? 'Image caption'}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    multiline
                    rows={2}
                  />

                  <TextField
                    fullWidth
                      label={t?.description ?? 'Description'}
                      placeholder={dictionary?.navigation?.descriptionPlaceholder ?? 'Detailed file description'}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    multiline
                    rows={3}
                  />
                </div>
              </Grid>
              )}
            </Grid>

            {/* Actions */}
            <Divider />
            {isInTrash ? (
              // Buttons for trashed files
              <div className='grid grid-cols-2 gap-2'>
                <Button
                  type='button'
                  variant='contained'
                  color='success'
                  onClick={handleRestore}
                  startIcon={<i className='ri-arrow-go-back-line' />}
                >
                  {t?.restore ?? 'Restore'}
                </Button>
                <Button
                  type='button'
                  variant='outlined'
                  color='error'
                  onClick={handleHardDelete}
                  startIcon={<i className='ri-delete-bin-line' />}
                >
                  {t?.deletePermanently ?? 'Delete permanently'}
                </Button>
              </div>
            ) : (
              // Кнопки для обычных файлов
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
              <Button
                  type='button'
                variant='contained'
                onClick={handleSave}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={18} color='inherit' /> : <i className='ri-save-line' />}
              >
                  {saving ? (t?.saving ?? 'Saving...') : (t?.save ?? 'Save')}
              </Button>
              {(media.storageStatus === 'local_only' || media.storageStatus === 'sync_error') && (
                <Button
                    type='button'
                  variant='outlined'
                  onClick={() => handleSyncToS3(false)}
                  disabled={syncing}
                  color={media.storageStatus === 'sync_error' ? 'warning' : 'primary'}
                  startIcon={syncing ? <CircularProgress size={18} /> : <i className='ri-cloud-line' />}
                >
                    {syncing ? (t?.uploading ?? 'Uploading...') : media.storageStatus === 'sync_error' ? (t?.retry ?? 'Retry') : (t?.toS3 ?? 'To S3')}
                </Button>
              )}
              {media.storageStatus === 'synced' && media.localPath && (
                <Button
                    type='button'
                  variant='outlined'
                  onClick={() => handleSyncToS3(true)}
                  disabled={syncing}
                  startIcon={syncing ? <CircularProgress size={18} /> : <i className='ri-refresh-line' />}
                >
                    {syncing ? (t?.uploading ?? 'Uploading...') : (t?.reupload ?? 'Re-upload')}
                </Button>
              )}
              {imageUrl && (
                <Button
                    type='button'
                  variant='outlined'
                  href={imageUrl}
                  target='_blank'
                  startIcon={<i className='ri-download-line' />}
                >
                    {t?.download ?? 'Download'}
                </Button>
              )}
              <Button
                  type='button'
                variant='outlined'
                color='error'
                onClick={handleDelete}
                startIcon={<i className='ri-delete-bin-line' />}
              >
                  {t?.delete ?? 'Delete'}
              </Button>
            </div>
            )}
          </div>
        ) : (
          <Typography color='text.secondary' className='text-center pbs-8'>
            {t?.selectFile ?? 'Select a file to view'}
          </Typography>
        )}
      </div>

      {/* Lightbox Dialog */}
      <Dialog
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        maxWidth={false}
        TransitionComponent={Fade}
        PaperProps={{
          sx: {
            bgcolor: 'transparent',
            boxShadow: 'none',
            maxWidth: '95vw',
            maxHeight: '95vh',
          },
        }}
        slotProps={{
          backdrop: {
            sx: { bgcolor: 'rgba(0, 0, 0, 0.92)' }
          }
        }}
      >
        <div className='relative'>
          <IconButton
            onClick={() => setLightboxOpen(false)}
            sx={{
              position: 'absolute',
              top: -48,
              right: 0,
              color: 'white',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
            }}
          >
            <i className='ri-close-line text-3xl' />
          </IconButton>

          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt={media?.alt || media?.filename || ''}
              style={{
                maxWidth: '95vw',
                maxHeight: '90vh',
                objectFit: 'contain',
                borderRadius: 8,
              }}
            />
          )}
        </div>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
          <i className="ri-error-warning-line" />
          {t?.confirmDelete ?? 'Confirm deletion'}
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mt: 1 }}>
            <Typography variant="body2">
              {t?.deleteFileWarning ?? 'Are you sure? The file will be deleted permanently.'}
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: '0.5rem', '& .MuiButtonBase-root:not(:first-of-type)': { marginInlineStart: 0 } }} disableSpacing>
          <Button
            variant="outlined"
            onClick={() => setConfirmDeleteOpen(false)}
          >
            {t?.cancel ?? 'Cancel'}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmHardDelete}
            startIcon={<i className="ri-delete-bin-line" />}
          >
            {t?.deletePermanently ?? 'Delete permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  )
}

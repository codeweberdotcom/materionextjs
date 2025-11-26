'use client'

/**
 * Боковая панель деталей медиа (WordPress-style)
 * Отображает информацию о файле и позволяет редактировать SEO-поля
 */

import { useState, useEffect } from 'react'

import Drawer from '@mui/material/Drawer'
import Dialog from '@mui/material/Dialog'
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

const getStorageStatusColor = (status: string): 'success' | 'warning' | 'info' | 'default' => {
  switch (status) {
    case 'synced':
      return 'success'
    case 's3_only':
      return 'info'
    case 'local_only':
      return 'warning'
    default:
      return 'default'
  }
}

const getStorageStatusLabel = (status: string): string => {
  switch (status) {
    case 'synced':
      return 'Синхронизировано'
    case 's3_only':
      return 'Только S3'
    case 'local_only':
      return 'Локально'
    default:
      return status
  }
}

export default function MediaDetailSidebar({
  open,
  mediaId,
  onClose,
  onUpdate,
  onDelete,
}: MediaDetailSidebarProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [media, setMedia] = useState<MediaItem | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string>('')

  // Editable fields
  const [alt, setAlt] = useState('')
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (open && mediaId) {
      fetchMedia()
    }
  }, [open, mediaId])

  const fetchMedia = async () => {
    if (!mediaId) return

    setLoading(true)

    try {
      const response = await fetch(`/api/admin/media/${mediaId}`)

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
      toast.error('Не удалось загрузить данные')
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

      toast.success('Изменения сохранены')
      onUpdate?.()
    } catch (error) {
      toast.error('Ошибка сохранения')
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
    toast.success('URL скопирован')
  }

  const handleCopyFilename = () => {
    if (media?.filename) {
      navigator.clipboard.writeText(media.filename)
      toast.success('Имя файла скопировано')
    }
  }

  const handleDelete = () => {
    if (mediaId && onDelete) {
      onDelete(mediaId)
    }
  }

  const openLightbox = (url: string) => {
    setLightboxUrl(url)
    setLightboxOpen(true)
  }

  const handleSyncToS3 = async () => {
    if (!mediaId) return

    setSyncing(true)

    try {
      const response = await fetch('/api/admin/media/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'upload_keep_local',
          scope: 'selected',
          mediaIds: [mediaId],
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to sync')
      }

      toast.success('Файл выгружен на S3')
      fetchMedia() // Обновляем данные
      onUpdate?.()
    } catch (error) {
      toast.error('Ошибка выгрузки на S3')
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
    return ''
  }
  
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
        <Typography variant='h5'>Детали файла</Typography>
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
                  Информация о файле
                </Typography>
                
                <div className='flex flex-col gap-4'>
                  {/* Filename */}
                  <div className='flex items-center justify-between'>
                    <Typography variant='body2' color='text.secondary'>
                      Имя файла
                    </Typography>
                    <div className='flex items-center gap-1 max-is-[60%]'>
                      <Typography variant='body2' noWrap title={media.filename}>
                        {media.filename}
                      </Typography>
                      <Tooltip title='Копировать' arrow>
                        <IconButton size='small' onClick={handleCopyFilename}>
                          <i className='ri-file-copy-line text-lg' />
                        </IconButton>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Size */}
                  <div className='flex items-center justify-between'>
                    <Typography variant='body2' color='text.secondary'>
                      Размер файла
                    </Typography>
                    <Typography variant='body2'>
                      {formatFileSize(media.size)}
                    </Typography>
                  </div>

                  {/* Resolution */}
                  {media.width && media.height && (
                    <div className='flex items-center justify-between'>
                      <Typography variant='body2' color='text.secondary'>
                        Разрешение
                      </Typography>
                      <Typography variant='body2'>
                        {media.width} × {media.height} px
                      </Typography>
                    </div>
                  )}

                  {/* Type */}
                  <div className='flex items-center justify-between'>
                    <Typography variant='body2' color='text.secondary'>
                      Тип файла
                    </Typography>
                    <Typography variant='body2'>
                      {media.mimeType}
                    </Typography>
                  </div>

                  {/* Date */}
                  <div className='flex items-center justify-between'>
                    <Typography variant='body2' color='text.secondary'>
                      Дата загрузки
                    </Typography>
                    <Typography variant='body2'>
                      {formatDate(media.createdAt)}
                    </Typography>
                  </div>

                  {/* Storage */}
                  <div className='flex items-center justify-between'>
                    <Typography variant='body2' color='text.secondary'>
                      Хранилище
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
                        Загрузил
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
                </div>

                {/* Available Sizes Section */}
                {Object.keys(urls).length > 0 && (
                  <div className='mbs-6'>
                    <Typography variant='h6' className='mbe-4'>
                      Доступные размеры
                    </Typography>
                    <div className='flex flex-col gap-2'>
                      {/* Original */}
                      {urls.original && (
                        <div className='flex items-center justify-between p-2 rounded border border-divider'>
                          <div className='flex items-center gap-2'>
                            <Chip label="Оригинал" size="small" color="primary" />
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
                            <Tooltip title='Копировать URL' arrow>
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
                                <Tooltip title='Копировать URL' arrow>
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

              {/* Column 2 - SEO Fields */}
              <Grid item xs={12} md={6}>
                <Typography variant='h6' className='mbe-4'>
                  SEO и метаданные
                </Typography>

                <div className='flex flex-col gap-2'>
                  <TextField
                    fullWidth
                    label='Alt текст'
                    placeholder='Описание изображения для поисковиков'
                    value={alt}
                    onChange={(e) => setAlt(e.target.value)}
                  />

                  <TextField
                    fullWidth
                    label='Заголовок (Title)'
                    placeholder='Заголовок изображения'
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />

                  <TextField
                    fullWidth
                    label='Подпись (Caption)'
                    placeholder='Подпись под изображением'
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    multiline
                    rows={2}
                  />

                  <TextField
                    fullWidth
                    label='Описание'
                    placeholder='Подробное описание файла'
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    multiline
                    rows={3}
                  />
                </div>
              </Grid>
            </Grid>

            {/* Actions */}
            <Divider />
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
              <Button
                variant='contained'
                onClick={handleSave}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={18} color='inherit' /> : <i className='ri-save-line' />}
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </Button>
              {media.storageStatus === 'local_only' && (
                <Button
                  variant='outlined'
                  onClick={handleSyncToS3}
                  disabled={syncing}
                  startIcon={syncing ? <CircularProgress size={18} /> : <i className='ri-cloud-line' />}
                >
                  {syncing ? 'Выгрузка...' : 'На S3'}
                </Button>
              )}
              {imageUrl && (
                <Button
                  variant='outlined'
                  href={imageUrl}
                  target='_blank'
                  startIcon={<i className='ri-download-line' />}
                >
                  Скачать
                </Button>
              )}
              <Button
                variant='outlined'
                color='error'
                onClick={handleDelete}
                startIcon={<i className='ri-delete-bin-line' />}
              >
                Удалить
              </Button>
            </div>
          </div>
        ) : (
          <Typography color='text.secondary' className='text-center pbs-8'>
            Выберите файл для просмотра
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
    </Drawer>
  )
}

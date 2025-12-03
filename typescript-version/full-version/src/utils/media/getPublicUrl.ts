/**
 * Утилита для получения публичного URL медиа файла
 * Для использования на фронтенде (без проксирования)
 * 
 * @module utils/media/getPublicUrl
 */

export interface MediaUrlOptions {
  /** ID медиа файла */
  id: string
  /** Название варианта (thumb, medium, large) */
  variant?: string
  /** Локальный путь (если есть) */
  localPath?: string | null
  /** S3 ключ (если есть) */
  s3Key?: string | null
  /** Публичный URL prefix для S3/CDN */
  s3PublicUrlPrefix?: string | null
}

/**
 * Получить публичный URL для медиа файла
 * 
 * Приоритет:
 * 1. Если есть s3PublicUrlPrefix и s3Key → CDN URL
 * 2. Если есть localPath → локальный URL
 * 3. Fallback на API endpoint
 * 
 * @example
 * // С CDN
 * getPublicMediaUrl({ 
 *   id: 'abc123', 
 *   s3Key: 'images/photo.webp',
 *   s3PublicUrlPrefix: 'https://cdn.example.com'
 * })
 * // → 'https://cdn.example.com/images/photo.webp'
 * 
 * @example
 * // Локальный файл
 * getPublicMediaUrl({ 
 *   id: 'abc123', 
 *   localPath: 'other/2025/12/photo.webp'
 * })
 * // → '/uploads/other/2025/12/photo.webp'
 */
export function getPublicMediaUrl(options: MediaUrlOptions): string {
  const { id, variant, localPath, s3Key, s3PublicUrlPrefix } = options

  // 1. CDN/Public S3 URL (лучший вариант для production)
  if (s3PublicUrlPrefix && s3Key) {
    const prefix = s3PublicUrlPrefix.endsWith('/') 
      ? s3PublicUrlPrefix.slice(0, -1) 
      : s3PublicUrlPrefix
    const key = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key
    return `${prefix}/${key}`
  }

  // 2. Локальный файл
  if (localPath) {
    let path = localPath
      .replace(/^public\//, '')
      .replace(/^\//, '')
    
    // Убираем дублирующиеся uploads/
    while (path.startsWith('uploads/')) {
      path = path.substring(8)
    }
    
    return `/uploads/${path}`
  }

  // 3. Fallback на API (с проксированием)
  const baseUrl = `/api/media/${id}`
  return variant ? `${baseUrl}?variant=${variant}` : baseUrl
}

/**
 * Получить URL для варианта изображения
 */
export function getPublicVariantUrl(
  media: {
    id: string
    localPath?: string | null
    s3Key?: string | null
    variants?: string | null
  },
  variantName: string,
  s3PublicUrlPrefix?: string | null
): string {
  // Парсим варианты
  if (media.variants) {
    try {
      const variants = JSON.parse(media.variants)
      const variant = variants[variantName]
      
      if (variant) {
        return getPublicMediaUrl({
          id: media.id,
          variant: variantName,
          localPath: variant.localPath,
          s3Key: variant.s3Key,
          s3PublicUrlPrefix,
        })
      }
    } catch {
      // Игнорируем ошибки парсинга
    }
  }

  // Fallback на оригинал
  return getPublicMediaUrl({
    id: media.id,
    localPath: media.localPath,
    s3Key: media.s3Key,
    s3PublicUrlPrefix,
  })
}

/**
 * Получить оптимальный URL для отображения
 * Автоматически выбирает лучший вариант
 */
export function getOptimalImageUrl(
  media: {
    id: string
    localPath?: string | null
    s3Key?: string | null
    variants?: string | null
  },
  preferredSize: 'thumb' | 'medium' | 'large' | 'original' = 'medium',
  s3PublicUrlPrefix?: string | null
): string {
  if (preferredSize === 'original') {
    return getPublicMediaUrl({
      id: media.id,
      localPath: media.localPath,
      s3Key: media.s3Key,
      s3PublicUrlPrefix,
    })
  }

  return getPublicVariantUrl(media, preferredSize, s3PublicUrlPrefix)
}


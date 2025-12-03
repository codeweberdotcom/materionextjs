/**
 * Компонент для отображения медиа изображений
 * Автоматически выбирает лучший URL (CDN/local/proxy)
 * 
 * @module components/media/MediaImage
 * 
 * @example
 * // Базовое использование
 * <MediaImage media={product.image} size="medium" />
 * 
 * @example
 * // С кастомными стилями
 * <MediaImage 
 *   media={product.image} 
 *   size="large"
 *   className="rounded-lg shadow"
 *   alt="Product image"
 * />
 * 
 * @example
 * // Адаптивное изображение
 * <MediaImage 
 *   media={product.image} 
 *   sizes="(max-width: 768px) 100vw, 50vw"
 *   priority
 * />
 */

'use client'

import { useState } from 'react'
import Image, { ImageProps } from 'next/image'

import { useMediaUrl, useMediaUrls } from '@/hooks/useMediaUrl'

interface MediaData {
  id: string
  localPath?: string | null
  s3Key?: string | null
  variants?: string | null
  alt?: string | null
  title?: string | null
  width?: number | null
  height?: number | null
}

interface MediaImageProps extends Omit<ImageProps, 'src' | 'alt'> {
  /** Данные медиа файла */
  media: MediaData | null | undefined
  /** Размер варианта */
  size?: 'thumb' | 'medium' | 'large' | 'original'
  /** Alt текст (переопределяет media.alt) */
  alt?: string
  /** Показывать placeholder при загрузке */
  showPlaceholder?: boolean
  /** URL placeholder изображения */
  placeholderSrc?: string
  /** Fallback при ошибке загрузки */
  fallbackSrc?: string
}

/**
 * Оптимизированный компонент для отображения медиа изображений
 */
export function MediaImage({
  media,
  size = 'medium',
  alt,
  showPlaceholder = true,
  placeholderSrc = '/images/placeholder.png',
  fallbackSrc = '/images/placeholder.png',
  width,
  height,
  ...props
}: MediaImageProps) {
  const { url, loading } = useMediaUrl(media, size)
  const [error, setError] = useState(false)

  // Если нет media - показываем placeholder
  if (!media) {
    return showPlaceholder ? (
      <Image
        src={placeholderSrc}
        alt={alt || 'No image'}
        width={width || 400}
        height={height || 300}
        {...props}
      />
    ) : null
  }

  // Если ошибка загрузки - показываем fallback
  if (error) {
    return (
      <Image
        src={fallbackSrc}
        alt={alt || media.alt || 'Image error'}
        width={width || media.width || 400}
        height={height || media.height || 300}
        {...props}
      />
    )
  }

  // Если загружается - показываем placeholder
  if (loading || !url) {
    return showPlaceholder ? (
      <Image
        src={placeholderSrc}
        alt={alt || media.alt || 'Loading...'}
        width={width || media.width || 400}
        height={height || media.height || 300}
        {...props}
      />
    ) : null
  }

  return (
    <Image
      src={url}
      alt={alt || media.alt || media.title || 'Image'}
      width={width || media.width || 400}
      height={height || media.height || 300}
      onError={() => setError(true)}
      {...props}
    />
  )
}

/**
 * Простой img тег (без Next.js Image оптимизации)
 * Для случаев когда не нужна оптимизация
 */
export function MediaImg({
  media,
  size = 'medium',
  alt,
  className,
  style,
  ...props
}: {
  media: MediaData | null | undefined
  size?: 'thumb' | 'medium' | 'large' | 'original'
  alt?: string
  className?: string
  style?: React.CSSProperties
} & React.ImgHTMLAttributes<HTMLImageElement>) {
  const { url, loading } = useMediaUrl(media, size)

  if (!media || loading || !url) {
    return null
  }

  return (
    <img
      src={url}
      alt={alt || media.alt || media.title || 'Image'}
      className={className}
      style={style}
      loading="lazy"
      {...props}
    />
  )
}

/**
 * Picture элемент с srcset для разных размеров
 */
export function MediaPicture({
  media,
  alt,
  className,
  imgClassName,
  sizes = '100vw',
}: {
  media: MediaData | null | undefined
  alt?: string
  className?: string
  imgClassName?: string
  sizes?: string
}) {
  const { urls, loading } = useMediaUrls(media)

  if (!media || loading || !urls.original) {
    return null
  }

  return (
    <picture className={className}>
      {urls.large && (
        <source srcSet={urls.large} media="(min-width: 1024px)" />
      )}
      {urls.medium && (
        <source srcSet={urls.medium} media="(min-width: 640px)" />
      )}
      {urls.thumb && (
        <source srcSet={urls.thumb} media="(max-width: 639px)" />
      )}
      <img
        src={urls.original}
        alt={alt || media.alt || media.title || 'Image'}
        className={imgClassName}
        loading="lazy"
        sizes={sizes}
      />
    </picture>
  )
}

export default MediaImage


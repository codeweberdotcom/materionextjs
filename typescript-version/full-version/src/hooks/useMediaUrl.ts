/**
 * React хук для получения URL медиа файлов
 * Для использования на фронтенде
 * 
 * @module hooks/useMediaUrl
 */

'use client'

import { useState, useEffect, useCallback } from 'react'

import { getPublicMediaUrl, getOptimalImageUrl } from '@/utils/media'

interface MediaData {
  id: string
  localPath?: string | null
  s3Key?: string | null
  variants?: string | null
}

interface MediaUrlConfig {
  /** Публичный URL prefix для S3/CDN (загружается автоматически если не указан) */
  s3PublicUrlPrefix?: string | null
}

// Кэш для настроек
let cachedPublicUrlPrefix: string | null = null
let prefixLoadPromise: Promise<string | null> | null = null

/**
 * Загрузить publicUrlPrefix из настроек
 */
async function loadPublicUrlPrefix(): Promise<string | null> {
  if (cachedPublicUrlPrefix !== null) {
    return cachedPublicUrlPrefix
  }

  if (prefixLoadPromise) {
    return prefixLoadPromise
  }

  prefixLoadPromise = fetch('/api/admin/media/settings')
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      cachedPublicUrlPrefix = data?.global?.s3PublicUrlPrefix || null
      return cachedPublicUrlPrefix
    })
    .catch(() => {
      cachedPublicUrlPrefix = null
      return null
    })

  return prefixLoadPromise
}

/**
 * Хук для получения URL одного медиа файла
 * 
 * @example
 * const { url, loading } = useMediaUrl(media, 'medium')
 * <img src={url} />
 */
export function useMediaUrl(
  media: MediaData | null | undefined,
  variant: 'thumb' | 'medium' | 'large' | 'original' = 'original',
  config?: MediaUrlConfig
) {
  const [url, setUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!media) {
      setUrl('')
      setLoading(false)
      return
    }

    const resolveUrl = async () => {
      setLoading(true)
      
      const prefix = config?.s3PublicUrlPrefix ?? await loadPublicUrlPrefix()
      
      const resolvedUrl = getOptimalImageUrl(media, variant, prefix)
      setUrl(resolvedUrl)
      setLoading(false)
    }

    resolveUrl()
  }, [media?.id, media?.localPath, media?.s3Key, media?.variants, variant, config?.s3PublicUrlPrefix])

  return { url, loading }
}

/**
 * Хук для получения всех URL вариантов медиа файла
 * 
 * @example
 * const { urls, loading } = useMediaUrls(media)
 * <img src={urls.thumb} />
 * <img src={urls.original} />
 */
export function useMediaUrls(
  media: MediaData | null | undefined,
  config?: MediaUrlConfig
) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!media) {
      setUrls({})
      setLoading(false)
      return
    }

    const resolveUrls = async () => {
      setLoading(true)
      
      const prefix = config?.s3PublicUrlPrefix ?? await loadPublicUrlPrefix()
      const result: Record<string, string> = {}
      
      // Original
      result.original = getPublicMediaUrl({
        id: media.id,
        localPath: media.localPath,
        s3Key: media.s3Key,
        s3PublicUrlPrefix: prefix,
      })

      // Variants
      if (media.variants) {
        try {
          const variants = JSON.parse(media.variants)
          for (const [name, variant] of Object.entries(variants) as [string, any][]) {
            result[name] = getPublicMediaUrl({
              id: media.id,
              variant: name,
              localPath: variant.localPath,
              s3Key: variant.s3Key,
              s3PublicUrlPrefix: prefix,
            })
          }
        } catch {
          // Ignore
        }
      }

      setUrls(result)
      setLoading(false)
    }

    resolveUrls()
  }, [media?.id, media?.localPath, media?.s3Key, media?.variants, config?.s3PublicUrlPrefix])

  return { urls, loading }
}

/**
 * Функция для получения URL синхронно (если prefix известен)
 * Для использования в SSR или когда prefix уже загружен
 */
export function getMediaUrlSync(
  media: MediaData,
  variant: 'thumb' | 'medium' | 'large' | 'original' = 'original',
  s3PublicUrlPrefix?: string | null
): string {
  return getOptimalImageUrl(media, variant, s3PublicUrlPrefix)
}


/**
 * API endpoint для парсинга веб-сайтов
 *
 * POST /api/admin/tools/web-scraper
 *
 * @module app/api/admin/tools/web-scraper
 */

import { NextResponse } from 'next/server'

import { z } from 'zod'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { isSuperadmin, isAdminByCode } from '@/utils/permissions/permissions'
import { getWebScraperService } from '@/services/web-scraper'
import type { ScrapeOptions } from '@/services/web-scraper/types'

// Схема валидации входных данных
const scrapeRequestSchema = z.object({
  url: z.string().url('Некорректный URL'),
  options: z.object({
    extractImages: z.boolean().optional(),
    maxDepth: z.number().min(1).max(5).optional(),
    timeout: z.number().min(5000).max(120000).optional(),
    enableCrawl: z.boolean().optional(),
    maxPages: z.number().min(1).max(20).optional(),
    additionalPaths: z.array(z.string()).optional()
  }).optional()
})

/**
 * POST - Парсинг веб-сайта
 *
 * Request body:
 * {
 *   "url": "https://example.com",
 *   "options": {
 *     "extractImages": true,
 *     "enableCrawl": true,
 *     "maxPages": 5
 *   }
 * }
 */
export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    // Проверка роли (только ADMIN и SUPERADMIN)
    if (!isSuperadmin(user) && !isAdminByCode(user)) {
      return NextResponse.json(
        { success: false, error: 'Недостаточно прав. Требуется роль ADMIN.' },
        { status: 403 }
      )
    }

    // Парсинг и валидация тела запроса
    const body = await request.json()
    const validationResult = scrapeRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ошибка валидации',
          details: validationResult.error.errors
        },
        { status: 400 }
      )
    }

    const { url, options } = validationResult.data

    // Выполняем парсинг
    const scraperService = getWebScraperService()
    const result = await scraperService.scrapeWebsite(url, options as ScrapeOptions)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          duration: result.duration
        },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      textAnalysis: result.textAnalysis, // Анализ текста (леммы, TF-IDF)
      meta: {
        duration: result.duration,
        pagesScraped: result.pagesScraped,
        hasRawData: !!result.rawMarkdown
      }
    })
  }
})

/**
 * GET - Проверка доступности сервиса
 */
export const GET = withApiHandler({
  handler: async () => {
    const scraperService = getWebScraperService()
    const health = await scraperService.checkHealth()

    return NextResponse.json({
      success: true,
      data: {
        available: health.available,
        mode: health.mode, // 'firecrawl' или 'native'
        error: health.error
      }
    })
  }
})

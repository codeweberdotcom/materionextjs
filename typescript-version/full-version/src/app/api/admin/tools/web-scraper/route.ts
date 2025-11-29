/**
 * API endpoint для парсинга веб-сайтов
 * 
 * POST /api/admin/tools/web-scraper
 * 
 * @module app/api/admin/tools/web-scraper
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { getWebScraperService } from '@/services/web-scraper'
import type { ScrapeOptions } from '@/services/web-scraper/types'
import { z } from 'zod'

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
export async function POST(request: NextRequest) {
  try {
    // Проверка авторизации
    let user
    try {
      const auth = await requireAuth(request)
      user = auth.user
    } catch {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация' },
        { status: 401 }
      )
    }

    // Проверка роли (только ADMIN и SUPERADMIN)
    const roleCode = user?.role?.code
    if (!roleCode || !['SUPERADMIN', 'ADMIN'].includes(roleCode)) {
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
  } catch (error) {
    console.error('[WebScraper API] Error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Внутренняя ошибка сервера' 
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Проверка доступности сервиса
 */
export async function GET(request: NextRequest) {
  try {
    // Проверка авторизации
    try {
      await requireAuth(request)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация' },
        { status: 401 }
      )
    }

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
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Ошибка проверки' 
      },
      { status: 500 }
    )
  }
}


/**
 * Коннектор для Firecrawl API
 * Веб-скрапинг сервис для извлечения структурированных данных
 * 
 * @module modules/settings/services/connectors/FirecrawlConnector
 * @see https://docs.firecrawl.dev/
 */

import type { ServiceConfigurationModel, ConnectionTestResult } from '@/lib/config/types'
import { BaseConnector } from './BaseConnector'
import { safeDecrypt } from '@/lib/config/encryption'

/**
 * Коннектор для тестирования и работы с Firecrawl API
 */
export class FirecrawlConnector extends BaseConnector {
  private apiKey: string | null = null

  constructor(config: ServiceConfigurationModel) {
    super(config)
    // API ключ хранится в поле token (зашифрованный)
    if (config.token) {
      this.apiKey = safeDecrypt(config.token)
    }
  }

  /**
   * Получить базовый URL API
   */
  private getApiUrl(): string {
    const protocol = this.config.protocol || 'https://'
    const host = this.config.host || 'api.firecrawl.dev'
    const port = this.config.port && this.config.port !== 443 ? `:${this.config.port}` : ''
    const basePath = this.config.basePath || '/v1'

    return `${protocol}${host}${port}${basePath}`
  }

  /**
   * Тестировать подключение к Firecrawl API
   * Проверяет валидность API ключа через эндпоинт /scrape (dry run)
   */
  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'API ключ не настроен. Добавьте ключ в поле "API Token".'
      }
    }

    try {
      const { result, latency } = await this.measureLatency(async () => {
        const response = await fetch(`${this.getApiUrl()}/scrape`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            url: 'https://example.com',
            formats: ['markdown'],
            onlyMainContent: true,
            timeout: 10000
          })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          
          if (response.status === 401) {
            throw new Error('Неверный API ключ')
          }
          if (response.status === 402) {
            throw new Error('Недостаточно кредитов на аккаунте Firecrawl')
          }
          if (response.status === 429) {
            throw new Error('Превышен лимит запросов')
          }
          
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        return response.json()
      })

      return {
        success: true,
        latency,
        version: 'v1',
        details: {
          apiUrl: this.getApiUrl(),
          testUrl: 'https://example.com',
          response: result.success ? 'OK' : 'Partial'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        details: {
          apiUrl: this.getApiUrl()
        }
      }
    }
  }

  /**
   * Получить API клиент (API ключ)
   */
  getClient(): { apiKey: string; apiUrl: string } | null {
    if (!this.apiKey) return null

    return {
      apiKey: this.apiKey,
      apiUrl: this.getApiUrl()
    }
  }

  /**
   * Отключиться (не требуется для HTTP API)
   */
  async disconnect(): Promise<void> {
    // HTTP API не требует явного отключения
    this.apiKey = null
  }

  /**
   * Выполнить scrape одной страницы
   */
  async scrape(url: string, options?: {
    formats?: ('markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot')[]
    onlyMainContent?: boolean
    includeTags?: string[]
    excludeTags?: string[]
    timeout?: number
    waitFor?: number
  }): Promise<{
    success: boolean
    data?: {
      markdown?: string
      html?: string
      rawHtml?: string
      links?: string[]
      screenshot?: string
      metadata?: {
        title?: string
        description?: string
        language?: string
        ogTitle?: string
        ogDescription?: string
        ogImage?: string
      }
    }
    error?: string
  }> {
    if (!this.apiKey) {
      return { success: false, error: 'API ключ не настроен' }
    }

    try {
      const response = await fetch(`${this.getApiUrl()}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          url,
          formats: options?.formats || ['markdown'],
          onlyMainContent: options?.onlyMainContent ?? true,
          includeTags: options?.includeTags,
          excludeTags: options?.excludeTags,
          timeout: options?.timeout || 30000,
          waitFor: options?.waitFor
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`
        }
      }

      const result = await response.json()
      
      return {
        success: result.success,
        data: result.data,
        error: result.error
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка запроса'
      }
    }
  }

  /**
   * Выполнить crawl сайта (обход нескольких страниц)
   */
  async crawl(url: string, options?: {
    limit?: number
    maxDepth?: number
    includePaths?: string[]
    excludePaths?: string[]
    allowBackwardLinks?: boolean
    allowExternalLinks?: boolean
  }): Promise<{
    success: boolean
    jobId?: string
    error?: string
  }> {
    if (!this.apiKey) {
      return { success: false, error: 'API ключ не настроен' }
    }

    try {
      const response = await fetch(`${this.getApiUrl()}/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          url,
          limit: options?.limit || 10,
          maxDepth: options?.maxDepth || 2,
          includePaths: options?.includePaths,
          excludePaths: options?.excludePaths,
          allowBackwardLinks: options?.allowBackwardLinks ?? false,
          allowExternalLinks: options?.allowExternalLinks ?? false
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`
        }
      }

      const result = await response.json()
      
      return {
        success: result.success,
        jobId: result.id,
        error: result.error
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка запроса'
      }
    }
  }

  /**
   * Получить статус crawl задачи
   */
  async getCrawlStatus(jobId: string): Promise<{
    success: boolean
    status?: 'scraping' | 'completed' | 'failed'
    completed?: number
    total?: number
    data?: Array<{
      markdown?: string
      metadata?: Record<string, unknown>
    }>
    error?: string
  }> {
    if (!this.apiKey) {
      return { success: false, error: 'API ключ не настроен' }
    }

    try {
      const response = await fetch(`${this.getApiUrl()}/crawl/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`
        }
      }

      const result = await response.json()
      
      return {
        success: true,
        status: result.status,
        completed: result.completed,
        total: result.total,
        data: result.data,
        error: result.error
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка запроса'
      }
    }
  }

  /**
   * Извлечь структурированные данные с помощью LLM
   */
  async extract(urls: string[], options: {
    prompt?: string
    schema?: Record<string, unknown>
    systemPrompt?: string
  }): Promise<{
    success: boolean
    data?: Record<string, unknown>
    error?: string
  }> {
    if (!this.apiKey) {
      return { success: false, error: 'API ключ не настроен' }
    }

    try {
      const response = await fetch(`${this.getApiUrl()}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          urls,
          prompt: options.prompt,
          schema: options.schema,
          systemPrompt: options.systemPrompt
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`
        }
      }

      const result = await response.json()
      
      return {
        success: result.success,
        data: result.data,
        error: result.error
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка запроса'
      }
    }
  }
}





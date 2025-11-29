/**
 * Сервис для парсинга веб-сайтов и извлечения данных о компаниях
 * Использует Firecrawl API для скрапинга и LLM для структурирования данных
 * 
 * @module services/web-scraper/WebScraperService
 */

import { prisma } from '@/libs/prisma'
import { FirecrawlConnector } from '@/modules/settings/services/connectors/FirecrawlConnector'
import { safeDecrypt } from '@/lib/config/encryption'
import type { ServiceConfigurationModel } from '@/lib/config/types'
import type { 
  ScrapedCompanyData, 
  ScrapeOptions, 
  ScrapeResult,
  TextAnalysis,
  PhoneContact,
  EmailContact
} from './types'
import { 
  COMPANY_EXTRACTION_SCHEMA, 
  COMPANY_EXTRACTION_PROMPT 
} from './types'
import { getTextAnalysisService } from './TextAnalysisService'

/**
 * Получить активную конфигурацию Firecrawl
 */
async function getFirecrawlConfig(): Promise<ServiceConfigurationModel | null> {
  const config = await prisma.serviceConfiguration.findFirst({
    where: {
      type: 'FIRECRAWL',
      enabled: true
    }
  })

  return config as ServiceConfigurationModel | null
}

/**
 * Класс сервиса для парсинга веб-сайтов
 */
class WebScraperService {
  private connector: FirecrawlConnector | null = null
  private firecrawlAvailable: boolean | null = null

  /**
   * Проверить доступность Firecrawl
   */
  private async isFirecrawlAvailable(): Promise<boolean> {
    if (this.firecrawlAvailable !== null) {
      return this.firecrawlAvailable
    }

    const config = await getFirecrawlConfig()
    this.firecrawlAvailable = !!config
    return this.firecrawlAvailable
  }

  /**
   * Инициализировать коннектор Firecrawl (если доступен)
   */
  private async getConnector(): Promise<FirecrawlConnector | null> {
    if (this.connector) {
      return this.connector
    }

    const config = await getFirecrawlConfig()
    
    if (!config) {
      return null
    }

    this.connector = new FirecrawlConnector(config)
    return this.connector
  }

  /**
   * Получить HTML страницы через native fetch (без Firecrawl)
   */
  private async fetchPageNative(url: string): Promise<{ html: string; error?: string }> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        }
      })

      clearTimeout(timeout)

      if (!response.ok) {
        return { html: '', error: `HTTP ${response.status}` }
      }

      const html = await response.text()
      return { html }
    } catch (error) {
      return { 
        html: '', 
        error: error instanceof Error ? error.message : 'Ошибка загрузки' 
      }
    }
  }

  /**
   * Извлечь метаданные из HTML
   */
  private extractMetadata(html: string): Record<string, unknown> {
    const metadata: Record<string, unknown> = {}
    
    // Title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) metadata.title = titleMatch[1].trim()
    
    // Meta description
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    if (descMatch) metadata.description = descMatch[1]
    
    // OG tags
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    if (ogTitleMatch) metadata.ogTitle = ogTitleMatch[1]
    
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    if (ogDescMatch) metadata.ogDescription = ogDescMatch[1]
    
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    if (ogImageMatch) metadata.ogImage = ogImageMatch[1]
    
    return metadata
  }

  /**
   * Извлечь все ссылки из HTML
   */
  private extractAllLinks(html: string, baseUrl: string): string[] {
    const links: string[] = []
    const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
    
    let match
    while ((match = linkPattern.exec(html)) !== null) {
      let href = match[1]
      
      if (href.startsWith('#') || href.startsWith('javascript:') || 
          href.startsWith('mailto:') || href.startsWith('tel:')) {
        continue
      }
      
      // Нормализуем URL
      if (href.startsWith('/')) {
        href = baseUrl + href
      } else if (!href.startsWith('http')) {
        href = baseUrl + '/' + href
      }
      
      if (href.startsWith(baseUrl)) {
        links.push(href)
      }
    }
    
    return Array.from(new Set(links))
  }

  /**
   * Парсить сайт и извлечь данные о компании
   * Использует умный двухэтапный подход:
   * 1. Сначала парсим главную и получаем все ссылки
   * 2. Фильтруем по ключевым словам и парсим только релевантные страницы
   * 
   * Работает в двух режимах:
   * - С Firecrawl API (если настроен) - лучше для SPA сайтов
   * - Native fetch (без API) - для обычных сайтов
   */
  async scrapeWebsite(url: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    const startTime = Date.now()

    try {
      // Валидация URL
      const parsedUrl = new URL(url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('URL должен начинаться с http:// или https://')
      }

      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`
      
      // Проверяем доступность Firecrawl
      const connector = await this.getConnector()
      
      if (!connector) {
        // Режим без Firecrawl - используем native fetch
        console.log(`[WebScraper] Firecrawl не настроен, используем native fetch`)
        return await this.scrapeWithNativeFetch(url, baseUrl, startTime, options)
      }
      
      console.log(`[WebScraper] Используем Firecrawl API`)

      // ЭТАП 1: Парсим главную страницу и получаем HTML для извлечения навигации
      console.log(`[WebScraper] Этап 1: Парсим главную страницу...`)
      
      const mainPageResult = await connector.scrape(url, {
        formats: ['markdown', 'links', 'rawHtml'],
        onlyMainContent: false, // Нужен весь контент включая header и footer
        timeout: 30000
      })

      if (!mainPageResult.success || !mainPageResult.data) {
        console.log(`[WebScraper] Не удалось получить главную страницу, используем fallback`)
        return await this.scrapeWithFallback(url, connector, startTime, options)
      }

      // Собираем URL для парсинга
      const urlsToScrape = [url]
      
      if (options?.enableCrawl !== false) {
        // ЭТАП 2: Извлекаем ссылки из навигации (header, nav, footer)
        let links: string[] = mainPageResult.data.links || []
        
        // Если есть HTML, извлекаем ссылки из навигационных элементов
        const rawHtml = mainPageResult.data.rawHtml || ''
        if (rawHtml) {
          const navLinks = this.extractNavigationLinks(rawHtml, baseUrl)
          console.log(`[WebScraper] Извлечено ${navLinks.length} ссылок из навигации`)
          // Приоритет ссылкам из навигации
          links = Array.from(new Set([...navLinks, ...links]))
        }
        
        console.log(`[WebScraper] Всего ${links.length} ссылок для анализа`)
        
        // Ключевые слова для поиска важных страниц
        const keywords = [
          // Контакты
          'contact', 'kontakt', 'контакт', 'связь', 'svyaz', 'обратн',
          // О компании  
          'about', 'o-nas', 'о-нас', 'компани', 'company', 'who-we',
          // Услуги
          'service', 'uslug', 'услуг', 'catalog', 'katalog', 'каталог',
          'product', 'tovar', 'товар', 'price', 'прайс', 'цен',
          // Доставка
          'deliver', 'dostav', 'доставк', 'shipping',
          // Оплата
          'payment', 'oplat', 'оплат', 'pay'
        ]
        
        // Фильтруем ссылки
        const relevantLinks = links.filter((link: string) => {
          // Только ссылки с того же домена
          if (!link.startsWith(baseUrl) && !link.startsWith('/')) return false
          
          const lowerLink = link.toLowerCase()
          
          // Исключаем ненужные страницы
          if (lowerLink.includes('login') || lowerLink.includes('register') ||
              lowerLink.includes('cart') || lowerLink.includes('checkout') ||
              lowerLink.includes('admin') || lowerLink.includes('account') ||
              lowerLink.match(/\.(jpg|png|gif|pdf|doc|zip)$/i)) {
            return false
          }
          
          // Проверяем наличие ключевых слов
          return keywords.some(kw => lowerLink.includes(kw))
        })
        
        // Нормализуем и добавляем ссылки
        for (const link of relevantLinks) {
          const fullUrl = link.startsWith('/') ? `${baseUrl}${link}` : link
          if (!urlsToScrape.includes(fullUrl)) {
            urlsToScrape.push(fullUrl)
          }
        }
        
        // Если не нашли ссылок по ключевым словам, добавляем стандартные пути
        if (urlsToScrape.length === 1) {
          console.log(`[WebScraper] Релевантные ссылки не найдены, добавляем стандартные пути`)
          const fallbackPaths = ['/contacts', '/contact', '/kontakty', '/about', '/o-nas', '/services', '/uslugi']
          for (const path of fallbackPaths) {
            urlsToScrape.push(`${baseUrl}${path}`)
          }
        }
        
        console.log(`[WebScraper] Этап 2: Найдено ${urlsToScrape.length - 1} релевантных страниц:`, 
          urlsToScrape.slice(1, 6).map(u => u.replace(baseUrl, '')))
      }

      // ЭТАП 3: Извлекаем данные со всех страниц
      const pagesToParse = urlsToScrape.slice(0, options?.maxPages || 5)
      console.log(`[WebScraper] Этап 3: Извлекаем данные с ${pagesToParse.length} страниц...`)
      
      const extractResult = await connector.extract(pagesToParse, {
        prompt: COMPANY_EXTRACTION_PROMPT,
        schema: COMPANY_EXTRACTION_SCHEMA,
        systemPrompt: 'Ты - помощник для извлечения структурированной информации о компаниях с веб-сайтов. Извлекай только достоверную информацию, найденную на странице.'
      })

      if (!extractResult.success || !extractResult.data) {
        // Fallback: используем обычный scrape + парсинг ВСЕХ найденных страниц
        console.log(`[WebScraper] Extract API не удался (${extractResult.error}), используем fallback парсинг`)
        return await this.scrapeWithFallbackMultiPage(pagesToParse, connector, startTime, options)
      }

      // Преобразуем результат в ScrapedCompanyData
      const rawData = extractResult.data as Record<string, unknown>
      const companyData = this.normalizeCompanyData(rawData || {}, url)
      
      console.log(`[WebScraper] Успешно! Найдено: ${companyData.phones.length} телефонов, ${companyData.emails.length} email, категория: ${companyData.category || 'не определена'}`)
      
      // Анализ текста (TF-IDF, леммы)
      let textAnalysis: TextAnalysis | undefined
      try {
        const analysisService = getTextAnalysisService()
        textAnalysis = await analysisService.analyzeText(mainPageResult.data?.rawHtml || '')
        
        // Если категория не определена Extract API, берём из анализа
        if (!companyData.category && textAnalysis.suggestedCategory) {
          companyData.category = textAnalysis.suggestedCategory
        }
      } catch (analysisError) {
        console.log(`[WebScraper] Ошибка анализа текста:`, analysisError)
      }
      
      return {
        success: true,
        data: companyData,
        duration: Date.now() - startTime,
        pagesScraped: pagesToParse.length,
        textAnalysis
      }
    } catch (error) {
      console.error(`[WebScraper] Ошибка:`, error)
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * Парсинг без Firecrawl - через native fetch
   * Работает для обычных сайтов (не SPA)
   */
  private async scrapeWithNativeFetch(
    url: string,
    baseUrl: string,
    startTime: number,
    options?: ScrapeOptions
  ): Promise<ScrapeResult> {
    console.log(`[WebScraper] Native: парсим главную страницу...`)
    
    // Парсим главную страницу
    const mainPage = await this.fetchPageNative(url)
    
    if (!mainPage.html) {
      return {
        success: false,
        data: null,
        error: mainPage.error || 'Не удалось загрузить страницу',
        duration: Date.now() - startTime
      }
    }

    // Собираем страницы для парсинга
    const urlsToScrape = [url]
    
    if (options?.enableCrawl !== false) {
      // Извлекаем ссылки из навигации
      const navLinks = this.extractNavigationLinks(mainPage.html, baseUrl)
      const allLinks = this.extractAllLinks(mainPage.html, baseUrl)
      const links = Array.from(new Set([...navLinks, ...allLinks]))
      
      console.log(`[WebScraper] Native: найдено ${links.length} ссылок`)
      
      // Фильтруем по ключевым словам
      const keywords = [
        'contact', 'kontakt', 'контакт', 'связь', 'svyaz',
        'about', 'o-nas', 'о-нас', 'компани', 'company',
        'service', 'uslug', 'услуг', 'catalog', 'katalog',
        'deliver', 'dostav', 'доставк', 'payment', 'oplat'
      ]
      
      const relevantLinks = links.filter(link => {
        const lowerLink = link.toLowerCase()
        if (lowerLink.includes('login') || lowerLink.includes('cart') || 
            lowerLink.includes('admin') || lowerLink.match(/\.(jpg|png|pdf)$/i)) {
          return false
        }
        return keywords.some(kw => lowerLink.includes(kw))
      })
      
      for (const link of relevantLinks) {
        if (!urlsToScrape.includes(link)) {
          urlsToScrape.push(link)
        }
      }
      
      // Если ничего не нашли - добавляем стандартные пути
      if (urlsToScrape.length === 1) {
        const fallbackPaths = ['/contacts', '/kontakty', '/about', '/o-nas', '/service', '/services', '/uslugi']
        for (const path of fallbackPaths) {
          urlsToScrape.push(`${baseUrl}${path}`)
        }
      }
      
      console.log(`[WebScraper] Native: будем парсить ${urlsToScrape.length} страниц`)
    }

    // Парсим все страницы
    const pagesToParse = urlsToScrape.slice(0, options?.maxPages || 5)
    let allHtml = mainPage.html
    let successCount = 1
    
    for (let i = 1; i < pagesToParse.length; i++) {
      const pageUrl = pagesToParse[i]
      console.log(`[WebScraper] Native: парсим ${pageUrl.replace(baseUrl, '')}`)
      
      const page = await this.fetchPageNative(pageUrl)
      if (page.html) {
        allHtml += '\n\n' + page.html
        successCount++
      }
    }
    
    console.log(`[WebScraper] Native: успешно спарсено ${successCount}/${pagesToParse.length} страниц`)

    // Извлекаем данные
    const metadata = this.extractMetadata(mainPage.html)
    const companyData = this.parseCompanyDataFromContent('', allHtml, metadata, url)
    
    console.log(`[WebScraper] Native: найдено ${companyData.phones.length} телефонов, ${companyData.emails.length} email`)

    // Анализ текста (TF-IDF, леммы)
    let textAnalysis: TextAnalysis | undefined
    try {
      const analysisService = getTextAnalysisService()
      textAnalysis = await analysisService.analyzeText(allHtml)
      
      // Улучшаем категорию из анализа
      // Если категория пустая или явно неправильная (не соответствует контенту) - берём из анализа
      if (textAnalysis.suggestedCategory) {
        if (!companyData.category) {
          companyData.category = textAnalysis.suggestedCategory
        } else {
          // Проверяем, соответствует ли текущая категория контенту
          // Игнорируем общие слова типа "магазин", "салон", "центр"
          const genericWords = ['магазин', 'салон', 'центр', 'компания', 'фирма', 'услуги', 'сервис']
          const currentCategoryKeywords = companyData.category.toLowerCase().split(/\s+/)
            .filter(kw => kw.length > 3 && !genericWords.includes(kw))
          
          const contentLower = allHtml.toLowerCase()
          
          // Все специфичные слова категории должны быть в контенте
          const categoryMatchesContent = currentCategoryKeywords.length > 0 && 
            currentCategoryKeywords.every(kw => contentLower.includes(kw))
          
          if (!categoryMatchesContent) {
            console.log(`[WebScraper] Категория "${companyData.category}" не соответствует контенту, заменяем на "${textAnalysis.suggestedCategory}"`)
            companyData.category = textAnalysis.suggestedCategory
          }
        }
      }
      
      // Добавляем продукты/услуги из анализа
      if (companyData.services.length === 0 && textAnalysis.entities.products.length > 0) {
        companyData.services = textAnalysis.entities.products
      }
    } catch (analysisError) {
      console.log(`[WebScraper] Ошибка анализа текста:`, analysisError)
    }

    return {
      success: true,
      data: companyData,
      rawHtml: allHtml,
      duration: Date.now() - startTime,
      pagesScraped: successCount,
      textAnalysis
    }
  }

  /**
   * Fallback парсинг через обычный scrape (одна страница)
   */
  private async scrapeWithFallback(
    url: string, 
    connector: FirecrawlConnector, 
    startTime: number,
    options?: ScrapeOptions
  ): Promise<ScrapeResult> {
    return this.scrapeWithFallbackMultiPage([url], connector, startTime, options)
  }

  /**
   * Fallback парсинг нескольких страниц с объединением результатов
   */
  private async scrapeWithFallbackMultiPage(
    urls: string[], 
    connector: FirecrawlConnector, 
    startTime: number,
    options?: ScrapeOptions
  ): Promise<ScrapeResult> {
    console.log(`[WebScraper] Fallback: парсим ${urls.length} страниц...`)
    
    // Собираем данные со всех страниц
    let allMarkdown = ''
    let allHtml = ''
    let metadata: Record<string, unknown> = {}
    let successCount = 0
    
    for (const url of urls) {
      try {
        console.log(`[WebScraper] Fallback: парсим ${url}`)
        const scrapeResult = await connector.scrape(url, {
          formats: ['markdown', 'html'],
          onlyMainContent: false, // Берём весь контент включая контакты в футере
          timeout: options?.timeout || 30000
        })

        if (scrapeResult.success && scrapeResult.data) {
          allMarkdown += '\n\n' + (scrapeResult.data.markdown || '')
          allHtml += '\n\n' + (scrapeResult.data.html || '')
          
          // Берём metadata с первой успешной страницы
          if (!metadata.title && scrapeResult.data.metadata) {
            metadata = scrapeResult.data.metadata
          }
          successCount++
        }
      } catch (error) {
        console.log(`[WebScraper] Fallback: ошибка парсинга ${url}:`, error)
      }
    }

    if (successCount === 0) {
      return {
        success: false,
        data: null,
        error: 'Не удалось получить контент ни с одной страницы',
        duration: Date.now() - startTime
      }
    }

    console.log(`[WebScraper] Fallback: успешно спарсено ${successCount}/${urls.length} страниц`)

    // Парсим данные из объединённого контента
    const companyData = this.parseCompanyDataFromContent(allMarkdown, allHtml, metadata, urls[0])
    
    console.log(`[WebScraper] Fallback результат: ${companyData.phones.length} телефонов, ${companyData.emails.length} email`)

    // Анализ текста (TF-IDF, леммы)
    let textAnalysis: TextAnalysis | undefined
    try {
      const analysisService = getTextAnalysisService()
      textAnalysis = await analysisService.analyzeText(allMarkdown + ' ' + allHtml)
      
      // Улучшаем категорию из анализа
      if (textAnalysis.suggestedCategory) {
        if (!companyData.category) {
          companyData.category = textAnalysis.suggestedCategory
        } else {
          // Проверяем, соответствует ли текущая категория контенту
          // Игнорируем общие слова типа "магазин", "салон", "центр"
          const genericWords = ['магазин', 'салон', 'центр', 'компания', 'фирма', 'услуги', 'сервис']
          const currentCategoryKeywords = companyData.category.toLowerCase().split(/\s+/)
            .filter(kw => kw.length > 3 && !genericWords.includes(kw))
          
          const contentLower = (allMarkdown + ' ' + allHtml).toLowerCase()
          
          // Все специфичные слова категории должны быть в контенте
          const categoryMatchesContent = currentCategoryKeywords.length > 0 && 
            currentCategoryKeywords.every(kw => contentLower.includes(kw))
          
          if (!categoryMatchesContent) {
            console.log(`[WebScraper] Категория "${companyData.category}" не соответствует контенту, заменяем на "${textAnalysis.suggestedCategory}"`)
            companyData.category = textAnalysis.suggestedCategory
          }
        }
      }
      
      // Добавляем продукты/услуги из анализа
      if (companyData.services.length === 0 && textAnalysis.entities.products.length > 0) {
        companyData.services = textAnalysis.entities.products
      }
    } catch (analysisError) {
      console.log(`[WebScraper] Ошибка анализа текста:`, analysisError)
    }

    return {
      success: true,
      data: companyData,
      rawMarkdown: allMarkdown,
      rawHtml: allHtml,
      duration: Date.now() - startTime,
      pagesScraped: successCount,
      textAnalysis
    }
  }

  /**
   * Извлечение ссылок из навигационных элементов HTML (header, nav, footer)
   */
  private extractNavigationLinks(html: string, baseUrl: string): string[] {
    const links: string[] = []
    
    // Регулярные выражения для поиска навигационных блоков
    const navPatterns = [
      /<header[^>]*>([\s\S]*?)<\/header>/gi,
      /<nav[^>]*>([\s\S]*?)<\/nav>/gi,
      /<footer[^>]*>([\s\S]*?)<\/footer>/gi,
      /<div[^>]*class="[^"]*(?:menu|nav|header|footer)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<ul[^>]*class="[^"]*(?:menu|nav)[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi
    ]
    
    // Собираем контент из навигационных блоков
    let navContent = ''
    for (const pattern of navPatterns) {
      let match
      while ((match = pattern.exec(html)) !== null) {
        navContent += match[1] + ' '
      }
    }
    
    // Если навигационные блоки не найдены, берём первые 20% HTML (обычно там header)
    if (!navContent) {
      const htmlLength = html.length
      navContent = html.substring(0, Math.floor(htmlLength * 0.2))
      // И последние 10% (footer)
      navContent += html.substring(Math.floor(htmlLength * 0.9))
    }
    
    // Извлекаем все ссылки из навигационного контента
    const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
    let linkMatch
    while ((linkMatch = linkPattern.exec(navContent)) !== null) {
      let href = linkMatch[1]
      
      // Пропускаем якоря и javascript
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        continue
      }
      
      // Нормализуем URL
      if (href.startsWith('/')) {
        href = baseUrl + href
      } else if (!href.startsWith('http')) {
        href = baseUrl + '/' + href
      }
      
      // Только ссылки с того же домена
      if (href.startsWith(baseUrl)) {
        links.push(href)
      }
    }
    
    return Array.from(new Set(links)) // Убираем дубликаты
  }

  /**
   * Парсинг данных из контента страницы
   */
  private parseCompanyDataFromContent(
    markdown: string,
    html: string,
    metadata: Record<string, unknown>,
    sourceUrl: string
  ): ScrapedCompanyData {
    const content = markdown + ' ' + html
    
    // Извлекаем филиалы
    const branches = this.extractBranches(html)
    
    // Собираем телефоны филиалов для исключения из общего списка
    const branchPhoneNumbers = new Set<string>()
    branches.forEach(b => {
      b.phones.forEach(p => {
        // Нормализуем телефон для сравнения (только цифры)
        const normalized = p.replace(/\D/g, '')
        branchPhoneNumbers.add(normalized)
      })
    })
    
    // Извлекаем все телефоны и фильтруем телефоны филиалов
    const allPhones = this.extractPhones(content)
    const generalPhones = allPhones.filter(phone => {
      const normalized = phone.number.replace(/\D/g, '')
      return !branchPhoneNumbers.has(normalized)
    })

    return {
      name: this.extractCompanyName(metadata, content),
      description: this.extractDescription(metadata, content),
      category: this.detectCategory(metadata, content),
      phones: generalPhones.length > 0 ? generalPhones : allPhones.slice(0, 3), // Если все телефоны в филиалах - берём первые 3
      emails: this.extractEmails(content),
      address: this.extractAddress(content),
      coordinates: this.extractCoordinates(content),
      branches,
      socialLinks: this.extractSocialLinks(content),
      website: sourceUrl,
      workingHours: this.extractWorkingHours(content),
      logoUrl: this.extractLogo(html, sourceUrl),
      photos: this.extractPhotos(html, sourceUrl),
      services: this.extractServices(html),
      sourceUrl,
      scrapedAt: new Date(),
      confidence: 60 // Базовая уверенность для fallback метода
    }
  }
  
  /**
   * Извлечение филиалов из HTML
   */
  private extractBranches(html: string): ScrapedCompanyData['branches'] {
    const branches: ScrapedCompanyData['branches'] = []
    
    // Удаляем HTML теги для более простого парсинга текста
    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
    
    // Паттерн для поиска блоков филиалов
    // Ищем: г. Город ... адрес ... часы работы ... телефон
    const branchPattern = /г\.\s*([А-ЯЁа-яё\-]+(?:\s*\([^)]+\))?)[^г]*?((?:ул\.|улица|пр\.|проспект|бул\.|бульвар|пер\.|переулок)[^\d]*\d+[А-Яа-яёЁ]?(?:\s*\([^)]+\))?)[^+]*?(?:час[ыа]\s*работы|работ|график)?[:\s]*(\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2})?[^+]*?(\+7\s*[\d\s\-\(\)]{10,20})/gi
    
    let match
    while ((match = branchPattern.exec(textContent)) !== null) {
      const cityFull = match[1]?.trim()
      const city = cityFull?.replace(/\s*\([^)]+\)/, '').trim()
      const branchName = cityFull?.includes('(') ? `г. ${cityFull}` : `г. ${city}`
      let address = match[2]?.trim()
      const hours = match[3]?.trim()
      const phone = match[4]?.trim()
      
      // Убираем часы работы из адреса если они туда попали
      if (address) {
        address = address.replace(/\s*(?:Пн|Вт|Ср|Чт|Пт|Сб|Вс|пн|вт|ср|чт|пт|сб|вс)[.\-:].*/gi, '').trim()
        address = address.replace(/\s*\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}.*/gi, '').trim()
      }
      
      if (address && address.length > 5) {
        const exists = branches.some(b => 
          b.address.toLowerCase().includes(address!.toLowerCase().slice(0, 15))
        )
        
        if (!exists) {
          branches.push({
            name: branchName,
            address: address,
            city: city || undefined,
            phones: phone ? [this.formatPhone(phone)] : [],
            workingHours: hours ? { note: hours.replace(/\./g, ':') } : undefined,
            type: 'store'
          })
        }
      }
    }
    
    // Если не нашли с паттерном 1, пробуем упрощённый
    if (branches.length === 0) {
      const simplePattern = /г\.\s*([А-ЯЁа-яё\-]+)[^г]*?((?:ул\.|пр\.|бул\.)[^+]{5,80})(\+7\s*[\d\s\-\(\)]+)/gi
      
      while ((match = simplePattern.exec(textContent)) !== null) {
        const city = match[1]?.trim()
        let address = match[2]?.trim()
        const phone = match[3]?.trim()
        
        // Убираем часы работы из адреса
        if (address) {
          address = address.replace(/\s*(?:Пн|Вт|Ср|Чт|Пт|Сб|Вс)[.\-:].*/gi, '').trim()
          address = address.replace(/\s*\d{1,2}[:.]\d{2}\s*[-–].*/gi, '').trim()
        }
        
        if (address && address.length > 3) {
          const exists = branches.some(b => 
            b.address.toLowerCase().includes(address!.toLowerCase().slice(0, 10))
          )
          
          if (!exists) {
            branches.push({
              name: `г. ${city}`,
              address: address,
              city: city || undefined,
              phones: phone ? [this.formatPhone(phone)] : [],
              type: 'store'
            })
          }
        }
      }
    }
    
    // Дополнительный поиск часов работы для филиалов без них
    for (const branch of branches) {
      if (!branch.workingHours && branch.address) {
        // Ищем часы работы рядом с адресом в исходном тексте
        const addressWords = branch.address.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const hoursPattern = new RegExp(addressWords + '[^]*?(\\d{1,2}[:.:]\\d{2}\\s*[-–]\\s*\\d{1,2}[:.:]\\d{2})', 'i')
        const hoursMatch = textContent.match(hoursPattern)
        if (hoursMatch) {
          branch.workingHours = { note: hoursMatch[1].replace(/\./g, ':') }
        }
      }
    }
    
    console.log(`[WebScraper] Извлечено ${branches.length} филиалов`)
    return branches
  }
  
  /**
   * Форматирование телефона
   */
  private formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
      const d = digits.slice(1)
      return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`
    }
    return phone.trim()
  }

  /**
   * Нормализация данных от Extract API
   */
  private normalizeCompanyData(raw: Record<string, unknown> | null | undefined, sourceUrl: string): ScrapedCompanyData {
    const data = raw || {}
    
    // Нормализуем филиалы
    let branches: ScrapedCompanyData['branches'] = []
    if (Array.isArray(data.branches)) {
      branches = data.branches.map((b: Record<string, unknown>) => ({
        name: (b.name as string) || null,
        address: (b.address as string) || '',
        city: (b.city as string) || undefined,
        phones: Array.isArray(b.phones) ? b.phones.map(String) : [],
        email: (b.email as string) || undefined,
        workingHours: (b.workingHours as ScrapedCompanyData['workingHours']) || undefined,
        coordinates: b.coordinates as { lat: number; lng: number } || undefined,
        type: (b.type as 'store' | 'office' | 'warehouse' | 'service' | 'pickup' | 'other') || undefined
      })).filter(b => b.address) // Только филиалы с адресом
    }
    
    // Нормализуем телефоны в PhoneContact[]
    let phones: PhoneContact[] = []
    if (Array.isArray(data.phones)) {
      phones = data.phones.map((p: unknown) => {
        if (typeof p === 'string') {
          return { number: p }
        } else if (typeof p === 'object' && p !== null) {
          const obj = p as Record<string, unknown>
          return {
            number: String(obj.number || obj.phone || ''),
            label: obj.label ? String(obj.label) : undefined
          }
        }
        return { number: String(p) }
      }).filter(p => p.number)
    }
    
    // Нормализуем emails в EmailContact[]
    let emails: EmailContact[] = []
    if (Array.isArray(data.emails)) {
      emails = data.emails.map((e: unknown) => {
        if (typeof e === 'string') {
          return { email: e }
        } else if (typeof e === 'object' && e !== null) {
          const obj = e as Record<string, unknown>
          return {
            email: String(obj.email || obj.address || ''),
            label: obj.label ? String(obj.label) : undefined
          }
        }
        return { email: String(e) }
      }).filter(e => e.email && !e.email.startsWith('u0022'))
    }
    
    return {
      name: (data.name as string) || null,
      description: (data.description as string) || null,
      category: (data.category as string) || null,
      phones,
      emails,
      address: (data.address as string) || null,
      coordinates: data.coordinates as { lat: number; lng: number } || null,
      branches,
      socialLinks: (data.socialLinks as ScrapedCompanyData['socialLinks']) || {},
      website: sourceUrl,
      workingHours: (data.workingHours as ScrapedCompanyData['workingHours']) || null,
      logoUrl: (data.logoUrl as string) || null,
      photos: Array.isArray(data.photos) ? data.photos.map(String) : [],
      services: Array.isArray(data.services) ? data.services.map(String) : [],
      sourceUrl,
      scrapedAt: new Date(),
      confidence: 85 // Высокая уверенность для Extract API
    }
  }

  // ==================== Методы извлечения ====================

  /**
   * Автоматическое определение категории бизнеса из контента
   */
  private detectCategory(metadata: Record<string, unknown>, content: string): string | null {
    const text = `${metadata.title || ''} ${metadata.description || ''} ${content}`.toLowerCase()
    
    // Карта ключевых слов → категория
    const categoryMap: Array<{ keywords: string[]; category: string }> = [
      // Торговля
      { keywords: ['сантехник', 'сантехника', 'санфаянс', 'унитаз', 'ванн', 'смесител'], category: 'Магазин сантехники' },
      { keywords: ['цвет', 'букет', 'флорист', 'роз'], category: 'Продажа и доставка цветов' },
      { keywords: ['автошин', 'шиномонтаж', 'шины', 'колёс', 'колес', 'диск'], category: 'Автошины и диски' },
      { keywords: ['автозапчаст', 'запчаст', 'автодетал'], category: 'Автозапчасти' },
      { keywords: ['мебел', 'диван', 'кроват', 'шкаф'], category: 'Мебельный магазин' },
      { keywords: ['одежд', 'обув', 'fashion', 'бутик'], category: 'Магазин одежды' },
      { keywords: ['электроник', 'бытов', 'техник', 'телевизор', 'холодильник'], category: 'Магазин электроники' },
      { keywords: ['продукт', 'grocery', 'супермаркет', 'магазин'], category: 'Продуктовый магазин' },
      
      // Транспорт
      { keywords: ['автобус', 'пассажир', 'перевоз', 'рейс', 'маршрут'], category: 'Автобусные перевозки' },
      { keywords: ['груз', 'доставк', 'логистик', 'транспорт', 'cargo'], category: 'Грузоперевозки' },
      { keywords: ['такси', 'taxi', 'трансфер'], category: 'Такси' },
      
      // Услуги
      { keywords: ['автосервис', 'сто', 'ремонт авто', 'автомобил'], category: 'Автосервис' },
      { keywords: ['салон красот', 'парикмахер', 'маникюр', 'косметолог', 'beauty'], category: 'Салон красоты' },
      { keywords: ['стоматолог', 'зубн', 'dental', 'дентал'], category: 'Стоматология' },
      { keywords: ['юрист', 'адвокат', 'юридич', 'право'], category: 'Юридические услуги' },
      { keywords: ['фитнес', 'спортзал', 'тренажёр', 'gym', 'fitness'], category: 'Фитнес-клуб' },
      { keywords: ['клиник', 'медицин', 'врач', 'больниц', 'health'], category: 'Медицинский центр' },
      { keywords: ['строител', 'ремонт', 'отделк'], category: 'Строительство и ремонт' },
      
      // Общепит
      { keywords: ['ресторан', 'restaurant', 'кухн'], category: 'Ресторан' },
      { keywords: ['кафе', 'cafe', 'coffee', 'кофейн'], category: 'Кафе' },
      { keywords: ['пицц', 'pizza', 'пиццер'], category: 'Пиццерия' },
      { keywords: ['суши', 'sushi', 'роллы', 'японск'], category: 'Суши-бар' },
      { keywords: ['доставка еды', 'food delivery'], category: 'Доставка еды' },
      
      // Другое
      { keywords: ['отел', 'гостиниц', 'hotel', 'хостел'], category: 'Гостиница' },
      { keywords: ['турист', 'туризм', 'тур ', 'путешеств', 'travel'], category: 'Туристическое агентство' },
      { keywords: ['образован', 'школ', 'курс', 'обучен'], category: 'Образование' },
      { keywords: ['недвижимост', 'квартир', 'аренд', 'риэлтор', 'realty'], category: 'Недвижимость' },
    ]
    
    for (const { keywords, category } of categoryMap) {
      if (keywords.some(kw => text.includes(kw))) {
        return category
      }
    }
    
    return null
  }

  private extractCompanyName(metadata: Record<string, unknown>, content: string): string | null {
    // Приоритет: og:title > title > первый H1
    if (metadata.ogTitle) return String(metadata.ogTitle)
    if (metadata.title) return String(metadata.title).split('|')[0].split('-')[0].trim()
    
    const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    if (h1Match) return h1Match[1].trim()
    
    return null
  }

  private extractDescription(metadata: Record<string, unknown>, content: string): string | null {
    if (metadata.ogDescription) return String(metadata.ogDescription)
    if (metadata.description) return String(metadata.description)
    
    // Берём первые 300 символов текста
    const textOnly = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return textOnly.substring(0, 300) || null
  }

  private extractPhones(content: string): PhoneContact[] {
    const phones: PhoneContact[] = []
    const seenNumbers = new Set<string>()
    
    // Удаляем HTML теги для анализа контекста
    const textContent = content
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
    
    // Маппинг ключевых слов к label
    const labelKeywords: Array<{ keywords: string[]; label: string }> = [
      { keywords: ['корпоратив', 'corporate', 'b2b', 'юрлиц', 'организаци', 'оптов'], label: 'Корпоративный отдел' },
      { keywords: ['сервис', 'service', 'ремонт', 'repair', 'гарантий'], label: 'Сервисный центр' },
      { keywords: ['интернет-магазин', 'интернет магазин', 'online', 'онлайн', 'заказ', 'им '], label: 'Интернет-магазин' },
      { keywords: ['доставк', 'delivery', 'склад', 'warehouse'], label: 'Доставка' },
      { keywords: ['горяч', 'hotline', 'справ', 'info', 'единый'], label: 'Горячая линия' },
      { keywords: ['продаж', 'sales', 'отдел продаж'], label: 'Отдел продаж' },
      { keywords: ['поддержк', 'support', 'помощь'], label: 'Поддержка' },
      { keywords: ['бухгалтер', 'accounting', 'финанс'], label: 'Бухгалтерия' },
      { keywords: ['точка выдачи', 'самовывоз', 'pickup'], label: 'Точка выдачи' },
    ]
    
    // Функция определения label по контексту
    const detectLabel = (context: string): string | undefined => {
      const contextLower = context.toLowerCase()
      for (const { keywords, label } of labelKeywords) {
        if (keywords.some(kw => contextLower.includes(kw))) {
          return label
        }
      }
      return undefined
    }
    
    // Функция проверки валидности номера
    const isValidPhone = (normalized: string): boolean => {
      if (normalized.length < 10 || normalized.length > 15) return false
      const digits = normalized.replace(/^\+?[78]?/, '')
      if (
        digits.match(/^(\d)\1{9}$/) ||    // Все одинаковые цифры
        digits.match(/^9{10}$/) ||         // 9999999999
        digits.match(/^0{10}$/) ||         // 0000000000
        digits.match(/^1234567/) ||        // 1234567...
        digits.startsWith('999999')        // 999999...
      ) {
        return false
      }
      return true
    }
    
    // Ищем все телефоны и их позиции
    const phonePattern = /\+7\s*[\(\s]?\d{3}[\)\s]?\s*\d{3}[\s\-]?\d{2}[\s\-]?\d{2}|\+7\s*\d{3}\s*\d[\s\-]?\d{5}[\s\-]?\d/g
    let match
    
    while ((match = phonePattern.exec(textContent)) !== null) {
      const phone = match[0]
      const phoneIndex = match.index
      const normalized = phone.replace(/[^\d+]/g, '')
      
      if (!isValidPhone(normalized)) continue
      if (seenNumbers.has(normalized.replace(/\D/g, ''))) continue
      
      // Ищем контекст: 100 символов до и после телефона
      const contextBefore = textContent.slice(Math.max(0, phoneIndex - 100), phoneIndex)
      const contextAfter = textContent.slice(phoneIndex + phone.length, phoneIndex + phone.length + 50)
      
      // Определяем label
      const label = detectLabel(contextBefore) || detectLabel(contextAfter)
      
      // Форматируем номер
      const digits = normalized.replace(/^\+?[78]?/, '')
      let formattedPhone = phone.trim()
      if (digits.length === 10) {
        formattedPhone = `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`
      }
      
      phones.push({
        number: formattedPhone,
        label
      })
      seenNumbers.add(normalized.replace(/\D/g, ''))
    }

    return phones
  }

  private extractEmails(content: string): EmailContact[] {
    const emails: EmailContact[] = []
    const seenEmails = new Set<string>()
    
    // Удаляем HTML теги для анализа контекста
    const textContent = content
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
    
    // Маппинг ключевых слов к label
    const labelKeywords: Array<{ keywords: string[]; label: string }> = [
      { keywords: ['корпоратив', 'corporate', 'b2b', 'юрлиц', 'организаци', 'оптов'], label: 'Корпоративный отдел' },
      { keywords: ['сервис', 'service', 'ремонт', 'repair', 'гарантий'], label: 'Сервисный центр' },
      { keywords: ['онлайн', 'online', 'заказ', 'order', 'интернет-магазин'], label: 'Интернет-магазин' },
      { keywords: ['поддержк', 'support', 'помощь', 'help'], label: 'Поддержка' },
      { keywords: ['info', 'инфо', 'общ', 'general'], label: 'Общий' },
      { keywords: ['продаж', 'sales', 'отдел продаж'], label: 'Отдел продаж' },
      { keywords: ['бухгалтер', 'accounting', 'финанс', 'оплат'], label: 'Бухгалтерия' },
      { keywords: ['hr', 'кадр', 'работ', 'вакан', 'career', 'job'], label: 'HR / Кадры' },
      { keywords: ['рекла', 'pr', 'маркет', 'advert', 'marketing'], label: 'Маркетинг' },
      { keywords: ['директор', 'руковод', 'ceo', 'director'], label: 'Руководство' },
    ]
    
    // Функция определения label по контексту
    const detectLabel = (context: string): string | undefined => {
      const contextLower = context.toLowerCase()
      for (const { keywords, label } of labelKeywords) {
        if (keywords.some(kw => contextLower.includes(kw))) {
          return label
        }
      }
      return undefined
    }
    
    // Функция определения label по префиксу email
    const detectLabelFromEmail = (email: string): string | undefined => {
      const prefix = email.split('@')[0].toLowerCase()
      
      if (prefix.includes('info') || prefix === 'mail') return 'Общий'
      if (prefix.includes('support') || prefix.includes('help')) return 'Поддержка'
      if (prefix.includes('sales') || prefix.includes('order')) return 'Отдел продаж'
      if (prefix.includes('hr') || prefix.includes('job') || prefix.includes('career')) return 'HR / Кадры'
      if (prefix.includes('service') || prefix.includes('repair')) return 'Сервисный центр'
      if (prefix.includes('advert') || prefix.includes('market') || prefix.includes('pr')) return 'Маркетинг'
      if (prefix.includes('account') || prefix.includes('buh') || prefix.includes('finance')) return 'Бухгалтерия'
      if (prefix.includes('corporate') || prefix.includes('b2b') || prefix.includes('korporativ')) return 'Корпоративный отдел'
      if (prefix.includes('online') || prefix.includes('shop') || prefix.includes('store')) return 'Интернет-магазин'
      if (prefix.includes('director') || prefix.includes('ceo') || prefix.includes('boss')) return 'Руководство'
      
      return undefined
    }
    
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    let match
    
    while ((match = emailPattern.exec(textContent)) !== null) {
      const email = match[0].toLowerCase()
      const emailIndex = match.index
      
      // Фильтруем технические email'ы
      if (
        email.includes('example.com') ||
        email.includes('domain.com') ||
        email.includes('sentry.io') ||
        email.includes('webpack') ||
        email.startsWith('noreply@') ||
        email.startsWith('no-reply@') ||
        email.startsWith('u0022')  // Escaped quotes artifact
      ) {
        continue
      }
      
      if (seenEmails.has(email)) continue
      
      // Ищем контекст: 80 символов до и 30 после
      const contextBefore = textContent.slice(Math.max(0, emailIndex - 80), emailIndex)
      const contextAfter = textContent.slice(emailIndex + email.length, emailIndex + email.length + 30)
      
      // Определяем label: сначала по контексту, потом по префиксу email
      const label = detectLabel(contextBefore) || detectLabel(contextAfter) || detectLabelFromEmail(email)
      
      emails.push({ email, label })
      seenEmails.add(email)
    }

    return emails
  }

  private extractAddress(content: string): string | null {
    // Паттерны для российских адресов
    const addressPatterns = [
      /(?:г\.|город)\s*[А-Яа-яёЁ-]+,?\s*(?:ул\.|улица|пр\.|проспект|пер\.|переулок)\s*[А-Яа-яёЁ0-9\s,.-]+(?:д\.|дом)?\s*\d+[а-яА-Я]?/gi,
      /(?:ул\.|улица)\s*[А-Яа-яёЁ-]+,?\s*(?:д\.|дом)?\s*\d+[а-яА-Я]?/gi
    ]

    for (const pattern of addressPatterns) {
      const match = content.match(pattern)
      if (match) return match[0].trim()
    }

    return null
  }

  private extractCoordinates(content: string): { lat: number; lng: number } | null {
    // Ищем координаты в различных форматах
    const patterns = [
      /["']?lat(?:itude)?["']?\s*[:=]\s*["']?([\d.]+)["']?.*?["']?l(?:on|ng)(?:itude)?["']?\s*[:=]\s*["']?([\d.]+)["']?/i,
      /coords?\s*[:=]\s*\[?\s*([\d.]+)\s*,\s*([\d.]+)\s*\]?/i
    ]

    for (const pattern of patterns) {
      const match = content.match(pattern)
      if (match) {
        const lat = parseFloat(match[1])
        const lng = parseFloat(match[2])
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { lat, lng }
        }
      }
    }

    return null
  }

  private extractSocialLinks(content: string): ScrapedCompanyData['socialLinks'] {
    const links: ScrapedCompanyData['socialLinks'] = {}

    const patterns: [keyof typeof links, RegExp][] = [
      ['vk', /https?:\/\/(?:www\.)?vk\.com\/[a-zA-Z0-9_.-]+/gi],
      ['telegram', /https?:\/\/(?:www\.)?t(?:elegram)?\.me\/[a-zA-Z0-9_]+/gi],
      ['whatsapp', /https?:\/\/(?:www\.)?wa\.me\/\d+|whatsapp:\/\/send\?phone=\d+/gi],
      ['instagram', /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.-]+/gi],
      ['facebook', /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9_.-]+/gi],
      ['youtube', /https?:\/\/(?:www\.)?youtube\.com\/(?:channel|c|user)\/[a-zA-Z0-9_-]+/gi],
      ['tiktok', /https?:\/\/(?:www\.)?tiktok\.com\/@[a-zA-Z0-9_.-]+/gi],
      ['twitter', /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[a-zA-Z0-9_]+/gi],
      ['linkedin', /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_-]+/gi],
      ['ok', /https?:\/\/(?:www\.)?ok\.ru\/[a-zA-Z0-9_.-]+/gi]
    ]

    for (const [key, pattern] of patterns) {
      const match = content.match(pattern)
      if (match) {
        links[key] = match[0]
      }
    }

    return links
  }

  private extractWorkingHours(content: string): ScrapedCompanyData['workingHours'] | null {
    // Базовый паттерн для времени работы
    const timePattern = /(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/g
    const matches = content.match(timePattern)
    
    if (!matches || matches.length === 0) return null

    // Упрощённая логика - возвращаем первое найденное время как общее
    const firstTime = matches[0]
    
    return {
      mon: firstTime,
      tue: firstTime,
      wed: firstTime,
      thu: firstTime,
      fri: firstTime,
      sat: matches[1] || firstTime,
      sun: 'выходной'
    }
  }

  private extractLogo(html: string, sourceUrl: string): string | null {
    // Ищем логотип по различным паттернам
    const patterns = [
      /<img[^>]+class="[^"]*logo[^"]*"[^>]+src="([^"]+)"/i,
      /<img[^>]+id="[^"]*logo[^"]*"[^>]+src="([^"]+)"/i,
      /<img[^>]+alt="[^"]*logo[^"]*"[^>]+src="([^"]+)"/i,
      /<link[^>]+rel="icon"[^>]+href="([^"]+)"/i
    ]

    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match) {
        return this.resolveUrl(match[1], sourceUrl)
      }
    }

    return null
  }

  private extractPhotos(html: string, sourceUrl: string): string[] {
    const photos: string[] = []
    
    // Ищем все изображения
    const imgPattern = /<img[^>]+src="([^"]+)"[^>]*>/gi
    let match

    while ((match = imgPattern.exec(html)) !== null) {
      const src = match[1]
      // Фильтруем мелкие иконки и служебные изображения
      if (
        !src.includes('icon') &&
        !src.includes('logo') &&
        !src.includes('avatar') &&
        !src.includes('1x1') &&
        !src.includes('pixel') &&
        !src.endsWith('.svg') &&
        !src.endsWith('.gif')
      ) {
        const resolved = this.resolveUrl(src, sourceUrl)
        if (resolved && !photos.includes(resolved)) {
          photos.push(resolved)
        }
      }
    }

    return photos.slice(0, 10) // Лимитируем количество фото
  }

  /**
   * Извлечение услуг из HTML
   */
  private extractServices(html: string): string[] {
    const services: string[] = []
    
    // Очистка строки от HTML-мусора
    const cleanServiceText = (text: string): string => {
      return text
        .replace(/["'\\]+$/g, '')              // Кавычки в конце
        .replace(/^["'\\]+/g, '')              // Кавычки в начале
        .replace(/">/g, '')                    // HTML атрибуты
        .replace(/<[^>]+>/g, '')               // HTML теги
        .replace(/&[a-z]+;/gi, '')             // HTML entities
        .replace(/\s+/g, ' ')                  // Множественные пробелы
        .trim()
    }
    
    // Слова-мусор, которые нужно отфильтровать
    const junkPatterns = [
      /contact\./i,           // JS переменные
      /^адрес/i,              // Метки
      /^телефон/i,
      /^email/i,
      /^\d+$/,                // Только цифры
      /^['"]/,                // Начинается с кавычек (JS код)
      /\+\s*['"]$/,           // Конкатенация строк
      /^почему/i,             // "Почему обращаются..." - не услуга
      /^основные/i,           // "Основные направления..." - заголовок
      /магазин/i,             // Название магазина
      /steelsmart/i,          // Название компании
      /условия\s+гарантийного/i, // Ссылки на другие страницы
      /политика/i,
      /правила/i,
      /юридическ/i,
    ]
    
    const isJunk = (text: string): boolean => {
      const cleaned = cleanServiceText(text)
      return junkPatterns.some(p => p.test(cleaned)) || cleaned.length < 5 || cleaned.length > 80
    }
    
    let match
    
    // Паттерн 1: Списки услуг (li элементы в секциях услуг)
    const serviceBlockPattern = /(?:услуг|сервис|service)[^<]*<\/[^>]+>[\s\S]{0,500}?<(?:ul|ol)[^>]*>([\s\S]*?)<\/(?:ul|ol)>/gi
    
    while ((match = serviceBlockPattern.exec(html)) !== null) {
      const listContent = match[1]
      const liPattern = /<li[^>]*>([^<]+)<\/li>/gi
      let liMatch
      
      while ((liMatch = liPattern.exec(listContent)) !== null) {
        const service = cleanServiceText(liMatch[1])
        if (!isJunk(service) && !services.includes(service)) {
          services.push(service)
        }
      }
    }
    
    // Паттерн 2: Карточки услуг (div/article с классами service, card и т.д.)
    const cardPattern = /<(?:div|article|section)[^>]*class="[^"]*(?:service|card|item)[^"]*"[^>]*>[\s\S]*?<(?:h[2-4]|strong|b)[^>]*>([^<]{5,80})<\/(?:h[2-4]|strong|b)>/gi
    
    while ((match = cardPattern.exec(html)) !== null) {
      const title = cleanServiceText(match[1])
      if (!isJunk(title) && !title.match(/корзин|cart|login|вход|регистр/i) && !services.includes(title)) {
        services.push(title)
      }
    }
    
    // Паттерн 3: Явные услуги в тексте
    const explicitServices = [
      /подъ[её]м\s+(?:техники|товар)[^<]{0,30}/gi,
      /установка\s+(?:и\s+)?настройка[^<]{0,50}/gi,
      /(?:персональная\s+)?сборка\s+(?:компьютер|пк|pc)[^<]{0,30}/gi,
      /ремонт\s+[^<]{5,40}/gi,
      /доставка\s+(?:по\s+)?[^<]{5,40}/gi,
      /монтаж\s+[^<]{5,40}/gi,
      /(?:гарантийное\s+)?обслуживани[ея][^<]{0,30}/gi,
      /заправка\s+(?:картридж|принтер)[^<]{0,30}/gi,
      /настройка\s+(?:программ|по|оборудован)[^<]{0,30}/gi
    ]
    
    for (const pattern of explicitServices) {
      while ((match = pattern.exec(html)) !== null) {
        let service = cleanServiceText(match[0]).replace(/[;,]$/, '')
        
        // Ограничиваем длину
        if (service.length > 60) {
          service = service.slice(0, 60)
        }
        
        if (!isJunk(service) && !services.some(s => s.toLowerCase().includes(service.toLowerCase().slice(0, 20)))) {
          // Капитализируем первую букву
          services.push(service.charAt(0).toUpperCase() + service.slice(1))
        }
      }
    }
    
    // Убираем дубликаты с учётом подстрок
    const uniqueServices = services.filter((s, i, arr) => {
      const lower = s.toLowerCase()
      return !arr.some((other, j) => j !== i && other.toLowerCase().includes(lower) && other.length > s.length)
    })
    
    console.log(`[WebScraper] Извлечено ${uniqueServices.length} услуг`)
    return uniqueServices.slice(0, 15) // Лимит
  }

  private resolveUrl(url: string, base: string): string | null {
    try {
      if (url.startsWith('data:')) return null
      if (url.startsWith('//')) return 'https:' + url
      if (url.startsWith('/')) {
        const baseUrl = new URL(base)
        return `${baseUrl.protocol}//${baseUrl.host}${url}`
      }
      if (!url.startsWith('http')) {
        const baseUrl = new URL(base)
        return `${baseUrl.protocol}//${baseUrl.host}/${url}`
      }
      return url
    } catch {
      return null
    }
  }

  /**
   * Проверить доступность сервиса
   */
  async checkHealth(): Promise<{ available: boolean; mode: 'firecrawl' | 'native'; error?: string }> {
    try {
      const connector = await this.getConnector()
      
      if (!connector) {
        // Режим без Firecrawl - всегда доступен
        return {
          available: true,
          mode: 'native',
          error: undefined
        }
      }
      
      // Проверяем Firecrawl
      const result = await connector.testConnection()
      
      return {
        available: result.success,
        mode: 'firecrawl',
        error: result.error
      }
    } catch (error) {
      // Если Firecrawl недоступен - используем native режим
      return {
        available: true,
        mode: 'native',
        error: undefined
      }
    }
  }
}

// Singleton instance
let webScraperService: WebScraperService | null = null

/**
 * Получить экземпляр WebScraperService
 */
export function getWebScraperService(): WebScraperService {
  if (!webScraperService) {
    webScraperService = new WebScraperService()
  }
  return webScraperService
}

export { WebScraperService }


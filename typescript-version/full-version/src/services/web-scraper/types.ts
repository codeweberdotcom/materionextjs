/**
 * Типы для модуля Web Scraper
 * 
 * @module services/web-scraper/types
 */

/**
 * Филиал/точка продаж компании
 */
export interface CompanyBranch {
  name: string | null        // Название филиала (например: "г. Донецк (ТРЦ Донецк-Сити)")
  address: string            // Полный адрес
  city?: string              // Город
  phones: string[]           // Телефоны этого филиала
  email?: string             // Email филиала
  workingHours?: {           // Режим работы филиала
    mon?: string
    tue?: string
    wed?: string
    thu?: string
    fri?: string
    sat?: string
    sun?: string
    note?: string
  }
  coordinates?: {
    lat: number
    lng: number
  }
  type?: 'store' | 'office' | 'warehouse' | 'service' | 'pickup' | 'other' // Тип точки
}

/**
 * Телефон с описанием
 */
export interface PhoneContact {
  number: string
  label?: string  // "Корпоративный отдел", "Сервисный центр", "Интернет-магазин" и т.д.
}

/**
 * Email с описанием
 */
export interface EmailContact {
  email: string
  label?: string  // "Общий", "Поддержка", "Корпоративный отдел" и т.д.
}

/**
 * Данные извлечённой компании
 */
export interface ScrapedCompanyData {
  // Основная информация
  name: string | null
  description: string | null
  category: string | null
  
  // Контакты (общие/главный офис)
  phones: PhoneContact[]
  emails: EmailContact[]
  address: string | null
  coordinates: {
    lat: number
    lng: number
  } | null
  
  // Филиалы/точки продаж (для сетевых компаний)
  branches: CompanyBranch[]
  
  // Соцсети
  socialLinks: {
    vk?: string
    telegram?: string
    whatsapp?: string
    instagram?: string
    facebook?: string
    youtube?: string
    tiktok?: string
    twitter?: string
    linkedin?: string
    ok?: string // Одноклассники
  }
  website: string | null
  
  // Режим работы (общий/главный офис)
  workingHours: {
    mon?: string
    tue?: string
    wed?: string
    thu?: string
    fri?: string
    sat?: string
    sun?: string
    note?: string // Дополнительная информация
  } | null
  
  // Медиа
  logoUrl: string | null
  photos: string[]
  
  // Услуги и деятельность
  services: string[]
  
  // Мета
  sourceUrl: string
  scrapedAt: Date
  confidence: number // 0-100, уверенность в данных
}

/**
 * Опции парсинга
 */
export interface ScrapeOptions {
  /** Извлекать изображения */
  extractImages?: boolean
  /** Глубина обхода для crawl (1-5) */
  maxDepth?: number
  /** Таймаут в миллисекундах */
  timeout?: number
  /** CSS селектор для ожидания */
  waitForSelector?: string
  /** Включить crawl (обход нескольких страниц) */
  enableCrawl?: boolean
  /** Максимум страниц при crawl */
  maxPages?: number
  /** Дополнительные страницы для проверки */
  additionalPaths?: string[]
}

/**
 * Результат парсинга
 */
export interface ScrapeResult {
  success: boolean
  data: ScrapedCompanyData | null
  rawMarkdown?: string
  rawHtml?: string
  error?: string
  duration: number // ms
  pagesScraped?: number
  textAnalysis?: TextAnalysis // Анализ текста (леммы, TF-IDF)
}

/**
 * JSON Schema для извлечения данных через Firecrawl Extract
 */
export const COMPANY_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Название компании или организации'
    },
    description: {
      type: 'string',
      description: 'Краткое описание деятельности компании (до 300 слов)'
    },
    category: {
      type: 'string',
      description: 'Категория бизнеса. Примеры: автобусные перевозки, продажа и доставка цветов, автошины, автосервис, ресторан, кафе, магазин одежды, салон красоты, стоматология, юридические услуги, грузоперевозки, такси, туристическое агентство, фитнес-клуб, отель, магазин электроники'
    },
    phones: {
      type: 'array',
      items: { type: 'string' },
      description: 'Общие номера телефонов компании (горячая линия, call-центр)'
    },
    emails: {
      type: 'array',
      items: { type: 'string' },
      description: 'Email адреса'
    },
    address: {
      type: 'string',
      description: 'Главный/основной адрес компании'
    },
    coordinates: {
      type: 'object',
      properties: {
        lat: { type: 'number' },
        lng: { type: 'number' }
      },
      description: 'GPS координаты (если найдены)'
    },
    branches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Название филиала/магазина (например: "ТРЦ Донецк-Сити")' },
          address: { type: 'string', description: 'Полный адрес филиала' },
          city: { type: 'string', description: 'Город' },
          phones: { type: 'array', items: { type: 'string' }, description: 'Телефоны филиала' },
          email: { type: 'string', description: 'Email филиала' },
          workingHours: {
            type: 'object',
            properties: {
              mon: { type: 'string' },
              tue: { type: 'string' },
              wed: { type: 'string' },
              thu: { type: 'string' },
              fri: { type: 'string' },
              sat: { type: 'string' },
              sun: { type: 'string' },
              note: { type: 'string' }
            }
          },
          type: { type: 'string', description: 'Тип: store, office, warehouse, service, pickup' }
        },
        required: ['address']
      },
      description: 'Список филиалов/магазинов/точек выдачи (для сетевых компаний)'
    },
    socialLinks: {
      type: 'object',
      properties: {
        vk: { type: 'string' },
        telegram: { type: 'string' },
        whatsapp: { type: 'string' },
        instagram: { type: 'string' },
        facebook: { type: 'string' },
        youtube: { type: 'string' },
        tiktok: { type: 'string' },
        twitter: { type: 'string' },
        linkedin: { type: 'string' },
        ok: { type: 'string' }
      },
      description: 'Ссылки на социальные сети'
    },
    workingHours: {
      type: 'object',
      properties: {
        mon: { type: 'string' },
        tue: { type: 'string' },
        wed: { type: 'string' },
        thu: { type: 'string' },
        fri: { type: 'string' },
        sat: { type: 'string' },
        sun: { type: 'string' },
        note: { type: 'string' }
      },
      description: 'Общий режим работы компании'
    },
    logoUrl: {
      type: 'string',
      description: 'URL логотипа компании'
    },
    photos: {
      type: 'array',
      items: { type: 'string' },
      description: 'URL фотографий компании/товаров'
    },
    services: {
      type: 'array',
      items: { type: 'string' },
      description: 'Список услуг или товаров'
    }
  },
  required: ['name']
}

/**
 * Prompt для извлечения данных
 */
export const COMPANY_EXTRACTION_PROMPT = `
Извлеки полную информацию о компании с веб-страницы.

## Обязательные поля:

1. **Название компании** (name) - официальное название организации

2. **Описание** (description) - подробное описание деятельности компании:
   - Чем занимается компания
   - Основные направления работы
   - Особенности и преимущества
   Максимум 300 слов.

3. **Категория** (category) - ОДНА основная категория бизнеса.
   Примеры: магазин электроники, автобусные перевозки, магазин одежды, автосервис, салон красоты, ресторан, стоматология

4. **Услуги/товары** (services) - список основных услуг или категорий товаров

## Контактные данные:
- Телефоны (phones) - ОБЩИЕ номера (горячая линия, call-центр)
- Email (emails) - все адреса
- Адрес (address) - ГЛАВНЫЙ/основной адрес (если один)
- Координаты (coordinates) - GPS если есть

## ФИЛИАЛЫ (branches) - ВАЖНО для сетевых компаний!
Если у компании НЕСКОЛЬКО магазинов/офисов/точек - извлеки КАЖДЫЙ филиал отдельно:
- name: название филиала ("ТРЦ Донецк-Сити", "Магазин на Артёма")
- address: полный адрес
- city: город
- phones: телефоны ЭТОГО филиала
- workingHours: режим работы ЭТОГО филиала
- type: тип (store - магазин, office - офис, service - сервис, pickup - точка выдачи)

Пример структуры филиалов:
[
  { "name": "ТРЦ Донецк-Сити", "address": "ул. Артёма 130", "city": "Донецк", "phones": ["+7 949 308-03-03"], "type": "store" },
  { "name": "ТЦ Континент", "address": "ул. Первомайская 51", "city": "Донецк", "phones": ["+7 949 303-06-60"], "type": "store" }
]

## Соцсети (socialLinks):
VK, Telegram, WhatsApp, Instagram, Facebook, YouTube, TikTok, Twitter, LinkedIn, OK

## Дополнительно:
- Режим работы (workingHours) - ОБЩИЙ режим работы компании
- Логотип (logoUrl) - URL изображения
- Фото (photos) - URL фотографий

ВАЖНО: 
- Если есть несколько адресов/филиалов - обязательно извлеки их в branches!
- Для каждого филиала укажи его собственный телефон и режим работы.
`.trim()

/**
 * Результат анализа текста
 */
export interface TextAnalysis {
  // Топ ключевых слов по TF-IDF
  keywords: Array<{
    word: string
    lemma: string
    score: number
  }>
  
  // Частотный анализ (топ слов)
  frequentWords: Array<{
    word: string
    lemma: string
    count: number
  }>
  
  // Предполагаемая категория бизнеса
  suggestedCategory: string | null
  
  // Извлечённые сущности
  entities: {
    organizations: string[]
    locations: string[]
    products: string[]
  }
}

/**
 * Статус сохранённого результата
 */
export type ScrapedCompanyStatus = 'new' | 'verified' | 'rejected' | 'imported'

/**
 * Фильтры для списка результатов
 */
export interface ScrapedCompanyFilters {
  status?: ScrapedCompanyStatus
  category?: string
  search?: string
  dateFrom?: Date
  dateTo?: Date
}

/**
 * Статистика парсинга
 */
export interface ScrapeStats {
  totalRequests: number
  successfulScrapes: number
  failedScrapes: number
  averageDuration: number
  averageConfidence: number
}


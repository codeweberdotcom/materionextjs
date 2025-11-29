/**
 * Сервис анализа текста
 * - Лемматизация русского языка (Az.js)
 * - TF-IDF для выделения важных слов (собственная реализация)
 * - Частотный анализ
 * 
 * @module services/web-scraper/TextAnalysisService
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Az = require('az')

// Глобальная инициализация Az.Morph (один раз при загрузке модуля)
let globalAzInitialized = false
let globalAzInitPromise: Promise<boolean> | null = null

async function initAzMorph(): Promise<boolean> {
  if (globalAzInitialized) return true
  
  if (!globalAzInitPromise) {
    globalAzInitPromise = new Promise((resolve) => {
      try {
        console.log('[Az.Morph] Глобальная инициализация...')
        
        const timeout = setTimeout(() => {
          console.log('[Az.Morph] Таймаут инициализации')
          globalAzInitialized = false
          resolve(false)
        }, 10000)
        
        Az.Morph.init(() => {
          clearTimeout(timeout)
          
          // Тестируем после небольшой задержки (даём Az.js завершить внутреннюю инициализацию)
          setTimeout(() => {
            try {
              const test = Az.Morph('планшеты')
              if (test && test.length > 0) {
                const norm = test[0].normalize()
                console.log('[Az.Morph] Тест: планшеты →', norm?.word || 'FAIL')
                globalAzInitialized = true
                console.log('[Az.Morph] Инициализирован успешно!')
                resolve(true)
              } else {
                console.log('[Az.Morph] Тест не прошёл')
                globalAzInitialized = false
                resolve(false)
              }
            } catch (testErr) {
              console.error('[Az.Morph] Ошибка теста:', testErr)
              globalAzInitialized = false
              resolve(false)
            }
          }, 100)
        })
      } catch (err) {
        console.error('[Az.Morph] Ошибка инициализации:', err)
        globalAzInitialized = false
        resolve(false)
      }
    })
  }
  
  return globalAzInitPromise
}

/**
 * Лемматизация слова с помощью Az.js
 */
function lemmatizeWithAz(word: string): string {
  if (!globalAzInitialized) {
    return word.toLowerCase()
  }
  
  try {
    const parsed = Az.Morph(word)
    if (parsed && parsed.length > 0) {
      const firstParse = parsed[0]
      if (typeof firstParse.normalize === 'function') {
        const normalized = firstParse.normalize()
        if (normalized?.word) {
          return normalized.word.toLowerCase()
        }
      }
    }
  } catch {
    // Ошибка — возвращаем как есть
  }
  
  return word.toLowerCase()
}

/**
 * Результат анализа текста
 */
export interface TextAnalysisResult {
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
  
  // Повторяющиеся фразы из 2 слов
  frequentPhrases: Array<{
    phrase: string
    lemmaPhrase: string
    count: number
    variants: string[] // похожие варианты фразы
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
 * Стоп-слова для русского языка
 */
const STOP_WORDS_RU = new Set([
  'и', 'в', 'на', 'с', 'по', 'для', 'от', 'к', 'из', 'о', 'об', 'до', 'за', 'при',
  'не', 'что', 'как', 'это', 'все', 'он', 'она', 'они', 'мы', 'вы', 'я', 'ты',
  'а', 'но', 'или', 'если', 'то', 'же', 'бы', 'ли', 'ни', 'так', 'уже', 'еще',
  'его', 'её', 'их', 'наш', 'ваш', 'свой', 'мой', 'твой', 'который', 'какой',
  'также', 'можно', 'нужно', 'есть', 'быть', 'было', 'будет', 'были', 'более',
  'только', 'очень', 'просто', 'всего', 'того', 'этого', 'чтобы', 'после',
  'другой', 'другие', 'каждый', 'любой', 'между', 'через', 'такой', 'сейчас',
  'тут', 'там', 'здесь', 'где', 'когда', 'почему', 'как', 'сколько', 'весь',
  'под', 'над', 'без', 'про', 'ещё', 'вот', 'даже', 'www', 'http', 'https',
  'ru', 'com', 'рф', 'html', 'php', 'asp', 'page', 'index', 'главная', 'контакты',
  'new', 'the', 'and', 'for', 'you', 'are', 'this', 'that', 'with', 'your'
])

/**
 * Категории бизнеса и их ключевые слова
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Магазин сантехники': ['сантехника', 'унитаз', 'ванна', 'смеситель', 'раковина', 'душ', 'плитка', 'инсталляция'],
  'Продажа и доставка цветов': ['цветы', 'букет', 'роза', 'флорист', 'доставка цветов', 'цветок'],
  'Автобусные перевозки': ['автобус', 'перевозки', 'пассажир', 'рейс', 'маршрут', 'билет'],
  'Грузоперевозки': ['груз', 'перевозка', 'доставка', 'транспорт', 'логистика', 'фура'],
  'Автосервис': ['автосервис', 'ремонт авто', 'сто', 'шиномонтаж', 'диагностика'],
  'Автошины и диски': ['шина', 'диск', 'колесо', 'резина', 'покрышка'],
  'Ресторан': ['ресторан', 'меню', 'кухня', 'блюдо', 'повар', 'банкет'],
  'Кафе': ['кафе', 'кофе', 'завтрак', 'обед', 'десерт'],
  'Салон красоты': ['салон', 'красота', 'маникюр', 'педикюр', 'стрижка', 'парикмахер'],
  'Стоматология': ['стоматология', 'зуб', 'лечение зубов', 'имплант', 'протез'],
  'Юридические услуги': ['юрист', 'адвокат', 'право', 'консультация', 'договор'],
  'Недвижимость': ['недвижимость', 'квартира', 'дом', 'аренда', 'продажа', 'риэлтор'],
  'Строительство': ['строительство', 'ремонт', 'отделка', 'стройматериалы'],
  'Мебельный магазин': ['мебель', 'диван', 'кровать', 'шкаф', 'стол', 'стул'],
  'Магазин электроники': ['электроника', 'телефон', 'компьютер', 'ноутбук', 'телевизор'],
}


/**
 * Вычислить похожесть двух строк (0-1)
 * Использует расстояние Левенштейна
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()
  
  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0
  
  // Расстояние Левенштейна
  const matrix: number[][] = []
  
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // удаление
        matrix[i][j - 1] + 1,      // вставка
        matrix[i - 1][j - 1] + cost // замена
      )
    }
  }
  
  const distance = matrix[s1.length][s2.length]
  const maxLen = Math.max(s1.length, s2.length)
  
  return 1 - distance / maxLen
}

/**
 * Простая реализация TF-IDF
 */
class SimpleTfIdf {
  private documents: Map<string, number>[] = []
  
  addDocument(text: string): void {
    const words = text.toLowerCase().match(/[а-яёa-z]{3,}/gi) || []
    const wordCount = new Map<string, number>()
    
    for (const word of words) {
      if (!STOP_WORDS_RU.has(word)) {
        wordCount.set(word, (wordCount.get(word) || 0) + 1)
      }
    }
    
    this.documents.push(wordCount)
  }
  
  /**
   * Вычислить TF-IDF для документа
   */
  listTerms(docIndex: number): Array<{ term: string; tfidf: number }> {
    if (docIndex >= this.documents.length) return []
    
    const doc = this.documents[docIndex]
    const totalTerms = Array.from(doc.values()).reduce((a, b) => a + b, 0)
    const results: Array<{ term: string; tfidf: number }> = []
    
    doc.forEach((count, term) => {
      // TF: частота термина в документе
      const tf = count / totalTerms
      
      // IDF: log(N / df), где df - количество документов с термином
      let df = 0
      for (const d of this.documents) {
        if (d.has(term)) df++
      }
      const idf = Math.log((this.documents.length + 1) / (df + 1)) + 1
      
      results.push({
        term,
        tfidf: tf * idf
      })
    })
    
    return results.sort((a, b) => b.tfidf - a.tfidf)
  }
}

/**
 * Класс для анализа текста
 */
class TextAnalysisService {

  /**
   * Инициализация Az.js (асинхронная)
   */
  private async ensureAzInitialized(): Promise<void> {
    await initAzMorph()
  }

  /**
   * Лемматизация слова (русский язык)
   * Использует Az.js, если не работает — возвращает слово как есть
   */
  private lemmatize(word: string): string {
    return lemmatizeWithAz(word)
  }

  /**
   * Извлечь только видимый текст из HTML
   * (title, description, заголовки, параграфы, списки)
   */
  private extractVisibleText(html: string): string {
    const parts: string[] = []
    
    // 1. Title страницы
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) {
      parts.push(titleMatch[1].trim())
    }
    
    // 2. Meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    if (descMatch) {
      parts.push(descMatch[1].trim())
    }
    
    // 3. Удаляем script, style, noscript, svg, path
    let cleanHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
    
    // 4. Заголовки h1-h6
    const headingRegex = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi
    let match
    while ((match = headingRegex.exec(cleanHtml)) !== null) {
      const text = match[1].replace(/<[^>]+>/g, ' ').trim()
      if (text) parts.push(text)
    }
    
    // 5. Параграфы
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
    while ((match = pRegex.exec(cleanHtml)) !== null) {
      const text = match[1].replace(/<[^>]+>/g, ' ').trim()
      if (text && text.length > 10) parts.push(text)
    }
    
    // 6. Списки (li)
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi
    while ((match = liRegex.exec(cleanHtml)) !== null) {
      const text = match[1].replace(/<[^>]+>/g, ' ').trim()
      if (text && text.length > 3) parts.push(text)
    }
    
    // 7. Div и span с текстом (только короткие, вероятно заголовки/лейблы)
    const divRegex = /<(?:div|span)[^>]*>([^<]{10,200})<\/(?:div|span)>/gi
    while ((match = divRegex.exec(cleanHtml)) !== null) {
      const text = match[1].trim()
      if (text && !/^[\s\d.,]+$/.test(text)) parts.push(text)
    }
    
    // 8. Alt атрибуты изображений
    const altRegex = /alt=["']([^"']+)["']/gi
    while ((match = altRegex.exec(html)) !== null) {
      if (match[1].length > 3) parts.push(match[1])
    }
    
    return parts.join(' ')
  }

  /**
   * Токенизация текста
   */
  private tokenize(text: string): string[] {
    // Очищаем от HTML-сущностей
    const cleanText = text
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/&\#\d+;/gi, ' ')
      .toLowerCase()
    
    // Извлекаем слова (только кириллица и латиница)
    const words = cleanText.match(/[а-яёa-z]{3,}/gi) || []
    
    // Фильтруем стоп-слова и короткие слова
    return words.filter(word => 
      word.length >= 3 && 
      !STOP_WORDS_RU.has(word) &&
      !/^\d+$/.test(word)
    )
  }

  /**
   * Извлечение биграмм (фраз из 2 слов) из токенов
   */
  private extractBigrams(tokens: string[]): string[] {
    const bigrams: string[] = []
    
    for (let i = 0; i < tokens.length - 1; i++) {
      const word1 = tokens[i]
      const word2 = tokens[i + 1]
      
      // Пропускаем, если одно из слов - стоп-слово
      if (STOP_WORDS_RU.has(word1) || STOP_WORDS_RU.has(word2)) {
        continue
      }
      
      bigrams.push(`${word1} ${word2}`)
    }
    
    return bigrams
  }

  /**
   * Лемматизация фразы (каждое слово отдельно)
   */
  private lemmatizePhrase(phrase: string): string {
    const words = phrase.split(' ')
    const lemmatizedWords = words.map(word => this.lemmatize(word))
    return lemmatizedWords.join(' ')
  }

  /**
   * Группировка похожих фраз (>= 90% похожести)
   * Возвращает Map: ключ - каноническая фраза, значение - массив всех вариантов
   */
  private groupSimilarPhrases(
    phrases: string[],
    similarityThreshold: number = 0.9
  ): Map<string, { variants: string[]; count: number }> {
    const groups = new Map<string, { variants: string[]; count: number }>()
    const processed = new Set<number>()
    
    // Подсчитываем частоту каждой фразы
    const phraseCounts = new Map<string, number>()
    for (const phrase of phrases) {
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1)
    }
    
    const uniquePhrases = Array.from(phraseCounts.keys())
    
    for (let i = 0; i < uniquePhrases.length; i++) {
      if (processed.has(i)) continue
      
      const phrase1 = uniquePhrases[i]
      const count1 = phraseCounts.get(phrase1) || 0
      
      // Создаем группу для этой фразы
      const groupKey = phrase1
      const variants: string[] = [phrase1]
      let totalCount = count1
      
      // Ищем похожие фразы
      for (let j = i + 1; j < uniquePhrases.length; j++) {
        if (processed.has(j)) continue
        
        const phrase2 = uniquePhrases[j]
        const similarity = stringSimilarity(phrase1, phrase2)
        
        if (similarity >= similarityThreshold) {
          variants.push(phrase2)
          totalCount += phraseCounts.get(phrase2) || 0
          processed.add(j)
        }
      }
      
      if (variants.length > 0) {
        groups.set(groupKey, {
          variants: Array.from(new Set(variants)), // Убираем дубликаты
          count: totalCount
        })
      }
      
      processed.add(i)
    }
    
    return groups
  }

  /**
   * Анализ текста (HTML или plain text)
   */
  async analyzeText(html: string): Promise<TextAnalysisResult> {
    await this.ensureAzInitialized()
    
    // Извлекаем только видимый текст из HTML
    const visibleText = this.extractVisibleText(html)
    console.log(`[TextAnalysis] Извлечено ${visibleText.length} символов видимого текста`)
    
    const tokens = this.tokenize(visibleText)
    console.log(`[TextAnalysis] Токенизировано ${tokens.length} слов`)
    
    // Лемматизация
    const lemmas = new Map<string, { original: string; count: number }>()
    
    for (const token of tokens) {
      const lemma = this.lemmatize(token)
      
      if (lemmas.has(lemma)) {
        lemmas.get(lemma)!.count++
      } else {
        lemmas.set(lemma, { original: token, count: 1 })
      }
    }
    
    // Частотный анализ (топ-20 слов)
    const frequentWords = Array.from(lemmas.entries())
      .map(([lemma, data]) => ({
        word: data.original,
        lemma,
        count: data.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
    
    console.log(`[TextAnalysis] Топ леммы:`, frequentWords.slice(0, 5).map(w => `${w.lemma}(${w.count})`))
    
    // TF-IDF анализ
    const tfidf = new SimpleTfIdf()
    tfidf.addDocument(tokens.join(' '))
    
    const keywords: Array<{ word: string; lemma: string; score: number }> = []
    
    tfidf.listTerms(0).slice(0, 30).forEach((item: { term: string; tfidf: number }) => {
      const lemma = this.lemmatize(item.term)
      if (!STOP_WORDS_RU.has(lemma) && lemma.length >= 3) {
        keywords.push({
          word: item.term,
          lemma,
          score: Math.round(item.tfidf * 100) / 100
        })
      }
    })
    
    // Определение категории
    const suggestedCategory = this.detectCategory(frequentWords.map(w => w.lemma))
    
    // Извлечение сущностей (из видимого текста)
    const entities = this.extractEntities(visibleText, frequentWords)
    
    // Анализ повторяющихся фраз (биграммы)
    const bigrams = this.extractBigrams(tokens)
    console.log(`[TextAnalysis] Извлечено ${bigrams.length} биграмм`)
    
    const phraseGroups = this.groupSimilarPhrases(bigrams, 0.9)
    const frequentPhrases = Array.from(phraseGroups.entries())
      .map(([phrase, data]) => ({
        phrase,
        lemmaPhrase: this.lemmatizePhrase(phrase),
        count: data.count,
        variants: data.variants.filter(v => v !== phrase) // Убираем основную фразу из вариантов
      }))
      .filter(p => p.count >= 2) // Только фразы, встречающиеся минимум 2 раза
      .sort((a, b) => b.count - a.count)
      .slice(0, 20) // Топ-20 фраз
    
    console.log(`[TextAnalysis] Найдено ${frequentPhrases.length} повторяющихся фраз`)
    
    return {
      keywords: keywords.slice(0, 15),
      frequentWords,
      frequentPhrases,
      suggestedCategory,
      entities
    }
  }

  /**
   * Определение категории по ключевым словам
   */
  private detectCategory(lemmas: string[]): string | null {
    const lemmaArray = Array.from(new Set(lemmas.map(l => l.toLowerCase())))
    
    let bestCategory: string | null = null
    let bestScore = 0
    
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      let score = 0
      
      for (const keyword of keywords) {
        // Проверяем вхождение ключевого слова
        for (const lemma of lemmaArray) {
          if (lemma.includes(keyword) || keyword.includes(lemma)) {
            score++
          }
        }
      }
      
      if (score > bestScore) {
        bestScore = score
        bestCategory = category
      }
    }
    
    return bestScore >= 2 ? bestCategory : null
  }

  /**
   * Извлечение сущностей из текста
   */
  private extractEntities(
    text: string, 
    frequentWords: Array<{ word: string; lemma: string; count: number }>
  ): TextAnalysisResult['entities'] {
    const organizations: string[] = []
    const locations: string[] = []
    const products: string[] = []
    
    // Паттерны для организаций
    const orgPatterns = [
      /(?:ООО|ОАО|ЗАО|ИП|АО)\s*[«"]?([^»"]+)[»"]?/gi,
      /(?:компания|фирма|организация)\s+[«"]?([^»".,]+)[»"]?/gi
    ]
    
    for (const pattern of orgPatterns) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && match[1].length > 2) {
          organizations.push(match[1].trim())
        }
      }
    }
    
    // Паттерны для локаций
    const locationPatterns = [
      /(?:г\.|город|гор\.)\s*([А-ЯЁа-яё-]+)/gi,
      /(?:ул\.|улица)\s*([А-ЯЁа-яё\s]+)/gi,
      /(?:пр\.|проспект)\s*([А-ЯЁа-яё\s]+)/gi
    ]
    
    for (const pattern of locationPatterns) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && match[1].length > 2) {
          locations.push(match[1].trim())
        }
      }
    }
    
    // Продукты/услуги из частотных слов
    const serviceKeywords = ['продажа', 'услуга', 'доставка', 'ремонт', 'установка', 'монтаж']
    
    for (const word of frequentWords.slice(0, 10)) {
      const isService = serviceKeywords.some(kw => word.lemma.includes(kw))
      if (isService || word.count >= 3) {
        products.push(word.word)
      }
    }
    
    return {
      organizations: Array.from(new Set(organizations)).slice(0, 5),
      locations: Array.from(new Set(locations)).slice(0, 5),
      products: Array.from(new Set(products)).slice(0, 10)
    }
  }
}

// Singleton
let textAnalysisService: TextAnalysisService | null = null

export function getTextAnalysisService(): TextAnalysisService {
  if (!textAnalysisService) {
    textAnalysisService = new TextAnalysisService()
  }
  return textAnalysisService
}

// Запускаем инициализацию Az.Morph при загрузке модуля
initAzMorph().catch(err => {
  console.error('[Az.Morph] Ошибка при автоинициализации:', err)
})

export { TextAnalysisService, initAzMorph }

'use client'

/**
 * Страница Web Scraper - парсинг сайтов для извлечения данных о компаниях
 * 
 * @module app/[lang]/(dashboard)/admin/tools/web-scraper/page
 */

import { useState, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Grid,
  Paper,
  IconButton,
  Tooltip,
  FormControlLabel,
  Checkbox,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Link as MuiLink,
  Skeleton
} from '@mui/material'

// Icons
const iconStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }

const SearchIcon = () => <i className='ri-search-line' style={iconStyle} />
const CopyIcon = () => <i className='ri-file-copy-line' style={iconStyle} />
const PhoneIcon = () => <i className='ri-phone-line' style={iconStyle} />
const EmailIcon = () => <i className='ri-mail-line' style={iconStyle} />
const LocationIcon = () => <i className='ri-map-pin-line' style={iconStyle} />
const TimeIcon = () => <i className='ri-time-line' style={iconStyle} />
const LinkIcon = () => <i className='ri-link' style={iconStyle} />
const ImageIcon = () => <i className='ri-image-line' style={iconStyle} />
const BuildingIcon = () => <i className='ri-building-line' style={iconStyle} />
const ServiceIcon = () => <i className='ri-tools-line' style={iconStyle} />
const CheckIcon = () => <i className='ri-check-line' style={iconStyle} />
const ExpandIcon = () => <i className='ri-arrow-down-s-line' style={iconStyle} />
const CollapseIcon = () => <i className='ri-arrow-up-s-line' style={iconStyle} />
const FireIcon = () => <i className='ri-fire-line' style={iconStyle} />
const SettingsIcon = () => <i className='ri-settings-3-line' style={iconStyle} />
const BrainIcon = () => <i className='ri-brain-line' style={iconStyle} />
const TagIcon = () => <i className='ri-price-tag-3-line' style={iconStyle} />
const FileListIcon = () => <i className='ri-file-list-3-line' style={iconStyle} />

// Social icons
const VkIcon = () => <i className='ri-vk-line' style={iconStyle} />
const TelegramIcon = () => <i className='ri-telegram-line' style={iconStyle} />
const InstagramIcon = () => <i className='ri-instagram-line' style={iconStyle} />
const FacebookIcon = () => <i className='ri-facebook-line' style={iconStyle} />
const YoutubeIcon = () => <i className='ri-youtube-line' style={iconStyle} />
const TwitterIcon = () => <i className='ri-twitter-x-line' style={iconStyle} />
const WhatsappIcon = () => <i className='ri-whatsapp-line' style={iconStyle} />

// Types
interface Branch {
  name: string | null
  address: string
  city?: string
  phones: string[]
  email?: string
  workingHours?: Record<string, string>
  type?: 'store' | 'office' | 'warehouse' | 'service' | 'pickup' | 'other'
}

interface PhoneContact {
  number: string
  label?: string
}

interface EmailContact {
  email: string
  label?: string
}

interface ScrapedData {
  name: string | null
  description: string | null
  category: string | null
  phones: PhoneContact[]
  emails: EmailContact[]
  address: string | null
  coordinates: { lat: number; lng: number } | null
  branches?: Branch[]
  socialLinks: {
    vk?: string
    telegram?: string
    whatsapp?: string
    instagram?: string
    facebook?: string
    youtube?: string
    twitter?: string
  }
  website: string | null
  workingHours: Record<string, string> | null
  logoUrl: string | null
  photos: string[]
  services: string[]
  sourceUrl: string
  scrapedAt: string
  confidence: number
}

interface ScrapeOptions {
  extractImages: boolean
  enableCrawl: boolean
  maxPages: number
}

// Анализ текста
interface TextAnalysis {
  keywords: Array<{ word: string; lemma: string; score: number }>
  frequentWords: Array<{ word: string; lemma: string; count: number }>
  frequentPhrases?: Array<{
    phrase: string
    lemmaPhrase: string
    count: number
    variants: string[]
  }>
  suggestedCategory: string | null
  entities: {
    organizations: string[]
    locations: string[]
    products: string[]
  }
}

const DAYS_RU: Record<string, string> = {
  mon: 'Пн',
  tue: 'Вт',
  wed: 'Ср',
  thu: 'Чт',
  fri: 'Пт',
  sat: 'Сб',
  sun: 'Вс'
}

export default function WebScraperPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScrapedData | null>(null)
  const [textAnalysis, setTextAnalysis] = useState<TextAnalysis | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [showRawJson, setShowRawJson] = useState(false)
  const [showTextAnalysis, setShowTextAnalysis] = useState(false)
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null)
  const [serviceMode, setServiceMode] = useState<'firecrawl' | 'native' | null>(null)
  
  const [options, setOptions] = useState<ScrapeOptions>({
    extractImages: true,
    enableCrawl: true,
    maxPages: 10 // Увеличено для лучшего поиска контактов
  })

  // Проверка доступности сервиса
  const checkService = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/tools/web-scraper')
      const data = await response.json()
      setServiceAvailable(data.data?.available ?? false)
      setServiceMode(data.data?.mode || 'native')
      if (!data.data?.available) {
        setError(data.data?.error || 'Сервис недоступен')
      }
    } catch {
      setServiceAvailable(true) // Native режим всегда доступен
      setServiceMode('native')
    }
  }, [])

  // Выполнить парсинг
  const handleScrape = async () => {
    if (!url.trim()) {
      setError('Введите URL сайта')
      return
    }

    // Добавляем протокол если его нет
    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setTextAnalysis(null)
    setDuration(null)

    try {
      const response = await fetch('/api/admin/tools/web-scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: normalizedUrl,
          options
        })
      })

      const data = await response.json()

      if (!data.success) {
        setError(data.error || 'Ошибка парсинга')
        setDuration(data.duration)
        return
      }

      // Нормализуем данные (для совместимости со старым форматом)
      const normalizedData = {
        ...data.data,
        phones: Array.isArray(data.data.phones) 
          ? data.data.phones.map((p: unknown) => 
              typeof p === 'string' ? { number: p } : p
            )
          : [],
        emails: Array.isArray(data.data.emails)
          ? data.data.emails.map((e: unknown) =>
              typeof e === 'string' ? { email: e } : e
            )
          : []
      }

      setResult(normalizedData)
      setTextAnalysis(data.textAnalysis || null)
      setDuration(data.meta?.duration)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сети')
    } finally {
      setLoading(false)
    }
  }

  // Копировать JSON
  const handleCopyJson = async () => {
    if (!result) return
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Не удалось скопировать')
    }
  }

  // Рендер социальных ссылок
  const renderSocialLinks = (links: ScrapedData['socialLinks']) => {
    const socialConfig: Array<{ key: keyof typeof links; icon: React.ReactNode; label: string; color: string }> = [
      { key: 'vk', icon: <VkIcon />, label: 'VK', color: '#4C75A3' },
      { key: 'telegram', icon: <TelegramIcon />, label: 'Telegram', color: '#0088CC' },
      { key: 'whatsapp', icon: <WhatsappIcon />, label: 'WhatsApp', color: '#25D366' },
      { key: 'instagram', icon: <InstagramIcon />, label: 'Instagram', color: '#E4405F' },
      { key: 'facebook', icon: <FacebookIcon />, label: 'Facebook', color: '#1877F2' },
      { key: 'youtube', icon: <YoutubeIcon />, label: 'YouTube', color: '#FF0000' },
      { key: 'twitter', icon: <TwitterIcon />, label: 'X/Twitter', color: '#000000' }
    ]

    const availableLinks = socialConfig.filter(s => links[s.key])

    if (availableLinks.length === 0) return null

    return (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {availableLinks.map(({ key, icon, label, color }) => (
          <Chip
            key={key}
            icon={<span style={{ color }}>{icon}</span>}
            label={label}
            size='small'
            component='a'
            href={links[key]}
            target='_blank'
            rel='noopener noreferrer'
            clickable
            variant='outlined'
          />
        ))}
      </Box>
    )
  }

  // Рендер режима работы
  const renderWorkingHours = (hours: Record<string, string>) => {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 0.5 }}>
        {Object.entries(hours).map(([day, time]) => {
          if (day === 'note') return null
          return (
            <Box key={day} sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <Typography variant='body2' color='textSecondary'>{DAYS_RU[day] || day}:</Typography>
              <Typography variant='body2'>{time}</Typography>
            </Box>
          )
        })}
        {hours.note && (
          <Typography variant='caption' color='textSecondary' sx={{ gridColumn: '1 / -1', mt: 0.5 }}>
            {hours.note}
          </Typography>
        )}
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Заголовок и форма поиска */}
      <Card>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FireIcon />
              <Typography variant='h5'>Web Scraper</Typography>
              <Chip 
                label={serviceMode === 'firecrawl' ? 'Firecrawl API' : 'Native Mode'} 
                size='small' 
                color={serviceAvailable ? (serviceMode === 'firecrawl' ? 'success' : 'info') : 'default'}
                variant='outlined'
              />
            </Box>
          }
          subheader='Извлечение контактных данных и информации о компаниях с веб-сайтов'
          action={
            <Button 
              size='small' 
              onClick={checkService}
              startIcon={serviceAvailable === null ? <CircularProgress size={16} /> : <CheckIcon />}
            >
              Проверить сервис
            </Button>
          }
        />
        <CardContent>
          {error && (
            <Alert severity='error' sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              fullWidth
              label='URL сайта'
              placeholder='https://example.com'
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleScrape()}
              disabled={loading}
              InputProps={{
                startAdornment: <LinkIcon />,
              }}
            />
            <Button
              variant='contained'
              onClick={handleScrape}
              disabled={loading || !url.trim()}
              startIcon={loading ? <CircularProgress size={20} color='inherit' /> : <SearchIcon />}
              sx={{ minWidth: 140 }}
            >
              {loading ? 'Парсинг...' : 'Парсить'}
            </Button>
          </Box>

          {/* Опции */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size='small'
              startIcon={showOptions ? <CollapseIcon /> : <SettingsIcon />}
              onClick={() => setShowOptions(!showOptions)}
            >
              Настройки
            </Button>
            {duration && (
              <Chip 
                label={`${(duration / 1000).toFixed(1)}с`} 
                size='small' 
                variant='outlined'
              />
            )}
          </Box>

          <Collapse in={showOptions}>
            <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.extractImages}
                        onChange={e => setOptions(prev => ({ ...prev, extractImages: e.target.checked }))}
                      />
                    }
                    label='Извлекать изображения'
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.enableCrawl}
                        onChange={e => setOptions(prev => ({ ...prev, enableCrawl: e.target.checked }))}
                      />
                    }
                    label='Обходить страницы контактов'
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label='Макс. страниц'
                    type='number'
                    size='small'
                    value={options.maxPages}
                    onChange={e => setOptions(prev => ({ ...prev, maxPages: parseInt(e.target.value) || 5 }))}
                    inputProps={{ min: 1, max: 20 }}
                    disabled={!options.enableCrawl}
                    fullWidth
                  />
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* Результаты */}
      {loading && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Skeleton variant='text' width='60%' height={40} />
              <Skeleton variant='text' width='80%' />
              <Skeleton variant='rectangular' height={100} />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Skeleton variant='rectangular' width='50%' height={60} />
                <Skeleton variant='rectangular' width='50%' height={60} />
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader
            title={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <BuildingIcon />
                <Typography variant='h6'>{result.name || 'Без названия'}</Typography>
                {result.category && (
                  <Chip label={result.category} size='small' color='primary' variant='outlined' />
                )}
              </Box>
            }
            subheader={result.sourceUrl}
            action={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip 
                  label={`Уверенность: ${result.confidence}%`}
                  size='small'
                  color={result.confidence >= 80 ? 'success' : result.confidence >= 50 ? 'warning' : 'error'}
                />
                <Tooltip title={copied ? 'Скопировано!' : 'Копировать JSON'}>
                  <IconButton onClick={handleCopyJson}>
                    {copied ? <CheckIcon /> : <CopyIcon />}
                  </IconButton>
                </Tooltip>
              </Box>
            }
          />
          <CardContent>
            <Grid container spacing={3}>
              {/* Описание */}
              {result.description && (
                <Grid item xs={12}>
                  <Typography variant='body1' color='textSecondary'>
                    {result.description}
                  </Typography>
                </Grid>
              )}

              {/* Контакты */}
              <Grid item xs={12} md={6}>
                <Paper variant='outlined' sx={{ p: 2 }}>
                  <Typography variant='subtitle2' gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PhoneIcon /> Контакты
                  </Typography>
                  
                  {result.phones.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant='caption' color='textSecondary'>Телефоны:</Typography>
                      <List dense disablePadding>
                        {result.phones.map((phone, i) => (
                          <ListItem key={i} disablePadding sx={{ py: 0.25 }}>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <PhoneIcon />
                            </ListItemIcon>
                            <ListItemText>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <MuiLink href={`tel:${phone.number.replace(/\D/g, '')}`}>{phone.number}</MuiLink>
                                {phone.label && (
                                  <Chip label={phone.label} size='small' variant='outlined' sx={{ fontSize: '0.65rem', height: 18 }} />
                                )}
                              </Box>
                            </ListItemText>
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}

                  {result.emails.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant='caption' color='textSecondary'>Email:</Typography>
                      <List dense disablePadding>
                        {result.emails.map((emailObj, i) => (
                          <ListItem key={i} disablePadding sx={{ py: 0.25 }}>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <EmailIcon />
                            </ListItemIcon>
                            <ListItemText>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <MuiLink href={`mailto:${emailObj.email}`}>{emailObj.email}</MuiLink>
                                {emailObj.label && (
                                  <Chip label={emailObj.label} size='small' variant='outlined' color='secondary' sx={{ fontSize: '0.65rem', height: 18 }} />
                                )}
                              </Box>
                            </ListItemText>
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}

                  {result.address && (
                    <Box>
                      <Typography variant='caption' color='textSecondary'>Адрес:</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <LocationIcon />
                        <Typography variant='body2'>{result.address}</Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Филиалы */}
                  {result.branches && result.branches.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant='subtitle2' gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <i className='ri-store-2-line' style={iconStyle} /> Филиалы ({result.branches.length})
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {result.branches.map((branch, i) => (
                          <Paper 
                            key={i} 
                            variant='outlined' 
                            sx={{ p: 1.5, bgcolor: 'action.hover' }}
                          >
                            {branch.name && (
                              <Typography variant='body2' fontWeight='medium'>
                                {branch.name}
                              </Typography>
                            )}
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mt: 0.5 }}>
                              <LocationIcon />
                              <Typography variant='body2' color='textSecondary'>
                                {branch.address}
                              </Typography>
                            </Box>
                            {branch.phones && branch.phones.length > 0 && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                <PhoneIcon />
                                <Typography variant='body2'>
                                  {branch.phones.join(', ')}
                                </Typography>
                              </Box>
                            )}
                            {branch.workingHours?.note && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                <TimeIcon />
                                <Typography variant='caption' color='textSecondary'>
                                  {branch.workingHours.note}
                                </Typography>
                              </Box>
                            )}
                          </Paper>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {result.phones.length === 0 && result.emails.length === 0 && !result.address && (!result.branches || result.branches.length === 0) && (
                    <Typography variant='body2' color='textSecondary'>
                      Контактные данные не найдены
                    </Typography>
                  )}
                </Paper>
              </Grid>

              {/* Соцсети и время работы */}
              <Grid item xs={12} md={6}>
                <Paper variant='outlined' sx={{ p: 2 }}>
                  {/* Соцсети */}
                  {Object.keys(result.socialLinks).length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant='subtitle2' gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinkIcon /> Социальные сети
                      </Typography>
                      {renderSocialLinks(result.socialLinks)}
                    </Box>
                  )}

                  {/* Время работы */}
                  {result.workingHours && (
                    <Box>
                      <Typography variant='subtitle2' gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TimeIcon /> Режим работы
                      </Typography>
                      {renderWorkingHours(result.workingHours)}
                    </Box>
                  )}

                  {Object.keys(result.socialLinks).length === 0 && !result.workingHours && (
                    <Typography variant='body2' color='textSecondary'>
                      Дополнительная информация не найдена
                    </Typography>
                  )}
                </Paper>
              </Grid>

              {/* Услуги */}
              {result.services.length > 0 && (
                <Grid item xs={12}>
                  <Paper variant='outlined' sx={{ p: 2 }}>
                    <Typography variant='subtitle2' gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ServiceIcon /> Услуги / Товары
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {result.services.map((service, i) => (
                        <Chip key={i} label={service} size='small' variant='outlined' />
                      ))}
                    </Box>
                  </Paper>
                </Grid>
              )}

              {/* Изображения */}
              {(result.logoUrl || result.photos.length > 0) && (
                <Grid item xs={12}>
                  <Paper variant='outlined' sx={{ p: 2 }}>
                    <Typography variant='subtitle2' gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ImageIcon /> Изображения
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {result.logoUrl && (
                        <Box>
                          <Typography variant='caption' color='textSecondary'>Логотип:</Typography>
                          <Box
                            component='img'
                            src={result.logoUrl}
                            alt='Logo'
                            sx={{ 
                              maxWidth: 150, 
                              maxHeight: 80, 
                              objectFit: 'contain',
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                              p: 0.5
                            }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        </Box>
                      )}
                      {result.photos.length > 0 && (
                        <Box>
                          <Typography variant='caption' color='textSecondary'>
                            Фото ({result.photos.length}):
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                            {result.photos.slice(0, 5).map((photo, i) => (
                              <Box
                                key={i}
                                component='img'
                                src={photo}
                                alt={`Photo ${i + 1}`}
                                sx={{ 
                                  width: 80, 
                                  height: 60, 
                                  objectFit: 'cover',
                                  borderRadius: 1,
                                  cursor: 'pointer'
                                }}
                                onClick={() => window.open(photo, '_blank')}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              )}

              {/* Анализ текста */}
              {textAnalysis && (
                <Grid item xs={12}>
                  <Paper variant='outlined' sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant='subtitle2' sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BrainIcon /> Анализ текста (NLP)
                      </Typography>
                      <Button
                        size='small'
                        startIcon={showTextAnalysis ? <CollapseIcon /> : <ExpandIcon />}
                        onClick={() => setShowTextAnalysis(!showTextAnalysis)}
                      >
                        {showTextAnalysis ? 'Скрыть детали' : 'Показать детали'}
                      </Button>
                    </Box>

                    {/* Предложенная категория */}
                    {textAnalysis.suggestedCategory && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant='caption' color='textSecondary'>
                          Категория (по анализу):
                        </Typography>
                        <Box>
                          <Chip 
                            icon={<TagIcon />}
                            label={textAnalysis.suggestedCategory} 
                            color='secondary' 
                            size='small'
                          />
                        </Box>
                      </Box>
                    )}

                    {/* Ключевые слова (TF-IDF) */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant='caption' color='textSecondary'>
                        Ключевые слова (TF-IDF):
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                        {textAnalysis.keywords.slice(0, 10).map((kw, i) => (
                          <Chip
                            key={i}
                            label={`${kw.lemma} (${kw.score})`}
                            size='small'
                            variant='outlined'
                            sx={{ 
                              fontSize: '0.7rem',
                              opacity: Math.max(0.5, 1 - i * 0.05)
                            }}
                          />
                        ))}
                      </Box>
                    </Box>

                    {/* Слова и Фразы - всегда видны */}
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      {/* Топ слов */}
                      <Grid item xs={12} md={6}>
                        <Typography variant='caption' color='textSecondary' sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <FileListIcon /> Топ слов по частоте:
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                          {textAnalysis.frequentWords.slice(0, 10).map((word, i) => (
                            <Box 
                              key={i} 
                              sx={{ 
                                display: 'flex', 
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                py: 0.25,
                                borderBottom: '1px solid',
                                borderColor: 'divider'
                              }}
                            >
                              <Typography variant='body2'>
                                {i + 1}. {word.lemma}
                              </Typography>
                              <Chip 
                                label={word.count} 
                                size='small' 
                                sx={{ minWidth: 40, height: 20, fontSize: '0.7rem' }}
                              />
                            </Box>
                          ))}
                        </Box>
                      </Grid>

                      {/* Топ фраз */}
                      {textAnalysis.frequentPhrases && textAnalysis.frequentPhrases.length > 0 && (
                        <Grid item xs={12} md={6}>
                          <Typography variant='caption' color='textSecondary' sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <i className='ri-chat-quote-line' style={{ fontSize: '1rem' }} /> Топ фраз по частоте:
                          </Typography>
                          <Box sx={{ mt: 1 }}>
                            {textAnalysis.frequentPhrases.slice(0, 10).map((phrase, i) => (
                              <Box 
                                key={i} 
                                sx={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  py: 0.25,
                                  borderBottom: '1px solid',
                                  borderColor: 'divider'
                                }}
                              >
                                <Box>
                                  <Typography variant='body2'>
                                    {i + 1}. {phrase.lemmaPhrase}
                                  </Typography>
                                  {phrase.variants && phrase.variants.length > 0 && (
                                    <Typography variant='caption' color='textSecondary' sx={{ fontSize: '0.65rem' }}>
                                      ≈ {phrase.variants.slice(0, 2).join(', ')}
                                    </Typography>
                                  )}
                                </Box>
                                <Chip 
                                  label={phrase.count} 
                                  size='small' 
                                  sx={{ minWidth: 40, height: 20, fontSize: '0.7rem' }}
                                />
                              </Box>
                            ))}
                          </Box>
                        </Grid>
                      )}
                    </Grid>

                    <Collapse in={showTextAnalysis}>
                      <Divider sx={{ my: 2 }} />
                      
                      <Grid container spacing={2}>
                        {/* Извлечённые сущности */}
                        <Grid item xs={12} md={6}>
                          <Typography variant='caption' color='textSecondary'>
                            Извлечённые сущности:
                          </Typography>
                          
                          {textAnalysis.entities.organizations.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant='caption' color='primary'>Организации:</Typography>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {textAnalysis.entities.organizations.map((org, i) => (
                                  <Chip key={i} label={org} size='small' color='primary' variant='outlined' />
                                ))}
                              </Box>
                            </Box>
                          )}
                          
                          {textAnalysis.entities.locations.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant='caption' color='success.main'>Локации:</Typography>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {textAnalysis.entities.locations.map((loc, i) => (
                                  <Chip key={i} label={loc} size='small' color='success' variant='outlined' />
                                ))}
                              </Box>
                            </Box>
                          )}
                          
                          {textAnalysis.entities.products.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant='caption' color='warning.main'>Продукты/Услуги:</Typography>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {textAnalysis.entities.products.map((prod, i) => (
                                  <Chip key={i} label={prod} size='small' color='warning' variant='outlined' />
                                ))}
                              </Box>
                            </Box>
                          )}
                        </Grid>
                      </Grid>
                    </Collapse>
                  </Paper>
                </Grid>
              )}

              {/* Raw JSON */}
              <Grid item xs={12}>
                <Button
                  size='small'
                  startIcon={showRawJson ? <CollapseIcon /> : <ExpandIcon />}
                  onClick={() => setShowRawJson(!showRawJson)}
                >
                  {showRawJson ? 'Скрыть' : 'Показать'} JSON
                </Button>
                <Collapse in={showRawJson}>
                  <Paper 
                    variant='outlined' 
                    sx={{ 
                      p: 2, 
                      mt: 1, 
                      bgcolor: 'grey.900', 
                      color: 'grey.100',
                      maxHeight: 400,
                      overflow: 'auto'
                    }}
                  >
                    <pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify({ ...result, textAnalysis }, null, 2)}
                    </pre>
                  </Paper>
                </Collapse>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}


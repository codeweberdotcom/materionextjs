'use client'

// React Imports
import { useState, useEffect } from 'react'

// Next Imports
import { useRouter, useParams } from 'next/navigation'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import CardActions from '@mui/material/CardActions'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'

// Type Imports
import type { Locale } from '@configs/i18n'

type TariffPlan = {
  id: string
  code: string
  name: string
  description: string | null
  price: number
  currency: string
  features: string // JSON-строка с возможностями
  maxAccounts: number | null
  isActive: boolean
  isSystem: boolean
}

const TariffsPage = () => {
  const router = useRouter()
  const params = useParams()
  const lang = params.lang as Locale

  const [tariffs, setTariffs] = useState<TariffPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Загрузка тарифов
  useEffect(() => {
    const fetchTariffs = async () => {
      try {
        const response = await fetch('/api/tariff-plans')

        if (!response.ok) {
          throw new Error('Ошибка загрузки тарифов')
        }

        const result = await response.json()
        setTariffs(result.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки')
      } finally {
        setLoading(false)
      }
    }

    fetchTariffs()
  }, [])

  // Парсинг features - может быть объектом или массивом
  const parseFeatures = (featuresJson: string): string[] => {
    try {
      const parsed = JSON.parse(featuresJson)

      // Если это массив строк - возвращаем как есть
      if (Array.isArray(parsed)) {
        return parsed
      }

      // Если это объект - конвертируем в читаемый массив
      if (typeof parsed === 'object' && parsed !== null) {
        const features: string[] = []

        // Объявления
        if (parsed.maxListings === -1) {
          features.push('Безлимитные объявления')
        } else if (parsed.maxListings) {
          features.push(`До ${parsed.maxListings} объявлений`)
        }

        // Компании
        if (parsed.maxCompanies === -1) {
          features.push('Безлимитные компании')
        } else if (parsed.maxCompanies) {
          features.push(`До ${parsed.maxCompanies} компаний`)
        }

        // Менеджеры
        if (parsed.canAssignManagers) {
          if (parsed.maxManagers === -1) {
            features.push('Безлимитные менеджеры')
          } else if (parsed.maxManagers) {
            features.push(`До ${parsed.maxManagers} менеджеров`)
          } else {
            features.push('Назначение менеджеров')
          }
        }

        // Поддержка
        if (parsed.support === 'dedicated') {
          features.push('Выделенная поддержка')
        } else if (parsed.support === 'priority') {
          features.push('Приоритетная поддержка')
        } else if (parsed.support === 'email') {
          features.push('Email поддержка')
        } else if (parsed.support === 'community') {
          features.push('Поддержка сообщества')
        }

        // Дополнительные функции
        if (parsed.analytics) features.push('Аналитика и статистика')
        if (parsed.apiAccess) features.push('Доступ к API')
        if (parsed.customIntegration) features.push('Кастомные интеграции')

        return features.length > 0 ? features : ['Базовые возможности']
      }

      return ['Базовые возможности']
    } catch {
      return ['Базовые возможности']
    }
  }

  // Определить популярность тарифа
  const isPopular = (code: string) => code === 'PRO'

  if (loading) {
    return (
      <Box className='flex flex-col gap-6'>
        <Skeleton variant='text' width={300} height={40} />
        <Grid container spacing={4}>
          {[1, 2, 3, 4].map(i => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant='rounded' height={400} />
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  return (
    <Box className='flex flex-col gap-6'>
      {/* Хлебные крошки */}
      <Breadcrumbs>
        <Link
          underline='hover'
          color='inherit'
          href={`/${lang}/accounts`}
          onClick={(e) => {
            e.preventDefault()
            router.push(`/${lang}/accounts`)
          }}
        >
          Аккаунты
        </Link>
        <Typography color='text.primary'>Тарифные планы</Typography>
      </Breadcrumbs>

      {/* Заголовок */}
      <Box className='text-center'>
        <Typography variant='h4'>Тарифные планы</Typography>
        <Typography variant='body1' color='text.secondary' className='mt-2'>
          Выберите тариф, который подходит вашим потребностям
        </Typography>
      </Box>

      {/* Ошибки */}
      {error && (
        <Alert severity='error' onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Тарифы */}
      <Grid container spacing={4} justifyContent='center'>
        {tariffs.map(tariff => {
          const features = parseFeatures(tariff.features)
          const tariffIsPopular = isPopular(tariff.code)

          return (
            <Grid item xs={12} sm={6} md={3} key={tariff.id}>
              <Card
                variant='outlined'
                className={tariffIsPopular ? 'border-primary border-2' : ''}
                sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              >
                {tariffIsPopular && (
                  <Box className='bg-primary text-white text-center py-1'>
                    <Typography variant='caption' className='font-medium'>
                      ПОПУЛЯРНЫЙ
                    </Typography>
                  </Box>
                )}
                <CardHeader
                  title={tariff.name}
                  subheader={tariff.description}
                  titleTypographyProps={{ align: 'center', variant: 'h5' }}
                  subheaderTypographyProps={{ align: 'center' }}
                />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box className='text-center mb-4'>
                    {tariff.price > 0 ? (
                      <>
                        <Typography variant='h3' component='span'>
                          {tariff.price}
                        </Typography>
                        <Typography variant='body1' component='span' color='text.secondary'>
                          {' '}{tariff.currency === 'RUB' ? '₽' : tariff.currency}/мес
                        </Typography>
                      </>
                    ) : (
                      <Typography variant='h3'>
                        Бесплатно
                      </Typography>
                    )}
                  </Box>

                  {tariff.maxAccounts && (
                    <Typography variant='body2' color='text.secondary' className='text-center mb-3'>
                      До {tariff.maxAccounts} аккаунтов
                    </Typography>
                  )}

                  <List dense>
                    {features.map((feature, index) => (
                      <ListItem key={index} disablePadding>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <i className='ri-check-line text-success' />
                        </ListItemIcon>
                        <ListItemText primary={feature} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
                <CardActions sx={{ justifyContent: 'center', pb: 3 }}>
                  <Button
                    variant={tariffIsPopular ? 'contained' : 'outlined'}
                    fullWidth
                  >
                    Выбрать
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          )
        })}
      </Grid>

      {/* Информация */}
      <Alert severity='info' className='mt-4'>
        <Typography variant='body2'>
          Для смены тарифа перейдите в настройки нужного аккаунта и выберите новый тарифный план.
          Изменения вступят в силу с начала следующего расчетного периода.
        </Typography>
      </Alert>
    </Box>
  )
}

export default TariffsPage


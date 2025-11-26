'use client'

// React Imports
import { useState } from 'react'

// Next Imports
import { useRouter, useParams } from 'next/navigation'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import RadioGroup from '@mui/material/RadioGroup'
import Radio from '@mui/material/Radio'
import FormControlLabel from '@mui/material/FormControlLabel'
import CircularProgress from '@mui/material/CircularProgress'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'

// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { AccountType } from '@/types/accounts/types'
import type { Locale } from '@configs/i18n'

const accountTypes: { value: AccountType; label: string; description: string; icon: string }[] = [
  {
    value: 'LISTING',
    label: 'Для объявлений',
    description: 'Публикация и управление объявлениями',
    icon: 'ri-file-list-3-line'
  },
  {
    value: 'COMPANY',
    label: 'Компания',
    description: 'Размещение компании и услуг',
    icon: 'ri-building-line'
  },
  {
    value: 'NETWORK',
    label: 'Сеть компаний',
    description: 'Управление несколькими аккаунтами и назначение менеджеров',
    icon: 'ri-group-line'
  }
]

const CreateAccountPage = () => {
  const router = useRouter()
  const params = useParams()
  const lang = params.lang as Locale

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'LISTING' as AccountType
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Название аккаунта обязательно')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Ошибка создания аккаунта')
      }

      const result = await response.json()
      router.push(`/${lang}/accounts/${result.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
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
        <Typography color='text.primary'>Создать аккаунт</Typography>
      </Breadcrumbs>

      {/* Заголовок */}
      <Box>
        <Typography variant='h4'>Создать новый аккаунт</Typography>
        <Typography variant='body2' color='text.secondary'>
          Выберите тип аккаунта и заполните информацию
        </Typography>
      </Box>

      {/* Ошибки */}
      {error && (
        <Alert severity='error' onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <CardHeader title='Информация об аккаунте' />
        <CardContent>
          <Box className='flex flex-col gap-6'>
            {/* Тип аккаунта */}
            <Box>
              <Typography variant='subtitle2' className='mb-3'>
                Тип аккаунта
              </Typography>
              <RadioGroup
                value={formData.type}
                onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as AccountType }))}
                className='gap-3'
              >
                {accountTypes.map(type => (
                  <Card
                    key={type.value}
                    variant='outlined'
                    className={classnames('cursor-pointer transition-all', {
                      'border-primary border-2': formData.type === type.value
                    })}
                    onClick={() => setFormData(prev => ({ ...prev, type: type.value }))}
                  >
                    <CardContent className='flex items-center gap-4 py-3'>
                      <Radio value={type.value} checked={formData.type === type.value} />
                      <Box
                        className='flex items-center justify-center rounded-lg p-2'
                        sx={{ bgcolor: 'action.hover' }}
                      >
                        <i className={`${type.icon} text-2xl`} />
                      </Box>
                      <Box className='flex-1'>
                        <Typography className='font-medium'>
                          {type.label}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {type.description}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </RadioGroup>
            </Box>

            {/* Название */}
            <TextField
              label='Название аккаунта'
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              disabled={loading}
              placeholder='Например: Моя компания'
              helperText='Уникальное название для вашего аккаунта'
            />

            {/* Описание */}
            <TextField
              label='Описание'
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={3}
              disabled={loading}
              placeholder='Краткое описание аккаунта (необязательно)'
            />

            {/* Информация о тарифе */}
            <Alert severity='info'>
              <Typography variant='body2'>
                Новый аккаунт будет создан с бесплатным тарифом <strong>Free</strong>.
                Вы сможете изменить тариф в любое время в настройках аккаунта.
              </Typography>
            </Alert>

            {/* Кнопки */}
            <Box className='flex justify-end gap-3'>
              <Button
                onClick={() => router.push(`/${lang}/accounts`)}
                disabled={loading}
              >
                Отмена
              </Button>
              <Button
                variant='contained'
                onClick={handleSubmit}
                disabled={loading || !formData.name.trim()}
                startIcon={loading && <CircularProgress size={16} />}
              >
                Создать аккаунт
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

export default CreateAccountPage



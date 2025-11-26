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
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import Skeleton from '@mui/material/Skeleton'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'

// Type Imports
import type { UserAccountWithRelations } from '@/types/accounts/interfaces'
import type { AccountType } from '@/types/accounts/types'
import type { Locale } from '@configs/i18n'

// Utils
import { accountStateColors } from '@/services/workflows/machines/AccountMachine'

const accountTypeLabels: Record<AccountType, string> = {
  LISTING: 'Аккаунт для объявлений',
  COMPANY: 'Аккаунт компании',
  NETWORK: 'Сеть компаний'
}

const accountTypeIcons: Record<AccountType, string> = {
  LISTING: 'ri-file-list-3-line',
  COMPANY: 'ri-building-line',
  NETWORK: 'ri-group-line'
}

const statusLabels: Record<string, string> = {
  active: 'Активен',
  suspended: 'Приостановлен',
  archived: 'В архиве'
}

const AccountDetailPage = () => {
  const router = useRouter()
  const params = useParams()
  const accountId = params.id as string
  const lang = params.lang as Locale

  const [account, setAccount] = useState<UserAccountWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })

  // Загрузка аккаунта
  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const response = await fetch(`/api/accounts/${accountId}`)

        if (!response.ok) {
          throw new Error('Аккаунт не найден')
        }

        const result = await response.json()
        setAccount(result.data)
        setFormData({
          name: result.data.name || '',
          description: result.data.description || ''
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки')
      } finally {
        setLoading(false)
      }
    }

    fetchAccount()
  }, [accountId])

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Ошибка сохранения')
      }

      const result = await response.json()
      setAccount(result.data)
      setEditMode(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      name: account?.name || '',
      description: account?.description || ''
    })
    setEditMode(false)
  }

  if (loading) {
    return (
      <Box className='flex flex-col gap-6'>
        <Skeleton variant='text' width={300} height={40} />
        <Grid container spacing={4}>
          <Grid item xs={12} md={8}>
            <Skeleton variant='rounded' height={300} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Skeleton variant='rounded' height={200} />
          </Grid>
        </Grid>
      </Box>
    )
  }

  if (error && !account) {
    return (
      <Box className='flex flex-col items-center justify-center py-12'>
        <i className='ri-error-warning-line text-6xl text-error mb-4' />
        <Typography variant='h6' color='error'>
          {error}
        </Typography>
        <Button
          variant='contained'
          className='mt-4'
          onClick={() => router.push(`/${lang}/accounts`)}
        >
          Вернуться к списку
        </Button>
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
        <Typography color='text.primary'>{account?.name}</Typography>
      </Breadcrumbs>

      {/* Заголовок */}
      <Box className='flex items-center justify-between'>
        <Box className='flex items-center gap-4'>
          <Box
            className='flex items-center justify-center rounded-lg p-4'
            sx={{ bgcolor: 'action.hover' }}
          >
            <i className={`${accountTypeIcons[account?.type as AccountType] || 'ri-user-line'} text-4xl`} />
          </Box>
          <Box>
            <Typography variant='h4'>{account?.name}</Typography>
            <Typography variant='body2' color='text.secondary'>
              {accountTypeLabels[account?.type as AccountType]}
            </Typography>
          </Box>
        </Box>
        <Box className='flex gap-2'>
          {!editMode ? (
            <Button
              variant='outlined'
              startIcon={<i className='ri-edit-line' />}
              onClick={() => setEditMode(true)}
            >
              Редактировать
            </Button>
          ) : (
            <>
              <Button onClick={handleCancel} disabled={saving}>
                Отмена
              </Button>
              <Button
                variant='contained'
                onClick={handleSave}
                disabled={saving}
                startIcon={saving && <CircularProgress size={16} />}
              >
                Сохранить
              </Button>
            </>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity='error' onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={4}>
        {/* Основная информация */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader title='Основная информация' />
            <CardContent>
              {editMode ? (
                <Box className='flex flex-col gap-4'>
                  <TextField
                    label='Название'
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    fullWidth
                    disabled={saving}
                  />
                  <TextField
                    label='Описание'
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    fullWidth
                    multiline
                    rows={3}
                    disabled={saving}
                  />
                </Box>
              ) : (
                <Box className='flex flex-col gap-4'>
                  <Box>
                    <Typography variant='caption' color='text.secondary'>
                      Название
                    </Typography>
                    <Typography variant='body1'>{account?.name}</Typography>
                  </Box>
                  <Box>
                    <Typography variant='caption' color='text.secondary'>
                      Описание
                    </Typography>
                    <Typography variant='body1'>
                      {account?.description || 'Не указано'}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box className='flex gap-4'>
                    <Box>
                      <Typography variant='caption' color='text.secondary'>
                        Создан
                      </Typography>
                      <Typography variant='body2'>
                        {account?.createdAt && new Date(account.createdAt).toLocaleDateString('ru-RU')}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant='caption' color='text.secondary'>
                        Обновлен
                      </Typography>
                      <Typography variant='body2'>
                        {account?.updatedAt && new Date(account.updatedAt).toLocaleDateString('ru-RU')}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Боковая панель */}
        <Grid item xs={12} md={4}>
          <Box className='flex flex-col gap-4'>
            {/* Статус */}
            <Card>
              <CardHeader title='Статус' />
              <CardContent>
                <Chip
                  label={statusLabels[account?.status || ''] || account?.status}
                  color={accountStateColors[account?.status as keyof typeof accountStateColors] || 'default'}
                  size='medium'
                />
              </CardContent>
            </Card>

            {/* Тариф */}
            <Card>
              <CardHeader
                title='Тарифный план'
                action={
                  <Button
                    size='small'
                    onClick={() => router.push(`/${lang}/accounts/tariffs`)}
                  >
                    Изменить
                  </Button>
                }
              />
              <CardContent>
                <Box className='flex items-center gap-2'>
                  <i className='ri-vip-crown-line text-xl' />
                  <Typography variant='h6'>
                    {account?.tariffPlan?.name || 'Free'}
                  </Typography>
                </Box>
                {account?.tariffPlan?.priceMonthly ? (
                  <Typography variant='body2' color='text.secondary'>
                    {account.tariffPlan.priceMonthly} ₽/мес
                  </Typography>
                ) : (
                  <Typography variant='body2' color='text.secondary'>
                    Бесплатно
                  </Typography>
                )}
              </CardContent>
            </Card>

            {/* Быстрые действия */}
            <Card>
              <CardHeader title='Действия' />
              <CardContent className='flex flex-col gap-2'>
                {account?.type === 'NETWORK' && (
                  <Button
                    variant='outlined'
                    fullWidth
                    startIcon={<i className='ri-user-add-line' />}
                    onClick={() => router.push(`/${lang}/accounts/${accountId}/managers`)}
                  >
                    Управление менеджерами
                  </Button>
                )}
                <Button
                  variant='outlined'
                  fullWidth
                  startIcon={<i className='ri-share-forward-line' />}
                  onClick={() => router.push(`/${lang}/accounts/transfers`)}
                >
                  Передача аккаунта
                </Button>
              </CardContent>
            </Card>
          </Box>
        </Grid>
      </Grid>
    </Box>
  )
}

export default AccountDetailPage



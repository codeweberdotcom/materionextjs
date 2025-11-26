'use client'

// React Imports
import { useState, useEffect } from 'react'

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
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'

// Component Imports
import { AssignManagerDialog, ManagerList } from '@/components/accounts'

// Type Imports
import type { UserAccountWithRelations, AccountManagerWithUser } from '@/types/accounts/interfaces'
import type { Locale } from '@configs/i18n'

const AccountManagersPage = () => {
  const router = useRouter()
  const params = useParams()
  const accountId = params.id as string
  const lang = params.lang as Locale

  const [account, setAccount] = useState<UserAccountWithRelations | null>(null)
  const [managers, setManagers] = useState<AccountManagerWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Загрузка данных
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Загружаем аккаунт
        const accountResponse = await fetch(`/api/accounts/${accountId}`)

        if (!accountResponse.ok) {
          throw new Error('Аккаунт не найден')
        }

        const accountResult = await accountResponse.json()
        setAccount(accountResult.data)

        // Загружаем менеджеров
        const managersResponse = await fetch(`/api/accounts/${accountId}/managers`)

        if (managersResponse.ok) {
          const managersResult = await managersResponse.json()
          setManagers(managersResult.data || [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [accountId])

  const handleAssignManager = async (email: string, permissions: {
    canView: boolean
    canEdit: boolean
    canManage: boolean
    canTransfer: boolean
  }) => {
    setActionLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/accounts/${accountId}/managers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, permissions })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Ошибка назначения менеджера')
      }

      // Обновляем список менеджеров
      const managersResponse = await fetch(`/api/accounts/${accountId}/managers`)

      if (managersResponse.ok) {
        const managersResult = await managersResponse.json()
        setManagers(managersResult.data || [])
      }

      setAssignDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const handleRevokeManager = async (managerId: string) => {
    setActionLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/accounts/${accountId}/managers/${managerId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Ошибка отзыва доступа')
      }

      // Обновляем список менеджеров
      setManagers(prev => prev.filter(m => m.id !== managerId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <Box className='flex flex-col gap-6'>
        <Skeleton variant='text' width={300} height={40} />
        <Skeleton variant='rounded' height={400} />
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
        <Link
          underline='hover'
          color='inherit'
          href={`/${lang}/accounts/${accountId}`}
          onClick={(e) => {
            e.preventDefault()
            router.push(`/${lang}/accounts/${accountId}`)
          }}
        >
          {account?.name}
        </Link>
        <Typography color='text.primary'>Менеджеры</Typography>
      </Breadcrumbs>

      {/* Заголовок */}
      <Box className='flex items-center justify-between'>
        <Box>
          <Typography variant='h4'>Управление менеджерами</Typography>
          <Typography variant='body2' color='text.secondary'>
            Аккаунт: {account?.name}
          </Typography>
        </Box>
        <Button
          variant='contained'
          startIcon={<i className='ri-user-add-line' />}
          onClick={() => setAssignDialogOpen(true)}
          disabled={actionLoading}
        >
          Назначить менеджера
        </Button>
      </Box>

      {/* Ошибки */}
      {error && (
        <Alert severity='error' onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Информация */}
      <Alert severity='info'>
        <Typography variant='body2'>
          Менеджеры могут управлять аккаунтом в соответствии с назначенными правами.
          Пользователь должен быть зарегистрирован в системе для назначения менеджером.
        </Typography>
      </Alert>

      {/* Список менеджеров */}
      <Card>
        <CardHeader
          title='Назначенные менеджеры'
          subheader={`Всего: ${managers.length}`}
        />
        <CardContent>
          <ManagerList
            managers={managers}
            onRevoke={handleRevokeManager}
            loading={actionLoading}
          />
        </CardContent>
      </Card>

      {/* Диалог назначения */}
      <AssignManagerDialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        onSubmit={handleAssignManager}
        accountName={account?.name || ''}
      />
    </Box>
  )
}

export default AccountManagersPage



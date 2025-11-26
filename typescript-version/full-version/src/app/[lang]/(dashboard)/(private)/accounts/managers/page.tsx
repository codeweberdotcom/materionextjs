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
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Avatar from '@mui/material/Avatar'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Skeleton from '@mui/material/Skeleton'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'

// Type Imports
import type { Locale } from '@configs/i18n'

// Hook Imports
import { useAccount } from '@/hooks/useAccount'

type ManagerInfo = {
  id: string
  accountId: string
  accountName: string
  userId: string
  userName: string
  userEmail: string
  userAvatar: string | null
  canEdit: boolean
  canManage: boolean
  canDelete: boolean
  createdAt: string
}

const AllManagersPage = () => {
  const router = useRouter()
  const params = useParams()
  const lang = params.lang as Locale
  const { userAccounts, loading: accountsLoading } = useAccount()

  const [managers, setManagers] = useState<ManagerInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Загрузка менеджеров для всех аккаунтов
  useEffect(() => {
    const fetchAllManagers = async () => {
      if (accountsLoading) return

      try {
        const allManagers: ManagerInfo[] = []

        for (const account of userAccounts) {
          const response = await fetch(`/api/accounts/${account.id}/managers`)

          if (response.ok) {
            const result = await response.json()
            const accountManagers = (result.data || []).map((m: any) => ({
              id: m.id,
              accountId: account.id,
              accountName: account.name,
              userId: m.userId,
              userName: m.user?.fullName || 'Без имени',
              userEmail: m.user?.email || '',
              userAvatar: m.user?.avatar || null,
              canEdit: m.canEdit,
              canManage: m.canManage,
              canDelete: m.canDelete,
              createdAt: m.createdAt
            }))
            allManagers.push(...accountManagers)
          }
        }

        setManagers(allManagers)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки')
      } finally {
        setLoading(false)
      }
    }

    fetchAllManagers()
  }, [userAccounts, accountsLoading])

  const getPermissionChips = (manager: ManagerInfo) => {
    const chips = []

    // Все менеджеры имеют право на просмотр
    chips.push(<Chip key='view' label='Просмотр' size='small' variant='outlined' />)

    if (manager.canEdit) {
      chips.push(<Chip key='edit' label='Редактирование' size='small' variant='outlined' color='info' />)
    }

    if (manager.canManage) {
      chips.push(<Chip key='manage' label='Управление' size='small' variant='outlined' color='warning' />)
    }

    if (manager.canDelete) {
      chips.push(<Chip key='delete' label='Удаление' size='small' variant='outlined' color='error' />)
    }

    return chips
  }

  if (loading || accountsLoading) {
    return (
      <Box className='flex flex-col gap-6'>
        <Skeleton variant='text' width={300} height={40} />
        <Skeleton variant='rounded' height={400} />
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
        <Typography color='text.primary'>Все менеджеры</Typography>
      </Breadcrumbs>

      {/* Заголовок */}
      <Box>
        <Typography variant='h4'>Менеджеры аккаунтов</Typography>
        <Typography variant='body2' color='text.secondary'>
          Сводная информация о всех назначенных менеджерах
        </Typography>
      </Box>

      {/* Ошибки */}
      {error && (
        <Alert severity='error' onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Таблица */}
      <Card>
        <CardHeader
          title='Назначенные менеджеры'
          subheader={`Всего: ${managers.length}`}
        />
        <CardContent>
          {managers.length === 0 ? (
            <Box className='flex flex-col items-center justify-center py-8'>
              <i className='ri-user-add-line text-5xl text-textSecondary mb-4' />
              <Typography variant='body1' color='text.secondary'>
                Нет назначенных менеджеров
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                Назначьте менеджеров в настройках аккаунтов типа "Сеть компаний"
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Пользователь</TableCell>
                    <TableCell>Аккаунт</TableCell>
                    <TableCell>Права</TableCell>
                    <TableCell>Дата назначения</TableCell>
                    <TableCell align='right'>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {managers.map(manager => (
                    <TableRow key={manager.id}>
                      <TableCell>
                        <Box className='flex items-center gap-3'>
                          <Avatar src={manager.userAvatar || ''} alt={manager.userName}>
                            {manager.userName[0]?.toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant='body2' className='font-medium'>
                              {manager.userName}
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {manager.userEmail}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/${lang}/accounts/${manager.accountId}`}
                          underline='hover'
                          onClick={(e) => {
                            e.preventDefault()
                            router.push(`/${lang}/accounts/${manager.accountId}`)
                          }}
                        >
                          {manager.accountName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Box className='flex flex-wrap gap-1'>
                          {getPermissionChips(manager)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {new Date(manager.createdAt).toLocaleDateString('ru-RU')}
                      </TableCell>
                      <TableCell align='right'>
                        <Tooltip title='Управление'>
                          <IconButton
                            size='small'
                            onClick={() => router.push(`/${lang}/accounts/${manager.accountId}/managers`)}
                          >
                            <i className='ri-settings-3-line' />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

export default AllManagersPage


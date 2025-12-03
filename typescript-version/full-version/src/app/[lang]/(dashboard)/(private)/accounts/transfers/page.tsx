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
import Chip from '@mui/material/Chip'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Skeleton from '@mui/material/Skeleton'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'

// Type Imports
import type { AccountTransferWithRelations } from '@/types/accounts/interfaces'
import type { Locale } from '@configs/i18n'

const statusColors: Record<string, 'warning' | 'success' | 'error' | 'default'> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'error',
  cancelled: 'default'
}

const statusLabels: Record<string, string> = {
  pending: 'Ожидает',
  accepted: 'Принят',
  rejected: 'Отклонен',
  cancelled: 'Отменен'
}

const AccountTransfersPage = () => {
  const router = useRouter()
  const params = useParams()
  const lang = params.lang as Locale

  const [transfers, setTransfers] = useState<AccountTransferWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0) // 0 - входящие, 1 - исходящие
  const [actionLoading, setActionLoading] = useState(false)

  // Загрузка данных
  useEffect(() => {
    const fetchTransfers = async () => {
      try {
        const response = await fetch('/api/accounts/transfers')

        if (!response.ok) {
          throw new Error('Ошибка загрузки запросов')
        }

        const result = await response.json()
        setTransfers(result.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки')
      } finally {
        setLoading(false)
      }
    }

    fetchTransfers()
  }, [])

  const handleAccept = async (transferId: string) => {
    setActionLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/accounts/transfers/${transferId}/accept`, {
        method: 'POST'
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Ошибка принятия')
      }

      // Обновляем статус
      setTransfers(prev => prev.map(t =>
        t.id === transferId ? { ...t, status: 'accepted' } : t
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (transferId: string) => {
    setActionLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/accounts/transfers/${transferId}/reject`, {
        method: 'POST'
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Ошибка отклонения')
      }

      // Обновляем статус
      setTransfers(prev => prev.map(t =>
        t.id === transferId ? { ...t, status: 'rejected' } : t
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async (transferId: string) => {
    setActionLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/accounts/transfers/${transferId}/cancel`, {
        method: 'POST'
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Ошибка отмены')
      }

      // Обновляем статус
      setTransfers(prev => prev.map(t =>
        t.id === transferId ? { ...t, status: 'cancelled' } : t
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setActionLoading(false)
    }
  }

  // Фильтрация по типу (входящие/исходящие)
  const incomingTransfers = transfers.filter(t => t.toUserId === t.requestedBy)
  const outgoingTransfers = transfers.filter(t => t.fromAccount?.ownerId === t.requestedBy || t.fromAccount?.userId === t.requestedBy)

  const displayedTransfers = activeTab === 0 ? incomingTransfers : outgoingTransfers

  if (loading) {
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
        <Typography color='text.primary'>Передача аккаунтов</Typography>
      </Breadcrumbs>

      {/* Заголовок */}
      <Box>
        <Typography variant='h4'>Передача аккаунтов</Typography>
        <Typography variant='body2' color='text.secondary'>
          Входящие и исходящие запросы на передачу аккаунтов
        </Typography>
      </Box>

      {/* Ошибки */}
      {error && (
        <Alert severity='error' onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Табы */}
      <Card>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label={`Входящие (${incomingTransfers.length})`} />
          <Tab label={`Исходящие (${outgoingTransfers.length})`} />
        </Tabs>
        <CardContent>
          {displayedTransfers.length === 0 ? (
            <Box className='flex flex-col items-center justify-center py-8'>
              <i className='ri-inbox-line text-5xl text-textSecondary mb-4' />
              <Typography variant='body1' color='text.secondary'>
                {activeTab === 0 ? 'Нет входящих запросов' : 'Нет исходящих запросов'}
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Аккаунт</TableCell>
                    <TableCell>{activeTab === 0 ? 'От кого' : 'Кому'}</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Дата</TableCell>
                    <TableCell align='right'>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayedTransfers.map(transfer => (
                    <TableRow key={transfer.id}>
                      <TableCell>
                        <Typography variant='body2' className='font-medium'>
                          {transfer.account?.name || 'Аккаунт'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant='body2'>
                          {activeTab === 0
                            ? transfer.fromUser?.email || 'Неизвестно'
                            : transfer.toUser?.email || 'Неизвестно'
                          }
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={statusLabels[transfer.status] || transfer.status}
                          color={statusColors[transfer.status] || 'default'}
                          size='small'
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant='body2'>
                          {new Date(transfer.createdAt).toLocaleDateString('ru-RU')}
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>
                        {transfer.status === 'pending' && (
                          <Box className='flex justify-end gap-1'>
                            {activeTab === 0 ? (
                              // Входящие - можно принять или отклонить
                              <>
                                <Button
                                  size='small'
                                  color='success'
                                  onClick={() => handleAccept(transfer.id)}
                                  disabled={actionLoading}
                                >
                                  Принять
                                </Button>
                                <Button
                                  size='small'
                                  color='error'
                                  onClick={() => handleReject(transfer.id)}
                                  disabled={actionLoading}
                                >
                                  Отклонить
                                </Button>
                              </>
                            ) : (
                              // Исходящие - можно отменить
                              <Button
                                size='small'
                                color='error'
                                onClick={() => handleCancel(transfer.id)}
                                disabled={actionLoading}
                              >
                                Отменить
                              </Button>
                            )}
                          </Box>
                        )}
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

export default AccountTransfersPage



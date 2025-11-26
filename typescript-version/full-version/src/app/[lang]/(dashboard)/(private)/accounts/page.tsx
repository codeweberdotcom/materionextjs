'use client'

// React Imports
import { useState, useEffect } from 'react'

// Next Imports
import { useRouter, useParams } from 'next/navigation'

// MUI Imports
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Skeleton from '@mui/material/Skeleton'

// Component Imports
import { AccountCard, AccountForm, TransferAccountDialog } from '@/components/accounts'

// Hook Imports
import { useAccount, useCurrentAccount, useSwitchAccount } from '@/hooks/useAccount'

// Type Imports
import type { AccountType } from '@/types/accounts/types'
import type { Locale } from '@configs/i18n'

const AccountsPage = () => {
  const router = useRouter()
  const { lang } = useParams()
  const { userAccounts, loading, error, refreshAccounts } = useAccount()
  const currentAccount = useCurrentAccount()
  const switchAccount = useSwitchAccount()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Очистка ошибки при загрузке
  useEffect(() => {
    if (error) {
      setActionError(error)
    }
  }, [error])

  const handleCreateAccount = async (data: { name: string; description: string; type: AccountType }) => {
    setActionLoading(true)
    setActionError(null)

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Ошибка создания аккаунта')
      }

      await refreshAccounts()
      setCreateDialogOpen(false)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Произошла ошибка')
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const handleSwitchAccount = async (accountId: string) => {
    try {
      await switchAccount(accountId)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ошибка переключения')
    }
  }

  const handleEditAccount = (accountId: string) => {
    router.push(`/${lang}/accounts/${accountId}`)
  }

  const handleManagers = (accountId: string) => {
    router.push(`/${lang}/accounts/${accountId}/managers`)
  }

  const handleTransfer = (accountId: string) => {
    setSelectedAccountId(accountId)
    setTransferDialogOpen(true)
  }

  const handleTransferSubmit = async (email: string) => {
    if (!selectedAccountId) return

    setActionLoading(true)
    setActionError(null)

    try {
      const response = await fetch(`/api/accounts/${selectedAccountId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserEmail: email })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Ошибка передачи аккаунта')
      }

      await refreshAccounts()
      setTransferDialogOpen(false)
      setSelectedAccountId(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Произошла ошибка')
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот аккаунт? Это действие необратимо.')) {
      return
    }

    setActionLoading(true)
    setActionError(null)

    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Ошибка удаления аккаунта')
      }

      await refreshAccounts()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setActionLoading(false)
    }
  }

  const selectedAccount = userAccounts.find(a => a.id === selectedAccountId)

  return (
    <Box className='flex flex-col gap-6'>
      {/* Заголовок */}
      <Box className='flex items-center justify-between'>
        <Box>
          <Typography variant='h4'>Мои аккаунты</Typography>
          <Typography variant='body2' color='text.secondary'>
            Управление аккаунтами и настройками
          </Typography>
        </Box>
        <Button
          variant='contained'
          startIcon={<i className='ri-add-line' />}
          onClick={() => setCreateDialogOpen(true)}
          disabled={actionLoading}
        >
          Создать аккаунт
        </Button>
      </Box>

      {/* Ошибки */}
      {actionError && (
        <Alert severity='error' onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {/* Загрузка */}
      {loading && (
        <Grid container spacing={4}>
          {[1, 2, 3].map(i => (
            <Grid item xs={12} md={6} lg={4} key={i}>
              <Skeleton variant='rounded' height={200} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Список аккаунтов */}
      {!loading && userAccounts.length === 0 && (
        <Box className='flex flex-col items-center justify-center py-12'>
          <i className='ri-user-line text-6xl text-textSecondary mb-4' />
          <Typography variant='h6' color='text.secondary'>
            У вас пока нет аккаунтов
          </Typography>
          <Typography variant='body2' color='text.secondary' className='mb-4'>
            Создайте первый аккаунт для начала работы
          </Typography>
          <Button
            variant='contained'
            startIcon={<i className='ri-add-line' />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Создать аккаунт
          </Button>
        </Box>
      )}

      {!loading && userAccounts.length > 0 && (
        <Grid container spacing={4}>
          {userAccounts.map(account => (
            <Grid item xs={12} md={6} lg={4} key={account.id}>
              <AccountCard
                account={account}
                isCurrent={currentAccount?.id === account.id}
                onSwitch={handleSwitchAccount}
                onEdit={handleEditAccount}
                onManagers={handleManagers}
                onTransfer={handleTransfer}
                onDelete={handleDeleteAccount}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Диалог создания */}
      <AccountForm
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreateAccount}
        mode='create'
      />

      {/* Диалог передачи */}
      <TransferAccountDialog
        open={transferDialogOpen}
        onClose={() => {
          setTransferDialogOpen(false)
          setSelectedAccountId(null)
        }}
        onSubmit={handleTransferSubmit}
        accountName={selectedAccount?.name || ''}
      />
    </Box>
  )
}

export default AccountsPage



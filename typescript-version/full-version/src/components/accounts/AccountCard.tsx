'use client'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'

// React Imports
import { useState } from 'react'
import type { MouseEvent } from 'react'

// Type Imports
import type { UserAccountWithRelations } from '@/types/accounts/interfaces'
import type { AccountType } from '@/types/accounts/types'

// Utils
import { accountStateColors } from '@/services/workflows/machines/AccountMachine'

// Маппинг типов аккаунтов на иконки
const accountTypeIcons: Record<AccountType, string> = {
  LISTING: 'ri-file-list-3-line',
  COMPANY: 'ri-building-line',
  NETWORK: 'ri-group-line'
}

// Маппинг типов аккаунтов на названия
const accountTypeLabels: Record<AccountType, string> = {
  LISTING: 'Объявления',
  COMPANY: 'Компания',
  NETWORK: 'Сеть компаний'
}

// Маппинг статусов на названия
const statusLabels: Record<string, string> = {
  active: 'Активен',
  suspended: 'Приостановлен',
  archived: 'В архиве'
}

type Props = {
  account: UserAccountWithRelations
  isCurrent?: boolean
  onSwitch?: (accountId: string) => void
  onEdit?: (accountId: string) => void
  onManagers?: (accountId: string) => void
  onTransfer?: (accountId: string) => void
  onDelete?: (accountId: string) => void
}

const AccountCard = ({
  account,
  isCurrent = false,
  onSwitch,
  onEdit,
  onManagers,
  onTransfer,
  onDelete
}: Props) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  const handleMenuClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleAction = (action: () => void) => {
    handleMenuClose()
    action()
  }

  return (
    <Card
      variant='outlined'
      className={isCurrent ? 'border-primary border-2' : ''}
    >
      <CardContent>
        <Box className='flex items-start justify-between'>
          <Box className='flex items-center gap-3'>
            <Box
              className='flex items-center justify-center rounded-lg p-3'
              sx={{ bgcolor: 'action.hover' }}
            >
              <i className={`${accountTypeIcons[account.type as AccountType] || 'ri-user-line'} text-2xl`} />
            </Box>
            <Box>
              <Box className='flex items-center gap-2'>
                <Typography variant='h6' className='font-medium'>
                  {account.name}
                </Typography>
                {isCurrent && (
                  <Chip
                    label='Текущий'
                    size='small'
                    color='primary'
                    variant='filled'
                  />
                )}
              </Box>
              <Typography variant='body2' color='text.secondary'>
                {account.description || accountTypeLabels[account.type as AccountType]}
              </Typography>
            </Box>
          </Box>

          <IconButton onClick={handleMenuClick}>
            <i className='ri-more-2-line' />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={handleMenuClose}
          >
            {[
              !isCurrent && onSwitch && (
                <MenuItem key='switch' onClick={() => handleAction(() => onSwitch(account.id))}>
                  <i className='ri-refresh-line mie-2' />
                  Переключиться
                </MenuItem>
              ),
              onEdit && (
                <MenuItem key='edit' onClick={() => handleAction(() => onEdit(account.id))}>
                  <i className='ri-edit-line mie-2' />
                  Редактировать
                </MenuItem>
              ),
              account.type === 'NETWORK' && onManagers && (
                <MenuItem key='managers' onClick={() => handleAction(() => onManagers(account.id))}>
                  <i className='ri-user-add-line mie-2' />
                  Управление менеджерами
                </MenuItem>
              ),
              onTransfer && (
                <MenuItem key='transfer' onClick={() => handleAction(() => onTransfer(account.id))}>
                  <i className='ri-share-forward-line mie-2' />
                  Передать аккаунт
                </MenuItem>
              ),
              onDelete && <Divider key='divider' />,
              onDelete && (
                <MenuItem key='delete' onClick={() => handleAction(() => onDelete(account.id))} className='text-error'>
                  <i className='ri-delete-bin-line mie-2' />
                  Удалить
                </MenuItem>
              )
            ].filter(Boolean)}
          </Menu>
        </Box>

        <Divider className='my-4' />

        <Box className='flex items-center gap-2 flex-wrap'>
          <Chip
            icon={<i className={accountTypeIcons[account.type as AccountType]} />}
            label={accountTypeLabels[account.type as AccountType]}
            size='small'
            variant='outlined'
          />
          <Chip
            icon={<i className='ri-vip-crown-line' />}
            label={account.tariffPlan.name}
            size='small'
            color={account.tariffPlan.code === 'FREE' ? 'default' : 'primary'}
            variant='outlined'
          />
          <Chip
            label={statusLabels[account.status] || account.status}
            size='small'
            color={accountStateColors[account.status as keyof typeof accountStateColors] || 'default'}
            variant='filled'
          />
          {account.managers && account.managers.length > 0 && (
            <Chip
              icon={<i className='ri-user-line' />}
              label={`${account.managers.length} менеджеров`}
              size='small'
              variant='outlined'
            />
          )}
        </Box>

        <Box className='mt-4 flex items-center justify-between text-sm'>
          <Typography variant='caption' color='text.secondary'>
            Создан: {new Date(account.createdAt).toLocaleDateString('ru-RU')}
          </Typography>
          {account.tariffPlan.priceMonthly > 0 && (
            <Typography variant='caption' color='text.secondary'>
              {account.tariffPlan.priceMonthly} ₽/мес
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

export default AccountCard


'use client'

// React Imports
import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'

// MUI Imports
import IconButton from '@mui/material/IconButton'
import Popper from '@mui/material/Popper'
import Fade from '@mui/material/Fade'
import Paper from '@mui/material/Paper'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import MenuList from '@mui/material/MenuList'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'
import { useAccount, useCurrentAccount, useUserAccounts, useSwitchAccount } from '@/hooks/useAccount'

// Type Imports
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

const AccountSwitcher = () => {
  // States
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)

  // Refs
  const anchorRef = useRef<HTMLButtonElement>(null)

  // Hooks
  const { settings } = useSettings()
  const accountContext = useAccount()
  const { currentAccount, userAccounts, loading } = accountContext
  const switchAccount = useSwitchAccount()

  // Показываем компонент только если есть аккаунты
  if (loading || userAccounts.length === 0) {
    return null
  }

  const handleDropdownOpen = () => {
    setOpen(!open)
  }

  const handleDropdownClose = (event?: MouseEvent<HTMLLIElement> | (MouseEvent | TouchEvent)) => {
    if (anchorRef.current && anchorRef.current.contains(event?.target as HTMLElement)) {
      return
    }

    setOpen(false)
  }

  const handleSwitchAccount = async (accountId: string) => {
    if (accountId === currentAccount?.id) {
      setOpen(false)
      return
    }

    setSwitching(accountId)
    try {
      await switchAccount(accountId)
      setOpen(false)
    } catch (error) {
      console.error('Failed to switch account:', error)
    } finally {
      setSwitching(null)
    }
  }

  return (
    <>
      <IconButton
        ref={anchorRef}
        onClick={handleDropdownOpen}
        className='!text-textPrimary'
        title={currentAccount?.name || 'Аккаунты'}
      >
        <i className={currentAccount ? accountTypeIcons[currentAccount.type as AccountType] || 'ri-user-line' : 'ri-user-line'} />
      </IconButton>
      <Popper
        open={open}
        transition
        disablePortal
        placement='bottom-end'
        anchorEl={anchorRef.current}
        className='min-is-[280px] !mbs-4 z-[1]'
      >
        {({ TransitionProps, placement }) => (
          <Fade
            {...TransitionProps}
            style={{
              transformOrigin: placement === 'bottom-end' ? 'right top' : 'left top'
            }}
          >
            <Paper className={settings.skin === 'bordered' ? 'border shadow-none' : 'shadow-lg'}>
              <ClickAwayListener onClickAway={e => handleDropdownClose(e as MouseEvent | TouchEvent)}>
                <MenuList>
                  {/* Заголовок */}
                  <div className='flex items-center plb-2 pli-4 gap-2' tabIndex={-1}>
                    <Box className='flex items-center gap-2 flex-col items-start'>
                      <Typography variant='caption' color='text.secondary'>
                        Текущий аккаунт
                      </Typography>
                      {currentAccount && (
                        <Box className='flex items-center gap-2'>
                          <i className={accountTypeIcons[currentAccount.type as AccountType] || 'ri-user-line'} />
                          <Typography className='font-medium' color='text.primary'>
                            {currentAccount.name}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </div>
                  <Divider className='mlb-1' />

                  {/* Список аккаунтов */}
                  {userAccounts.length > 0 ? (
                    userAccounts.map(account => {
                      const isCurrent = account.id === currentAccount?.id
                      const isSwitching = switching === account.id

                      return (
                        <MenuItem
                          key={account.id}
                          onClick={() => handleSwitchAccount(account.id)}
                          disabled={isSwitching}
                          selected={isCurrent}
                          className='gap-3'
                        >
                          <Box className='flex items-center gap-2 flex-1'>
                            <i className={accountTypeIcons[account.type as AccountType] || 'ri-user-line'} />
                            <Box className='flex flex-col flex-1'>
                              <Typography color='text.primary' className='font-medium'>
                                {account.name}
                              </Typography>
                              <Box className='flex items-center gap-2 mts-1'>
                                <Chip
                                  label={accountTypeLabels[account.type as AccountType] || account.type}
                                  size='small'
                                  variant='outlined'
                                  className='text-xs'
                                />
                                <Chip
                                  label={account.tariffPlan.name}
                                  size='small'
                                  color={account.tariffPlan.code === 'FREE' ? 'default' : 'primary'}
                                  variant='outlined'
                                  className='text-xs'
                                />
                                <Chip
                                  label={account.status}
                                  size='small'
                                  color={accountStateColors[account.status as keyof typeof accountStateColors] || 'default'}
                                  variant='outlined'
                                  className='text-xs'
                                />
                              </Box>
                            </Box>
                            {isSwitching && (
                              <CircularProgress size={16} />
                            )}
                            {isCurrent && !isSwitching && (
                              <i className='ri-check-line text-success' />
                            )}
                          </Box>
                        </MenuItem>
                      )
                    })
                  ) : (
                    <MenuItem disabled>
                      <Typography color='text.secondary' variant='body2'>
                        Нет доступных аккаунтов
                      </Typography>
                    </MenuItem>
                  )}

                  <Divider className='mlb-1' />

                  {/* Действия */}
                  <MenuItem
                    className='gap-3'
                    onClick={e => {
                      handleDropdownClose(e)
                      // TODO: Переход на страницу управления аккаунтами
                      window.location.href = '/accounts'
                    }}
                  >
                    <i className='ri-settings-3-line' />
                    <Typography color='text.primary'>Управление аккаунтами</Typography>
                  </MenuItem>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  )
}

export default AccountSwitcher


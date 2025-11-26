'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import Tooltip from '@mui/material/Tooltip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'

// Type Imports
import type { AccountManagerWithUser } from '@/types/accounts/interfaces'

type Props = {
  managers: AccountManagerWithUser[]
  onRevoke?: (managerId: string) => Promise<void>
  onUpdatePermissions?: (managerId: string, permissions: string[]) => Promise<void>
  loading?: boolean
}

const ManagerList = ({
  managers,
  onRevoke,
  onUpdatePermissions,
  loading = false
}: Props) => {
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)

  const handleRevoke = async () => {
    if (confirmRevoke && onRevoke) {
      await onRevoke(confirmRevoke)
      setConfirmRevoke(null)
    }
  }

  const getPermissionChips = (manager: AccountManagerWithUser) => {
    const chips = []

    // Все менеджеры имеют право на просмотр
    chips.push(
      <Chip key='view' label='Просмотр' size='small' variant='outlined' color='default' />
    )

    if (manager.canEdit) {
      chips.push(
        <Chip key='edit' label='Редактирование' size='small' variant='outlined' color='info' />
      )
    }

    if (manager.canManage) {
      chips.push(
        <Chip key='manage' label='Управление' size='small' variant='outlined' color='warning' />
      )
    }

    if (manager.canDelete) {
      chips.push(
        <Chip key='delete' label='Удаление' size='small' variant='outlined' color='error' />
      )
    }

    return chips
  }

  if (managers.length === 0) {
    return (
      <Card variant='outlined'>
        <CardContent>
          <Box className='flex flex-col items-center justify-center py-8'>
            <i className='ri-user-add-line text-5xl text-textSecondary mb-4' />
            <Typography variant='body1' color='text.secondary'>
              Менеджеры не назначены
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              Назначьте менеджеров для совместного управления аккаунтом
            </Typography>
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Пользователь</TableCell>
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
                    <Avatar
                      src={manager.user.avatar || ''}
                      alt={manager.user.fullName || manager.user.email || ''}
                    >
                      {(manager.user.fullName || manager.user.email || '?')[0].toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant='body2' className='font-medium'>
                        {manager.user.fullName || 'Без имени'}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {manager.user.email}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box className='flex flex-wrap gap-1'>
                    {getPermissionChips(manager)}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant='body2'>
                    {new Date(manager.createdAt).toLocaleDateString('ru-RU')}
                  </Typography>
                </TableCell>
                <TableCell align='right'>
                  <Box className='flex justify-end gap-1'>
                    {onUpdatePermissions && (
                      <Tooltip title='Изменить права'>
                        <IconButton
                          size='small'
                          onClick={() => {
                            // TODO: открыть диалог редактирования прав
                          }}
                          disabled={loading}
                        >
                          <i className='ri-settings-3-line' />
                        </IconButton>
                      </Tooltip>
                    )}
                    {onRevoke && (
                      <Tooltip title='Отозвать доступ'>
                        <IconButton
                          size='small'
                          color='error'
                          onClick={() => setConfirmRevoke(manager.id)}
                          disabled={loading}
                        >
                          <i className='ri-user-unfollow-line' />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Диалог подтверждения отзыва */}
      <Dialog open={!!confirmRevoke} onClose={() => setConfirmRevoke(null)}>
        <DialogTitle>Отозвать доступ?</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите отозвать доступ у этого менеджера? Он потеряет доступ к аккаунту.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRevoke(null)}>
            Отмена
          </Button>
          <Button variant='contained' color='error' onClick={handleRevoke}>
            Отозвать
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default ManagerList


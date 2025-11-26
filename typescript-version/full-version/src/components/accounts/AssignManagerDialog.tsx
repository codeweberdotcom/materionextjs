'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'

type ManagerPermissions = {
  canEdit: boolean
  canManage: boolean
  canDelete: boolean
}

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (email: string, permissions: ManagerPermissions) => Promise<void>
  accountName: string
}

const AssignManagerDialog = ({
  open,
  onClose,
  onSubmit,
  accountName
}: Props) => {
  const [email, setEmail] = useState('')
  const [permissions, setPermissions] = useState<ManagerPermissions>({
    canEdit: false,
    canManage: false,
    canDelete: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Email пользователя обязателен')
      return
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Введите корректный email')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onSubmit(email, permissions)
      setEmail('')
      setPermissions({
        canEdit: false,
        canManage: false,
        canDelete: false
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setError(null)
      setEmail('')
      onClose()
    }
  }

  const handlePermissionChange = (key: keyof ManagerPermissions) => {
    setPermissions(prev => {
      const newPermissions = { ...prev, [key]: !prev[key] }

      // canManage включает canEdit
      if (key === 'canManage' && newPermissions.canManage) {
        newPermissions.canEdit = true
      }

      // canDelete требует canManage
      if (key === 'canDelete' && newPermissions.canDelete) {
        newPermissions.canManage = true
        newPermissions.canEdit = true
      }

      return newPermissions
    })
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
      <DialogTitle>
        Назначить менеджера
      </DialogTitle>
      <DialogContent>
        <Box className='flex flex-col gap-4 pt-2'>
          <Typography variant='body2' color='text.secondary'>
            Назначьте пользователя для управления аккаунтом <strong>{accountName}</strong>
          </Typography>

          {error && (
            <Alert severity='error' onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <TextField
            label='Email пользователя'
            type='email'
            value={email}
            onChange={e => setEmail(e.target.value)}
            fullWidth
            required
            disabled={loading}
            placeholder='user@example.com'
            helperText='Пользователь должен быть зарегистрирован в системе'
          />

          <Divider />

          <Typography variant='subtitle2'>
            Права доступа
          </Typography>

          <Box className='flex flex-col gap-1'>
            <FormControlLabel
              control={
                <Checkbox
                  checked={permissions.canEdit}
                  onChange={() => handlePermissionChange('canEdit')}
                  disabled={loading || permissions.canManage || permissions.canDelete}
                />
              }
              label={
                <Box>
                  <Typography variant='body2'>Редактирование</Typography>
                  <Typography variant='caption' color='text.secondary'>
                    Редактирование данных аккаунта и контента
                  </Typography>
                </Box>
              }
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={permissions.canManage}
                  onChange={() => handlePermissionChange('canManage')}
                  disabled={loading || permissions.canDelete}
                />
              }
              label={
                <Box>
                  <Typography variant='body2'>Управление</Typography>
                  <Typography variant='caption' color='text.secondary'>
                    Полное управление аккаунтом (включая настройки)
                  </Typography>
                </Box>
              }
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={permissions.canDelete}
                  onChange={() => handlePermissionChange('canDelete')}
                  disabled={loading}
                />
              }
              label={
                <Box>
                  <Typography variant='body2'>Удаление</Typography>
                  <Typography variant='caption' color='text.secondary'>
                    Право удалять контент и данные аккаунта
                  </Typography>
                </Box>
              }
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Отмена
        </Button>
        <Button
          variant='contained'
          onClick={handleSubmit}
          disabled={loading}
          startIcon={loading && <CircularProgress size={16} />}
        >
          Назначить
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AssignManagerDialog


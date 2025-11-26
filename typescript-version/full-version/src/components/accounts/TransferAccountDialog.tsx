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
import Typography from '@mui/material/Typography'

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (email: string) => Promise<void>
  accountName: string
}

const TransferAccountDialog = ({
  open,
  onClose,
  onSubmit,
  accountName
}: Props) => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Email пользователя обязателен')
      return
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Введите корректный email')
      return
    }

    if (!confirmed) {
      setConfirmed(true)
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onSubmit(email)
      setEmail('')
      setConfirmed(false)
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
      setConfirmed(false)
      onClose()
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
      <DialogTitle>
        Передать аккаунт
      </DialogTitle>
      <DialogContent>
        <Box className='flex flex-col gap-4 pt-2'>
          {!confirmed ? (
            <>
              <Typography variant='body2' color='text.secondary'>
                Вы собираетесь передать аккаунт <strong>{accountName}</strong> другому пользователю.
                После подтверждения получателем, вы потеряете доступ к этому аккаунту.
              </Typography>

              {error && (
                <Alert severity='error' onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

              <TextField
                label='Email получателя'
                type='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                fullWidth
                required
                disabled={loading}
                placeholder='user@example.com'
                helperText='Пользователь должен быть зарегистрирован в системе'
              />
            </>
          ) : (
            <>
              <Alert severity='warning'>
                <Typography variant='body2'>
                  <strong>Внимание!</strong> Вы уверены, что хотите передать аккаунт{' '}
                  <strong>{accountName}</strong> пользователю <strong>{email}</strong>?
                </Typography>
                <Typography variant='body2' className='mt-2'>
                  После подтверждения получателем:
                </Typography>
                <ul className='list-disc list-inside mt-1'>
                  <li>Вы потеряете доступ к аккаунту</li>
                  <li>Все данные перейдут новому владельцу</li>
                  <li>Это действие нельзя отменить</li>
                </ul>
              </Alert>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Отмена
        </Button>
        {confirmed && (
          <Button onClick={() => setConfirmed(false)} disabled={loading}>
            Назад
          </Button>
        )}
        <Button
          variant='contained'
          color={confirmed ? 'error' : 'primary'}
          onClick={handleSubmit}
          disabled={loading}
          startIcon={loading && <CircularProgress size={16} />}
        >
          {confirmed ? 'Подтвердить передачу' : 'Далее'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default TransferAccountDialog



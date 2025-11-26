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
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'

// Type Imports
import type { AccountType } from '@/types/accounts/types'

type AccountFormData = {
  name: string
  description: string
  type: AccountType
}

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (data: AccountFormData) => Promise<void>
  initialData?: Partial<AccountFormData>
  mode?: 'create' | 'edit'
}

const accountTypes: { value: AccountType; label: string; description: string }[] = [
  {
    value: 'LISTING',
    label: 'Для объявлений',
    description: 'Публикация и управление объявлениями'
  },
  {
    value: 'COMPANY',
    label: 'Компания',
    description: 'Размещение компании и услуг'
  },
  {
    value: 'NETWORK',
    label: 'Сеть компаний',
    description: 'Управление несколькими аккаунтами и назначение менеджеров'
  }
]

const AccountForm = ({
  open,
  onClose,
  onSubmit,
  initialData,
  mode = 'create'
}: Props) => {
  const [formData, setFormData] = useState<AccountFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    type: initialData?.type || 'LISTING'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Название аккаунта обязательно')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onSubmit(formData)
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
      onClose()
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
      <DialogTitle>
        {mode === 'create' ? 'Создать аккаунт' : 'Редактировать аккаунт'}
      </DialogTitle>
      <DialogContent>
        <Box className='flex flex-col gap-4 pt-2'>
          {error && (
            <Alert severity='error' onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <TextField
            label='Название аккаунта'
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            fullWidth
            required
            disabled={loading}
            placeholder='Например: Моя компания'
          />

          <TextField
            label='Описание'
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            fullWidth
            multiline
            rows={3}
            disabled={loading}
            placeholder='Краткое описание аккаунта'
          />

          {mode === 'create' && (
            <FormControl fullWidth>
              <InputLabel>Тип аккаунта</InputLabel>
              <Select
                value={formData.type}
                label='Тип аккаунта'
                onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as AccountType }))}
                disabled={loading}
              >
                {accountTypes.map(type => (
                  <MenuItem key={type.value} value={type.value}>
                    <Box>
                      <Box className='font-medium'>{type.label}</Box>
                      <Box className='text-xs text-textSecondary'>{type.description}</Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
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
          {mode === 'create' ? 'Создать' : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AccountForm



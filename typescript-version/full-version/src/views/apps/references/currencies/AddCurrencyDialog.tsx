'use client'

import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid2'
import IconButton from '@mui/material/IconButton'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'

type Currency = {
  id: string
  name: string
  code: string
  symbol: string
  isActive: boolean
}

type AddCurrencyDialogProps = {
  open: boolean
  handleClose: () => void
  onSubmit: (data: { name: string; code: string; symbol: string; isActive: boolean }) => void
  editCurrency?: Currency | null
  onUpdate?: (data: { id: string; name: string; code: string; symbol: string; isActive: boolean }) => void
}

const AddCurrencyDialog = ({ open, handleClose, onSubmit, editCurrency, onUpdate }: AddCurrencyDialogProps) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    symbol: '',
    isActive: true
  })
  const [errors, setErrors] = useState<{[key: string]: string}>({})

  const isEditMode = !!editCurrency

  // Populate form data when editing
  useEffect(() => {
    if (editCurrency) {
      setFormData({
        name: editCurrency.name,
        code: editCurrency.code,
        symbol: editCurrency.symbol,
        isActive: editCurrency.isActive
      })
    } else {
      setFormData({
        name: '',
        code: '',
        symbol: '',
        isActive: true
      })
    }
  }, [editCurrency])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    const newErrors: {[key: string]: string} = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Currency name is required'
    }

    if (!formData.code.trim()) {
      newErrors.code = 'Currency code is required'
    }

    if (!formData.symbol.trim()) {
      newErrors.symbol = 'Currency symbol is required'
    }

    setErrors(newErrors)

    // If there are errors, don't submit
    if (Object.keys(newErrors).length > 0) {
      return
    }

    if (isEditMode && onUpdate && editCurrency) {
      onUpdate({ ...formData, id: editCurrency.id })
    } else {
      onSubmit(formData)
    }
    handleClose()
  }

  const handleCloseDialog = () => {
    setFormData({ name: '', code: '', symbol: '', isActive: true })
    handleClose()
  }

  return (
    <Dialog fullWidth open={open} onClose={handleCloseDialog} maxWidth='sm'>
      <DialogTitle>{isEditMode ? 'Edit Currency' : 'Add New Currency'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <IconButton onClick={handleCloseDialog} className='absolute block-start-4 inline-end-4'>
            <i className='ri-close-line text-textSecondary' />
          </IconButton>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Currency Name'
                placeholder='US Dollar'
                value={formData.name}
                onChange={e => {
                  setFormData({ ...formData, name: e.target.value })
                  if (errors.name) {
                    setErrors({ ...errors, name: '' })
                  }
                }}
                error={!!errors.name}
                helperText={errors.name}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Currency Code'
                placeholder='USD'
                value={formData.code}
                onChange={e => {
                  setFormData({ ...formData, code: e.target.value })
                  if (errors.code) {
                    setErrors({ ...errors, code: '' })
                  }
                }}
                error={!!errors.code}
                helperText={errors.code}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Currency Symbol'
                placeholder='$'
                value={formData.symbol}
                onChange={e => {
                  setFormData({ ...formData, symbol: e.target.value })
                  if (errors.symbol) {
                    setErrors({ ...errors, symbol: '' })
                  }
                }}
                error={!!errors.symbol}
                helperText={errors.symbol}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                }
                label={formData.isActive ? 'Active' : 'Inactive'}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant='outlined' onClick={handleCloseDialog}>
            Cancel
          </Button>
          <Button variant='contained' type='submit'>
            {isEditMode ? 'Update Currency' : 'Add Currency'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default AddCurrencyDialog
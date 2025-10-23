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
import Box from '@mui/material/Box'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'


type State = {
  id: string
  name: string
  code: string
  isActive: boolean
}

type AddStateDialogProps = {
  open: boolean
  handleClose: () => void
  onSubmit: (data: { name: string; code: string }) => void
  editState?: State | null
  onUpdate?: (data: { id: string; name: string; code: string }) => void
}

const AddStateDialog = ({ open, handleClose, onSubmit, editState, onUpdate }: AddStateDialogProps) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    isActive: true
  })
  const [errors, setErrors] = useState<{[key: string]: string}>({})

  const isEditMode = !!editState


  // Populate form data when editing
  useEffect(() => {
    if (editState) {
      setFormData({
        name: editState.name,
        code: editState.code,
        isActive: editState.isActive
      })
    } else {
      setFormData({
        name: '',
        code: '',
        isActive: true
      })
    }
  }, [editState])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    const newErrors: {[key: string]: string} = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Название штата обязательно'
    }

    if (!formData.code.trim()) {
      newErrors.code = 'Код штата обязателен'
    }


    setErrors(newErrors)

    // If there are errors, don't submit
    if (Object.keys(newErrors).length > 0) {
      return
    }

    if (isEditMode && onUpdate && editState) {
      onUpdate({ ...formData, id: editState.id })
    } else {
      onSubmit(formData)
    }
    handleClose()
  }

  const handleCloseDialog = () => {
    setFormData({ name: '', code: '', isActive: true })
    handleClose()
  }

  return (
    <Dialog fullWidth open={open} onClose={handleCloseDialog} maxWidth='sm'>
      <DialogTitle>{isEditMode ? 'Edit State' : 'Add New State'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <IconButton onClick={handleCloseDialog} className='absolute block-start-4 inline-end-4'>
            <i className='ri-close-line text-textSecondary' />
          </IconButton>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='State Name'
                placeholder='California'
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
                label='State Code'
                placeholder='CA'
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                error={!!errors.code}
                helperText={errors.code}
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
            {isEditMode ? 'Update State' : 'Add State'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default AddStateDialog
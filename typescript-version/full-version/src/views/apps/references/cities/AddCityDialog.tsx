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
import Autocomplete from '@mui/material/Autocomplete'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'

type Country = {
  id: string
  name: string
  code: string
}

type City = {
  id: string
  name: string
  code: string
  isActive: boolean
}

type AddCityDialogProps = {
  open: boolean
  handleClose: () => void
  onSubmit: (data: { name: string; code: string; isActive: boolean }) => void
  editCity?: City | null
  onUpdate?: (data: { id: string; name: string; code: string; isActive: boolean }) => void
}

const AddCityDialog = ({ open, handleClose, onSubmit, editCity, onUpdate }: AddCityDialogProps) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    isActive: true
  })

  const isEditMode = !!editCity

  // Populate form data when editing
  useEffect(() => {
    if (editCity) {
      setFormData({
        name: editCity.name,
        code: editCity.code,
        isActive: editCity.isActive
      })
    } else {
      setFormData({
        name: '',
        code: '',
        isActive: true
      })
    }
  }, [editCity])

  const handleCloseDialog = () => {
    setFormData({ name: '', code: '', isActive: true })
    handleClose()
  }


  return (
    <Dialog fullWidth open={open} onClose={handleCloseDialog} maxWidth='sm'>
      <DialogTitle>{isEditMode ? 'Edit City' : 'Add New City'}</DialogTitle>
      <DialogContent>
        <IconButton onClick={handleCloseDialog} className='absolute block-start-4 inline-end-4'>
          <i className='ri-close-line text-textSecondary' />
        </IconButton>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label='City Name'
              placeholder='Los Angeles'
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label='City Code'
              placeholder='LA'
              value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value })}
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
        <Button
          variant='contained'
          onClick={() => {
            if (isEditMode && onUpdate && editCity) {
              onUpdate({ ...formData, id: editCity.id })
            } else {
              onSubmit(formData)
            }
            handleClose()
          }}
        >
          {isEditMode ? 'Update City' : 'Add City'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AddCityDialog
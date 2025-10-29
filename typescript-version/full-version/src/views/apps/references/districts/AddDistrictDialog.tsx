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

type District = {
  id: string
  name: string
  code: string
  isActive: boolean
}

type AddDistrictDialogProps = {
  open: boolean
  handleClose: () => void
  onSubmit: (data: { name: string; code: string; isActive: boolean }) => void
  editDistrict?: District | null
  onUpdate?: (data: { id: string; name: string; code: string; isActive: boolean }) => void
}

const AddDistrictDialog = ({ open, handleClose, onSubmit, editDistrict, onUpdate }: AddDistrictDialogProps) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    isActive: true
  })

  const isEditMode = !!editDistrict

  // Populate form data when editing
  useEffect(() => {
    if (editDistrict) {
      setFormData({
        name: editDistrict.name,
        code: editDistrict.code,
        isActive: editDistrict.isActive
      })
    } else {
      setFormData({
        name: '',
        code: '',
        isActive: true
      })
    }
  }, [editDistrict])

  const handleCloseDialog = () => {
    setFormData({ name: '', code: '', isActive: true })
    handleClose()
  }


  return (
    <Dialog fullWidth open={open} onClose={handleCloseDialog} maxWidth='sm'>
      <DialogTitle>{isEditMode ? 'Edit District' : 'Add New District'}</DialogTitle>
      <DialogContent>
        <IconButton onClick={handleCloseDialog} className='absolute block-start-4 inline-end-4'>
          <i className='ri-close-line text-textSecondary' />
        </IconButton>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label='District Name'
              placeholder='Downtown'
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label='District Code'
              placeholder='DT'
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
            if (isEditMode && onUpdate && editDistrict) {
              onUpdate({ ...formData, id: editDistrict.id })
            } else {
              onSubmit(formData)
            }

            handleClose()
          }}
        >
          {isEditMode ? 'Update District' : 'Add District'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AddDistrictDialog
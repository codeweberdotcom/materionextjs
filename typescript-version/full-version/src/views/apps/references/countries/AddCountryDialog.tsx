'use client'

import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid2'
import IconButton from '@mui/material/IconButton'

type AddCountryDialogProps = {
  open: boolean
  handleClose: () => void
  onSubmit: (data: { name: string; code: string }) => void
}

const AddCountryDialog = ({ open, handleClose, onSubmit }: AddCountryDialogProps) => {
  const [formData, setFormData] = useState({
    name: '',
    code: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
    setFormData({ name: '', code: '' })
  }

  const handleCloseDialog = () => {
    setFormData({ name: '', code: '' })
    handleClose()
  }

  return (
    <Dialog fullWidth open={open} onClose={handleCloseDialog} maxWidth='sm'>
      <DialogTitle>Add New Country</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <IconButton onClick={handleCloseDialog} className='absolute block-start-4 inline-end-4'>
            <i className='ri-close-line text-textSecondary' />
          </IconButton>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Country Name'
                placeholder='United States'
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Country Code'
                placeholder='US'
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                required
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant='outlined' onClick={handleCloseDialog}>
            Cancel
          </Button>
          <Button variant='contained' type='submit'>
            Add Country
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default AddCountryDialog
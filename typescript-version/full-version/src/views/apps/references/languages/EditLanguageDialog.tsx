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

type Language = {
  id: string
  name: string
  code: string
  isActive: boolean
}

type EditLanguageDialogProps = {
  open: boolean
  handleClose: () => void
  language: Language
  onSubmit: (data: { name: string; code: string }) => void
}

const EditLanguageDialog = ({ open, handleClose, language, onSubmit }: EditLanguageDialogProps) => {
  const [formData, setFormData] = useState({
    name: '',
    code: ''
  })

  useEffect(() => {
    if (language) {
      setFormData({
        name: language.name,
        code: language.code
      })
    }
  }, [language])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handleCloseDialog = () => {
    handleClose()
  }

  return (
    <Dialog fullWidth open={open} onClose={handleCloseDialog} maxWidth='sm'>
      <DialogTitle>Edit Language</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <IconButton onClick={handleCloseDialog} className='absolute block-start-4 inline-end-4'>
            <i className='ri-close-line text-textSecondary' />
          </IconButton>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Language Name'
                placeholder='English'
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Language Code'
                placeholder='en'
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
            Save Changes
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default EditLanguageDialog
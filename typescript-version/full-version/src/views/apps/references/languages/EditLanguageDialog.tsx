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

import { useTranslation } from '@/contexts/TranslationContext'

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
  onSubmit: (data: { name: string; code: string; isActive: boolean }) => void
}

const EditLanguageDialog = ({ open, handleClose, language, onSubmit }: EditLanguageDialogProps) => {
  const dictionary = useTranslation()

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    isActive: true
  })

  useEffect(() => {
    if (language) {
      setFormData({
        name: language.name,
        code: language.code,
        isActive: language.isActive
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
      <DialogTitle>{dictionary.navigation.editLanguage}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <IconButton onClick={handleCloseDialog} className='absolute block-start-4 inline-end-4'>
            <i className='ri-close-line text-textSecondary' />
          </IconButton>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={dictionary.navigation.language}
                placeholder='English'
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={dictionary.navigation.code}
                placeholder='en'
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
                label={formData.isActive ? dictionary.navigation.active : dictionary.navigation.inactive}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant='outlined' onClick={handleCloseDialog}>
            {dictionary.navigation.cancel}
          </Button>
          <Button variant='contained' type='submit'>
            {dictionary.navigation.saveChanges}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default EditLanguageDialog
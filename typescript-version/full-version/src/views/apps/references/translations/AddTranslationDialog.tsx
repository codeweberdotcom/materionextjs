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
import Autocomplete from '@mui/material/Autocomplete'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

type Translation = {
  id: string
  key: string
  language: string
  value: string
  namespace: string
  isActive: boolean
}

type AddTranslationDialogProps = {
  open: boolean
  handleClose: () => void
  onSubmit: (data: { key: string; language: string; value: string; namespace: string; isActive: boolean }) => void
  editTranslation?: Translation | null
  onUpdate?: (data: { id: string; key: string; language: string; value: string; namespace: string; isActive: boolean }) => void
}

const AddTranslationDialog = ({ open, handleClose, onSubmit, editTranslation, onUpdate }: AddTranslationDialogProps) => {
  // Hooks
  const dictionary = useTranslation()

  const [formData, setFormData] = useState({
    key: '',
    language: '',
    value: '',
    namespace: 'common',
    isActive: true
  })

  const [errors, setErrors] = useState<{[key: string]: string}>({})

  const isEditMode = !!editTranslation

  // Available languages and namespaces
  const [languages, setLanguages] = useState<{code: string, name: string}[]>([])

  useEffect(() => {
    import('@/data/languages.json').then(data => setLanguages(data.default))
  }, [])

  const namespaces = [
    { value: 'common', label: 'Common' },
    { value: 'navigation', label: 'Navigation' },
    { value: 'forms', label: 'Forms' },
    { value: 'messages', label: 'Messages' },
    { value: 'validation', label: 'Validation' }
  ]

  // Populate form data when editing
  useEffect(() => {
    if (editTranslation) {
      setFormData({
        key: editTranslation.key,
        language: editTranslation.language,
        value: editTranslation.value,
        namespace: editTranslation.namespace,
        isActive: editTranslation.isActive
      })
    } else {
      setFormData({
        key: '',
        language: '',
        value: '',
        namespace: 'common',
        isActive: true
      })
    }
  }, [editTranslation])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    const newErrors: {[key: string]: string} = {}

    if (!formData.key.trim()) {
      newErrors.key = 'Translation key is required'
    }

    if (!formData.language.trim()) {
      newErrors.language = 'Language is required'
    }

    if (!formData.value.trim()) {
      newErrors.value = 'Translation value is required'
    }

    setErrors(newErrors)

    // If there are errors, don't submit
    if (Object.keys(newErrors).length > 0) {
      return
    }

    if (isEditMode && onUpdate && editTranslation) {
      onUpdate({ ...formData, id: editTranslation.id })
    } else {
      onSubmit(formData)
    }

    handleClose()
  }

  const handleCloseDialog = () => {
    setFormData({ key: '', language: 'en', value: '', namespace: 'common', isActive: true })
    setErrors({})
    handleClose()
  }

  return (
    <Dialog fullWidth open={open} onClose={handleCloseDialog} maxWidth='sm'>
      <DialogTitle>{isEditMode ? dictionary.navigation.editTranslationTitle : dictionary.navigation.addNewTranslationTitle}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <IconButton onClick={handleCloseDialog} className='absolute block-start-4 inline-end-4'>
            <i className='ri-close-line text-textSecondary' />
          </IconButton>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={dictionary.navigation.translationKey}
                placeholder='navigation.dashboards'
                value={formData.key}
                onChange={e => {
                  setFormData({ ...formData, key: e.target.value })

                  if (errors.key) {
                    setErrors({ ...errors, key: '' })
                  }
                }}
                error={!!errors.key}
                helperText={errors.key}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                options={languages}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                value={languages.find(lang => lang.code === formData.language) || null}
                onChange={(event, newValue) => {
                  setFormData({
                    ...formData,
                    language: newValue ? newValue.code : ''
                  })

                  if (errors.language) {
                    setErrors({ ...errors, language: '' })
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={dictionary.navigation.language}
                    placeholder='Select language...'
                    error={!!errors.language}
                    helperText={errors.language}
                    required
                  />
                )}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props

                  
return (
                    <li key={option.code} {...otherProps}>
                      {option.name}
                    </li>
                  )
                }}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={dictionary.navigation.translationValue}
                placeholder='Dashboards'
                value={formData.value}
                onChange={e => {
                  setFormData({ ...formData, value: e.target.value })

                  if (errors.value) {
                    setErrors({ ...errors, value: '' })
                  }
                }}
                error={!!errors.value}
                helperText={errors.value}
                required
                multiline
                rows={3}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                options={namespaces}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.label}
                value={namespaces.find(ns => ns.value === formData.namespace) || namespaces[0]}
                onChange={(event, newValue) => {
                  setFormData({
                    ...formData,
                    namespace: newValue ? newValue.value : 'common'
                  })
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={dictionary.navigation.namespace}
                    placeholder='Select namespace...'
                  />
                )}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props

                  
return (
                    <li key={option.value} {...otherProps}>
                      {option.label}
                    </li>
                  )
                }}
                fullWidth
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
            {isEditMode ? dictionary.navigation.updateTranslation : dictionary.navigation.addTranslation}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default AddTranslationDialog
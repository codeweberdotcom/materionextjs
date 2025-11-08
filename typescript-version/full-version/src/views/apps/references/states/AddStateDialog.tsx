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
import Autocomplete from '@mui/material/Autocomplete'
import Chip from '@mui/material/Chip'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

type City = {
  id: string
  name: string
  code: string
  isActive: boolean
}

type State = {
  id: string
  name: string
  code: string
  isActive: boolean
  cities?: Array<{
    id: string
    name: string
    code: string
    isActive: boolean
  }>
}

type AddStateDialogProps = {
  open: boolean
  handleClose: () => void
  onSubmit: (data: { name: string; code: string; cities: string[]; isActive: boolean }) => void
  editState?: State | null
  onUpdate?: (data: { id: string; name: string; code: string; cities: string[]; isActive: boolean }) => void
}

const AddStateDialog = ({ open, handleClose, onSubmit, editState, onUpdate }: AddStateDialogProps) => {
  // Hooks
  const dictionary = useTranslation()

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    cities: [] as string[],
    isActive: true
  })

  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [cities, setCities] = useState<City[]>([])

  const isEditMode = !!editState

  useEffect(() => {
    const fetchCities = async () => {
      try {
        const response = await fetch('/api/cities')

        if (response.ok) {
          const data = await response.json()

          setCities(data)
        }
      } catch (error) {
        console.error('Error fetching cities:', error)
      }
    }

    if (open) {
      fetchCities()
    }
  }, [open])

  // Populate form data when editing
  useEffect(() => {
    if (editState) {
      setFormData({
        name: editState.name,
        code: editState.code,
        cities: editState.cities ? editState.cities.map(c => c.id) : [],
        isActive: editState.isActive
      })
    } else {
      setFormData({
        name: '',
        code: '',
        cities: [],
        isActive: true
      })
    }
  }, [editState])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    const newErrors: {[key: string]: string} = {}

    if (!formData.name.trim()) {
      newErrors.name = dictionary.navigation.stateName + ' обязательно'
    }

    if (!formData.code.trim()) {
      newErrors.code = dictionary.navigation.stateCode + ' обязателен'
    }


    setErrors(newErrors)

    // If there are errors, don't submit
    if (Object.keys(newErrors).length > 0) {
      return
    }

    if (isEditMode && onUpdate && editState) {
      onUpdate({ ...formData, id: editState.id })
    } else {
      onSubmit({ ...formData, cities: formData.cities })
    }

    handleClose()
  }

  const handleCloseDialog = () => {
    setFormData({ name: '', code: '', cities: [], isActive: true })
    handleClose()
  }

  return (
    <Dialog fullWidth open={open} onClose={handleCloseDialog} maxWidth='sm'>
      <DialogTitle>{isEditMode ? dictionary.navigation.editStateTitle : dictionary.navigation.addStateTitle}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <IconButton onClick={handleCloseDialog} className='absolute block-start-4 inline-end-4'>
            <i className='ri-close-line text-textSecondary' />
          </IconButton>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={dictionary.navigation.stateName}
                placeholder={dictionary.navigation.stateName}
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
                label={dictionary.navigation.stateCode}
                placeholder={dictionary.navigation.stateCode}
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                error={!!errors.code}
                helperText={errors.code}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                multiple
                id='cities-autocomplete'
                options={cities}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                value={cities.filter(city => formData.cities.includes(city.id))}
                onChange={(event, newValue) => {
                  setFormData({
                    ...formData,
                    cities: newValue.map(city => typeof city === 'string' ? city : city.id)
                  })
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={dictionary.navigation.cities}
                    placeholder={dictionary.navigation.searchCity}
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...chipProps } = getTagProps({ index })
                    const city = cities.find(c => c.id === (typeof option === 'string' ? option : option.id))

                    
return (
                      <Chip
                        key={city?.id || index}
                        label={city?.name || (typeof option === 'string' ? option : option.name)}
                        size='small'
                        {...chipProps}
                      />
                    )
                  })
                }
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props

                  
return (
                    <li key={option.id} {...otherProps}>
                      {option.name}
                    </li>
                  )
                }}
                filterSelectedOptions
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
            {isEditMode ? dictionary.navigation.updateState : dictionary.navigation.addState}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default AddStateDialog
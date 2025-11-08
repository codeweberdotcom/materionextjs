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
import Chip from '@mui/material/Chip'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

type Country = {
  id: string
  name: string
  code: string
}

type District = {
  id: string
  name: string
  code: string
  isActive: boolean
}

type City = {
  id: string
  name: string
  code: string
  isActive: boolean
  districts?: Array<{
    id: string
    name: string
    code: string
    isActive: boolean
  }>
}

type AddCityDialogProps = {
  open: boolean
  handleClose: () => void
  onSubmit: (data: { name: string; code: string; districts: string[]; isActive: boolean }) => void
  editCity?: City | null
  onUpdate?: (data: { id: string; name: string; code: string; districts: string[]; isActive: boolean }) => void
}

const AddCityDialog = ({ open, handleClose, onSubmit, editCity, onUpdate }: AddCityDialogProps) => {
  const dictionary = useTranslation()

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    districts: [] as string[],
    isActive: true
  })

  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [districts, setDistricts] = useState<District[]>([])

  const isEditMode = !!editCity

  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const response = await fetch('/api/districts')

        if (response.ok) {
          const data = await response.json()

          setDistricts(data)
        }
      } catch (error) {
        console.error('Error fetching districts:', error)
      }
    }

    if (open) {
      fetchDistricts()
    }
  }, [open])

  // Populate form data when editing
  useEffect(() => {
    if (editCity) {
      setFormData({
        name: editCity.name,
        code: editCity.code,
        districts: editCity.districts ? editCity.districts.map(d => d.id) : [],
        isActive: editCity.isActive
      })
    } else {
      setFormData({
        name: '',
        code: '',
        districts: [],
        isActive: true
      })
    }
  }, [editCity])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    const newErrors: {[key: string]: string} = {}

    if (!formData.name.trim()) {
      newErrors.name = `${dictionary.navigation.cityName} is required`
    }

    if (!formData.code.trim()) {
      newErrors.code = `${dictionary.navigation.cityCode} is required`
    }

    setErrors(newErrors)

    // If there are errors, don't submit
    if (Object.keys(newErrors).length > 0) {
      return
    }

    if (isEditMode && onUpdate && editCity) {
      onUpdate({ ...formData, id: editCity.id })
    } else {
      onSubmit({ ...formData, districts: formData.districts })
    }

    handleClose()
  }

  const handleCloseDialog = () => {
    setFormData({ name: '', code: '', districts: [], isActive: true })
    handleClose()
  }


  return (
    <Dialog fullWidth open={open} onClose={handleCloseDialog} maxWidth='sm'>
      <DialogTitle>{isEditMode ? dictionary.navigation.editCityTitle : dictionary.navigation.addCityTitle}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <IconButton onClick={handleCloseDialog} className='absolute block-start-4 inline-end-4'>
            <i className='ri-close-line text-textSecondary' />
          </IconButton>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={dictionary.navigation.cityName}
                placeholder='Los Angeles'
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
                label={dictionary.navigation.cityCode}
                placeholder='LA'
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
              <Autocomplete
                multiple
                id='districts-autocomplete'
                options={districts}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                value={districts.filter(district => formData.districts.includes(district.id))}
                onChange={(event, newValue) => {
                  setFormData({
                    ...formData,
                    districts: newValue.map(district => typeof district === 'string' ? district : district.id)
                  })
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={dictionary.navigation.districts}
                    placeholder='Search and select districts...'
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...chipProps } = getTagProps({ index })
                    const district = districts.find(d => d.id === (typeof option === 'string' ? option : option.id))

                    
return (
                      <Chip
                        key={district?.id || index}
                        label={district?.name || (typeof option === 'string' ? option : option.name)}
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
            {isEditMode ? dictionary.navigation.updateCity : dictionary.navigation.addCity}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default AddCityDialog
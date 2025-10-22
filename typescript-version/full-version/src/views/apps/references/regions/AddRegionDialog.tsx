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
import Autocomplete from '@mui/material/Autocomplete'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'

type Country = {
  id: string
  name: string
  code: string
  isActive: boolean
}

type Region = {
  id: string
  name: string
  code: string
  isActive: boolean
  country: {
    id: string
    name: string
    code: string
  }
}

type AddRegionDialogProps = {
  open: boolean
  handleClose: () => void
  onSubmit: (data: { name: string; code: string; countryId: string }) => void
  editRegion?: Region | null
  onUpdate?: (data: { id: string; name: string; code: string; countryId: string }) => void
}

const AddRegionDialog = ({ open, handleClose, onSubmit, editRegion, onUpdate }: AddRegionDialogProps) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    countryId: '',
    isActive: true
  })
  const [countries, setCountries] = useState<Country[]>([])

  const isEditMode = !!editRegion

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await fetch('/api/countries')
        if (response.ok) {
          const data = await response.json()
          setCountries(data)
        }
      } catch (error) {
        console.error('Error fetching countries:', error)
      }
    }

    if (open) {
      fetchCountries()
    }
  }, [open])

  // Populate form data when editing
  useEffect(() => {
    if (editRegion) {
      setFormData({
        name: editRegion.name,
        code: editRegion.code,
        countryId: editRegion.country.id,
        isActive: editRegion.isActive
      })
    } else {
      setFormData({
        name: '',
        code: '',
        countryId: '',
        isActive: true
      })
    }
  }, [editRegion])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEditMode && onUpdate && editRegion) {
      onUpdate({ ...formData, id: editRegion.id })
    } else {
      onSubmit(formData)
    }
    handleClose()
  }

  const handleCloseDialog = () => {
    setFormData({ name: '', code: '', countryId: '', isActive: true })
    handleClose()
  }

  return (
    <Dialog fullWidth open={open} onClose={handleCloseDialog} maxWidth='sm'>
      <DialogTitle>{isEditMode ? 'Edit Region' : 'Add New Region'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <IconButton onClick={handleCloseDialog} className='absolute block-start-4 inline-end-4'>
            <i className='ri-close-line text-textSecondary' />
          </IconButton>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Region Name'
                placeholder='Republic of Adygea'
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Region Code'
                placeholder='AD'
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                id='country-autocomplete'
                options={countries}
                getOptionLabel={(option) => option.name}
                value={countries.find(country => country.id === formData.countryId) || null}
                onChange={(event, newValue) => {
                  setFormData({
                    ...formData,
                    countryId: newValue ? newValue.id : ''
                  })
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label='Country'
                    placeholder='Search and select country...'
                    required
                  />
                )}
                renderOption={(props, option) => {
                  const { key, ...restProps } = props
                  return (
                    <Box key={key} component='li' {...restProps}>
                      {option.name}
                    </Box>
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
            {isEditMode ? 'Update Region' : 'Add Region'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default AddRegionDialog
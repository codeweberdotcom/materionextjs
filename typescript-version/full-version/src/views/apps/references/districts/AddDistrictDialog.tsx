'use client'

import { useState, useEffect } from 'react'

import { useParams } from 'next/navigation'

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
import CircularProgress from '@mui/material/CircularProgress'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

type City = {
  id: string
  name: string
  code: string
}

type District = {
  id: string
  name: string
  code: string
  isActive: boolean
  cityId?: string | null
  city?: City | null
}

type AddDistrictDialogProps = {
  open: boolean
  handleClose: () => void
  onSubmit: (data: { name: string; code: string; cityId: string | null; isActive: boolean }) => void
  editDistrict?: District | null
  onUpdate?: (data: { id: string; name: string; code: string; cityId: string | null; isActive: boolean }) => void
}

const AddDistrictDialog = ({ open, handleClose, onSubmit, editDistrict, onUpdate }: AddDistrictDialogProps) => {
  const dictionary = useTranslation()
  const { lang: locale } = useParams()

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    cityId: null as string | null,
    isActive: true
  })

  const [cities, setCities] = useState<City[]>([])
  const [citiesLoading, setCitiesLoading] = useState(false)

  const isEditMode = !!editDistrict

  useEffect(() => {
    const fetchCities = async () => {
      setCitiesLoading(true)

      try {
        const response = await fetch(`/api/cities?locale=${locale}`)

        if (response.ok) {
          const data = await response.json()

          setCities(data)
        }
      } catch (error) {
        console.error('Error fetching cities:', error)
      } finally {
        setCitiesLoading(false)
      }
    }

    if (open) {
      fetchCities()
    }
  }, [open])

  // Populate form data when editing
  useEffect(() => {
    if (editDistrict) {
      setFormData({
        name: editDistrict.name,
        code: editDistrict.code,
        cityId: editDistrict.cityId || editDistrict.city?.id || null,
        isActive: editDistrict.isActive
      })
    } else {
      setFormData({
        name: '',
        code: '',
        cityId: null,
        isActive: true
      })
    }
  }, [editDistrict])

  const handleCloseDialog = () => {
    setFormData({ name: '', code: '', cityId: null, isActive: true })
    handleClose()
  }

  const selectedCity = cities.find(c => c.id === formData.cityId) || null

  return (
    <Dialog fullWidth open={open} onClose={handleCloseDialog} maxWidth='sm'>
      <DialogTitle>{isEditMode ? dictionary.navigation.editDistrictTitle : dictionary.navigation.addDistrictTitle}</DialogTitle>
      <DialogContent sx={{ paddingBlockStart: '1rem !important' }}>
        <IconButton onClick={handleCloseDialog} className='absolute block-start-4 inline-end-4'>
          <i className='ri-close-line text-textSecondary' />
        </IconButton>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label={dictionary.navigation.districtName}
              placeholder='Downtown'
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label={dictionary.navigation.districtCode}
              placeholder='DT'
              value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value })}
              required
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Autocomplete
              id='city-autocomplete'
              options={cities}
              loading={citiesLoading}
              loadingText={dictionary.navigation.loading}
              disabled={citiesLoading}
              getOptionLabel={(option) => option.name}
              value={selectedCity}
              onChange={(event, newValue) => {
                setFormData({
                  ...formData,
                  cityId: newValue ? newValue.id : null
                })
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={dictionary.navigation.city}
                  placeholder={dictionary.navigation.selectCity}
                  slotProps={{
                    input: {
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {citiesLoading ? <CircularProgress color='inherit' size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      )
                    }
                  }}
                />
              )}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props

                return (
                  <li key={option.id} {...otherProps}>
                    {option.name}
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
          {isEditMode ? dictionary.navigation.updateDistrict : dictionary.navigation.addDistrict}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AddDistrictDialog

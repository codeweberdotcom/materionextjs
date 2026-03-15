'use client'

import { useState, useEffect, useMemo } from 'react'

import { useParams } from 'next/navigation'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid2'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Autocomplete from '@mui/material/Autocomplete'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

import isoCountries from '@/data/iso-countries.json'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

type IsoCountry = {
  code: string
  name: string
  nativeName: string
}

type State = {
  id: string
  name: string
  code: string
  isActive: boolean
}

type Country = {
  id: string
  name: string
  code: string
  isActive: boolean
  states?: Array<{
    id: string
    name: string
    code: string
    isActive: boolean
  }>
}

type AddCountryDialogProps = {
  open: boolean
  handleClose: () => void
  onSubmit: (data: { name: string; code: string; states: string[]; isActive: boolean }) => void
  editCountry?: Country | null
  onUpdate?: (data: { id: string; name: string; code: string; states: string[]; isActive: boolean }) => void
  existingCodes?: string[]
}

const AddCountryDialog = ({ open, handleClose, onSubmit, editCountry, onUpdate, existingCodes = [] }: AddCountryDialogProps) => {
  // Hooks
  const dictionary = useTranslation()
  const { lang: locale } = useParams()

  const [selectedCountry, setSelectedCountry] = useState<IsoCountry | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    states: [] as string[],
    isActive: true
  })

  const [states, setStates] = useState<State[]>([])
  const [statesLoading, setStatesLoading] = useState(false)

  const isEditMode = !!editCountry

  const availableCountries = useMemo(() => {
    return (isoCountries as IsoCountry[]).filter(c => !existingCodes.includes(c.code))
  }, [existingCodes])

  useEffect(() => {
    const fetchStates = async () => {
      setStatesLoading(true)

      try {
        const response = await fetch(`/api/states?locale=${locale}`)

        if (response.ok) {
          const data = await response.json()

          setStates(data)
        }
      } catch (error) {
        console.error('Error fetching states:', error)
      } finally {
        setStatesLoading(false)
      }
    }

    if (open) {
      fetchStates()
    }
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (isEditMode && onUpdate && editCountry) {
      onUpdate({ ...formData, id: editCountry.id })
    } else {
      if (!selectedCountry) return

      onSubmit({
        name: selectedCountry.name,
        code: selectedCountry.code,
        states: formData.states,
        isActive: formData.isActive
      })
    }

    handleCloseDialog()
  }

  const handleCloseDialog = () => {
    setSelectedCountry(null)
    setFormData({ name: '', code: '', states: [], isActive: true })
    handleClose()
  }

  // Populate form data when editing
  useEffect(() => {
    if (editCountry) {
      setFormData({
        name: editCountry.name,
        code: editCountry.code,
        states: editCountry.states ? editCountry.states.map(s => s.id) : [],
        isActive: editCountry.isActive
      })
    } else {
      setSelectedCountry(null)
      setFormData({
        name: '',
        code: '',
        states: [],
        isActive: true
      })
    }
  }, [editCountry])

  return (
    <Dialog fullWidth open={open} onClose={handleCloseDialog} maxWidth='sm'>
      <DialogTitle>{isEditMode ? dictionary.navigation.editCountryTitle : dictionary.navigation.addCountryTitle}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <IconButton onClick={handleCloseDialog} className='absolute block-start-4 inline-end-4'>
            <i className='ri-close-line text-textSecondary' />
          </IconButton>
          <Grid container spacing={4}>
            {isEditMode ? (
              <>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label={dictionary.navigation.countryName}
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label={dictionary.navigation.countryCode}
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    required
                  />
                </Grid>
              </>
            ) : (
              <>
                <Grid size={{ xs: 12 }}>
                  <Autocomplete
                    options={availableCountries}
                    value={selectedCountry}
                    onChange={(_, value) => setSelectedCountry(value)}
                    getOptionLabel={(option) => `${option.name} (${option.nativeName})`}
                    renderOption={(props, option) => (
                      <li {...props} key={option.code}>
                        <div>
                          <Typography variant='body1'>{option.name}</Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {option.nativeName} — {option.code}
                          </Typography>
                        </div>
                      </li>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={dictionary.navigation.selectCountry}
                        placeholder={dictionary.navigation.searchByCountryName}
                        required
                      />
                    )}
                    isOptionEqualToValue={(option, value) => option.code === value.code}
                    noOptionsText={dictionary.navigation.noCountriesAvailable}
                  />
                </Grid>
                {selectedCountry && (
                  <Grid size={{ xs: 12 }}>
                    <div className='flex items-center gap-4 p-3 rounded bg-actionHover'>
                      <div>
                        <Typography variant='body2' color='text.secondary'>{dictionary.navigation.code}</Typography>
                        <Typography variant='body1' fontWeight={500}>{selectedCountry.code}</Typography>
                      </div>
                    </div>
                  </Grid>
                )}
              </>
            )}
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                multiple
                id='states-autocomplete'
                options={states}
                loading={statesLoading}
                loadingText={dictionary.navigation.loading}
                disabled={statesLoading}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                value={states.filter(state => formData.states.includes(state.id))}
                onChange={(event, newValue) => {
                  setFormData({
                    ...formData,
                    states: newValue.map(state => typeof state === 'string' ? state : state.id)
                  })
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={dictionary.navigation.states}
                    placeholder={dictionary.navigation.searchAndSelectStates}
                    slotProps={{
                      input: {
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {statesLoading ? <CircularProgress color='inherit' size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        )
                      }
                    }}
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key: tagKey, ...chipProps } = getTagProps({ index })
                    const state = states.find(s => s.id === (typeof option === 'string' ? option : option.id))

                    return (
                      <Chip
                        key={tagKey}
                        label={state?.name || (typeof option === 'string' ? option : option.name)}
                        size='small'
                        {...chipProps}
                      />
                    )
                  })
                }
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    {option.name}
                  </li>
                )}
                filterSelectedOptions
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={isEditMode ? formData.isActive : formData.isActive}
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
          <Button variant='contained' type='submit' disabled={!isEditMode && !selectedCountry}>
            {isEditMode ? dictionary.navigation.updateCountry : dictionary.navigation.addCountry}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default AddCountryDialog

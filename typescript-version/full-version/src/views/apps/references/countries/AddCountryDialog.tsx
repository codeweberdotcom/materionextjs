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
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Autocomplete from '@mui/material/Autocomplete'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'

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
}

const AddCountryDialog = ({ open, handleClose, onSubmit, editCountry, onUpdate }: AddCountryDialogProps) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    states: [] as string[],
    isActive: true
  })
  const [states, setStates] = useState<State[]>([])

  const isEditMode = !!editCountry

  useEffect(() => {
    const fetchStates = async () => {
      try {
        const response = await fetch('/api/states')
        if (response.ok) {
          const data = await response.json()
          setStates(data)
        }
      } catch (error) {
        console.error('Error fetching states:', error)
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
      onSubmit(formData)
    }
    handleClose()
  }

  const handleCloseDialog = () => {
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
      <DialogTitle>{isEditMode ? 'Edit Country' : 'Add New Country'}</DialogTitle>
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
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                multiple
                id='states-autocomplete'
                options={states}
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
                    label='States'
                    placeholder='Search and select states...'
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...chipProps } = getTagProps({ index })
                    const state = states.find(s => s.id === (typeof option === 'string' ? option : option.id))
                    return (
                      <Chip
                        key={state?.id || index}
                        label={state?.name || (typeof option === 'string' ? option : option.name)}
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
            {isEditMode ? 'Update Country' : 'Add Country'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default AddCountryDialog
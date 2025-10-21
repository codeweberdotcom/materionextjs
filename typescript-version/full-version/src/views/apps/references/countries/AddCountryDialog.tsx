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
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'

type Region = {
  id: string
  name: string
  code: string
  isActive: boolean
}

type AddCountryDialogProps = {
  open: boolean
  handleClose: () => void
  onSubmit: (data: { name: string; code: string; regions: string[] }) => void
}

const AddCountryDialog = ({ open, handleClose, onSubmit }: AddCountryDialogProps) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    regions: [] as string[]
  })
  const [regions, setRegions] = useState<Region[]>([])

  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const response = await fetch('/api/regions')
        if (response.ok) {
          const data = await response.json()
          setRegions(data)
        }
      } catch (error) {
        console.error('Error fetching regions:', error)
      }
    }

    if (open) {
      fetchRegions()
    }
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
    setFormData({ name: '', code: '', regions: [] })
  }

  const handleCloseDialog = () => {
    setFormData({ name: '', code: '', regions: [] })
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
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Regions</InputLabel>
                <Select
                  multiple
                  label='Regions'
                  name='regions'
                  variant='outlined'
                  value={formData.regions}
                  onChange={e => setFormData({ ...formData, regions: e.target.value as string[] })}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => {
                        const region = regions.find(r => r.id === value)
                        return (
                          <Chip key={value} label={region?.name || value} size='small' />
                        )
                      })}
                    </Box>
                  )}
                >
                  {regions.map((region) => (
                    <MenuItem key={region.id} value={region.id}>
                      {region.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
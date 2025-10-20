'use client'

// React Imports
import { useState, useEffect } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid2'
import Dialog from '@mui/material/Dialog'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import Switch from '@mui/material/Switch'
import IconButton from '@mui/material/IconButton'
import { FormControlLabel } from '@mui/material'

// Third-party Imports
import { toast } from 'react-toastify'

// Type Imports
import type { UsersType } from '@/types/apps/userTypes'

type EditUserInfoProps = {
  open?: boolean
  setOpen?: (open: boolean) => void
  data?: UsersType
}

// Vars
const status = ['Status', 'Active', 'Inactive', 'Suspended']

const languages = ['English', 'Spanish', 'French', 'German', 'Hindi']

const countries = ['Select Country', 'France', 'Russia', 'China', 'UK', 'US']

const EditUserInfo = ({ open, setOpen, data }: EditUserInfoProps) => {
  // States
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: '',
    company: '',
    contact: '',
    country: ''
  })
  const [saving, setSaving] = useState(false)

  // Update local state when data prop changes
  useEffect(() => {
    if (data) {
      // Split full name into first and last name
      const nameParts = data.fullName.split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      setFormData({
        firstName,
        lastName,
        email: data.email,
        role: data.role,
        company: data.company,
        contact: data.contact,
        country: data.country
      })
    }
  }, [data])

  const handleClose = () => {
    if (setOpen) {
      setOpen(false)
    }
    // Reset form data when closing
    if (data) {
      // Split full name into first and last name
      const nameParts = data.fullName.split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      setFormData({
        firstName,
        lastName,
        email: data.email,
        role: data.role,
        company: data.company,
        contact: data.contact,
        country: data.country
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Combine first and last name into full name
      const fullName = `${formData.firstName} ${formData.lastName}`.trim()

      const response = await fetch(`/api/admin/users/${data?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName,
          email: formData.email,
          role: formData.role,
          company: formData.company,
          contact: formData.contact,
          country: formData.country
        })
      })

      if (response.ok) {
        toast.success('User updated successfully!')
        if (setOpen) {
          setOpen(false)
        }
        // Refresh the page to show updated data
        window.location.reload()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to update user')
      }
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error('Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog fullWidth open={open || false} onClose={handleClose} maxWidth='md' scroll='body' closeAfterTransition={false}>
      <DialogTitle variant='h4' className='flex gap-2 flex-col items-center sm:pbs-16 sm:pbe-6 sm:pli-16'>
        <div className='max-sm:is-[80%] max-sm:text-center'>Edit User Information</div>
        <Typography component='span' className='flex flex-col text-center'>
          Updating user details will receive a privacy audit.
        </Typography>
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent className='overflow-visible pbs-0 sm:pli-16'>
          <IconButton onClick={handleClose} className='absolute block-start-4 inline-end-4'>
            <i className='ri-close-line text-textSecondary' />
          </IconButton>
          <Grid container spacing={5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label='First Name'
                placeholder='John'
                value={formData.firstName}
                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label='Last Name'
                placeholder='Doe'
                value={formData.lastName}
                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label='Email'
                placeholder='john.doe@example.com'
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label='Company'
                placeholder='Company Name'
                value={formData.company}
                onChange={e => setFormData({ ...formData, company: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label='Contact'
                placeholder='+1 (234) 567-8901'
                value={formData.contact}
                onChange={e => setFormData({ ...formData, contact: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  label='Role'
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                >
                  <MenuItem value='admin'>Admin</MenuItem>
                  <MenuItem value='maintainer'>Maintainer</MenuItem>
                  <MenuItem value='subscriber'>Subscriber</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Country</InputLabel>
                <Select
                  label='Country'
                  value={formData.country}
                  onChange={e => setFormData({ ...formData, country: e.target.value })}
                >
                  <MenuItem value='USA'>USA</MenuItem>
                  <MenuItem value='UK'>UK</MenuItem>
                  <MenuItem value='France'>France</MenuItem>
                  <MenuItem value='Russia'>Russia</MenuItem>
                  <MenuItem value='China'>China</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions className='justify-center pbs-0 sm:pbe-16 sm:pli-16'>
          <Button variant='contained' type='submit' disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant='outlined' color='secondary' onClick={handleClose}>
            Cancel
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default EditUserInfo

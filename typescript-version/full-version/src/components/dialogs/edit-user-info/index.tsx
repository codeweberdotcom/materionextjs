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
import Autocomplete from '@mui/material/Autocomplete'

// Third-party Imports
import { toast } from 'react-toastify'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Type Imports
import type { UsersType } from '@/types/apps/userTypes'

type EditUserInfoProps = {
  open?: boolean
  setOpen?: (open: boolean) => void
  data?: UsersType
}

// Vars
const status = ['Status', 'Active', 'Inactive', 'Suspended']

const languages = ['English', 'Spanish', 'French', 'German', 'Hindi', 'Russian', 'Chinese', 'Japanese', 'Korean', 'Italian', 'Portuguese']

const countries = ['Select Country', 'United States', 'United Kingdom', 'France', 'Germany', 'Russia', 'China', 'Japan', 'South Korea', 'Canada', 'Australia', 'Brazil', 'India', 'Italy', 'Spain', 'Portugal']

type Role = {
  id: string
  name: string
  description: string | null
}

// No mapping needed anymore

const EditUserInfo = ({ open, setOpen, data }: EditUserInfoProps) => {
  // Hooks
  const dictionary = useTranslation()

  // States
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: '',
    company: '',
    contact: '',
    country: '',
    avatar: null as File | null
  })

  const [saving, setSaving] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [countries, setCountries] = useState<any[]>([])
  const [loadingCountries, setLoadingCountries] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [isEditingOwnProfile, setIsEditingOwnProfile] = useState<boolean>(false)

  // Fetch roles
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await fetch('/api/admin/roles')

        if (response.ok) {
          const rolesData = await response.json()

          setRoles(rolesData)
        }
      } catch (error) {
        console.error('Error fetching roles:', error)
      } finally {
        setLoadingRoles(false)
      }
    }

    fetchRoles()
  }, [])

  // Fetch countries
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await fetch('/api/admin/references/countries')

        if (response.ok) {
          const countriesData = await response.json()

          setCountries(countriesData)
        }
      } catch (error) {
        console.error('Error fetching countries:', error)
      } finally {
        setLoadingCountries(false)
      }
    }

    fetchCountries()
  }, [])

  // Fetch current user profile to check if editing own profile
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/user/profile')

        if (response.ok) {
          const userData = await response.json()

          setCurrentUserId(userData.id)
        }
      } catch (error) {
        console.error('Error fetching current user:', error)
      }
    }

    fetchCurrentUser()
  }, [])

  // Update local state when data prop changes
  useEffect(() => {
    if (data && countries.length > 0 && roles.length > 0) {
      // Split full name into first and last name
      const nameParts = data.fullName.split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      // Use database role name directly
      const dbRole = data.role

      // Find the country code from the user's country name
      const userCountry = countries.find(c => c.name.toLowerCase() === data.country.toLowerCase())
      const countryCode = userCountry ? userCountry.code : data.country

      setFormData({
        firstName,
        lastName,
        email: data.email,
        role: dbRole,
        company: data.company,
        contact: data.contact,
        country: countryCode,
        avatar: null
      })

      // Check if editing own profile
      setIsEditingOwnProfile(currentUserId === data.id)
    }
  }, [data, countries, roles, currentUserId])

  const handleClose = () => {
    if (setOpen) {
      setOpen(false)
    }


    // Reset form data when closing
    if (data && countries.length > 0 && roles.length > 0) {
      // Split full name into first and last name
      const nameParts = data.fullName.split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      // Use database role name directly (only if not editing own profile)
      const dbRole = isEditingOwnProfile ? '' : data.role

      // Find the country code from the user's country name
      const userCountry = countries.find(c => c.name.toLowerCase() === data.country.toLowerCase())
      const countryCode = userCountry ? userCountry.code : data.country

      setFormData({
        firstName,
        lastName,
        email: data.email,
        role: isEditingOwnProfile ? '' : dbRole,
        company: data.company,
        contact: data.contact,
        country: countryCode,
        avatar: null
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Validate required fields
      if (!isEditingOwnProfile && !formData.role) {
        toast.error(dictionary.navigation.roleRequired)
        setSaving(false)
        
return
      }

      // Combine first and last name into full name
      const fullName = `${formData.firstName} ${formData.lastName}`.trim()

      const formDataToSend = new FormData()

      formDataToSend.append('fullName', fullName)
      formDataToSend.append('email', formData.email)

      if (!isEditingOwnProfile) {
        formDataToSend.append('role', formData.role)
      }

      formDataToSend.append('company', formData.company)
      formDataToSend.append('contact', formData.contact)
      formDataToSend.append('country', formData.country)

      if (formData.avatar) {
        formDataToSend.append('avatar', formData.avatar)
      }

      const response = await fetch(`/api/admin/users/${data?.id}`, {
        method: 'PUT',
        body: formDataToSend
      })

      if (response.ok) {
        toast.success(dictionary.navigation.userUpdatedSuccessfully)

        if (setOpen) {
          setOpen(false)
        }


        // Refresh the page to show updated data
        window.location.reload()
      } else {
        const error = await response.json()

        toast.error(error.message || dictionary.navigation.failedToUpdateUser)
      }
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error(dictionary.navigation.failedToUpdateUser)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog fullWidth open={open || false} onClose={handleClose} maxWidth='md' scroll='body' closeAfterTransition={false}>
      <DialogTitle variant='h4' className='flex gap-2 flex-col items-center sm:pbs-16 sm:pbe-6 sm:pli-16'>
        <div className='max-sm:is-[80%] max-sm:text-center'>{dictionary.navigation.editUserInformation}</div>
        <Typography component='span' className='flex flex-col text-center'>
          {dictionary.navigation.updatingUserDetails}
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
                label={dictionary.navigation.firstName}
                placeholder='John'
                value={formData.firstName}
                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label={dictionary.navigation.lastName}
                placeholder='Doe'
                value={formData.lastName}
                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label={dictionary.navigation.email}
                placeholder='john.doe@example.com'
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label={dictionary.navigation.company}
                placeholder='Company Name'
                value={formData.company}
                onChange={e => setFormData({ ...formData, company: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label={dictionary.navigation.contact}
                placeholder='+1 (234) 567-8901'
                value={formData.contact}
                onChange={e => setFormData({ ...formData, contact: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type='file'
                label={dictionary.navigation.avatar}
                InputLabelProps={{
                  shrink: true,
                }}
                onChange={e => setFormData({ ...formData, avatar: (e.target as HTMLInputElement).files?.[0] || null })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Autocomplete
                fullWidth
                options={countries}
                getOptionLabel={(option) => option.name}
                value={countries.find(c => c.code === formData.country) || null}
                onChange={(event, newValue) => {
                  setFormData({ ...formData, country: newValue ? newValue.code : '' })
                }}
                disabled={loadingCountries}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={dictionary.navigation.country}
                    placeholder={dictionary.navigation.searchCountries}
                  />
                )}
                loading={loadingCountries}
                loadingText={dictionary.navigation.loadingCountries}
                noOptionsText={dictionary.navigation.noCountriesFound}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions className='justify-center pbs-0 sm:pbe-16 sm:pli-16'>
          <Button variant='contained' type='submit' disabled={saving}>
            {saving ? dictionary.navigation.saving : dictionary.navigation.saveChanges}
          </Button>
          <Button variant='outlined' color='secondary' onClick={handleClose}>
            {dictionary.navigation.cancel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default EditUserInfo

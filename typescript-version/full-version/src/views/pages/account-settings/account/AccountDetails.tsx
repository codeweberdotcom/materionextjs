'use client'

// React Imports
import { useState, useEffect } from 'react'
import type { ChangeEvent } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid2'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import type { SelectChangeEvent } from '@mui/material/Select'
import { toast } from 'react-toastify'

type Data = {
  firstName: string
  lastName: string
  email: string
  organization: string
  phoneNumber: number | string
  address: string
  state: string
  zipCode: string
  country: string
  language: string
  timezone: string
  currency: string
}

// Vars
const initialData: Data = {
  firstName: '',
  lastName: '',
  email: '',
  organization: '',
  phoneNumber: '',
  address: '',
  state: '',
  zipCode: '',
  country: '',
  language: '',
  timezone: '',
  currency: ''
}

const AccountDetails = () => {
  // States
  const [formData, setFormData] = useState<Data>(initialData)
  const [fileInput, setFileInput] = useState<string>('')
  const [imgSrc, setImgSrc] = useState<string>('/images/avatars/1.png')
  const [language, setLanguage] = useState<string>('English')
  const [languages, setLanguages] = useState<string[]>([])
  const [currencies, setCurrencies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const handleLanguageChange = (event: SelectChangeEvent<string>) => {
    setLanguage(event.target.value)
  }

  const handleFormChange = (field: keyof Data, value: Data[keyof Data]) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleFileInputChange = async (fileEvent: ChangeEvent) => {
    const { files } = fileEvent.target as HTMLInputElement

    if (files && files.length !== 0) {
      const file = files[0]

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file')
        return
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB')
        return
      }

      try {
        // Show preview immediately
        const reader = new FileReader()
        reader.onload = () => setImgSrc(reader.result as string)
        reader.readAsDataURL(file)

        // Upload file to server
        const formData = new FormData()
        formData.append('avatar', file)

        const response = await fetch('/api/user/avatar', {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          const result = await response.json()
          setImgSrc(result.avatarUrl)
          toast.success('Avatar uploaded successfully!')
        } else {
          const error = await response.json()
          toast.error(error.message || 'Failed to upload avatar')
          // Reset to previous image on error
          const profileResponse = await fetch('/api/user/profile')
          if (profileResponse.ok) {
            const userData = await profileResponse.json()
            setImgSrc(userData.avatar || '/images/avatars/1.png')
          }
        }
      } catch (error) {
        console.error('Error uploading avatar:', error)
        toast.error('Failed to upload avatar')
      }
    }
  }

  const handleFileInputReset = () => {
    setFileInput('')
    setImgSrc('/images/avatars/1.png')
  }

  // Fetch current user data and languages
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Fetch user profile
        const response = await fetch('/api/user/profile')
        if (response.ok) {
          const userData = await response.json()

          // Split full name into first and last name
          const nameParts = userData.fullName.split(' ')
          const firstName = nameParts[0] || ''
          const lastName = nameParts.slice(1).join(' ') || ''

          setFormData({
            firstName,
            lastName,
            email: userData.email,
            organization: userData.company || '',
            phoneNumber: userData.contact || '',
            address: '',
            state: '',
            zipCode: '',
            country: userData.country || 'russia',
            language: userData.language || 'Russian',
            timezone: userData.timezone || 'Europe/Moscow',
            currency: userData.currency || 'RUB'
          })
          setLanguage(userData.language || 'English')

          // Set current avatar if exists
          if (userData.avatar) {
            setImgSrc(userData.avatar)
          }
        }

        // Fetch available languages
        const languagesResponse = await fetch('/api/languages')
        if (languagesResponse.ok) {
          const languagesData = await languagesResponse.json()
          setLanguages(languagesData.map((lang: any) => lang.name))
        }

        // Fetch available currencies
        const currenciesResponse = await fetch('/api/currencies')
        if (currenciesResponse.ok) {
          const currenciesData = await currenciesResponse.json()
          setCurrencies(currenciesData)
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
        toast.error('Failed to load user data')
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          email: formData.email,
          language: language || 'English',
          timezone: formData.timezone,
          currency: formData.currency,
          country: formData.country
        })
      })

      if (response.ok) {
        const updatedUser = await response.json()

        // Update local state with server response
        setFormData({
          firstName: updatedUser.fullName?.split(' ')[0] || '',
          lastName: updatedUser.fullName?.split(' ').slice(1).join(' ') || '',
          email: updatedUser.email,
          organization: updatedUser.company || '',
          phoneNumber: updatedUser.contact || '',
          address: '',
          state: '',
          zipCode: '',
          country: updatedUser.country || 'usa',
          language: updatedUser.language || 'English',
          timezone: updatedUser.timezone || 'gmt-05-et',
          currency: updatedUser.currency || 'USD'
        })
        setLanguage(updatedUser.language || 'English')

        toast.success('Profile updated successfully!')
      } else {
        toast.error('Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className='mbe-5'>
        <div className='flex max-sm:flex-col items-center gap-6'>
          <img height={100} width={100} className='rounded' src={imgSrc} alt='Profile' />
          <div className='flex flex-grow flex-col gap-4'>
            <div className='flex flex-col sm:flex-row gap-4'>
              <Button component='label' size='small' variant='contained' htmlFor='account-settings-upload-image'>
                Upload New Photo
                <input
                  hidden
                  type='file'
                  value={fileInput}
                  accept='image/png, image/jpeg'
                  onChange={handleFileInputChange}
                  id='account-settings-upload-image'
                />
              </Button>
              <Button size='small' variant='outlined' color='error' onClick={handleFileInputReset}>
                Reset
              </Button>
            </div>
            <Typography>Allowed JPG, GIF or PNG. Max size of 800K</Typography>
          </div>
        </div>
      </CardContent>
      <CardContent>
        {loading ? (
          <Typography>Loading user data...</Typography>
        ) : (
          <form onSubmit={handleSubmit}>
          <Grid container spacing={5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label='First Name'
                value={formData.firstName}
                placeholder='John'
                onChange={e => handleFormChange('firstName', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label='Last Name'
                value={formData.lastName}
                placeholder='Doe'
                onChange={e => handleFormChange('lastName', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label='Email'
                value={formData.email}
                placeholder='john.doe@gmail.com'
                onChange={e => handleFormChange('email', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label='Organization'
                value={formData.organization}
                placeholder='ThemeSelection'
                onChange={e => handleFormChange('organization', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label='Phone Number'
                value={formData.phoneNumber}
                placeholder='+1 (234) 567-8901'
                onChange={e => handleFormChange('phoneNumber', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label='Address'
                value={formData.address}
                placeholder='Address'
                onChange={e => handleFormChange('address', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label='State'
                value={formData.state}
                placeholder='New York'
                onChange={e => handleFormChange('state', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type='number'
                label='Zip Code'
                value={formData.zipCode}
                placeholder='123456'
                onChange={e => handleFormChange('zipCode', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Country</InputLabel>
                <Select
                  label='Country'
                  value={formData.country}
                  onChange={e => handleFormChange('country', e.target.value)}
                >
                  <MenuItem value='usa'>USA</MenuItem>
                  <MenuItem value='uk'>UK</MenuItem>
                  <MenuItem value='australia'>Australia</MenuItem>
                  <MenuItem value='germany'>Germany</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Language</InputLabel>
                <Select
                  label='Language'
                  value={language}
                  onChange={handleLanguageChange}
                >
                  {languages.map(name => (
                    <MenuItem key={name} value={name}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>TimeZone</InputLabel>
                <Select
                  label='TimeZone'
                  value={formData.timezone}
                  onChange={e => handleFormChange('timezone', e.target.value)}
                  MenuProps={{ PaperProps: { style: { maxHeight: 250 } } }}
                >
                  <MenuItem value='gmt-12'>(GMT-12:00) International Date Line West</MenuItem>
                  <MenuItem value='gmt-11'>(GMT-11:00) Midway Island, Samoa</MenuItem>
                  <MenuItem value='gmt-10'>(GMT-10:00) Hawaii</MenuItem>
                  <MenuItem value='gmt-09'>(GMT-09:00) Alaska</MenuItem>
                  <MenuItem value='gmt-08'>(GMT-08:00) Pacific Time (US & Canada)</MenuItem>
                  <MenuItem value='gmt-08-baja'>(GMT-08:00) Tijuana, Baja California</MenuItem>
                  <MenuItem value='gmt-07'>(GMT-07:00) Chihuahua, La Paz, Mazatlan</MenuItem>
                  <MenuItem value='gmt-07-mt'>(GMT-07:00) Mountain Time (US & Canada)</MenuItem>
                  <MenuItem value='gmt-06'>(GMT-06:00) Central America</MenuItem>
                  <MenuItem value='gmt-06-ct'>(GMT-06:00) Central Time (US & Canada)</MenuItem>
                  <MenuItem value='gmt-06-mc'>(GMT-06:00) Guadalajara, Mexico City, Monterrey</MenuItem>
                  <MenuItem value='gmt-06-sk'>(GMT-06:00) Saskatchewan</MenuItem>
                  <MenuItem value='gmt-05'>(GMT-05:00) Bogota, Lima, Quito, Rio Branco</MenuItem>
                  <MenuItem value='gmt-05-et'>(GMT-05:00) Eastern Time (US & Canada)</MenuItem>
                  <MenuItem value='gmt-05-ind'>(GMT-05:00) Indiana (East)</MenuItem>
                  <MenuItem value='gmt-04'>(GMT-04:00) Atlantic Time (Canada)</MenuItem>
                  <MenuItem value='gmt-04-clp'>(GMT-04:00) Caracas, La Paz</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Currency</InputLabel>
                <Select
                  label='Currency'
                  value={formData.currency}
                  onChange={e => handleFormChange('currency', e.target.value)}
                >
                  {currencies.map(currency => (
                    <MenuItem key={currency.id} value={currency.code}>
                      {currency.name} ({currency.symbol})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }} className='flex gap-4 flex-wrap'>
              <Button variant='contained' type='submit' disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant='outlined' type='reset' color='secondary' onClick={() => setFormData(initialData)}>
                Reset
              </Button>
            </Grid>
          </Grid>
        </form>
       )}
      </CardContent>
    </Card>
  )
}

export default AccountDetails

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
import Autocomplete from '@mui/material/Autocomplete'
import Chip from '@mui/material/Chip'
import type { SelectChangeEvent } from '@mui/material/Select'
import { toast } from 'react-toastify'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

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
  currency: string
  role: string
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
  language: 'en',
  currency: '',
  role: ''
}

const AccountDetails = () => {
  // Hooks
  const dictionary = useTranslation()

  // States
  const [formData, setFormData] = useState<Data>(initialData)
  const [fileInput, setFileInput] = useState<string>('')
  const [imgSrc, setImgSrc] = useState<string>('/images/avatars/1.png')
  const [language, setLanguage] = useState<string>('en')
  const [languages, setLanguages] = useState<{code: string, name: string}[]>([])
  const [currencies, setCurrencies] = useState<any[]>([])
  const [countries, setCountries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const handleLanguageChange = (event: SelectChangeEvent<string>) => {
    setLanguage(event.target.value)
    // Update formData.language with code
    const selectedLang = languages.find(lang => lang.code === event.target.value)
    if (selectedLang) {
      handleFormChange('language', selectedLang.code)
    }
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
            language: userData.language || 'ru',
            currency: userData.currency || 'RUB',
            role: userData.role || ''
          })
          setLanguage(userData.language || 'ru')

          // Set current avatar if exists
          if (userData.avatar) {
            setImgSrc(userData.avatar)
          }
        } else if (response.status === 401) {
          // User is not authenticated, redirect to login
          toast.error('Please log in to access your account settings')
          window.location.href = '/en/login'
          return
        }

        // Fetch available languages from JSON
        try {
          const languagesData = await import('@/data/languages.json')
          setLanguages(languagesData.default)
        } catch (error) {
          console.error('Error loading languages:', error)
          setLanguages([
            { code: 'en', name: 'English' },
            { code: 'fr', name: 'French' },
            { code: 'ar', name: 'Arabic' },
            { code: 'ru', name: 'Russian' }
          ])
        }

        // Fetch available currencies
         const currenciesResponse = await fetch('/api/currencies')
         if (currenciesResponse.ok) {
           const currenciesData = await currenciesResponse.json()
           setCurrencies(currenciesData)
         }

         // Fetch available countries
         const countriesResponse = await fetch('/api/countries')
         if (countriesResponse.ok) {
           const countriesData = await countriesResponse.json()
           setCountries(countriesData)
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
          language: language || 'en',
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
          language: updatedUser.language || 'en',
          currency: updatedUser.currency || 'USD',
          role: updatedUser.role || ''
        })
        setLanguage(updatedUser.language || 'en')

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
                {dictionary.navigation.uploadNewPhoto}
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
                {dictionary.navigation.reset}
              </Button>
            </div>
            <Typography>{dictionary.navigation.allowedImageFormats}</Typography>
          </div>
        </div>
      </CardContent>
      <CardContent>
        {loading ? (
          <Typography>{dictionary.forms.loadingUserData}</Typography>
        ) : (
          <form onSubmit={handleSubmit}>
          <Grid container spacing={5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label={dictionary.forms.firstName}
                value={formData.firstName}
                placeholder='John'
                onChange={e => handleFormChange('firstName', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label={dictionary.forms.lastName}
                value={formData.lastName}
                placeholder='Doe'
                onChange={e => handleFormChange('lastName', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label={dictionary.forms.email}
                value={formData.email}
                placeholder='john.doe@gmail.com'
                onChange={e => handleFormChange('email', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label={dictionary.forms.organization}
                value={formData.organization}
                placeholder='ThemeSelection'
                onChange={e => handleFormChange('organization', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label={dictionary.forms.phoneNumber}
                value={formData.phoneNumber}
                placeholder='+1 (234) 567-8901'
                onChange={e => handleFormChange('phoneNumber', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label={dictionary.forms.address}
                value={formData.address}
                placeholder='Address'
                onChange={e => handleFormChange('address', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label={dictionary.forms.state}
                value={formData.state}
                placeholder='New York'
                onChange={e => handleFormChange('state', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type='number'
                label={dictionary.forms.zipCode}
                value={formData.zipCode}
                placeholder='123456'
                onChange={e => handleFormChange('zipCode', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Autocomplete
                fullWidth
                options={countries}
                getOptionLabel={(option) => option.name}
                value={countries.find(country => country.code === formData.country) || null}
                onChange={(event, newValue) => {
                  handleFormChange('country', newValue?.code || '')
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={dictionary.forms.country}
                    required
                    placeholder='Search for a country...'
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    {option.name}
                  </li>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>{dictionary.forms.language}</InputLabel>
                <Select
                  label='Dashboard Language'
                  value={language}
                  onChange={handleLanguageChange}
                >
                  {languages.map(lang => (
                    <MenuItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>{dictionary.forms.currency}</InputLabel>
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
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label={dictionary.forms.role}
                value={formData.role}
                disabled
              />
            </Grid>
            <Grid size={{ xs: 12 }} className='flex gap-4 flex-wrap'>
              <Button variant='contained' type='submit' disabled={saving}>
                {saving ? dictionary.navigation.saving : dictionary.navigation.saveChanges}
              </Button>
              <Button variant='outlined' type='reset' color='secondary' onClick={() => setFormData(initialData)}>
                {dictionary.navigation.reset}
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

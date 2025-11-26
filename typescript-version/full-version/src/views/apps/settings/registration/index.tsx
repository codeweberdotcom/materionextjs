'use client'

// React Imports
import { useState, useEffect } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import FormHelperText from '@mui/material/FormHelperText'
import Switch from '@mui/material/Switch'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Hook Imports
import { usePermissions } from '@/hooks/usePermissions'
import { toast } from 'react-toastify'

// Third-party Imports
import Skeleton from '@mui/material/Skeleton'

type RegistrationMode = 'email_or_phone' | 'email_and_phone'

interface RegistrationSettingsData {
  registrationMode: RegistrationMode
  requirePhoneVerification: boolean
  requireEmailVerification: boolean
  smsProvider: string
}

const RegistrationSettings = () => {
  // Hooks
  const dictionary = useTranslation()
  const { checkPermission } = usePermissions()

  // Permission checks
  const canUpdate = checkPermission('settings', 'update')
  const canRead = checkPermission('settings', 'read')

  // States
  const [formData, setFormData] = useState<RegistrationSettingsData>({
    registrationMode: 'email_or_phone',
    requirePhoneVerification: true,
    requireEmailVerification: true,
    smsProvider: 'smsru'
  })

  const [loading, setLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings/registration')

        if (response.ok) {
          const settings = await response.json()
          setFormData({
            registrationMode: settings.registrationMode,
            requirePhoneVerification: settings.requirePhoneVerification,
            requireEmailVerification: settings.requireEmailVerification,
            smsProvider: settings.smsProvider
          })
          setLastUpdated(settings.updatedAt)
        } else if (response.status === 401 || response.status === 403) {
          toast.error('У вас нет прав для просмотра настроек регистрации')
        }
      } catch (error) {
        console.error('Error fetching registration settings:', error)
        toast.error('Ошибка при загрузке настроек регистрации')
      } finally {
        setFetchLoading(false)
      }
    }

    if (canRead) {
      fetchSettings()
    } else {
      setFetchLoading(false)
    }
  }, [canRead])

  const handleChange = (field: keyof RegistrationSettingsData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/settings/registration', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(result.message || 'Настройки регистрации сохранены успешно!')
        setLastUpdated(result.updatedAt)
      } else if (response.status === 401 || response.status === 403) {
        toast.error(result.message || 'У вас нет прав для изменения настроек регистрации')
      } else {
        toast.error(result.message || 'Ошибка при сохранении настроек.')
      }
    } catch (error) {
      toast.error('Ошибка при сохранении настроек.')
    } finally {
      setLoading(false)
    }
  }

  if (fetchLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton width={300} height={28} />
        </CardHeader>
        <CardContent>
          <Grid container spacing={4}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Grid item xs={12} key={index}>
                <Skeleton height={56} />
              </Grid>
            ))}
            <Grid item xs={12}>
              <Skeleton width={120} height={36} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    )
  }

  if (!canRead) {
    return (
      <Card>
        <CardContent>
          <Alert severity='error'>
            У вас нет прав для просмотра настроек регистрации
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader 
          title={dictionary?.navigation?.registrationSettings || 'Настройки регистрации'} 
        />
        <CardContent>
          {lastUpdated && (
            <Alert severity='info' sx={{ mb: 4 }}>
              Последнее обновление: {new Date(lastUpdated).toLocaleString('ru-RU')}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={4}>
              {/* Registration Mode */}
              <Grid item xs={12}>
                <FormControl component='fieldset' fullWidth>
                  <FormLabel component='legend'>
                    {dictionary?.navigation?.registrationMode || 'Режим регистрации'}
                  </FormLabel>
                  <RadioGroup
                    value={formData.registrationMode}
                    onChange={(e) => handleChange('registrationMode', e.target.value as RegistrationMode)}
                    row
                  >
                    <FormControlLabel
                      value='email_or_phone'
                      control={<Radio disabled={!canUpdate} />}
                      label='Email или телефон'
                    />
                    <FormControlLabel
                      value='email_and_phone'
                      control={<Radio disabled={!canUpdate} />}
                      label='Email и телефон (оба обязательны)'
                    />
                  </RadioGroup>
                  <FormHelperText>
                    Выберите, требуется ли для регистрации только email или телефон, или оба поля обязательны
                  </FormHelperText>
                </FormControl>
              </Grid>

              <Divider sx={{ my: 2, width: '100%' }} />

              {/* Verification Requirements */}
              <Grid item xs={12}>
                <Typography variant='h6' gutterBottom>
                  {dictionary?.navigation?.verificationRequirements || 'Требования к верификации'}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant='body1'>
                      {dictionary?.navigation?.requireEmailVerification || 'Требовать верификацию email'}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      Всегда требуется при регистрации по email
                    </Typography>
                  </Box>
                  <Switch
                    checked={formData.requireEmailVerification}
                    onChange={(e) => handleChange('requireEmailVerification', e.target.checked)}
                    disabled={!canUpdate}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant='body1'>
                      {dictionary?.navigation?.requirePhoneVerification || 'Требовать верификацию телефона'}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      Всегда требуется для полного доступа
                    </Typography>
                  </Box>
                  <Switch
                    checked={formData.requirePhoneVerification}
                    onChange={(e) => handleChange('requirePhoneVerification', e.target.checked)}
                    disabled={!canUpdate}
                  />
                </Box>
              </Grid>

              <Divider sx={{ my: 2, width: '100%' }} />

              {/* SMS Provider */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={dictionary?.navigation?.smsProvider || 'SMS провайдер'}
                  value={formData.smsProvider}
                  onChange={(e) => handleChange('smsProvider', e.target.value)}
                  disabled={!canUpdate}
                  helperText='Текущий провайдер: SMS.ru'
                />
              </Grid>

              {/* Submit Button */}
              {canUpdate && (
                <Grid item xs={12}>
                  <Button
                    type='submit'
                    variant='contained'
                    disabled={loading}
                    sx={{ minWidth: '120px' }}
                  >
                    {loading 
                      ? (dictionary?.navigation?.saving || 'Сохранение...') 
                      : (dictionary?.navigation?.save || 'Сохранить')
                    }
                  </Button>
                </Grid>
              )}
            </Grid>
          </form>
        </CardContent>
      </Card>
    </>
  )
}

export default RegistrationSettings







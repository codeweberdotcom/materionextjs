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
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Hook Imports
import { usePermissions } from '@/hooks/usePermissions'
import { toast } from 'react-toastify'

type SmtpPreset = {
  host: string
  port: string
  encryption: string
  fromEmail?: string
  fromName?: string
}

const SmtpSettings = () => {
  // Hooks
  const dictionary = useTranslation()
  const { checkPermission } = usePermissions()

  // Permission checks
  const canUpdate = checkPermission('smtpManagement', 'update')

  // States
  const [formData, setFormData] = useState({
    host: '',
    port: '',
    username: '',
    password: '',
    encryption: 'tls',
    fromEmail: '',
    fromName: ''
  })

  const [loading, setLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [testLoading, setTestLoading] = useState(false)
  const [sendTestLoading, setSendTestLoading] = useState(false)
  const [testRecipientEmail, setTestRecipientEmail] = useState('')
  const [message, setMessage] = useState('')

  // Email provider presets
  const presets: Record<string, SmtpPreset> = {
    gmail: {
      host: 'smtp.gmail.com',
      port: '587',
      encryption: 'tls'
    },
    outlook: {
      host: 'smtp-mail.outlook.com',
      port: '587',
      encryption: 'tls'
    },
    yandex: {
      host: 'smtp.yandex.ru',
      port: '587',
      encryption: 'tls'
    },
    mailru: {
      host: 'smtp.mail.ru',
      port: '465',
      encryption: 'ssl'
    },
    beget: {
      host: 'smtp.beget.com',
      port: '465',
      encryption: 'ssl'
    },
    yahoo: {
      host: 'smtp.mail.yahoo.com',
      port: '587',
      encryption: 'tls'
    },
    regru: {
      host: 'smtp.reg.ru',
      port: '587',
      encryption: 'tls'
    },
    rambler: {
      host: 'smtp.rambler.ru',
      port: '465',
      encryption: 'ssl'
    }
  }

  const applyPreset = (provider: string) => {
    const preset = presets[provider]

    if (preset) {
      setFormData(prev => ({
        ...prev,
        ...preset
      }))
      const providerName = dictionary?.navigation?.[provider] || provider

      setMessage(`Настройки для ${providerName} применены!`)

      // Clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000)
    }
  }

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings/smtp')

        if (response.ok) {
          const settings = await response.json()

          setFormData(settings)
        }
      } catch (error) {
        console.error('Error fetching SMTP settings:', error)
      } finally {
        setFetchLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleChange = (field: string, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value }

      // Auto-update port when encryption changes
      if (field === 'encryption') {
        switch (value) {
          case 'ssl':
            newData.port = '465'
            break
          case 'tls':
            newData.port = '587'
            break
          case 'none':
            newData.port = '25'
            break
        }
      }

      return newData
    })

    // Clear message when user makes changes
    if (message) setMessage('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/smtp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        toast.success('Настройки SMTP сохранены успешно!')
      } else if (response.status === 401) {
        toast.error('У вас нет прав для изменения настроек SMTP')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Ошибка при сохранении настроек.')
      }
    } catch (error) {
      toast.error('Ошибка при сохранении настроек.')
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async () => {
    setTestLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/smtp/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Подключение успешно!')
      } else if (response.status === 401) {
        toast.error('У вас нет прав для тестирования SMTP соединения')
      } else {
        toast.error(result.message || 'Ошибка подключения')
      }
    } catch (error) {
      toast.error('Ошибка при тестировании подключения.')
    } finally {
      setTestLoading(false)
    }
  }

  const handleSendTestEmail = async () => {
    if (!testRecipientEmail) {
      toast.error('Пожалуйста, введите email получателя')
      return
    }

    setSendTestLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/smtp/send-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          recipientEmail: testRecipientEmail
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Тестовое письмо отправлено успешно!')
      } else if (response.status === 401) {
        toast.error('У вас нет прав для отправки тестового письма')
      } else {
        toast.error(result.message || 'Ошибка отправки письма')
      }
    } catch (error) {
      toast.error('Ошибка при отправке тестового письма.')
    } finally {
      setSendTestLoading(false)
    }
  }

  if (fetchLoading) {
    return (
      <Card>
        <CardContent>
          <Typography>{dictionary?.navigation?.loadingSmtpSettings || 'Loading SMTP settings...'}</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader title={dictionary?.navigation?.smtpSettings || 'SMTP Settings'} />
        <CardContent>
          {message && (
            <Alert severity={message.includes('применены') || message.includes('applied') || message.includes('успешно') || message.includes('successfully') || message.includes('сохранены') || message.includes('saved') ? 'success' : 'error'} sx={{ mb: 4 }}>
              {message}
            </Alert>
          )}

          {/* Provider Presets */}
          {canUpdate && (
            <>
              <Typography variant='h6' gutterBottom>
                {dictionary?.navigation?.smtpPresets || 'Provider Presets'}
              </Typography>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '32px' }}>
                {Object.keys(presets).map(provider => (
                  <Button
                    key={provider}
                    variant='outlined'
                    size='small'
                    onClick={() => applyPreset(provider)}
                    startIcon={
                      provider === 'gmail' ? <i className='ri-google-line' /> :
                      provider === 'outlook' ? <i className='ri-microsoft-line' /> :
                      provider === 'yandex' ? <i className='ri-global-line' /> :
                      provider === 'mailru' ? <i className='ri-mail-line' /> :
                      provider === 'beget' ? <i className='ri-server-line' /> :
                      provider === 'yahoo' ? <i className='ri-yahoo-line' /> :
                      provider === 'regru' ? <i className='ri-global-line' /> :
                      provider === 'rambler' ? <i className='ri-mail-line' /> :
                      <i className='ri-mail-settings-line' />
                    }
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.875rem',
                      py: 1,
                      minWidth: 'auto'
                    }}
                  >
                    {dictionary?.navigation?.[provider] || provider}
                  </Button>
                ))}
              </div>
            </>
          )}
          <Divider sx={{ mb: 4 }} />

          {/* Manual Configuration */}
          <Typography variant='h6' gutterBottom>
            {dictionary?.navigation?.other || 'Other'}
          </Typography>

          <form onSubmit={handleSubmit}>
            <Grid container spacing={4}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={dictionary?.navigation?.smtpHost || 'SMTP Host'}
                  value={formData.host}
                  onChange={(e) => handleChange('host', e.target.value)}
                  required
                  disabled={!canUpdate}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={dictionary?.navigation?.smtpPort || 'SMTP Port'}
                  type='number'
                  value={formData.port}
                  onChange={(e) => handleChange('port', e.target.value)}
                  required
                  helperText="Port is automatically set when encryption changes"
                  disabled={!canUpdate}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={dictionary?.navigation?.smtpUsername || 'SMTP Username'}
                  value={formData.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                  required
                  disabled={!canUpdate}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={dictionary?.navigation?.smtpPassword || 'SMTP Password'}
                  type='password'
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  required
                  disabled={!canUpdate}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={dictionary?.navigation?.smtpEncryption || 'Encryption'}
                  select
                  value={formData.encryption}
                  onChange={(e) => handleChange('encryption', e.target.value)}
                  SelectProps={{
                    native: true
                  }}
                  helperText="Port will be set automatically based on encryption"
                  disabled={!canUpdate}
                >
                  <option value='none'>None (Port 25)</option>
                  <option value='ssl'>SSL (Port 465)</option>
                  <option value='tls'>TLS (Port 587)</option>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={dictionary?.navigation?.smtpFromEmail || 'From Email'}
                  type='email'
                  value={formData.fromEmail}
                  onChange={(e) => handleChange('fromEmail', e.target.value)}
                  required
                  disabled={!canUpdate}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={dictionary?.navigation?.smtpFromName || 'From Name'}
                  value={formData.fromName}
                  onChange={(e) => handleChange('fromName', e.target.value)}
                  required
                  disabled={!canUpdate}
                />
              </Grid>
              <Grid item xs={12}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {canUpdate && (
                    <Button
                      type='submit'
                      variant='contained'
                      disabled={loading}
                      sx={{ flex: 1, minWidth: '120px' }}
                    >
                      {loading ? dictionary?.navigation?.saving || 'Saving...' : dictionary?.navigation?.save || 'Save'}
                    </Button>
                  )}
                  {canUpdate && (
                    <Button
                      variant='outlined'
                      disabled={testLoading}
                      onClick={handleTestConnection}
                      sx={{ flex: 1, minWidth: '120px' }}
                    >
                      {testLoading ? dictionary?.navigation?.testingConnection || 'Testing...' : dictionary?.navigation?.testConnection || 'Test Connection'}
                    </Button>
                  )}
                </div>
              </Grid>
            </Grid>
          </form>

        </CardContent>
      </Card>

      {/* Test Email Widget */}
      <Card sx={{ mt: 4 }}>
        <CardHeader title={dictionary?.navigation?.testEmail || 'Test Email'} />
        <CardContent>
          <Grid container spacing={4}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={dictionary?.navigation?.recipientEmail || 'Recipient Email'}
                type='email'
                value={testRecipientEmail}
                onChange={(e) => setTestRecipientEmail(e.target.value)}
                placeholder="test@example.com"
                disabled={!canUpdate}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button
                variant='contained'
                disabled={sendTestLoading || !canUpdate}
                onClick={handleSendTestEmail}
                sx={{ height: '56px' }}
              >
                {sendTestLoading ? dictionary?.navigation?.sending || 'Sending...' : dictionary?.navigation?.sendTestEmail || 'Send Test Email'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </>
  )
}

export default SmtpSettings

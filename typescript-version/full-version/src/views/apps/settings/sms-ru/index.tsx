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
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import CircularProgress from '@mui/material/CircularProgress'
import Skeleton from '@mui/material/Skeleton'
import Chip from '@mui/material/Chip'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Hook Imports
import { usePermissions } from '@/hooks/usePermissions'
import { toast } from 'react-toastify'

const SMSRuSettings = () => {
  // Hooks
  const dictionary = useTranslation()
  const { checkPermission } = usePermissions()

  // Permission checks
  const canUpdate = checkPermission('smtpManagement', 'update')
  const canRead = checkPermission('smtpManagement', 'read')

  // States
  const [formData, setFormData] = useState({
    apiKey: '',
    sender: '',
    testMode: false
  })
  const [balance, setBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isCheckingBalance, setIsCheckingBalance] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState('Тестовое сообщение от Materio')
  const [error, setError] = useState<string | null>(null)

  // Load settings on mount
  useEffect(() => {
    if (canRead) {
      loadSettings()
    }
  }, [canRead])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/settings/sms-ru')
      if (response.ok) {
        const data = await response.json()
        setFormData({
          apiKey: data.apiKey || '',
          sender: data.sender || '',
          testMode: data.testMode ?? false
        })
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to load settings')
      }
    } catch (err) {
      setError('Failed to load settings')
      console.error('Error loading SMS.ru settings:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!canUpdate) {
      toast.error('Недостаточно прав для обновления настроек')
      return
    }

    try {
      setIsSaving(true)
      setError(null)

      const response = await fetch('/api/settings/sms-ru', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Настройки SMS.ru успешно сохранены')
        setFormData({
          apiKey: data.settings.apiKey === '***provided***' ? formData.apiKey : data.settings.apiKey,
          sender: data.settings.sender || '',
          testMode: data.settings.testMode ?? false
        })
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to save settings')
        toast.error(errorData.message || 'Ошибка при сохранении настроек')
      }
    } catch (err) {
      setError('Failed to save settings')
      toast.error('Ошибка при сохранении настроек')
      console.error('Error saving SMS.ru settings:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCheckBalance = async () => {
    try {
      setIsCheckingBalance(true)
      setError(null)

      const response = await fetch('/api/settings/sms-ru/balance')
      if (response.ok) {
        const data = await response.json()
        setBalance(data.balance)
        toast.success(`Баланс: ${data.balance} ${data.currency}`)
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to check balance')
        toast.error(errorData.message || 'Ошибка при проверке баланса')
      }
    } catch (err) {
      setError('Failed to check balance')
      toast.error('Ошибка при проверке баланса')
      console.error('Error checking balance:', err)
    } finally {
      setIsCheckingBalance(false)
    }
  }

  const handleSendTest = async () => {
    if (!testPhone) {
      toast.error('Введите номер телефона для теста')
      return
    }

    try {
      setIsTesting(true)
      setError(null)

      const response = await fetch('/api/settings/sms-ru/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: testPhone,
          message: testMessage
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(
          data.testMode
            ? 'Тестовое SMS отправлено (тестовый режим)'
            : `Тестовое SMS отправлено. ID: ${data.messageId}`
        )
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to send test SMS')
        toast.error(errorData.message || 'Ошибка при отправке тестового SMS')
      }
    } catch (err) {
      setError('Failed to send test SMS')
      toast.error('Ошибка при отправке тестового SMS')
      console.error('Error sending test SMS:', err)
    } finally {
      setIsTesting(false)
    }
  }

  if (!canRead) {
    return (
      <Card>
        <CardContent>
          <Alert severity='error'>Недостаточно прав для просмотра настроек</Alert>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader title='Настройки SMS.ru' subheader='Конфигурация сервиса отправки SMS сообщений' />
        <CardContent>
          <Grid container spacing={4}>
            {Array.from({ length: 3 }).map((_, index) => (
              <Grid item xs={12} sm={6} key={index}>
                <Skeleton height={56} />
              </Grid>
            ))}
            <Grid item xs={12}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Skeleton width={180} height={36} />
                <Skeleton width={180} height={36} />
              </div>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Main Settings Card */}
      <Card>
        <CardHeader 
          title='Настройки SMS.ru' 
          subheader='Конфигурация сервиса отправки SMS сообщений'
        />
        <CardContent>
          {error && (
            <Alert severity='error' sx={{ mb: 4 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Grid container spacing={4}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='API ключ SMS.ru'
                type='password'
                value={formData.apiKey}
                onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder='Введите API ключ от SMS.ru'
                helperText='API ключ можно получить в личном кабинете SMS.ru'
                disabled={!canUpdate}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='Отправитель (Sender ID)'
                value={formData.sender}
                onChange={e => setFormData({ ...formData, sender: e.target.value })}
                placeholder='Например: MATERIO'
                helperText='Имя отправителя (опционально). Должно быть одобрено в SMS.ru'
                disabled={!canUpdate}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.testMode}
                    onChange={e => setFormData({ ...formData, testMode: e.target.checked })}
                    disabled={!canUpdate}
                  />
                }
                label='Тестовый режим'
              />
              <Typography variant='caption' display='block' sx={{ color: 'text.secondary', ml: 4.5 }}>
                В тестовом режиме SMS не отправляются, но логируются в консоль
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', height: '100%' }}>
                <Button
                  variant='outlined'
                  onClick={handleCheckBalance}
                  disabled={!canUpdate || isCheckingBalance || !formData.apiKey}
                  startIcon={isCheckingBalance ? <CircularProgress size={20} /> : <i className='ri-wallet-3-line' />}
                >
                  Проверить баланс
                </Button>
                {balance !== null && (
                  <Chip 
                    label={`${balance.toFixed(2)} ₽`} 
                    color='success' 
                    variant='outlined'
                    icon={<i className='ri-money-ruble-circle-line' />}
                  />
                )}
              </div>
            </Grid>

            <Grid item xs={12}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Button
                  variant='contained'
                  onClick={handleSave}
                  disabled={!canUpdate || isSaving}
                  startIcon={isSaving ? <CircularProgress size={20} color='inherit' /> : <i className='ri-save-line' />}
                >
                  {isSaving ? 'Сохранение...' : 'Сохранить настройки'}
                </Button>
              </div>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Test SMS Card */}
      <Card sx={{ mt: 4 }}>
        <CardHeader 
          title='Тестовая отправка SMS' 
          subheader='Проверьте работу сервиса отправив тестовое сообщение'
        />
        <CardContent>
          <Grid container spacing={4}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='Номер телефона'
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder='+79991234567'
                helperText='Формат: +7XXXXXXXXXX'
                disabled={!canUpdate || isTesting}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='Текст сообщения'
                value={testMessage}
                onChange={e => setTestMessage(e.target.value)}
                disabled={!canUpdate || isTesting}
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                variant='contained'
                color='secondary'
                onClick={handleSendTest}
                disabled={!canUpdate || isTesting || !testPhone || !formData.apiKey}
                startIcon={isTesting ? <CircularProgress size={20} color='inherit' /> : <i className='ri-send-plane-line' />}
              >
                {isTesting ? 'Отправка...' : 'Отправить тестовое SMS'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card sx={{ mt: 4 }}>
        <CardHeader title='Информация о сервисе SMS.ru' />
        <CardContent>
          <Alert severity='info' icon={<i className='ri-information-line' />}>
            <Typography variant='body2' paragraph sx={{ mb: 1 }}>
              <strong>SMS.ru</strong> — российский сервис отправки SMS сообщений.
            </Typography>
            <Typography variant='body2' paragraph sx={{ mb: 1 }}>
              Для получения API ключа зарегистрируйтесь на{' '}
              <a href='https://sms.ru' target='_blank' rel='noopener noreferrer' style={{ color: 'inherit' }}>
                sms.ru
              </a>{' '}
              и перейдите в раздел «API».
            </Typography>
            <Typography variant='body2'>
              Sender ID (имя отправителя) требует предварительного согласования с сервисом.
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    </>
  )
}

export default SMSRuSettings

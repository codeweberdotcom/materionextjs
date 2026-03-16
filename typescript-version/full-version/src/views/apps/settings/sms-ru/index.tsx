'use client'

// React Imports
import { useState, useEffect, useCallback } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import CircularProgress from '@mui/material/CircularProgress'
import Skeleton from '@mui/material/Skeleton'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'

// Context Imports
import { toast } from 'react-toastify'

import { useTranslation } from '@/contexts/TranslationContext'

// Hook Imports
import { usePermissions } from '@/hooks/usePermissions'

const SMSRuSettings = () => {
  // Hooks
  const dictionary = useTranslation()
  const { checkPermission } = usePermissions()

  // Permission checks
  const canUpdate = checkPermission('smsManagement', 'update')
  const canRead = checkPermission('smsManagement', 'read')

  // States
  const [formData, setFormData] = useState({
    apiKey: '',
    sender: '',
    testMode: false,
    useFreeFirst: false
  })

  const [balance, setBalance] = useState<number | null>(null)
  const [freeInfo, setFreeInfo] = useState<{ free: number; used: number; total: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isCheckingBalance, setIsCheckingBalance] = useState(false)
  const [isCheckingFree, setIsCheckingFree] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState(dictionary.smsRuDefaultTestMessage)
  const [error, setError] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/settings/sms-ru')

      if (response.ok) {
        const data = await response.json()

        setFormData({
          apiKey: data.apiKey || '',
          sender: data.sender || '',
          testMode: data.testMode ?? false,
          useFreeFirst: data.useFreeFirst ?? false
        })
      } else {
        const errorData = await response.json()

        setError(errorData.message || dictionary.smsRuSaveError)
      }
    } catch (err) {
      setError(dictionary.smsRuSaveError)
      console.error('Error loading SMS.ru settings:', err)
    } finally {
      setIsLoading(false)
    }
  }, [dictionary])

  // Load settings on mount
  useEffect(() => {
    if (canRead) {
      loadSettings()
    }
  }, [canRead, loadSettings])

  const handleSave = async () => {
    if (!canUpdate) {
      toast.error(dictionary.smsRuNoAccessUpdate)

      return
    }

    try {
      setIsSaving(true)
      setError(null)

      const response = await fetch('/api/settings/sms-ru', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const data = await response.json()

        toast.success(dictionary.smsRuSettingsSaved)
        setFormData({
          apiKey: data.settings.apiKey === '***provided***' ? formData.apiKey : data.settings.apiKey,
          sender: data.settings.sender || '',
          testMode: data.settings.testMode ?? false,
          useFreeFirst: data.settings.useFreeFirst ?? false
        })
      } else {
        const errorData = await response.json()

        setError(errorData.message || dictionary.smsRuSaveError)
        toast.error(errorData.message || dictionary.smsRuSaveError)
      }
    } catch (err) {
      setError(dictionary.smsRuSaveError)
      toast.error(dictionary.smsRuSaveError)
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
        toast.success(
          dictionary.smsRuBalanceResult
            .replace('{{balance}}', String(data.balance))
            .replace('{{currency}}', data.currency)
        )
      } else {
        const errorData = await response.json()

        setError(errorData.message || dictionary.smsRuBalanceError)
        toast.error(errorData.message || dictionary.smsRuBalanceError)
      }
    } catch (err) {
      setError(dictionary.smsRuBalanceError)
      toast.error(dictionary.smsRuBalanceError)
      console.error('Error checking balance:', err)
    } finally {
      setIsCheckingBalance(false)
    }
  }

  const handleCheckFree = async () => {
    try {
      setIsCheckingFree(true)
      setError(null)

      const response = await fetch('/api/settings/sms-ru/free')

      if (response.ok) {
        const data = await response.json()

        setFreeInfo({ free: data.free, used: data.used, total: data.total })
      } else {
        const errorData = await response.json()

        toast.error(errorData.message || dictionary.smsRuFreeError)
      }
    } catch (err) {
      toast.error(dictionary.smsRuFreeError)
      console.error('Error checking free SMS:', err)
    } finally {
      setIsCheckingFree(false)
    }
  }

  const handleSendTest = async () => {
    if (!testPhone) {
      toast.error(dictionary.smsRuPhoneRequired)

      return
    }

    try {
      setIsTesting(true)
      setError(null)

      const response = await fetch('/api/settings/sms-ru/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, message: testMessage })
      })

      if (response.ok) {
        const data = await response.json()

        toast.success(
          data.testMode
            ? dictionary.smsRuTestSentTestMode
            : dictionary.smsRuTestSentId.replace('{{id}}', String(data.messageId))
        )

        // Обновляем остаток бесплатных если useFreeFirst включен
        if (formData.useFreeFirst && data.freeRemaining !== undefined) {
          setFreeInfo(prev =>
            prev
              ? { ...prev, free: data.freeRemaining, used: prev.total - data.freeRemaining }
              : { free: data.freeRemaining, used: 0, total: data.freeRemaining }
          )
        }
      } else {
        const errorData = await response.json()

        setError(errorData.message || dictionary.smsRuTestSendError)
        toast.error(errorData.message || dictionary.smsRuTestSendError)
      }
    } catch (err) {
      setError(dictionary.smsRuTestSendError)
      toast.error(dictionary.smsRuTestSendError)
      console.error('Error sending test SMS:', err)
    } finally {
      setIsTesting(false)
    }
  }

  if (!canRead) {
    return (
      <Card>
        <CardContent>
          <Alert severity='error'>{dictionary.smsRuNoAccess}</Alert>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader title={dictionary.smsRuSettings} subheader={dictionary.smsRuSettingsSubheader} />
        <CardContent>
          <Grid container spacing={4}>
            {Array.from({ length: 4 }).map((_, index) => (
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
          title={dictionary.smsRuSettings}
          subheader={dictionary.smsRuSettingsSubheader}
        />
        <CardContent>
          {error && (
            <Alert severity='error' sx={{ mb: 4 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Grid container spacing={4}>
            {/* API Key */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={dictionary.smsRuApiKey}
                type='password'
                value={formData.apiKey}
                onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder={dictionary.smsRuApiKeyPlaceholder}
                helperText={dictionary.smsRuApiKeyHelper}
                disabled={!canUpdate}
              />
            </Grid>

            {/* Sender */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={dictionary.smsRuSenderId}
                value={formData.sender}
                onChange={e => setFormData({ ...formData, sender: e.target.value })}
                placeholder={dictionary.smsRuSenderIdPlaceholder}
                helperText={dictionary.smsRuSenderIdHelper}
                disabled={!canUpdate}
              />
            </Grid>

            {/* Test Mode */}
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.testMode}
                    onChange={e => setFormData({ ...formData, testMode: e.target.checked })}
                    disabled={!canUpdate}
                  />
                }
                label={dictionary.smsRuTestMode}
              />
              <Typography variant='caption' display='block' sx={{ color: 'text.secondary', ml: 4.5 }}>
                {dictionary.smsRuTestModeHelper}
              </Typography>
            </Grid>

            {/* Use Free First */}
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.useFreeFirst}
                    onChange={e => setFormData({ ...formData, useFreeFirst: e.target.checked })}
                    disabled={!canUpdate}
                    color='success'
                  />
                }
                label={dictionary.smsRuUseFreeFirst}
              />
              <Typography variant='caption' display='block' sx={{ color: 'text.secondary', ml: 4.5 }}>
                {dictionary.smsRuUseFreeFirstHelper}
              </Typography>
            </Grid>

            {/* Free SMS counter — показывается только когда useFreeFirst включен */}
            {formData.useFreeFirst && (
              <Grid item xs={12}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <Button
                    variant='outlined'
                    color='success'
                    size='small'
                    onClick={handleCheckFree}
                    disabled={isCheckingFree || !formData.apiKey}
                    startIcon={isCheckingFree ? <CircularProgress size={16} /> : <i className='ri-gift-line' />}
                  >
                    {dictionary.smsRuCheckFree}
                  </Button>

                  {freeInfo !== null && (
                    <Tooltip
                      title={dictionary.smsRuFreeTooltip
                        .replace('{{used}}', String(freeInfo.used))
                        .replace('{{total}}', String(freeInfo.total))}
                    >
                      <Chip
                        label={
                          freeInfo.free > 0
                            ? dictionary.smsRuFreeRemaining.replace('{{count}}', String(freeInfo.free))
                            : dictionary.smsRuFreeExhausted
                        }
                        color={freeInfo.free > 0 ? 'success' : 'warning'}
                        variant='outlined'
                        icon={<i className={freeInfo.free > 0 ? 'ri-gift-line' : 'ri-gift-2-line'} />}
                      />
                    </Tooltip>
                  )}
                </div>
              </Grid>
            )}

            {/* Balance */}
            <Grid item xs={12} sm={6}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', height: '100%' }}>
                <Button
                  variant='outlined'
                  onClick={handleCheckBalance}
                  disabled={!canRead || isCheckingBalance || !formData.apiKey}
                  startIcon={isCheckingBalance ? <CircularProgress size={20} /> : <i className='ri-wallet-3-line' />}
                >
                  {dictionary.smsRuCheckBalance}
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

            {/* Save */}
            <Grid item xs={12}>
              <Button
                variant='contained'
                onClick={handleSave}
                disabled={!canUpdate || isSaving}
                startIcon={isSaving ? <CircularProgress size={20} color='inherit' /> : <i className='ri-save-line' />}
              >
                {isSaving ? dictionary.saving : dictionary.smsRuSaveSettings}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Test SMS Card */}
      <Card sx={{ mt: 4 }}>
        <CardHeader
          title={dictionary.smsRuTestCardTitle}
          subheader={dictionary.smsRuTestCardSubheader}
        />
        <CardContent>
          <Grid container spacing={4}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={dictionary.phoneNumber}
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder='+79991234567'
                helperText={dictionary.smsRuPhoneFormat}
                disabled={!canUpdate || isTesting}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={dictionary.smsRuMessageText}
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
                {isTesting ? dictionary.smsRuSending : dictionary.smsRuSendTestButton}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card sx={{ mt: 4 }}>
        <CardHeader title={dictionary.smsRuInfoCardTitle} />
        <CardContent>
          <Alert severity='info' icon={<i className='ri-information-line' />}>
            <Typography variant='body2' paragraph sx={{ mb: 1 }}>
              <strong>SMS.ru</strong> — {dictionary.smsRuInfoText1}
            </Typography>
            <Typography variant='body2' paragraph sx={{ mb: 1 }}>
              {dictionary.smsRuInfoText2}
            </Typography>
            <Typography variant='body2'>
              {dictionary.smsRuInfoText3}
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    </>
  )
}

export default SMSRuSettings

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
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Hook Imports
import { usePermissions } from '@/hooks/usePermissions'
import { toast } from 'react-toastify'

interface TelegramSettings {
  botToken: string
  defaultChatId?: string
  channelId?: string
  channelEnabled: boolean
  enabled: boolean
  updatedAt?: string
}

interface BotInfo {
  id: number
  username: string
  firstName: string
}

const TelegramSettings = () => {
  // Hooks
  const dictionary = useTranslation()
  const { checkPermission } = usePermissions()

  // Permission checks
  const canUpdate = checkPermission('smtpManagement', 'update')

  // States
  const [formData, setFormData] = useState<TelegramSettings>({
    botToken: '',
    defaultChatId: '',
    channelId: '',
    channelEnabled: false,
    enabled: false
  })

  const [loading, setLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [testLoading, setTestLoading] = useState(false)
  const [testChannelLoading, setTestChannelLoading] = useState(false)
  const [testChatId, setTestChatId] = useState('')
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null)

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings/telegram')

        if (response.ok) {
          const settings = await response.json()
          setFormData(settings)
        }
      } catch (error) {
        console.error('Error fetching Telegram settings:', error)
      } finally {
        setFetchLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleChange = (field: keyof TelegramSettings, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/settings/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        toast.success('Настройки Telegram сохранены успешно!')
      } else if (response.status === 401) {
        toast.error('У вас нет прав для изменения настроек Telegram')
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

  const handleTestBot = async () => {
    if (!formData.botToken) {
      toast.error('Введите Bot Token')
      return
    }

    if (!testChatId && !formData.defaultChatId) {
      toast.error('Введите Chat ID для тестирования')
      return
    }

    setTestLoading(true)

    try {
      const response = await fetch('/api/settings/telegram/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          botToken: formData.botToken,
          chatId: testChatId || formData.defaultChatId
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Тестовое сообщение отправлено успешно!')
        if (result.botInfo) {
          setBotInfo(result.botInfo)
        }
      } else if (response.status === 401) {
        toast.error('У вас нет прав для тестирования Telegram')
      } else {
        toast.error(result.message || 'Ошибка тестирования')
      }
    } catch (error) {
      toast.error('Ошибка при тестировании Telegram.')
    } finally {
      setTestLoading(false)
    }
  }

  const handleTestChannel = async () => {
    if (!formData.botToken) {
      toast.error('Введите Bot Token')
      return
    }

    if (!formData.channelId) {
      toast.error('Введите Channel ID')
      return
    }

    setTestChannelLoading(true)

    try {
      const response = await fetch('/api/settings/telegram/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          botToken: formData.botToken,
          chatId: formData.channelId
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Тестовое сообщение отправлено в канал!')
        if (result.botInfo) {
          setBotInfo(result.botInfo)
        }
      } else if (response.status === 401) {
        toast.error('У вас нет прав для тестирования Telegram')
      } else {
        toast.error(result.message || 'Ошибка тестирования канала. Убедитесь, что бот является администратором канала.')
      }
    } catch (error) {
      toast.error('Ошибка при тестировании канала.')
    } finally {
      setTestChannelLoading(false)
    }
  }

  if (fetchLoading) {
    return (
      <Card>
        <CardHeader title={<Skeleton width={200} height={28} />} />
        <CardContent>
          <Grid container spacing={4}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Grid item xs={12} sm={6} key={index}>
                <Skeleton height={56} />
              </Grid>
            ))}
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
          title="Настройки Telegram Bot"
          subheader="Настройте Telegram бота для отправки уведомлений пользователям"
        />
        <CardContent>
          {/* Info Alert */}
          <Alert severity="info" sx={{ mb: 4 }}>
            <Box>
              <Typography variant="body2" component="span" fontWeight={600}>
                Как настроить:
              </Typography>
              <Box component="ol" sx={{ m: '8px 0 0 0', pl: '20px', '& li': { mb: 0.5 } }}>
                <li>Создайте бота через @BotFather в Telegram</li>
                <li>Скопируйте токен бота и вставьте ниже</li>
                <li>Для личных сообщений: пользователи должны начать диалог с ботом</li>
                <li>Для канала: добавьте бота как администратора канала</li>
              </Box>
            </Box>
          </Alert>

          <form onSubmit={handleSubmit}>
            <Grid container spacing={4}>
              {/* Bot Token */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Bot Token"
                  value={formData.botToken}
                  onChange={(e) => handleChange('botToken', e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  required
                  disabled={!canUpdate}
                  type="password"
                  helperText="Токен бота, полученный от @BotFather"
                />
              </Grid>

              {/* Enable Bot */}
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.enabled}
                      onChange={(e) => handleChange('enabled', e.target.checked)}
                      disabled={!canUpdate}
                    />
                  }
                  label="Включить отправку уведомлений через Telegram"
                />
              </Grid>

              {/* Bot Info */}
              {botInfo && (
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip 
                      label={`@${botInfo.username}`} 
                      color="success" 
                      icon={<i className="ri-telegram-line" />}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {botInfo.firstName}
                    </Typography>
                  </Box>
                </Grid>
              )}

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Личные уведомления пользователям
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Chat ID пользователя хранится в профиле (User.telegramChatId).
                  Пользователь должен начать диалог с ботом и отправить команду /start.
                </Typography>
              </Grid>

              {/* Default Chat ID */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Default Chat ID (опционально)"
                  value={formData.defaultChatId || ''}
                  onChange={(e) => handleChange('defaultChatId', e.target.value)}
                  placeholder="123456789"
                  disabled={!canUpdate}
                  helperText="Chat ID по умолчанию (для тестирования)"
                />
              </Grid>

              {/* Test Chat ID */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Chat ID для тестирования"
                  value={testChatId}
                  onChange={(e) => setTestChatId(e.target.value)}
                  placeholder="123456789"
                  disabled={!canUpdate}
                  helperText="Введите свой Chat ID для тестирования"
                />
              </Grid>

              {/* Test Bot Button */}
              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  disabled={testLoading || !canUpdate || !formData.botToken}
                  onClick={handleTestBot}
                  startIcon={<i className="ri-send-plane-line" />}
                >
                  {testLoading ? 'Отправка...' : 'Отправить тестовое сообщение'}
                </Button>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Публикация в канал (системные события)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Публикуйте системные события (регистрации, ошибки, платежи) в Telegram канал для мониторинга.
                </Typography>
              </Grid>

              {/* Channel ID */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Channel ID"
                  value={formData.channelId || ''}
                  onChange={(e) => handleChange('channelId', e.target.value)}
                  placeholder="@channelname или -1001234567890"
                  disabled={!canUpdate}
                  helperText="ID канала (начинается с @ или -100)"
                />
              </Grid>

              {/* Enable Channel */}
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.channelEnabled}
                      onChange={(e) => handleChange('channelEnabled', e.target.checked)}
                      disabled={!canUpdate}
                    />
                  }
                  label="Включить публикацию в канал"
                />
              </Grid>

              {/* Test Channel Button */}
              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  disabled={testChannelLoading || !canUpdate || !formData.botToken || !formData.channelId}
                  onClick={handleTestChannel}
                  startIcon={<i className="ri-megaphone-line" />}
                >
                  {testChannelLoading ? 'Отправка...' : 'Отправить в канал'}
                </Button>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
              </Grid>

              {/* Save Button */}
              <Grid item xs={12}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {canUpdate && (
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={loading}
                      startIcon={<i className="ri-save-line" />}
                    >
                      {loading ? 'Сохранение...' : 'Сохранить настройки'}
                    </Button>
                  )}
                </div>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>

      {/* How to get Chat ID */}
      <Card sx={{ mt: 4 }}>
        <CardHeader title="Как получить Chat ID" />
        <CardContent>
          <Typography variant="body2" paragraph>
            <strong>Для личного чата:</strong>
          </Typography>
          <ol style={{ paddingLeft: '20px', margin: '0 0 16px 0' }}>
            <li>Начните диалог с ботом @userinfobot</li>
            <li>Отправьте любое сообщение</li>
            <li>Бот вернёт ваш Chat ID</li>
          </ol>

          <Typography variant="body2" paragraph>
            <strong>Для канала:</strong>
          </Typography>
          <ol style={{ paddingLeft: '20px', margin: '0 0 16px 0' }}>
            <li>Добавьте бота @userinfobot в канал как администратора</li>
            <li>Перешлите любое сообщение из канала боту</li>
            <li>Бот вернёт Chat ID канала (начинается с -100)</li>
            <li>Или используйте username канала: @channelname</li>
          </ol>

          <Alert severity="warning">
            <Typography variant="body2">
              Для публикации в канал ваш бот должен быть добавлен как администратор канала с правом публикации сообщений.
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    </>
  )
}

export default TelegramSettings




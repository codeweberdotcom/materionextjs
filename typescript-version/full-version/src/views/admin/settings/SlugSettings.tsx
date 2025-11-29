'use client'

/**
 * Страница настроек системы slug/username в админке
 */

import { useState, useEffect } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid2'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'

import { toast } from 'react-toastify'

interface SlugSettings {
  changeIntervalDays: number
  minLength: number
  maxLength: number
  reservedSlugs: string
  allowAdminOverride: boolean
  updatedAt?: string
}

const defaultSettings: SlugSettings = {
  changeIntervalDays: 30,
  minLength: 3,
  maxLength: 50,
  reservedSlugs: '[]',
  allowAdminOverride: true
}

// Зарезервированные slug по умолчанию (из SlugService)
const systemReservedSlugs = [
  'admin', 'administrator', 'support', 'help', 'api', 'www', 'static',
  'assets', 'user', 'users', 'account', 'accounts', 'settings', 'profile',
  'login', 'logout', 'register', 'auth', 'moderator', 'system',
  'null', 'undefined', 'true', 'false', 'new', 'edit', 'delete', 'create',
  'company', 'companies', 'seller', 'sellers', 'shop', 'shops', 'store'
]

const SlugSettings = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<SlugSettings>(defaultSettings)
  const [newReservedSlug, setNewReservedSlug] = useState('')

  // Parse reserved slugs
  const getCustomReservedSlugs = (): string[] => {
    try {
      return JSON.parse(settings.reservedSlugs)
    } catch {
      return []
    }
  }

  // Add reserved slug
  const addReservedSlug = () => {
    if (!newReservedSlug.trim()) return
    
    const slug = newReservedSlug.toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (!slug) return

    const current = getCustomReservedSlugs()
    if (current.includes(slug) || systemReservedSlugs.includes(slug)) {
      toast.warning('This slug is already reserved')
      return
    }

    setSettings({
      ...settings,
      reservedSlugs: JSON.stringify([...current, slug])
    })
    setNewReservedSlug('')
  }

  // Remove reserved slug
  const removeReservedSlug = (slug: string) => {
    const current = getCustomReservedSlugs()
    setSettings({
      ...settings,
      reservedSlugs: JSON.stringify(current.filter(s => s !== slug))
    })
  }

  // Fetch settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/admin/settings/slug')
        
        if (response.ok) {
          const data = await response.json()
          setSettings({
            changeIntervalDays: data.changeIntervalDays ?? defaultSettings.changeIntervalDays,
            minLength: data.minLength ?? defaultSettings.minLength,
            maxLength: data.maxLength ?? defaultSettings.maxLength,
            reservedSlugs: data.reservedSlugs ?? defaultSettings.reservedSlugs,
            allowAdminOverride: data.allowAdminOverride ?? defaultSettings.allowAdminOverride,
            updatedAt: data.updatedAt
          })
        }
      } catch (error) {
        console.error('Error fetching slug settings:', error)
        toast.error('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  // Save settings
  const handleSave = async () => {
    setSaving(true)

    try {
      const response = await fetch('/api/admin/settings/slug', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Settings saved successfully!')
        setSettings({
          ...settings,
          updatedAt: data.settings?.updatedAt
        })
      } else {
        toast.error(data.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  // Reset to defaults
  const handleReset = () => {
    setSettings(defaultSettings)
  }

  if (loading) {
    return (
      <Grid container spacing={6}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader title={<Skeleton width={200} />} />
            <CardContent>
              <Stack spacing={3}>
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} variant="rectangular" height={56} />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    )
  }

  const customReservedSlugs = getCustomReservedSlugs()

  return (
    <Grid container spacing={6}>
      {/* Main Settings */}
      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardHeader 
            title="Username/Slug Settings"
            subheader="Configure how usernames and company slugs work"
          />
          <CardContent>
            <Grid container spacing={4}>
              {/* Change Interval */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Change Interval (days)"
                  value={settings.changeIntervalDays}
                  onChange={(e) => setSettings({
                    ...settings,
                    changeIntervalDays: parseInt(e.target.value) || 0
                  })}
                  helperText="Minimum days between username changes"
                  inputProps={{ min: 0, max: 365 }}
                />
              </Grid>

              {/* Min Length */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Minimum Length"
                  value={settings.minLength}
                  onChange={(e) => setSettings({
                    ...settings,
                    minLength: parseInt(e.target.value) || 3
                  })}
                  helperText="Minimum characters for username"
                  inputProps={{ min: 1, max: 50 }}
                />
              </Grid>

              {/* Max Length */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Maximum Length"
                  value={settings.maxLength}
                  onChange={(e) => setSettings({
                    ...settings,
                    maxLength: parseInt(e.target.value) || 50
                  })}
                  helperText="Maximum characters for username"
                  inputProps={{ min: 10, max: 100 }}
                />
              </Grid>

              {/* Admin Override */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.allowAdminOverride}
                      onChange={(e) => setSettings({
                        ...settings,
                        allowAdminOverride: e.target.checked
                      })}
                    />
                  }
                  label="Allow Admin Override"
                />
                <Typography variant="caption" color="text.secondary" display="block">
                  Admins can change usernames without interval limit
                </Typography>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Divider className="my-4" />
              </Grid>

              {/* Actions */}
              <Grid size={{ xs: 12 }}>
                <Box className="flex gap-4">
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={handleReset}
                    disabled={saving}
                  >
                    Reset to Defaults
                  </Button>
                </Box>

                {settings.updatedAt && (
                  <Typography variant="caption" color="text.secondary" className="mt-2" display="block">
                    Last updated: {new Date(settings.updatedAt).toLocaleString()}
                  </Typography>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Reserved Slugs */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardHeader 
            title="Reserved Slugs"
            subheader="Usernames that cannot be used"
          />
          <CardContent>
            {/* Add new reserved slug */}
            <Box className="flex gap-2 mb-4">
              <TextField
                size="small"
                fullWidth
                placeholder="Add slug..."
                value={newReservedSlug}
                onChange={(e) => setNewReservedSlug(e.target.value.toLowerCase())}
                onKeyDown={(e) => e.key === 'Enter' && addReservedSlug()}
              />
              <Button
                variant="contained"
                size="small"
                onClick={addReservedSlug}
              >
                Add
              </Button>
            </Box>

            {/* Custom reserved slugs */}
            {customReservedSlugs.length > 0 && (
              <Box className="mb-4">
                <Typography variant="subtitle2" className="mb-2">
                  Custom Reserved ({customReservedSlugs.length})
                </Typography>
                <Box className="flex flex-wrap gap-1">
                  {customReservedSlugs.map(slug => (
                    <Chip
                      key={slug}
                      label={slug}
                      size="small"
                      onDelete={() => removeReservedSlug(slug)}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* System reserved slugs */}
            <Box>
              <Typography variant="subtitle2" className="mb-2" color="text.secondary">
                System Reserved ({systemReservedSlugs.length})
              </Typography>
              <Box className="flex flex-wrap gap-1">
                {systemReservedSlugs.slice(0, 15).map(slug => (
                  <Chip
                    key={slug}
                    label={slug}
                    size="small"
                    variant="outlined"
                    disabled
                  />
                ))}
                {systemReservedSlugs.length > 15 && (
                  <Chip
                    label={`+${systemReservedSlugs.length - 15} more`}
                    size="small"
                    variant="outlined"
                    disabled
                  />
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6">
          <CardContent>
            <Alert severity="info">
              <Typography variant="body2" className="mb-2">
                <strong>Username Rules:</strong>
              </Typography>
              <ul className="list-disc pl-4 text-sm">
                <li>Only lowercase letters, numbers, underscore</li>
                <li>Cannot start with a number</li>
                <li>Length: {settings.minLength}-{settings.maxLength} characters</li>
                <li>Must be unique globally</li>
                <li>Old usernames redirect (301) to new ones</li>
              </ul>
            </Alert>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default SlugSettings


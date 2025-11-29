'use client'

/**
 * Карточка для просмотра и смены username
 */

import { useState, useEffect } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Collapse from '@mui/material/Collapse'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'

import { toast } from 'react-toastify'

// Context
import { useTranslation } from '@/contexts/TranslationContext'

interface UsernameInfo {
  username: string | null
  usernameChangedAt: string | null
  canChange: boolean
  nextChangeDate?: string
  history: Array<{
    oldSlug: string
    newSlug: string
    changedAt: string
  }>
}

const UsernameCard = () => {
  const dictionary = useTranslation()

  // States
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [usernameInfo, setUsernameInfo] = useState<UsernameInfo | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [availability, setAvailability] = useState<{
    available?: boolean
    valid?: boolean
    error?: string
  } | null>(null)

  // Fetch username info
  useEffect(() => {
    const fetchUsernameInfo = async () => {
      try {
        const response = await fetch('/api/user/username')
        
        if (response.ok) {
          const data = await response.json()
          setUsernameInfo(data)
          setNewUsername(data.username || '')
        } else if (response.status === 401) {
          // Not authenticated
          return
        }
      } catch (error) {
        console.error('Error fetching username info:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUsernameInfo()
  }, [])

  // Check username availability (debounced)
  useEffect(() => {
    if (!isEditing || !newUsername || newUsername === usernameInfo?.username) {
      setAvailability(null)
      return
    }

    const timeoutId = setTimeout(async () => {
      setChecking(true)
      try {
        const response = await fetch(`/api/user/username/check?username=${encodeURIComponent(newUsername)}`)
        
        if (response.ok) {
          const data = await response.json()
          setAvailability(data)
        }
      } catch (error) {
        console.error('Error checking username:', error)
      } finally {
        setChecking(false)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [newUsername, isEditing, usernameInfo?.username])

  // Handle save
  const handleSave = async () => {
    if (!newUsername || newUsername === usernameInfo?.username) {
      setIsEditing(false)
      return
    }

    if (availability && !availability.available) {
      toast.error(availability.error || 'Username not available')
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/user/username', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Username changed successfully!')
        
        // Refresh info
        const infoResponse = await fetch('/api/user/username')
        if (infoResponse.ok) {
          setUsernameInfo(await infoResponse.json())
        }
        
        setIsEditing(false)
        setAvailability(null)
      } else {
        toast.error(data.error || 'Failed to change username')
      }
    } catch (error) {
      console.error('Error changing username:', error)
      toast.error('Failed to change username')
    } finally {
      setSaving(false)
    }
  }

  // Handle cancel
  const handleCancel = () => {
    setNewUsername(usernameInfo?.username || '')
    setIsEditing(false)
    setAvailability(null)
  }

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  // Calculate days until can change
  const getDaysUntilChange = () => {
    if (!usernameInfo?.nextChangeDate) return null
    
    const nextDate = new Date(usernameInfo.nextChangeDate)
    const now = new Date()
    const diff = nextDate.getTime() - now.getTime()
    
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  if (loading) {
    return (
      <Card>
        <CardHeader title={<Skeleton width={150} />} />
        <CardContent>
          <Stack spacing={2}>
            <Skeleton variant="rectangular" height={56} />
            <Skeleton width="60%" />
          </Stack>
        </CardContent>
      </Card>
    )
  }

  const daysUntilChange = getDaysUntilChange()

  return (
    <Card>
      <CardHeader 
        title="Username"
        subheader="Your unique profile URL identifier"
        action={
          usernameInfo?.username && (
            <Chip 
              label={`/${usernameInfo.username}`}
              variant="outlined"
              color="primary"
              size="small"
            />
          )
        }
      />
      <CardContent>
        {/* Current Username Display */}
        {!isEditing ? (
          <Box>
            <Box className="flex items-center gap-4 mb-4">
              <TextField
                fullWidth
                label="Username"
                value={usernameInfo?.username || ''}
                disabled
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">@</InputAdornment>
                  )
                }}
              />
              <Button
                variant="contained"
                onClick={() => setIsEditing(true)}
                disabled={!usernameInfo?.canChange}
              >
                Change
              </Button>
            </Box>

            {/* Info about change restrictions */}
            {!usernameInfo?.canChange && daysUntilChange !== null && (
              <Alert severity="info" className="mb-4">
                You can change your username in {daysUntilChange} days
                {usernameInfo?.nextChangeDate && (
                  <Typography variant="caption" display="block">
                    Available from: {formatDate(usernameInfo.nextChangeDate)}
                  </Typography>
                )}
              </Alert>
            )}

            {/* Last change info */}
            {usernameInfo?.usernameChangedAt && (
              <Typography variant="body2" color="text.secondary" className="mb-2">
                Last changed: {formatDate(usernameInfo.usernameChangedAt)}
              </Typography>
            )}

            {/* History toggle */}
            {usernameInfo?.history && usernameInfo.history.length > 0 && (
              <Box className="mt-4">
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setShowHistory(!showHistory)}
                  startIcon={<i className={showHistory ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} />}
                >
                  {showHistory ? 'Hide' : 'Show'} history ({usernameInfo.history.length})
                </Button>
                
                <Collapse in={showHistory}>
                  <List dense className="mt-2">
                    {usernameInfo.history.map((item, index) => (
                      <Box key={index}>
                        {index > 0 && <Divider />}
                        <ListItem>
                          <ListItemText
                            primary={
                              <Box className="flex items-center gap-2">
                                <Typography variant="body2" color="text.secondary">
                                  @{item.oldSlug}
                                </Typography>
                                <i className="ri-arrow-right-line text-sm" />
                                <Typography variant="body2">
                                  @{item.newSlug}
                                </Typography>
                              </Box>
                            }
                            secondary={formatDate(item.changedAt)}
                          />
                        </ListItem>
                      </Box>
                    ))}
                  </List>
                </Collapse>
              </Box>
            )}

            {/* Public profile link */}
            {usernameInfo?.username && (
              <Box className="mt-4 p-3 bg-actionHover rounded">
                <Typography variant="body2" color="text.secondary" className="mb-1">
                  Your public profile:
                </Typography>
                <Typography 
                  variant="body2" 
                  component="a"
                  href={`/en/user/${usernameInfo.username}`}
                  target="_blank"
                  className="text-primary hover:underline"
                >
                  {window.location.origin}/user/{usernameInfo.username}
                </Typography>
              </Box>
            )}
          </Box>
        ) : (
          /* Edit Mode */
          <Box>
            <TextField
              fullWidth
              label="New Username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="your_username"
              helperText="Only lowercase letters, numbers, and underscores"
              error={availability?.valid === false}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">@</InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    {checking ? (
                      <CircularProgress size={20} />
                    ) : availability ? (
                      availability.available ? (
                        <i className="ri-check-line text-success" />
                      ) : (
                        <i className="ri-close-line text-error" />
                      )
                    ) : null}
                  </InputAdornment>
                )
              }}
              className="mb-4"
            />

            {/* Availability message */}
            {availability && (
              <Alert 
                severity={availability.available ? 'success' : 'error'} 
                className="mb-4"
              >
                {availability.available 
                  ? 'Username is available!' 
                  : availability.error || 'Username is not available'}
              </Alert>
            )}

            {/* Action buttons */}
            <Box className="flex gap-4">
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving || checking || !availability?.available}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </Button>
            </Box>

            {/* Warning */}
            <Alert severity="warning" className="mt-4">
              <Typography variant="body2">
                Changing your username will update your profile URL. Old URLs will redirect to your new username.
              </Typography>
            </Alert>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

export default UsernameCard


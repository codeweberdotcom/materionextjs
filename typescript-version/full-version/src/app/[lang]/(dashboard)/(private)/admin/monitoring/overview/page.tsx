// React Imports
'use client'

import React, { useEffect, useState } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid2'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  services: {
    database: 'up' | 'down'
    redis: 'up' | 'down'
    socketio: 'up' | 'down'
  }
  timestamp: string
  version: string
  environment: string
}

const MonitoringOverviewPage = () => {
  const t = useTranslation()
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHealthStatus = async () => {
      try {
        const response = await fetch('/api/health')
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        setHealthStatus(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch health status')
      } finally {
        setLoading(false)
      }
    }

    fetchHealthStatus()

    // Обновлять статус каждые 30 секунд
    const interval = setInterval(fetchHealthStatus, 30000)

    return () => clearInterval(interval)
  }, [])

  const getServiceStatus = (service: keyof HealthStatus['services']) => {
    if (!healthStatus) return { status: 'unknown', color: 'text.secondary' as const, icon: '?' }

    const status = healthStatus.services[service]
    switch (status) {
      case 'up':
        return { status: 'Running', color: 'success.main' as const, icon: '✓' }
      case 'down':
        return { status: 'Not available', color: 'error.main' as const, icon: '✗' }
      default:
        return { status: 'Unknown', color: 'warning.main' as const, icon: '⚠' }
    }
  }

  const getOverallStatus = () => {
    if (!healthStatus) return { text: 'Loading...', color: 'text.secondary' as const }

    switch (healthStatus.status) {
      case 'healthy':
        return { text: 'All systems operational', color: 'success.main' as const }
      case 'degraded':
        return { text: 'Some services unavailable', color: 'warning.main' as const }
      case 'unhealthy':
        return { text: 'System issues detected', color: 'error.main' as const }
      default:
        return { text: 'Status unknown', color: 'text.secondary' as const }
    }
  }

  if (loading) {
    return (
      <Grid container spacing={6}>
        <Grid size={{ xs: 12 }}>
          <Typography variant='h4' className='mbe-1'>
            Monitoring Overview
          </Typography>
          <Typography>
            Comprehensive overview of system monitoring and analytics
          </Typography>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography>Loading system status...</Typography>
              <LinearProgress sx={{ mt: 2 }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    )
  }

  if (error) {
    return (
      <Grid container spacing={6}>
        <Grid size={{ xs: 12 }}>
          <Typography variant='h4' className='mbe-1'>
            Monitoring Overview
          </Typography>
          <Typography>
            Comprehensive overview of system monitoring and analytics
          </Typography>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography color="error.main">
                Error loading system status: {error}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    )
  }

  const overallStatus = getOverallStatus()

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' className='mbe-1'>
          Monitoring Overview
        </Typography>
        <Typography>
          Comprehensive overview of system monitoring and analytics
        </Typography>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title="System Status" />
          <CardContent>
            <Typography variant="body1" gutterBottom sx={{ color: overallStatus.color }}>
              {overallStatus.text}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Last updated: {healthStatus ? new Date(healthStatus.timestamp).toLocaleString() : 'Unknown'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Environment: {healthStatus?.environment || 'Unknown'} | Version: {healthStatus?.version || 'Unknown'}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title="Active Services" />
          <CardContent>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Database (SQLite)
              </Typography>
              <Typography variant="body1" sx={{ color: getServiceStatus('database').color }}>
                {getServiceStatus('database').icon} {getServiceStatus('database').status}
              </Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Redis Cache
              </Typography>
              <Typography variant="body1" sx={{ color: getServiceStatus('redis').color }}>
                {getServiceStatus('redis').icon} {getServiceStatus('redis').status}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Socket.IO
              </Typography>
              <Typography variant="body1" sx={{ color: getServiceStatus('socketio').color }}>
                {getServiceStatus('socketio').icon} {getServiceStatus('socketio').status}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default MonitoringOverviewPage
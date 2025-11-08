// React Imports
'use client'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid2'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

const MonitoringErrorTrackingPage = () => {
  const t = useTranslation()

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' className='mbe-1'>
          Error Tracking
        </Typography>
        <Typography>
          Monitor and track application errors and exceptions
        </Typography>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Alert severity="info" sx={{ mb: 4 }}>
          Error tracking is configured with Sentry. Check the Sentry dashboard for detailed error reports.
        </Alert>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title="Recent Errors" />
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Error tracking data will be displayed here when errors occur.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Configure Sentry DSN in environment variables to enable error tracking.
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title="Error Statistics" />
          <CardContent>
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Errors (24h)
              </Typography>
              <Typography variant="h6">
                0
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Unique Errors
              </Typography>
              <Typography variant="h6">
                0
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Affected Users
              </Typography>
              <Typography variant="h6">
                0
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default MonitoringErrorTrackingPage
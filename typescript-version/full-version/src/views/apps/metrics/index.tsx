// React Imports
'use client'

import { useEffect, useState } from 'react'

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

// Hook Imports
import { usePermissions } from '@/hooks/usePermissions'

// Recharts Imports
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Area,
  AreaChart
} from 'recharts'

const MetricsPage = () => {
  const t = useTranslation()
  const { checkPermission } = usePermissions()

  // States
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState<any[]>([])

  // Fetch metrics on mount
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/metrics')
        if (response.ok) {
          const data = await response.json()
          setMetrics(data)

          // Generate mock chart data based on current metrics
          const mockChartData = [
            { time: '00:00', users: 1200, sessions: 85, requests: 450 },
            { time: '04:00', users: 1180, sessions: 82, requests: 380 },
            { time: '08:00', users: 1250, sessions: 89, requests: 520 },
            { time: '12:00', users: 1320, sessions: 95, requests: 680 },
            { time: '16:00', users: 1280, sessions: 92, requests: 620 },
            { time: '20:00', users: 1240, sessions: 88, requests: 580 },
          ]
          setChartData(mockChartData)
        }
      } catch (error) {
        console.error('Error fetching metrics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography>Loading metrics...</Typography>
          <LinearProgress sx={{ mt: 2 }} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' className='mbe-1'>
          Application Metrics
        </Typography>
        <Typography>
          Monitor your application performance and system metrics
        </Typography>
      </Grid>

      {metrics && (
        <>
          {/* System Metrics */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader title="System Metrics" />
              <CardContent>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Memory Usage
                  </Typography>
                  <Typography variant="h6">
                    {metrics?.system?.memoryUsage ? `${(metrics.system.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    CPU Usage
                  </Typography>
                  <Typography variant="h6">
                    {metrics?.system?.cpuUsage ? `${metrics.system.cpuUsage.toFixed(2)}%` : 'N/A'}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Uptime
                  </Typography>
                  <Typography variant="h6">
                    {metrics?.system?.uptime ? `${Math.floor(metrics.system.uptime / 3600)}h ${Math.floor((metrics.system.uptime % 3600) / 60)}m` : 'N/A'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Application Metrics */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader title="Application Metrics" />
              <CardContent>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Users
                  </Typography>
                  <Typography variant="h6">
                    {metrics?.application?.totalUsers || 0}
                  </Typography>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Active Sessions
                  </Typography>
                  <Typography variant="h6">
                    {metrics?.application?.activeSessions || 0}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    API Requests (Last Hour)
                  </Typography>
                  <Typography variant="h6">
                    {metrics?.application?.apiRequests || 0}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Database Metrics */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader title="Database Metrics" />
              <CardContent>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Records
                  </Typography>
                  <Typography variant="h6">
                    {metrics?.application?.totalRecords || 0}
                  </Typography>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Database Size
                  </Typography>
                  <Typography variant="h6">
                    {metrics?.application?.databaseSize ? `${(metrics.application.databaseSize / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Connection Pool
                  </Typography>
                  <Typography variant="h6">
                    {metrics?.application?.connectionPool || 'N/A'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Socket.IO Metrics */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader title="Socket.IO Metrics" />
              <CardContent>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Active Connections
                  </Typography>
                  <Typography variant="h6">
                    {metrics?.application?.socketConnections || 0}
                  </Typography>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Messages Sent
                  </Typography>
                  <Typography variant="h6">
                    {metrics?.application?.socketMessagesSent || 0}
                  </Typography>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Messages Received
                  </Typography>
                  <Typography variant="h6">
                    {metrics?.application?.socketMessagesReceived || 0}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Connection Errors
                  </Typography>
                  <Typography variant="h6">
                    {metrics?.application?.socketErrors || 0}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Route Metrics */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader title="Route Metrics" />
              <CardContent>
                {metrics?.application?.routeStats ? (
                  Object.entries(metrics.application.routeStats).map(([route, stats]: [string, any]) => (
                    <Box key={route} sx={{ mb: 3 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {route}
                      </Typography>
                      <Typography variant="body2">
                        Requests: {stats.requests} | Avg Time: {stats.avgResponseTime?.toFixed(2)}ms
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No route data available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Charts Section */}
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader title="Performance Trends" />
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="users" stroke="#8884d8" strokeWidth={2} name="Users" />
                    <Line type="monotone" dataKey="sessions" stroke="#82ca9d" strokeWidth={2} name="Active Sessions" />
                    <Line type="monotone" dataKey="requests" stroke="#ffc658" strokeWidth={2} name="API Requests" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Socket.IO Chart */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader title="Socket.IO Activity" />
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={[
                    { name: 'Connections', value: metrics?.application?.socketConnections || 0, color: '#8884d8' },
                    { name: 'Messages Sent', value: metrics?.application?.socketMessagesSent || 0, color: '#82ca9d' },
                    { name: 'Messages Received', value: metrics?.application?.socketMessagesReceived || 0, color: '#ffc658' },
                    { name: 'Errors', value: metrics?.application?.socketErrors || 0, color: '#ff7300' }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* System Resources Chart */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader title="System Resources" />
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={[
                    { name: 'Memory Usage', value: metrics?.system?.memoryUsage ? (metrics.system.memoryUsage.heapUsed / 1024 / 1024) : 0, unit: 'MB' },
                    { name: 'CPU Usage', value: metrics?.system?.cpuUsage || 0, unit: '%' },
                    { name: 'Uptime', value: metrics?.system?.uptime ? Math.floor(metrics.system.uptime / 3600) : 0, unit: 'hours' }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [`${value} ${name === 'Memory Usage' ? 'MB' : name === 'CPU Usage' ? '%' : 'hours'}`, name]} />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </>
      )}
    </Grid>
  )
}

export default MetricsPage
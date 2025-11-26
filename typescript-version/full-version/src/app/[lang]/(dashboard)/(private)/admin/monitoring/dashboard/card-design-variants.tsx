/**
 * ВАРИАНТ ДИЗАЙНА КАРТОЧЕК System Status и Active Services
 */

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid2'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import CustomAvatar from '@core/components/mui/Avatar'

// ============================================
// ВАРИАНТ 1: Минималистичный компактный
// ============================================
export const Variant1 = ({ dashboardData, getStatusColor, getStatusIcon, formatDuration, formatBytes }: any) => (
  <>
    {/* System Status */}
    <Grid size={{ xs: 12, md: 6 }}>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardHeader title="System Status" />
        <CardContent sx={{ flexGrow: 1 }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">Status</Typography>
              <Chip
                label={dashboardData.status.toUpperCase()}
                color={getStatusColor(dashboardData.status) as any}
                size="small"
                icon={<Box sx={{ color: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, height: '100%' }}>{getStatusIcon(dashboardData.status)}</Box>}
                sx={{
                  '& .MuiChip-icon': {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'center',
                    marginLeft: '4px',
                    marginRight: '-4px',
                    lineHeight: 1
                  }
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">Environment</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {dashboardData.environment} v{dashboardData.version}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">Updated</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {new Date(dashboardData.timestamp).toLocaleTimeString()}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Grid>

    {/* Active Services */}
    <Grid size={{ xs: 12, md: 6 }}>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardHeader title="Active Services" />
        <CardContent sx={{ flexGrow: 1 }}>
          <Stack spacing={2}>
            {/* Database */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Database</Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flex: 1, justifyContent: 'center' }}>
                <Tooltip title="Время ответа базы данных (latency)">
                  <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help' }}>
                    {formatDuration(dashboardData.services.database.latency)}
                  </Typography>
                </Tooltip>
                <Tooltip title="Количество активных соединений с базой данных">
                  <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help' }}>
                    {dashboardData.services.database.activeConnections} conn
                  </Typography>
                </Tooltip>
              </Box>
              <Chip 
                label={dashboardData.services.database.status.toUpperCase()} 
                color={getStatusColor(dashboardData.services.database.status) as any} 
                size="small"
                sx={{ minWidth: 50 }}
              />
            </Box>

            {/* Redis */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Redis</Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flex: 1, justifyContent: 'center' }}>
                {dashboardData.services.redis.status === 'up' && dashboardData.services.redis.memory && (
                  <>
                    <Tooltip title="Время ответа Redis (latency)">
                      <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help' }}>
                        {formatDuration(dashboardData.services.redis.latency)}
                      </Typography>
                    </Tooltip>
                    <Tooltip title="Используемая память Redis">
                      <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help' }}>
                        {formatBytes(dashboardData.services.redis.memory.used)}
                      </Typography>
                    </Tooltip>
                    <Tooltip title="Количество ключей в Redis">
                      <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help' }}>
                        {dashboardData.services.redis.memory.keys} keys
                      </Typography>
                    </Tooltip>
                  </>
                )}
              </Box>
              <Chip 
                label={dashboardData.services.redis.status.toUpperCase()} 
                color={getStatusColor(dashboardData.services.redis.status) as any} 
                size="small"
                sx={{ minWidth: 50 }}
              />
            </Box>

            {/* Socket.IO */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Socket.IO</Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flex: 1, justifyContent: 'center' }}>
                <Tooltip title="Количество активных WebSocket соединений">
                  <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help' }}>
                    {dashboardData.keyMetrics.websocket.activeConnections} connections
                  </Typography>
                </Tooltip>
              </Box>
              <Chip 
                label={dashboardData.services.socketio.status.toUpperCase()} 
                color={getStatusColor(dashboardData.services.socketio.status) as any} 
                size="small"
                sx={{ minWidth: 50 }}
              />
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  </>
)

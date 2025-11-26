'use client'

// React Imports
import { useState, useEffect } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TablePagination from '@mui/material/TablePagination'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'

// Third-party Imports
import { toast } from 'react-toastify'

interface User {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  image: string | null
  documentsStatus: 'not_submitted' | 'pending' | 'verified' | 'rejected'
  documentsVerified: string | null
  documentsRejectedAt: string | null
  documentsRejectedReason: string | null
  createdAt: string
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div
      role='tabpanel'
      hidden={value !== index}
      id={`documents-tabpanel-${index}`}
      aria-labelledby={`documents-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

const DocumentsVerification = () => {
  // States
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [totalUsers, setTotalUsers] = useState(0)

  // Dialog states
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)

  // Status mapping
  const statusMap: { [key: number]: string } = {
    0: 'pending',
    1: 'verified',
    2: 'rejected'
  }

  // Load users
  const loadUsers = async () => {
    setLoading(true)
    setError(null)

    try {
      const status = statusMap[tabValue]
      const response = await fetch(
        `/api/admin/users/pending-verification?status=${status}&page=${page + 1}&limit=${rowsPerPage}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      const data = await response.json()
      setUsers(data.users || [])
      setTotalUsers(data.pagination?.total || 0)
    } catch (err) {
      console.error('Error loading users:', err)
      setError('Ошибка загрузки пользователей')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [tabValue, page, rowsPerPage])

  // Handlers
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
    setPage(0)
  }

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleVerify = async (user: User) => {
    setProcessing(true)

    try {
      const response = await fetch(`/api/admin/users/${user.id}/verify-documents`, {
        method: 'POST'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to verify documents')
      }

      toast.success(`Документы пользователя ${user.name || user.email} подтверждены`)
      loadUsers()
    } catch (err: any) {
      toast.error(err.message || 'Ошибка подтверждения документов')
    } finally {
      setProcessing(false)
    }
  }

  const handleRejectClick = (user: User) => {
    setSelectedUser(user)
    setRejectReason('')
    setRejectDialogOpen(true)
  }

  const handleRejectConfirm = async () => {
    if (!selectedUser || !rejectReason.trim()) {
      toast.error('Укажите причину отклонения')
      return
    }

    setProcessing(true)

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/reject-documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: rejectReason })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to reject documents')
      }

      toast.success(`Документы пользователя ${selectedUser.name || selectedUser.email} отклонены`)
      setRejectDialogOpen(false)
      setSelectedUser(null)
      setRejectReason('')
      loadUsers()
    } catch (err: any) {
      toast.error(err.message || 'Ошибка отклонения документов')
    } finally {
      setProcessing(false)
    }
  }

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'verified':
        return <Chip label='Подтверждено' color='success' size='small' />
      case 'rejected':
        return <Chip label='Отклонено' color='error' size='small' />
      case 'pending':
        return <Chip label='На проверке' color='warning' size='small' />
      default:
        return <Chip label='Не загружено' color='default' size='small' />
    }
  }

  return (
    <Card>
      <CardHeader
        title='Подтверждение документов'
        subheader='Управление верификацией документов пользователей'
      />
      <CardContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label='На проверке' />
            <Tab label='Подтверждённые' />
            <Tab label='Отклонённые' />
          </Tabs>
        </Box>

        {error && (
          <Alert severity='error' sx={{ mt: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <TabPanel value={tabValue} index={0}>
          <UsersTable
            users={users}
            loading={loading}
            onVerify={handleVerify}
            onReject={handleRejectClick}
            processing={processing}
            showActions={true}
            getStatusChip={getStatusChip}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <UsersTable
            users={users}
            loading={loading}
            onVerify={handleVerify}
            onReject={handleRejectClick}
            processing={processing}
            showActions={false}
            getStatusChip={getStatusChip}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <UsersTable
            users={users}
            loading={loading}
            onVerify={handleVerify}
            onReject={handleRejectClick}
            processing={processing}
            showActions={true}
            getStatusChip={getStatusChip}
          />
        </TabPanel>

        <TablePagination
          component='div'
          count={totalUsers}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage='Строк на странице:'
        />
      </CardContent>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Отклонить документы</DialogTitle>
        <DialogContent>
          <Typography variant='body2' sx={{ mb: 2 }}>
            Укажите причину отклонения документов для пользователя{' '}
            <strong>{selectedUser?.name || selectedUser?.email}</strong>
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label='Причина отклонения'
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder='Например: фото документа нечёткое, документ просрочен и т.д.'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)} disabled={processing}>
            Отмена
          </Button>
          <Button
            onClick={handleRejectConfirm}
            color='error'
            variant='contained'
            disabled={processing || !rejectReason.trim()}
            startIcon={processing ? <CircularProgress size={20} /> : null}
          >
            Отклонить
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}

// Users Table Component
interface UsersTableProps {
  users: User[]
  loading: boolean
  onVerify: (user: User) => void
  onReject: (user: User) => void
  processing: boolean
  showActions: boolean
  getStatusChip: (status: string) => React.ReactNode
}

function UsersTable({
  users,
  loading,
  onVerify,
  onReject,
  processing,
  showActions,
  getStatusChip
}: UsersTableProps) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (users.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color='textSecondary'>Нет пользователей</Typography>
      </Box>
    )
  }

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Пользователь</TableCell>
            <TableCell>Контакты</TableCell>
            <TableCell>Документ</TableCell>
            <TableCell>Статус</TableCell>
            <TableCell>Дата регистрации</TableCell>
            {showActions && <TableCell align='right'>Действия</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map(user => (
            <TableRow key={user.id}>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar src={user.image || undefined}>{user.name?.[0] || '?'}</Avatar>
                  <Typography>{user.name || 'Без имени'}</Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Typography variant='body2'>{user.email || '-'}</Typography>
                <Typography variant='caption' color='textSecondary'>
                  {user.phone || '-'}
                </Typography>
              </TableCell>
              <TableCell>
                {user.image ? (
                  <Tooltip title='Просмотреть документ'>
                    <IconButton
                      size='small'
                      onClick={() => window.open(user.image!, '_blank')}
                    >
                      <i className='ri-file-image-line' />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Typography variant='caption' color='textSecondary'>
                    Не загружен
                  </Typography>
                )}
              </TableCell>
              <TableCell>{getStatusChip(user.documentsStatus)}</TableCell>
              <TableCell>
                {new Date(user.createdAt).toLocaleDateString('ru-RU')}
              </TableCell>
              {showActions && (
                <TableCell align='right'>
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    {user.documentsStatus !== 'verified' && (
                      <Button
                        size='small'
                        variant='contained'
                        color='success'
                        onClick={() => onVerify(user)}
                        disabled={processing}
                      >
                        Подтвердить
                      </Button>
                    )}
                    {user.documentsStatus !== 'rejected' && (
                      <Button
                        size='small'
                        variant='outlined'
                        color='error'
                        onClick={() => onReject(user)}
                        disabled={processing}
                      >
                        Отклонить
                      </Button>
                    )}
                  </Box>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default DocumentsVerification





'use client'

/**
 * Список лицензий медиа
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Pagination from '@mui/material/Pagination'
import Tooltip from '@mui/material/Tooltip'
import Skeleton from '@mui/material/Skeleton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'

import { toast } from 'react-toastify'

// Types
interface MediaLicense {
  id: string
  licenseType: string
  licenseTypeName?: string
  licensorName: string
  licenseeName: string
  documentPath?: string
  documentName?: string
  validFrom?: string
  validUntil?: string
  territory?: string
  createdAt: string
  mediaItems: { media: { id: string; filename: string } }[]
}

const LICENSE_TYPES = [
  { value: '', label: 'Все типы' },
  { value: 'royalty_free', label: 'Royalty-Free' },
  { value: 'rights_managed', label: 'Rights-Managed' },
  { value: 'creative_commons', label: 'Creative Commons' },
  { value: 'editorial', label: 'Editorial' },
  { value: 'exclusive', label: 'Exclusive' },
  { value: 'custom', label: 'Другое' },
]

const getLicenseTypeLabel = (type: string): string => {
  const found = LICENSE_TYPES.find((t) => t.value === type)

  return found?.label || type
}

const getLicenseTypeColor = (
  type: string
): 'success' | 'warning' | 'info' | 'error' | 'default' => {
  switch (type) {
    case 'royalty_free':
      return 'success'
    case 'rights_managed':
      return 'warning'
    case 'creative_commons':
      return 'info'
    case 'editorial':
      return 'error'
    case 'exclusive':
      return 'warning'
    default:
      return 'default'
  }
}

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '—'

  return new Date(dateStr).toLocaleDateString('ru-RU')
}

export default function MediaLicenses() {
  const router = useRouter()
  const params = useParams()
  const locale = params.lang || 'ru'
  const [licenses, setLicenses] = useState<MediaLicense[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [licenseType, setLicenseType] = useState('')

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MediaLicense | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchLicenses = useCallback(async () => {
    setLoading(true)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })

      if (search) params.set('search', search)
      if (licenseType) params.set('licenseType', licenseType)

      const response = await fetch(`/api/admin/media/licenses?${params}`)

      if (!response.ok) throw new Error('Failed to fetch')

      const data = await response.json()

      setLicenses(data.items)
      setTotalPages(data.totalPages)
      setTotal(data.total)
    } catch (error) {
      toast.error('Ошибка загрузки лицензий')
    } finally {
      setLoading(false)
    }
  }, [page, search, licenseType])

  useEffect(() => {
    fetchLicenses()
  }, [fetchLicenses])

  const handleDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)

    try {
      const response = await fetch(`/api/admin/media/licenses/${deleteTarget.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete')

      toast.success('Лицензия удалена')
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
      fetchLicenses()
    } catch (error) {
      toast.error('Ошибка удаления')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Grid container spacing={6}>
      <Grid item xs={12}>
        <Card>
          <CardHeader
            title="Лицензии медиа"
            subheader={`Всего: ${total}`}
            action={
              <Button
                variant="contained"
                startIcon={<i className="ri-add-line" />}
                onClick={() => router.push(`/${locale}/admin/media/licenses/new`)}
              >
                Добавить лицензию
              </Button>
            }
          />
          <CardContent>
            {/* Filters */}
            <Grid container spacing={4} sx={{ mb: 4 }}>
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Поиск по лицензиару, лицензиату, товару..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <i className="ri-search-line" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Тип лицензии</InputLabel>
                  <Select
                    value={licenseType}
                    label="Тип лицензии"
                    onChange={(e) => setLicenseType(e.target.value)}
                  >
                    {LICENSE_TYPES.map((t) => (
                      <MenuItem key={t.value} value={t.value}>
                        {t.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => {
                    setSearch('')
                    setLicenseType('')
                    setPage(1)
                  }}
                >
                  Сбросить
                </Button>
              </Grid>
            </Grid>

            {/* Table */}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Тип</TableCell>
                    <TableCell>Лицензиар</TableCell>
                    <TableCell>Лицензиат</TableCell>
                    <TableCell>Срок действия</TableCell>
                    <TableCell>Медиа</TableCell>
                    <TableCell>Документ</TableCell>
                    <TableCell align="right">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    [...Array(5)].map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Skeleton width={80} />
                        </TableCell>
                        <TableCell>
                          <Skeleton width={120} />
                        </TableCell>
                        <TableCell>
                          <Skeleton width={120} />
                        </TableCell>
                        <TableCell>
                          <Skeleton width={80} />
                        </TableCell>
                        <TableCell>
                          <Skeleton width={40} />
                        </TableCell>
                        <TableCell>
                          <Skeleton width={30} />
                        </TableCell>
                        <TableCell>
                          <Skeleton width={80} />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : licenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography color="text.secondary" sx={{ py: 4 }}>
                          Лицензии не найдены
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    licenses.map((license) => (
                      <TableRow
                        key={license.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/${locale}/admin/media/licenses/${license.id}`)}
                      >
                        <TableCell>
                          <Chip
                            label={getLicenseTypeLabel(license.licenseType)}
                            size="small"
                            color={getLicenseTypeColor(license.licenseType)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {license.licensorName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {license.licenseeName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {license.validUntil ? (
                            <Typography variant="body2">
                              до {formatDate(license.validUntil)}
                            </Typography>
                          ) : (
                            <Chip label="Бессрочно" size="small" variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={license.mediaItems.length}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {license.documentPath ? (
                            <Tooltip title={license.documentName || 'Документ'}>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(license.documentPath, '_blank')
                                }}
                              >
                                <i className="ri-file-pdf-line" />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Редактировать">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/admin/media/licenses/${license.id}`)
                              }}
                            >
                              <i className="ri-edit-line" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteTarget(license)
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <i className="ri-delete-bin-line" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, value) => setPage(value)}
                  color="primary"
                />
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                bgcolor: 'error.lighter',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i
                className="ri-delete-bin-line"
                style={{ fontSize: 20, color: 'var(--mui-palette-error-main)' }}
              />
            </Box>
            Удалить лицензию?
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Лицензия «{deleteTarget?.licensorName}» будет удалена. Это действие нельзя
            отменить.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 2 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deleting}
            variant="outlined"
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleting}
            startIcon={
              deleting ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <i className="ri-delete-bin-line" />
              )
            }
          >
            {deleting ? 'Удаление...' : 'Удалить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}


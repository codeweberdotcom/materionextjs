'use client'

/**
 * Форма создания/редактирования лицензии медиа
 */

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'

import { toast } from 'react-toastify'

interface MediaLicenseFormProps {
  licenseId?: string
}

const LICENSE_TYPES = [
  { value: 'royalty_free', label: 'Royalty-Free', description: 'Разовый платёж, неограниченное использование' },
  { value: 'rights_managed', label: 'Rights-Managed', description: 'Оплата за каждое использование' },
  { value: 'creative_commons', label: 'Creative Commons', description: 'Свободная лицензия с условиями' },
  { value: 'editorial', label: 'Editorial', description: 'Только для редакционного использования' },
  { value: 'exclusive', label: 'Exclusive', description: 'Эксклюзивные права' },
  { value: 'custom', label: 'Другое', description: 'Пользовательский тип лицензии' },
]

interface FormData {
  licenseType: string
  licenseTypeName: string
  licensorName: string
  licensorEmail: string
  licensorUrl: string
  licenseeName: string
  licenseeEmail: string
  validFrom: string
  validUntil: string
  territory: string
  notes: string
}

const initialFormData: FormData = {
  licenseType: 'royalty_free',
  licenseTypeName: '',
  licensorName: '',
  licensorEmail: '',
  licensorUrl: '',
  licenseeName: '',
  licenseeEmail: '',
  validFrom: '',
  validUntil: '',
  territory: '',
  notes: '',
}

export default function MediaLicenseForm({ licenseId }: MediaLicenseFormProps) {
  const router = useRouter()
  const params = useParams()
  const locale = params.lang || 'ru'
  const isEdit = !!licenseId && licenseId !== 'new'

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<FormData>(initialFormData)

  // Document
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [existingDocument, setExistingDocument] = useState<{
    path: string
    name: string
    size: number
  } | null>(null)
  const [uploadingDocument, setUploadingDocument] = useState(false)

  // Fetch license for edit
  useEffect(() => {
    if (!isEdit) return

    const fetchLicense = async () => {
      try {
        const response = await fetch(`/api/admin/media/licenses/${licenseId}`)

        if (!response.ok) throw new Error('Not found')

        const data = await response.json()

        setFormData({
          licenseType: data.licenseType || 'royalty_free',
          licenseTypeName: data.licenseTypeName || '',
          licensorName: data.licensorName || '',
          licensorEmail: data.licensorEmail || '',
          licensorUrl: data.licensorUrl || '',
          licenseeName: data.licenseeName || '',
          licenseeEmail: data.licenseeEmail || '',
          validFrom: data.validFrom ? data.validFrom.split('T')[0] : '',
          validUntil: data.validUntil ? data.validUntil.split('T')[0] : '',
          territory: data.territory || '',
          notes: data.notes || '',
        })

        if (data.documentPath) {
          setExistingDocument({
            path: data.documentPath,
            name: data.documentName || 'Документ',
            size: data.documentSize || 0,
          })
        }
      } catch (error) {
        toast.error('Лицензия не найдена')
        router.push(`/${locale}/admin/media/licenses`)
      } finally {
        setLoading(false)
      }
    }

    fetchLicense()
  }, [isEdit, licenseId, router])

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    // Validation
    if (!formData.licensorName.trim()) {
      toast.error('Укажите лицензиара')

      return
    }

    if (!formData.licenseeName.trim()) {
      toast.error('Укажите лицензиата')

      return
    }

    setSaving(true)

    try {
      const url = isEdit
        ? `/api/admin/media/licenses/${licenseId}`
        : '/api/admin/media/licenses'

      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          validFrom: formData.validFrom || null,
          validUntil: formData.validUntil || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()

        throw new Error(error.error || 'Failed')
      }

      const result = await response.json()

      // Upload document if selected
      if (documentFile) {
        await uploadDocument(result.id)
      }

      toast.success(isEdit ? 'Лицензия обновлена' : 'Лицензия создана')
      router.push(`/${locale}/admin/media/licenses`)
    } catch (error: any) {
      toast.error(error.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const uploadDocument = async (id: string) => {
    if (!documentFile) return

    setUploadingDocument(true)

    try {
      const formData = new FormData()

      formData.append('file', documentFile)

      const response = await fetch(`/api/admin/media/licenses/${id}/document`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Upload failed')

      toast.success('Документ загружен')
    } catch (error) {
      toast.error('Ошибка загрузки документа')
    } finally {
      setUploadingDocument(false)
    }
  }

  const handleDeleteDocument = async () => {
    if (!licenseId || !existingDocument) return

    try {
      const response = await fetch(`/api/admin/media/licenses/${licenseId}/document`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Delete failed')

      setExistingDocument(null)
      toast.success('Документ удалён')
    } catch (error) {
      toast.error('Ошибка удаления документа')
    }
  }

  if (loading) {
    return (
      <Grid container spacing={6}>
        <Grid item xs={12}>
          <Card>
            <CardHeader title={<Skeleton width={200} />} />
            <CardContent>
              <Grid container spacing={4}>
                {[...Array(8)].map((_, idx) => (
                  <Grid item xs={12} md={6} key={idx}>
                    <Skeleton height={56} />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    )
  }

  return (
    <Grid container spacing={6}>
      <Grid item xs={12}>
        <Card>
          <CardHeader
            title={isEdit ? 'Редактирование лицензии' : 'Новая лицензия'}
            action={
              <Button variant="outlined" onClick={() => router.push(`/${locale}/admin/media/licenses`)}>
                Отмена
              </Button>
            }
          />
          <CardContent>
            {/* License Type */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Тип лицензии
            </Typography>
            <Grid container spacing={4} sx={{ mb: 4 }}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Тип лицензии *</InputLabel>
                  <Select
                    value={formData.licenseType}
                    label="Тип лицензии *"
                    onChange={(e) => handleChange('licenseType', e.target.value)}
                  >
                    {LICENSE_TYPES.map((t) => (
                      <MenuItem key={t.value} value={t.value}>
                        <Box>
                          <Typography>{t.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t.description}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              {formData.licenseType === 'custom' && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Название типа лицензии"
                    value={formData.licenseTypeName}
                    onChange={(e) => handleChange('licenseTypeName', e.target.value)}
                  />
                </Grid>
              )}
            </Grid>

            <Divider sx={{ my: 4 }} />

            {/* Licensor */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Лицензиар (владелец прав)
            </Typography>
            <Grid container spacing={4} sx={{ mb: 4 }}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  required
                  label="Имя / Компания *"
                  value={formData.licensorName}
                  onChange={(e) => handleChange('licensorName', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.licensorEmail}
                  onChange={(e) => handleChange('licensorEmail', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="URL"
                  value={formData.licensorUrl}
                  onChange={(e) => handleChange('licensorUrl', e.target.value)}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 4 }} />

            {/* Licensee */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Лицензиат (получатель лицензии)
            </Typography>
            <Grid container spacing={4} sx={{ mb: 4 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Имя / Компания *"
                  value={formData.licenseeName}
                  onChange={(e) => handleChange('licenseeName', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.licenseeEmail}
                  onChange={(e) => handleChange('licenseeEmail', e.target.value)}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 4 }} />

            {/* Validity */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Срок действия
            </Typography>
            <Grid container spacing={4} sx={{ mb: 4 }}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="date"
                  label="Действует с"
                  value={formData.validFrom}
                  onChange={(e) => handleChange('validFrom', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="date"
                  label="Действует до"
                  value={formData.validUntil}
                  onChange={(e) => handleChange('validUntil', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  helperText="Оставьте пустым для бессрочной лицензии"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Территория"
                  value={formData.territory}
                  onChange={(e) => handleChange('territory', e.target.value)}
                  placeholder="Весь мир"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 4 }} />

            {/* Document */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Документ лицензии
            </Typography>
            <Box sx={{ mb: 4 }}>
              {existingDocument ? (
                <Alert
                  severity="info"
                  action={
                    <IconButton size="small" color="error" onClick={handleDeleteDocument}>
                      <i className="ri-delete-bin-line" />
                    </IconButton>
                  }
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <i className="ri-file-pdf-line" />
                    <Typography variant="body2">
                      {existingDocument.name} ({(existingDocument.size / 1024).toFixed(1)} KB)
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => window.open(existingDocument.path, '_blank')}
                    >
                      Открыть
                    </Button>
                  </Box>
                </Alert>
              ) : (
                <Button variant="outlined" component="label" startIcon={<i className="ri-upload-2-line" />}>
                  {documentFile ? documentFile.name : 'Загрузить документ'}
                  <input
                    type="file"
                    hidden
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                  />
                </Button>
              )}
              {documentFile && (
                <Chip
                  label={documentFile.name}
                  onDelete={() => setDocumentFile(null)}
                  sx={{ ml: 2 }}
                />
              )}
            </Box>

            <Divider sx={{ my: 4 }} />

            {/* Notes */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Примечания
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Дополнительная информация о лицензии..."
            />

            {/* Actions */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
              <Button variant="outlined" onClick={() => router.push(`/${locale}/admin/media/licenses`)}>
                Отмена
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={saving || uploadingDocument}
                startIcon={
                  saving || uploadingDocument ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <i className="ri-save-line" />
                  )
                }
              >
                {saving ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}


'use client'

/**
 * Водяные знаки - управление водяными знаками
 */

import { useState, useEffect, useCallback } from 'react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Slider from '@mui/material/Slider'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'

import { toast } from 'react-toastify'

interface Watermark {
  id: string
  name: string
  displayName: string
  description?: string
  mediaId?: string
  defaultPosition: string
  defaultOpacity: number
  defaultScale: number
  entityTypes: string
  isDefault: boolean
  isActive: boolean
  createdAt: string
}

const POSITIONS = [
  { value: 'top-left', label: '↖ Верх-лево' },
  { value: 'top-center', label: '↑ Верх-центр' },
  { value: 'top-right', label: '↗ Верх-право' },
  { value: 'center-left', label: '← Центр-лево' },
  { value: 'center', label: '◯ Центр' },
  { value: 'center-right', label: '→ Центр-право' },
  { value: 'bottom-left', label: '↙ Низ-лево' },
  { value: 'bottom-center', label: '↓ Низ-центр' },
  { value: 'bottom-right', label: '↘ Низ-право' },
]

const ENTITY_TYPES = [
  { value: 'listing_image', label: 'Фото объявлений' },
  { value: 'company_photo', label: 'Фото компаний' },
]

export default function MediaWatermarks() {
  const [watermarks, setWatermarks] = useState<Watermark[]>([])
  const [loading, setLoading] = useState(true)
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [position, setPosition] = useState('bottom-right')
  const [opacity, setOpacity] = useState(0.3)
  const [scale, setScale] = useState(0.15)
  const [entityTypes, setEntityTypes] = useState<string[]>([])
  const [isDefault, setIsDefault] = useState(false)
  const [isActive, setIsActive] = useState(true)

  const fetchWatermarks = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/media/watermarks')

      if (!response.ok) throw new Error('Failed to fetch watermarks')
      
      const data = await response.json()

      setWatermarks(data.watermarks)
    } catch (error) {
      toast.error('Ошибка загрузки водяных знаков')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWatermarks()
  }, [fetchWatermarks])

  const resetForm = () => {
    setName('')
    setDisplayName('')
    setDescription('')
    setPosition('bottom-right')
    setOpacity(0.3)
    setScale(0.15)
    setEntityTypes([])
    setIsDefault(false)
    setIsActive(true)
    setEditingId(null)
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (watermark: Watermark) => {
    setEditingId(watermark.id)
    setName(watermark.name)
    setDisplayName(watermark.displayName)
    setDescription(watermark.description || '')
    setPosition(watermark.defaultPosition)
    setOpacity(watermark.defaultOpacity)
    setScale(watermark.defaultScale)
    setEntityTypes(JSON.parse(watermark.entityTypes || '[]'))
    setIsDefault(watermark.isDefault)
    setIsActive(watermark.isActive)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!name || !displayName) {
      toast.error('Заполните обязательные поля')
      
return
    }
    
    setSaving(true)

    try {
      const body = {
        name,
        displayName,
        description,
        defaultPosition: position,
        defaultOpacity: opacity,
        defaultScale: scale,
        entityTypes,
        isDefault,
        isActive,
      }
      
      const url = editingId 
        ? `/api/admin/media/watermarks/${editingId}` 
        : '/api/admin/media/watermarks'
      
      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      
      if (!response.ok) {
        const error = await response.json()

        throw new Error(error.error || 'Failed to save')
      }
      
      toast.success(editingId ? 'Водяной знак обновлён' : 'Водяной знак создан')
      setDialogOpen(false)
      resetForm()
      fetchWatermarks()
    } catch (error: any) {
      toast.error(error.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить этот водяной знак?')) return
    
    try {
      const response = await fetch(`/api/admin/media/watermarks/${id}`, { method: 'DELETE' })

      if (!response.ok) throw new Error('Failed to delete')
      
      toast.success('Водяной знак удалён')
      fetchWatermarks()
    } catch (error) {
      toast.error('Ошибка удаления')
    }
  }

  if (loading) {
    return (
      <Grid container spacing={6}>
        <Grid item xs={12}>
          <Card>
            <CardHeader 
              title={<Skeleton variant="text" width={180} height={32} />}
              subheader={<Skeleton variant="text" width={280} height={20} />}
              action={<Skeleton variant="rounded" width={120} height={36} />}
            />
            <CardContent>
              <Skeleton variant="rounded" width="100%" height={48} sx={{ mb: 4 }} />
              
              <Table>
                <TableHead>
                  <TableRow>
                    {['Название', 'Позиция', 'Настройки', 'Применимость', 'Статус', ''].map((_, i) => (
                      <TableCell key={i}>
                        <Skeleton variant="text" width={80} />
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton variant="text" width={150} />
                        <Skeleton variant="text" width={100} height={16} />
                      </TableCell>
                      <TableCell><Skeleton variant="text" width={100} /></TableCell>
                      <TableCell>
                        <Skeleton variant="text" width={100} />
                        <Skeleton variant="text" width={80} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Skeleton variant="rounded" width={80} height={24} />
                          <Skeleton variant="rounded" width={80} height={24} />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Skeleton variant="rounded" width={70} height={24} />
                          <Skeleton variant="rounded" width={70} height={24} />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Skeleton variant="circular" width={32} height={32} />
                          <Skeleton variant="circular" width={32} height={32} />
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
            title="Водяные знаки"
            subheader="Управление водяными знаками для изображений"
            action={
              <Button 
                variant="contained" 
                startIcon={<i className="ri-add-line" />}
                onClick={openCreate}
              >
                Добавить
              </Button>
            }
          />
          <CardContent>
            <Alert severity="info" sx={{ mb: 4 }}>
              💡 Для использования водяного знака необходимо загрузить PNG-файл с прозрачностью через медиатеку 
              с типом "watermark", затем связать его с записью здесь.
            </Alert>
            
            {watermarks.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography color="text.secondary">Нет водяных знаков</Typography>
              </Box>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell>Позиция</TableCell>
                    <TableCell>Настройки</TableCell>
                    <TableCell>Применимость</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell align="right">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {watermarks.map(watermark => (
                    <TableRow key={watermark.id}>
                      <TableCell>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1" component="span">
                              {watermark.displayName}
                            </Typography>
                            {watermark.isDefault && (
                              <Chip label="По умолчанию" size="small" color="primary" />
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {watermark.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {POSITIONS.find(p => p.value === watermark.defaultPosition)?.label || watermark.defaultPosition}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          Opacity: {Math.round(watermark.defaultOpacity * 100)}%
                        </Typography>
                        <Typography variant="body2">
                          Scale: {Math.round(watermark.defaultScale * 100)}%
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {JSON.parse(watermark.entityTypes || '[]').map((type: string) => (
                          <Chip key={type} label={type} size="small" sx={{ mr: 0.5 }} />
                        ))}
                        {JSON.parse(watermark.entityTypes || '[]').length === 0 && (
                          <Typography variant="caption" color="text.secondary">Все типы</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={watermark.isActive ? 'Активен' : 'Отключён'} 
                          size="small"
                          color={watermark.isActive ? 'success' : 'default'}
                        />
                        {!watermark.mediaId && (
                          <Chip label="Нет файла" size="small" color="warning" sx={{ ml: 0.5 }} />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Редактировать">
                          <IconButton onClick={() => openEdit(watermark)}>
                            <i className="ri-edit-line" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Удалить">
                          <IconButton color="error" onClick={() => handleDelete(watermark.id)}>
                            <i className="ri-delete-bin-line" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingId ? 'Редактировать водяной знак' : 'Создать водяной знак'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Код (уникальный)"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={!!editingId}
              sx={{ mb: 3 }}
              helperText="Например: default, premium"
            />
            
            <TextField
              fullWidth
              label="Название"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              sx={{ mb: 3 }}
            />
            
            <TextField
              fullWidth
              label="Описание"
              value={description}
              onChange={e => setDescription(e.target.value)}
              multiline
              rows={2}
              sx={{ mb: 3 }}
            />
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Позиция по умолчанию</InputLabel>
              <Select
                value={position}
                label="Позиция по умолчанию"
                onChange={e => setPosition(e.target.value)}
              >
                {POSITIONS.map(p => (
                  <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Typography gutterBottom>Прозрачность: {Math.round(opacity * 100)}%</Typography>
            <Slider
              value={opacity}
              onChange={(_, value) => setOpacity(value as number)}
              min={0}
              max={1}
              step={0.05}
              sx={{ mb: 3 }}
            />
            
            <Typography gutterBottom>Масштаб: {Math.round(scale * 100)}%</Typography>
            <Slider
              value={scale}
              onChange={(_, value) => setScale(value as number)}
              min={0.05}
              max={0.5}
              step={0.01}
              sx={{ mb: 3 }}
            />
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Применять к типам</InputLabel>
              <Select
                multiple
                value={entityTypes}
                label="Применять к типам"
                onChange={e => setEntityTypes(e.target.value as string[])}
              >
                {ENTITY_TYPES.map(t => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControlLabel
              control={
                <Switch
                  checked={isDefault}
                  onChange={e => setIsDefault(e.target.checked)}
                />
              }
              label="Водяной знак по умолчанию"
              sx={{ mb: 2 }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                />
              }
              label="Активен"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
          <Button 
            variant="contained" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}


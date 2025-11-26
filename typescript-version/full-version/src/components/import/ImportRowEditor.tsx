'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Switch,
  FormControlLabel,
  Box,
  Typography,
  Alert,
  Chip
} from '@mui/material'
import type { RowWithValidation, ImportField } from '@/types/export-import'

interface ImportRowEditorProps {
  open: boolean
  onClose: () => void
  row: RowWithValidation | null
  importFields: ImportField[]
  onSave: (rowIndex: number, data: Record<string, any>) => void
}

/**
 * Диалог редактирования строки перед импортом
 */
export default function ImportRowEditor({
  open,
  onClose,
  row,
  importFields,
  onSave
}: ImportRowEditorProps) {
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Инициализируем форму данными строки
  useEffect(() => {
    if (row && open) {
      const initialData: Record<string, any> = {}
      importFields.forEach(field => {
        // Пробуем разные варианты ключей
        initialData[field.key] = row.data[field.label] || 
                                 row.data[field.key] || 
                                 row.data[field.label.toLowerCase()] || 
                                 row.data[field.key.toLowerCase()] || 
                                 field.defaultValue || 
                                 ''
      })
      setFormData(initialData)
      setErrors({})
    }
  }, [row, open, importFields])

  const handleChange = (fieldKey: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldKey]: value
    }))
    
    // Очищаем ошибку для этого поля
    if (errors[fieldKey]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldKey]
        return newErrors
      })
    }
  }

  const validateField = (field: ImportField, value: any): string | null => {
    // Проверка обязательных полей
    if (field.required) {
      // Для boolean полей проверяем, что значение не undefined/null
      if (field.type === 'boolean') {
        if (value === undefined || value === null || value === '') {
          return `${field.label} обязательно для заполнения`
        }
      } else if (!value || value === '') {
        return `${field.label} обязательно для заполнения`
      }
    }

    // Проверка типа
    // Для boolean полей проверяем отдельно, так как false является валидным значением
    if (field.type === 'boolean') {
      // Boolean поля могут быть: true, false, 'true', 'false', 1, 0, '1', '0'
      const isValidBoolean = typeof value === 'boolean' || 
                             value === 'true' || value === 'false' || 
                             value === 1 || value === 0 || 
                             value === '1' || value === '0'
      if (!isValidBoolean && value !== undefined && value !== null && value !== '') {
        return `${field.label} должно быть true или false`
      }
    } else if (value !== undefined && value !== null && value !== '') {
      // Для не-boolean полей проверяем только если значение не пустое
      if (field.type === 'number' && isNaN(Number(value))) {
        return `${field.label} должно быть числом`
      }
    }

    // Проверка максимальной длины
    if (field.maxLength && typeof value === 'string' && value.length > field.maxLength) {
      return `${field.label} не должно превышать ${field.maxLength} символов`
    }

    // Проверка паттерна (для email и т.д.)
    if (field.pattern && typeof value === 'string' && !field.pattern.test(value)) {
      return `Неверный формат ${field.label.toLowerCase()}`
    }

    // Проверка enum
    if (field.enum && !field.enum.includes(value)) {
      return `${field.label} должно быть одним из: ${field.enum.join(', ')}`
    }

    // Кастомная валидация
    if (field.validate) {
      const validationError = field.validate(value)
      if (validationError) {
        return validationError.message
      }
    }

    return null
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    importFields.forEach(field => {
      const value = formData[field.key]
      const error = validateField(field, value)
      if (error) {
        newErrors[field.key] = error
        console.log(`[ImportRowEditor] Validation error for field "${field.key}" (${field.label}):`, error, 'Value:', value)
      }
    })

    console.log('[ImportRowEditor] Validation result:', Object.keys(newErrors).length === 0 ? 'PASSED' : 'FAILED', 'Errors:', newErrors)
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (!row) {
      console.warn('[ImportRowEditor] handleSave: row is null')
      return
    }

    console.log('[ImportRowEditor] handleSave called for row:', row.rowIndex)
    console.log('[ImportRowEditor] formData:', formData)
    console.log('[ImportRowEditor] row.data keys:', Object.keys(row.data))
    console.log('[ImportRowEditor] row.data:', row.data)

    if (!validateForm()) {
      console.warn('[ImportRowEditor] Validation failed')
      return
    }

    // Просто обновляем все существующие ключи в row.data значениями из formData
    // Для каждого поля находим соответствующий ключ в row.data и обновляем его
    const savedData: Record<string, any> = { ...row.data }
    
    importFields.forEach(field => {
      const value = formData[field.key]
      
      // Ищем ключ в исходных данных, который соответствует этому полю
      const matchingKey = Object.keys(row.data).find(key => {
        const keyLower = key.toLowerCase()
        const labelLower = field.label.toLowerCase()
        const fieldKeyLower = field.key.toLowerCase()
        
        return key === field.label || 
               key === field.key || 
               keyLower === labelLower || 
               keyLower === fieldKeyLower
      })
      
      if (matchingKey) {
        // Обновляем существующий ключ
        savedData[matchingKey] = value
        console.log(`[ImportRowEditor] Updated key "${matchingKey}" with value:`, value)
      } else {
        // Если ключ не найден, добавляем по label (как в CSV)
        savedData[field.label] = value
        console.log(`[ImportRowEditor] Added new key "${field.label}" with value:`, value)
      }
    })
    
    console.log('[ImportRowEditor] Final savedData:', savedData)
    console.log('[ImportRowEditor] Calling onSave with rowIndex:', row.rowIndex)
    
    onSave(row.rowIndex, savedData)
    onClose()
  }

  const handleCancel = () => {
    setFormData({})
    setErrors({})
    onClose()
  }

  if (!row) return null

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            Редактирование строки {row.rowIndex}
          </Typography>
          {row.errors.length > 0 && (
            <Chip
              label={`${row.errors.length} ошибок`}
              color="error"
              size="small"
            />
          )}
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Показываем ошибки валидации строки */}
        {row.errors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Ошибки валидации:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {row.errors.map((error, index) => (
                <li key={index}>
                  <Typography variant="body2">
                    {error.field && <strong>{error.field}: </strong>}
                    {error.message}
                  </Typography>
                </li>
              ))}
            </ul>
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {importFields.map(field => {
            const value = formData[field.key] ?? ''
            const error = errors[field.key]
            const fieldError = row.errors.find(e => e.field === field.key)

            if (field.type === 'boolean') {
              return (
                <FormControlLabel
                  key={field.key}
                  control={
                    <Switch
                      checked={typeof value === 'boolean' ? value : value === 'true' || value === true}
                      onChange={(e) => handleChange(field.key, e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">
                        {field.label}
                        {field.required && <span style={{ color: 'red' }}> *</span>}
                      </Typography>
                      {fieldError && (
                        <Typography variant="caption" color="error">
                          {fieldError.message}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              )
            }

            if (field.enum && field.enum.length > 0) {
              return (
                <FormControl key={field.key} error={!!error || !!fieldError} fullWidth>
                  <InputLabel>{field.label}</InputLabel>
                  <Select
                    value={value}
                    label={field.label}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  >
                    {field.enum.map(option => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                  {(error || fieldError) && (
                    <FormHelperText>{error || fieldError?.message}</FormHelperText>
                  )}
                </FormControl>
              )
            }

            return (
              <TextField
                key={field.key}
                label={field.label}
                value={value}
                onChange={(e) => handleChange(field.key, e.target.value)}
                error={!!error || !!fieldError}
                helperText={error || fieldError?.message}
                required={field.required}
                fullWidth
                type={field.type === 'number' ? 'number' : 'text'}
                inputProps={{
                  maxLength: field.maxLength
                }}
              />
            )
          })}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel}>
          Отмена
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<i className="ri-save-line" />}
        >
          Сохранить
        </Button>
      </DialogActions>
    </Dialog>
  )
}



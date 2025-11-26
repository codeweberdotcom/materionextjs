'use client'

import { useState } from 'react'
import { Button, Menu, MenuItem, CircularProgress } from '@mui/material'
import { toast } from 'react-toastify'
import {
  ExportButtonProps,
  ExportFormat
} from '@/types/export-import'
import { exportService } from '@/services/export/ExportService'
import { useAuth } from '@/contexts/AuthProvider'
import { useTranslation } from '@/contexts/TranslationContext'

/**
 * Универсальная кнопка экспорта данных
 * Поддерживает множественные форматы и фильтры
 */
export default function ExportButton({
  entityType,
  availableFormats = ['xlsx', 'csv'],
  defaultFormat = 'xlsx',
  filters,
  selectedIds,
  disabled = false,
  size = 'medium',
  variant = 'outlined',
  onSuccess,
  onError
}: ExportButtonProps) {
  const { user } = useAuth()
  const dictionary = useTranslation()
  const nav = dictionary.navigation || {}
  const formatMessage = (template?: string, params?: Record<string, string | number>) => {
    if (!template) return ''
    let result = template
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        const stringValue = String(value)
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), stringValue)
        result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), stringValue)
      })
    }
    return result
  }
  const actorId = user?.id || null
  const [loading, setLoading] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleExport = async (format: ExportFormat) => {
    if (loading) return

    setLoading(true)
    handleClose()

    try {
      const result = await exportService.exportData(entityType, {
        format,
        filters,
        selectedIds,
        includeHeaders: true,
        actorId // Передаем ID текущего пользователя для записи в события
      })

      if (result.success) {
        // Скачиваем файл
        if (result.fileUrl && result.filename) {
          exportService.downloadFile(result.fileUrl, result.filename)
        }

        const exportedLabel =
          formatMessage(nav.recordsExported, { count: result.recordCount }) ||
          `Records exported: ${result.recordCount}`
        toast.success(`${nav.exportSuccess || 'Export completed successfully'} ${exportedLabel}`)

        onSuccess?.(result)
      } else {
        const errorMessage = result.error || nav.exportFailed || 'Export failed'
        toast.error(errorMessage)
        onError?.(errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : nav.unknownError || 'Unknown error'
      toast.error(`${nav.exportFailed || 'Export failed'}: ${errorMessage}`)
      onError?.(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const getFormatLabel = (format: ExportFormat): string => {
    switch (format) {
      case 'xlsx': return 'Excel (XLSX)'
      case 'xls': return 'Excel (XLS)'
      case 'csv': return 'CSV'
      default: return format.toUpperCase()
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        disabled={disabled || loading}
        onClick={handleClick}
        startIcon={loading ? <CircularProgress size={16} /> : <i className='ri-file-download-line text-xl' />}
        endIcon={<i className='ri-arrow-down-s-line text-xl' />}
        sx={{
          minWidth: 120
        }}
      >
        {loading ? nav.exportInProgress || 'Exporting...' : nav.export || 'Export'}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        {availableFormats.map((format: ExportFormat) => (
          <MenuItem
            key={format}
            onClick={() => handleExport(format)}
            disabled={loading}
          >
            {getFormatLabel(format)}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

'use client'

import { useState } from 'react'
import { Button, Menu, MenuItem, CircularProgress } from '@mui/material'
import { toast } from 'react-toastify'
import {
  ExportButtonProps,
  ExportFormat,
  ExportResult
} from '@/types/export-import'
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
    if (!template || typeof template !== 'string') return ''
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
  const [loading, setLoading] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  // Download file from base64 data
  const downloadFileFromBase64 = (base64: string, filename: string, mimeType: string) => {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: mimeType })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Download file from URL (legacy)
  const downloadFile = (url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExport = async (format: ExportFormat) => {
    if (loading) return

    setLoading(true)
    handleClose()

    try {
      // Call API instead of direct service
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          entityType,
          format,
          filters,
          selectedIds,
          includeHeaders: true
        })
      })

      const result: ExportResult = await response.json()

      if (result.success) {
        // Скачиваем файл - из base64 или URL
        if (result.base64 && result.filename && result.mimeType) {
          downloadFileFromBase64(result.base64, result.filename, result.mimeType)
        } else if (result.fileUrl && result.filename) {
          downloadFile(result.fileUrl, result.filename)
        }

        const exportedLabel =
          formatMessage(nav.recordsExported, { count: result.recordCount || 0 }) ||
          `Records exported: ${result.recordCount || 0}`
        const successMsg = typeof nav.exportSuccess === 'string' ? nav.exportSuccess : 'Export completed successfully'
        toast.success(`${successMsg} ${exportedLabel}`)

        onSuccess?.(result)
      } else {
        const errorMessage = result.error || 'Export failed'
        toast.error(typeof nav.exportFailed === 'string' ? nav.exportFailed : errorMessage)
        onError?.(errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Export failed: ${errorMessage}`)
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
      default: return String(format).toUpperCase()
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

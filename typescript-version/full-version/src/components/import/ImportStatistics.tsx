'use client'

import { useMemo } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Chip
} from '@mui/material'
import type { ValidationPreview } from '@/types/export-import'

interface ImportStatisticsProps {
  preview: ValidationPreview
  fileSize?: number
}

/**
 * Компонент статистики импорта
 */
export default function ImportStatistics({ preview, fileSize }: ImportStatisticsProps) {
  const statistics = useMemo(() => {
    return {
      total: preview.totalRows,
      valid: preview.validRows,
      invalid: preview.invalidRows,
      warnings: preview.warningRows,
      validityPercentage: preview.validityPercentage,
      errorsCount: preview.errors.length,
      warningsCount: preview.warnings.length
    }
  }, [preview])

  const getStatusColor = (percentage: number): 'success' | 'warning' | 'error' => {
    if (percentage >= 90) return 'success'
    if (percentage >= 50) return 'warning'
    return 'error'
  }

  const getStatusLabel = (percentage: number): string => {
    if (percentage >= 90) return 'Отлично'
    if (percentage >= 50) return 'Требует внимания'
    return 'Много ошибок'
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Статистика импорта
        </Typography>

        {/* Процент валидности */}
        <Box sx={{ mt: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Процент валидности
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" color={`${getStatusColor(statistics.validityPercentage)}.main`}>
                {statistics.validityPercentage}%
              </Typography>
              <Chip
                label={getStatusLabel(statistics.validityPercentage)}
                color={getStatusColor(statistics.validityPercentage)}
                size="small"
              />
            </Box>
          </Box>
          <LinearProgress
            variant="determinate"
            value={statistics.validityPercentage}
            color={getStatusColor(statistics.validityPercentage)}
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Box>

        {/* Детальная статистика */}
        <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip
            icon={<i className="ri-file-list-line" />}
            label={`Всего: ${statistics.total}`}
            color="primary"
            variant="outlined"
          />
          <Chip
            icon={<i className="ri-checkbox-circle-line" />}
            label={`Валидных: ${statistics.valid}`}
            color="success"
            variant="outlined"
          />
          <Chip
            icon={<i className="ri-error-warning-line" />}
            label={`${statistics.errorsCount} ошибок`}
            color="error"
            variant="outlined"
          />
          <Chip
            icon={<i className="ri-information-line" />}
            label={`${statistics.warningsCount} предупреждений`}
            color="warning"
            variant="outlined"
          />
          {fileSize && (
            <Chip
              icon={<i className="ri-file-line" />}
              label={`Размер: ${(fileSize / 1024).toFixed(2)} KB`}
              variant="outlined"
            />
          )}
        </Box>
      </CardContent>
    </Card>
  )
}


'use client'

/**
 * BulkUploadProgress - компонент прогресса массовой загрузки
 * 
 * Показывает:
 * - Общий прогресс
 * - Статистику (успешно/ошибки/в процессе)
 * - Скорость и оставшееся время
 * - Кнопки управления (пауза/отмена/retry)
 * 
 * @module components/media/BulkUploadProgress
 */

import React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Collapse from '@mui/material/Collapse'
import Paper from '@mui/material/Paper'

import type { UploadStats, QueuedFile } from '@/hooks/useBulkUpload'

interface BulkUploadProgressProps {
  /** Статистика загрузки */
  stats: UploadStats
  /** Идёт ли загрузка */
  isUploading: boolean
  /** Приостановлена ли загрузка */
  isPaused: boolean
  /** Начать загрузку */
  onStart: () => void
  /** Приостановить */
  onPause: () => void
  /** Возобновить */
  onResume: () => void
  /** Отменить */
  onCancel: () => void
  /** Повторить failed */
  onRetry: () => void
  /** Очистить успешные */
  onClearSuccess: () => void
  /** Очистить всё */
  onClearAll: () => void
  /** Показывать компактно */
  compact?: boolean
}

/**
 * Форматирование байтов
 */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

/**
 * Форматирование времени
 */
const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds <= 0) return '--:--'
  
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  
  if (mins >= 60) {
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return `${hours}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Компонент прогресса массовой загрузки
 */
export function BulkUploadProgress({
  stats,
  isUploading,
  isPaused,
  onStart,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onClearSuccess,
  onClearAll,
  compact = false,
}: BulkUploadProgressProps) {
  const hasFiles = stats.total > 0
  const hasPending = stats.pending > 0
  const hasErrors = stats.error > 0
  const hasSuccess = stats.success > 0
  const isComplete = hasFiles && stats.pending === 0 && stats.uploading === 0

  if (!hasFiles) return null

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: compact ? 1.5 : 2, 
        bgcolor: 'action.hover', 
        borderRadius: 1,
        mb: 2,
      }}
    >
      {/* Заголовок и статистика */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant={compact ? 'body2' : 'subtitle1'} fontWeight={600}>
            {isComplete 
              ? 'Загрузка завершена' 
              : isUploading 
                ? (isPaused ? 'Приостановлено' : 'Загрузка...') 
                : 'Готово к загрузке'}
          </Typography>
          
          {/* Chips со статистикой */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {stats.success > 0 && (
              <Chip 
                label={`✓ ${stats.success}`} 
                size="small" 
                color="success" 
                variant="filled"
              />
            )}
            {stats.uploading > 0 && (
              <Chip 
                label={`↑ ${stats.uploading}`} 
                size="small" 
                color="primary" 
                variant="filled"
              />
            )}
            {stats.error > 0 && (
              <Chip 
                label={`✗ ${stats.error}`} 
                size="small" 
                color="error" 
                variant="filled"
              />
            )}
            {stats.pending > 0 && (
              <Chip 
                label={`⏳ ${stats.pending}`} 
                size="small" 
                variant="outlined"
              />
            )}
          </Box>
        </Box>

        {/* Кнопки управления */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {/* Start */}
          {!isUploading && hasPending && (
            <Button 
              size="small" 
              variant="contained" 
              onClick={onStart}
              startIcon={<i className="ri-upload-2-line" />}
            >
              Загрузить ({stats.pending})
            </Button>
          )}

          {/* Pause/Resume */}
          {isUploading && !isPaused && (
            <Tooltip title="Приостановить">
              <IconButton size="small" onClick={onPause}>
                <i className="ri-pause-line" />
              </IconButton>
            </Tooltip>
          )}
          {isUploading && isPaused && (
            <Tooltip title="Продолжить">
              <IconButton size="small" color="primary" onClick={onResume}>
                <i className="ri-play-line" />
              </IconButton>
            </Tooltip>
          )}

          {/* Cancel */}
          {isUploading && (
            <Tooltip title="Отменить">
              <IconButton size="small" color="error" onClick={onCancel}>
                <i className="ri-stop-line" />
              </IconButton>
            </Tooltip>
          )}

          {/* Retry failed */}
          {hasErrors && !isUploading && (
            <Button 
              size="small" 
              variant="outlined" 
              color="warning"
              onClick={onRetry}
              startIcon={<i className="ri-refresh-line" />}
            >
              Повторить ({stats.error})
            </Button>
          )}

          {/* Clear success */}
          {hasSuccess && !isUploading && (
            <Tooltip title="Убрать загруженные">
              <IconButton size="small" onClick={onClearSuccess}>
                <i className="ri-check-double-line" />
              </IconButton>
            </Tooltip>
          )}

          {/* Clear all */}
          {!isUploading && (
            <Tooltip title="Очистить очередь">
              <IconButton size="small" onClick={onClearAll}>
                <i className="ri-delete-bin-line" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Прогресс-бар */}
      <Box sx={{ mb: 1 }}>
        <LinearProgress 
          variant="determinate" 
          value={stats.progress}
          color={hasErrors ? 'warning' : 'primary'}
          sx={{ height: 8, borderRadius: 1 }}
        />
      </Box>

      {/* Детальная информация */}
      <Collapse in={!compact && isUploading}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {formatBytes(stats.bytesUploaded)} / {formatBytes(stats.bytesTotal)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatBytes(stats.speed)}/сек • Осталось: {formatTime(stats.estimatedTimeLeft)}
          </Typography>
        </Box>
      </Collapse>

      {/* Сводка для компактного режима */}
      {compact && (
        <Typography variant="caption" color="text.secondary">
          {stats.success + stats.error}/{stats.total} • {formatBytes(stats.bytesUploaded)}
        </Typography>
      )}
    </Paper>
  )
}

export default BulkUploadProgress











'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress,
  Alert,
  Chip,
  Stepper,
  Step,
  StepLabel,
  Checkbox,
  FormControlLabel,
  Tabs,
  Tab,
  CircularProgress,
  Card,
  CardContent,
  Tooltip,
  IconButton
} from '@mui/material'
import { toast } from 'react-toastify'
import {
  ImportDialogProps,
  ImportMode,
  MAX_IMPORT_FILE_SIZE,
  ALLOWED_FILE_EXTENSIONS,
  formatFileSize,
  ValidationPreview,
  RowWithValidation,
  ImportResult
} from '@/types/export-import'
import { importService } from '@/services/import/ImportService'
import { importAdapterFactory } from '@/services/import/ImportAdapterFactory'
import { useAuth } from '@/contexts/AuthProvider'
import { useTranslation } from '@/contexts/TranslationContext'
import ImportStatistics from './ImportStatistics'
import ImportErrorsList from './ImportErrorsList'
import ImportPreviewTable from './ImportPreviewTable'
import ImportRowEditor from './ImportRowEditor'

type StepType = 'select' | 'preview' | 'importing' | 'result'

/**
 * Диалог импорта данных с drag & drop и предпросмотром
 */
export default function ImportDialog({
  open,
  onClose,
  entityType,
  mode = 'create',
  onSuccess,
  onError,
  maxFileSize = MAX_IMPORT_FILE_SIZE,
  allowedExtensions = ALLOWED_FILE_EXTENSIONS,
  dialogMaxWidth = 'lg'
}: ImportDialogProps) {
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
  const [step, setStep] = useState<StepType>('select')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<ValidationPreview | null>(null)
  const [importResultState, setImportResultState] = useState<ImportResult | null>(null)
  const [editableData, setEditableData] = useState<RowWithValidation[]>([])
  const [importOnlyValid, setImportOnlyValid] = useState(false)
  const [editingRow, setEditingRow] = useState<RowWithValidation | null>(null)
  const [previewTab, setPreviewTab] = useState(0)
  const [importMode, setImportMode] = useState<ImportMode>(mode)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Сбрасываем состояние при закрытии
  useEffect(() => {
    if (!open) {
      setStep('select')
      setFile(null)
      setPreview(null)
      setImportResultState(null)
      setEditableData([])
      setImportOnlyValid(false)
      setEditingRow(null)
      setImportMode(mode)
      setProgress(0)
    }
  }, [open, mode])

  const handleClose = () => {
    if (!loading && !previewLoading) {
      setStep('select')
      setFile(null)
      setPreview(null)
      setImportResultState(null)
      setEditableData([])
      setImportOnlyValid(false)
      setEditingRow(null)
      setProgress(0)
      onClose()
    }
  }

  const handleFileSelect = async (selectedFile: File) => {
    // Валидация размера файла
    if (selectedFile.size > maxFileSize) {
      const sizeLabel =
        formatMessage(nav.fileSize, { size: formatFileSize(maxFileSize) }) || formatFileSize(maxFileSize)
      toast.error(`${nav.fileTooLarge || 'File is too large'}. ${sizeLabel}`)
      return
    }

    // Валидация расширения
    const extension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'))
    if (!allowedExtensions.includes(extension)) {
      const formatsLabel =
        formatMessage(nav.supportedFormats, {
          formats: allowedExtensions.map(ext => ext.replace('.', '').toUpperCase()).join(', ')
        }) || `Supported formats: ${allowedExtensions.join(', ').toUpperCase()}`
      toast.error(`${nav.invalidFileFormat || 'Invalid file format'}. ${formatsLabel}`)
      return
    }

    setFile(selectedFile)
    setPreviewLoading(true)

    try {
      // Загружаем предпросмотр
      const previewData = await importService.previewImport(selectedFile, entityType, {
        maxPreviewRows: 50,
        actorId // Передаем ID текущего пользователя для записи в события
      })

      setPreview(previewData)
      setEditableData(previewData.previewData)
      setStep('preview')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : nav.previewLoadError || 'Failed to load preview'
      toast.error(errorMessage)
      onError?.(errorMessage)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleRowEdit = (rowIndex: number, data: Record<string, any>) => {
    console.log('[ImportDialog] handleRowEdit called for row:', rowIndex, 'with data:', data)
    setEditableData(prev => {
      const updated = prev.map(row => {
        if (row.rowIndex === rowIndex) {
          // Обновляем данные строки
          const updatedRow = { 
            ...row, 
            data: { ...data } // Создаем новый объект, чтобы гарантировать обновление
          }
          console.log('[ImportDialog] Updated row:', rowIndex, 'Old data keys:', Object.keys(row.data), 'New data keys:', Object.keys(updatedRow.data))
          return updatedRow
        }
        return row
      })
      return updated
    })
  }

  const handleEditRowClick = (rowIndex: number) => {
    const row = editableData.find(r => r.rowIndex === rowIndex)
    if (row) {
      setEditingRow(row)
    }
  }

  const handleSaveEditedRow = (rowIndex: number, data: Record<string, any>) => {
    handleRowEdit(rowIndex, data)
    setEditingRow(null)
    toast.success(
      formatMessage(nav.rowUpdated, { row: rowIndex }) || `Row ${rowIndex} updated`
    )
  }

  const handleDeleteRow = (rowIndex: number) => {
    setEditableData(prev => prev.filter(row => row.rowIndex !== rowIndex))
    toast.success(
      formatMessage(nav.rowRemoved, { row: rowIndex }) || `Row ${rowIndex} removed from preview`
    )
  }

  const handleImport = async () => {
    if (!file || !preview) return

    setStep('importing')
    setLoading(true)
    setProgress(0)

    try {
      const adapter = importAdapterFactory.getAdapter(entityType)
      const result = await importService.importData(entityType, file, {
        mode: importMode,
        importOnlyValid,
        editedData: editableData.length > 0 ? editableData : undefined,
        onProgress: (progressValue: number) => setProgress(progressValue),
        actorId // Передаем ID текущего пользователя для записи в события
      })

      // Показываем предупреждения о дубликатах, если есть
      if (result.warnings && result.warnings.length > 0) {
        const duplicateWarnings = result.warnings.filter(w => w.message?.includes('already exists'))
        if (duplicateWarnings.length > 0) {
          const message =
            formatMessage(nav.duplicatesFound, { count: duplicateWarnings.length }) ||
            `${duplicateWarnings.length} duplicates found. Please review import results.`
          toast.warning(message, {
            autoClose: 5000
          })
        }
      }

      if (result.successCount > 0) {
        setImportResultState(result)
        const importedLabel =
          formatMessage(nav.recordsImported, { count: result.successCount }) ||
          `Records imported: ${result.successCount}`
        const failedLabel =
          formatMessage(nav.recordsFailed, { count: result.errorCount }) ||
          `Records failed: ${result.errorCount}`
        toast.success(`${nav.importSuccess || 'Import completed successfully'} ${importedLabel}, ${failedLabel}`)
        onSuccess?.(result)
        setStep('result')
      } else {
        // Показываем детали ошибок
        const errorDetails = result.errors && result.errors.length > 0
          ? result.errors.slice(0, 3).map(e => e.message || nav.unknownError || 'Unknown error').join(', ')
          : nav.unknownError || 'Unknown error'
        const errorMessage = `${nav.importFailed || 'Import failed'}: ${errorDetails}${
          result.errors && result.errors.length > 3 ? '...' : ''
        }`
        console.error('[ImportDialog] Import failed:', result)
        toast.error(errorMessage)
        onError?.(errorMessage)
        setStep('preview')
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error) || nav.unknownError || 'Unknown error'
      console.error('[ImportDialog] Import error:', error)
      toast.error(`${nav.importFailed || 'Import failed'}: ${errorMessage}`)
      onError?.(errorMessage)
      setStep('preview')
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }

  const handleBackToPreview = () => {
    setStep('preview')
  }

  const getModeLabel = (modeValue: ImportMode) => {
    switch (modeValue) {
      case 'create':
        return nav.createMode || 'Create new records'
      case 'update':
        return nav.updateMode || 'Update existing records'
      case 'upsert':
        return nav.upsertMode || 'Create or update records'
      default:
        return modeValue
    }
  }

  const getModeDescription = (modeValue: ImportMode) => {
    switch (modeValue) {
      case 'create':
        return (
          nav.createModeDescription ||
          'Creates only new users. Rows with existing emails will fail.'
        )
      case 'update':
        return (
          nav.updateModeDescription ||
          'Updates existing users (by email). Rows without matches will fail. Updates Full Name, Username, Role, Plan and Active status.'
        )
      case 'upsert':
        return (
          nav.upsertModeDescription ||
          'Updates existing users by email or creates new ones if missing. Safest mode.'
        )
      default:
        return ''
    }
  }

  const steps = [
    nav.stepSelectFile || 'Select File',
    nav.stepPreview || 'Preview',
    nav.stepImport || 'Import'
  ]

  const getActiveStep = () => {
    switch (step) {
      case 'select': return 0
      case 'preview': return 1
      case 'importing': return 2
      case 'result': return 2
      default: return 0
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      disableEscapeKeyDown={loading || previewLoading}
      maxWidth={dialogMaxWidth}
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            {`${nav.import || 'Import'} - ${entityType}`}
          </Typography>
          {preview && (
            <Chip
              label={
                formatMessage(nav.validityPercentage, {
                  percentage: Math.round(preview.validityPercentage)
                }) || `${preview.validityPercentage}%`
              }
              color={preview.validityPercentage >= 90 ? 'success' : preview.validityPercentage >= 50 ? 'warning' : 'error'}
              size="small"
            />
          )}
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Stepper */}
        <Stepper activeStep={getActiveStep()} sx={{ mb: 3, mt: 1 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Шаг 1: Выбор файла */}
        {step === 'select' && (
          <Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {(nav.importMode || 'Import mode') + ': ' + getModeLabel(importMode)}
              </Typography>
            </Box>

            {/* Drop zone */}
            <Box
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !previewLoading && fileInputRef.current?.click()}
              sx={{
                border: '2px dashed',
                borderColor: dragOver ? 'primary.main' : file ? 'success.main' : 'grey.400',
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                cursor: previewLoading ? 'default' : 'pointer',
                backgroundColor: dragOver ? 'action.hover' : 'background.paper',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: file ? 'success.main' : 'primary.main',
                  backgroundColor: 'action.hover'
                }
              }}
            >
              {previewLoading ? (
                <Box>
                  <CircularProgress size={48} />
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                    {nav.loadingPreview || 'Loading and analyzing file...'}
                  </Typography>
                </Box>
              ) : file ? (
                <Box>
                  <i className='ri-file-list-2-line text-[48px] text-success mb-1' />
                  <Typography variant="h6" gutterBottom>
                    {file.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatMessage(nav.fileSize, { size: formatFileSize(file.size) }) ||
                      `File size: ${formatFileSize(file.size)}`}
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <i className='ri-upload-cloud-2-line text-[48px] text-textDisabled mb-1' />
                  <Typography variant="h6" gutterBottom>
                    {nav.dragDropFile || 'Drag and drop a file here, or click to select'}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      label={
                        formatMessage(nav.fileSize, { size: formatFileSize(maxFileSize) }) ||
                        `File size: ${formatFileSize(maxFileSize)}`
                      }
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </Box>
              )}
            </Box>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={allowedExtensions.map(ext => ext).join(',')}
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />

            {/* File format info */}
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                {formatMessage(nav.supportedFormats, {
                  formats: allowedExtensions.map(ext => ext.replace('.', '').toUpperCase()).join(', ')
                }) || `Supported formats: ${allowedExtensions.join(', ').toUpperCase()}`}
              </Typography>
            </Alert>
          </Box>
        )}

        {/* Шаг 2: Предпросмотр */}
        {step === 'preview' && preview && (
          <Box>
            {/* Выбор режима импорта */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="h6">
                    {nav.importMode || 'Import mode'}
                  </Typography>
                  <Tooltip 
                    title={
                      <Box>
                        <Typography variant="body2" fontWeight="bold" gutterBottom sx={{ color: 'white' }}>
                          {getModeLabel(importMode)}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'white' }}>
                          {getModeDescription(importMode)}
                        </Typography>
                      </Box>
                    }
                    arrow
                    placement="top"
                    componentsProps={{
                      tooltip: {
                        sx: {
                          bgcolor: 'rgba(0, 0, 0, 0.9)',
                          '& .MuiTooltip-arrow': {
                            color: 'rgba(0, 0, 0, 0.9)'
                          }
                        }
                      }
                    }}
                  >
                    <IconButton size="small" sx={{ color: 'info.main' }}>
                      <i className="ri-information-line" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                  <Box sx={{ flex: 1, minWidth: '150px', position: 'relative' }}>
                    <Button
                      variant={importMode === 'create' ? 'contained' : 'outlined'}
                      onClick={() => setImportMode('create')}
                      fullWidth
                      sx={{ 
                        '&.MuiButton-contained': {
                          color: 'white',
                          '& .MuiTypography-root': {
                            color: 'white'
                          },
                          '& .MuiTypography-caption': {
                            color: 'rgba(255, 255, 255, 0.7)'
                          }
                        }
                      }}
                    >
                      <Box sx={{ textAlign: 'left', flex: 1 }}>
                        <Typography variant="body1" fontWeight="medium">
                          {getModeLabel('create')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {nav.createModeShort || getModeDescription('create')}
                        </Typography>
                      </Box>
                    </Button>
                    <Tooltip 
                      title={
                        <Box>
                          <Typography variant="body2" fontWeight="bold" gutterBottom sx={{ color: 'white' }}>
                            {getModeLabel('create')}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'white' }}>
                            {getModeDescription('create')}
                          </Typography>
                        </Box>
                      }
                      arrow
                      placement="top"
                      componentsProps={{
                        tooltip: {
                          sx: {
                            bgcolor: 'rgba(0, 0, 0, 0.9)',
                            '& .MuiTooltip-arrow': {
                              color: 'rgba(0, 0, 0, 0.9)'
                            }
                          }
                        }
                      }}
                    >
                      <IconButton
                        size="small"
                        sx={{ 
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          color: importMode === 'create' ? 'white' : 'text.secondary',
                          '&:hover': {
                            backgroundColor: importMode === 'create' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.04)'
                          }
                        }}
                      >
                        <i className="ri-information-line" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: '150px', position: 'relative' }}>
                    <Button
                      variant={importMode === 'update' ? 'contained' : 'outlined'}
                      onClick={() => setImportMode('update')}
                      fullWidth
                      sx={{ 
                        '&.MuiButton-contained': {
                          color: 'white',
                          '& .MuiTypography-root': {
                            color: 'white'
                          },
                          '& .MuiTypography-caption': {
                            color: 'rgba(255, 255, 255, 0.7)'
                          }
                        }
                      }}
                    >
                      <Box sx={{ textAlign: 'left', flex: 1 }}>
                        <Typography variant="body1" fontWeight="medium">
                          {getModeLabel('update')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {nav.updateModeShort || getModeDescription('update')}
                        </Typography>
                      </Box>
                    </Button>
                    <Tooltip 
                      title={
                        <Box>
                          <Typography variant="body2" fontWeight="bold" gutterBottom sx={{ color: 'white' }}>
                            {getModeLabel('update')}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'white' }}>
                            {getModeDescription('update')}
                          </Typography>
                        </Box>
                      }
                      arrow
                      placement="top"
                      componentsProps={{
                        tooltip: {
                          sx: {
                            bgcolor: 'rgba(0, 0, 0, 0.9)',
                            '& .MuiTooltip-arrow': {
                              color: 'rgba(0, 0, 0, 0.9)'
                            }
                          }
                        }
                      }}
                    >
                      <IconButton
                        size="small"
                        sx={{ 
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          color: importMode === 'update' ? 'white' : 'text.secondary',
                          '&:hover': {
                            backgroundColor: importMode === 'update' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.04)'
                          }
                        }}
                      >
                        <i className="ri-information-line" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: '150px', position: 'relative' }}>
                    <Button
                      variant={importMode === 'upsert' ? 'contained' : 'outlined'}
                      onClick={() => setImportMode('upsert')}
                      fullWidth
                      sx={{ 
                        '&.MuiButton-contained': {
                          color: 'white',
                          '& .MuiTypography-root': {
                            color: 'white'
                          },
                          '& .MuiTypography-caption': {
                            color: 'rgba(255, 255, 255, 0.7)'
                          }
                        }
                      }}
                    >
                      <Box sx={{ textAlign: 'left', flex: 1 }}>
                        <Typography variant="body1" fontWeight="medium">
                          {getModeLabel('upsert')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {nav.upsertModeShort || getModeDescription('upsert')}
                        </Typography>
                      </Box>
                    </Button>
                    <Tooltip 
                      title={
                        <Box>
                          <Typography variant="body2" fontWeight="bold" gutterBottom sx={{ color: 'white' }}>
                            {getModeLabel('upsert')}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'white' }}>
                            {getModeDescription('upsert')}
                          </Typography>
                        </Box>
                      }
                      arrow
                      placement="top"
                      componentsProps={{
                        tooltip: {
                          sx: {
                            bgcolor: 'rgba(0, 0, 0, 0.9)',
                            '& .MuiTooltip-arrow': {
                              color: 'rgba(0, 0, 0, 0.9)'
                            }
                          }
                        }
                      }}
                    >
                      <IconButton
                        size="small"
                        sx={{ 
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          color: importMode === 'upsert' ? 'white' : 'text.secondary',
                          '&:hover': {
                            backgroundColor: importMode === 'upsert' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.04)'
                          }
                        }}
                      >
                        <i className="ri-information-line" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Статистика */}
            <Box sx={{ mb: 3 }}>
              <ImportStatistics preview={preview} fileSize={file?.size} />
            </Box>

            {/* Вкладки: Предпросмотр и Ошибки */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs value={previewTab} onChange={(_, newValue) => setPreviewTab(newValue)}>
                <Tab
                  label={nav.previewData || 'Preview Data'}
                  icon={<i className='ri-table-line' />}
                  iconPosition='start'
                />
                <Tab
                  label={nav.validationErrors || 'Validation Errors'}
                  icon={<i className='ri-error-warning-line' />}
                  iconPosition='start'
                />
              </Tabs>
            </Box>

            {/* Предпросмотр таблицы */}
            {previewTab === 0 && (
              <Box>
                <ImportPreviewTable
                  previewData={editableData}
                  onRowEdit={handleEditRowClick}
                  onRowDelete={handleDeleteRow}
                  onRowClick={(rowIndex) => {
                    // Можно добавить прокрутку к строке
                    const row = editableData.find(r => r.rowIndex === rowIndex)
                    if (row) {
                      setEditingRow(row)
                    }
                  }}
                  importFields={importAdapterFactory.getAdapter(entityType)?.importFields}
                />
              </Box>
            )}

            {/* Список ошибок */}
            {previewTab === 1 && (
              <Box>
                <ImportErrorsList
                  errors={preview.errors}
                  warnings={preview.warnings}
                  onRowClick={(rowIndex) => {
                    setPreviewTab(0)
                    handleEditRowClick(rowIndex)
                  }}
                />
              </Box>
            )}

            {/* Import only valid rows option */}
            {preview.invalidRows > 0 && (
              <Box sx={{ mt: 3 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={importOnlyValid}
                      onChange={(e) => setImportOnlyValid(e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">
                        {nav.importOnlyValid || 'Import only valid rows'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatMessage(nav.rowsWillBeSkipped, { count: preview.invalidRows }) ||
                          `${preview.invalidRows} rows with errors will be skipped`}
                      </Typography>
                    </Box>
                  }
                />
              </Box>
            )}
          </Box>
        )}

        {/* Step 3: Import in progress */}
        {step === 'importing' && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={64} sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {nav.importProgress || 'Import in progress'}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {formatMessage(nav.progressPercentage, { percentage: Math.round(progress) }) ||
                `${Math.round(progress)}% complete`}
            </Typography>
            <LinearProgress variant="determinate" value={progress} sx={{ mt: 2, height: 8, borderRadius: 1 }} />
          </Box>
        )}

        {/* Step 4: Result */}
        {step === 'result' && (
          <Box>
            {(() => {
              const fallbackCount = preview ? Math.max(preview.validRows - preview.invalidRows, 0) : 0
              const importedCount = importResultState?.successCount ?? fallbackCount
              return (
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                {nav.importCompletedSuccessfully || 'Import completed successfully!'}
              </Typography>
              <Typography variant="body2">
                  {formatMessage(nav.recordsImported, { count: importedCount }) || `Records imported: ${importedCount}`}
              </Typography>
            </Alert>
              )
            })()}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {step === 'select' && (
          <>
            <Button onClick={handleClose} disabled={previewLoading}>
              {nav.cancel || 'Cancel'}
            </Button>
          </>
        )}

        {step === 'preview' && (
          <>
            <Button onClick={() => setStep('select')} disabled={loading}>
              {nav.back || 'Back'}
            </Button>
            <Button
              onClick={handleImport}
              variant="contained"
              disabled={loading || !file}
              startIcon={loading ? <CircularProgress size={16} /> : <i className='ri-upload-cloud-2-line' />}
            >
              {loading ? nav.importInProgress || 'Importing...' : nav.importButton || 'Import'}
            </Button>
          </>
        )}

        {step === 'importing' && (
          <Button onClick={handleClose} disabled>
            {nav.cancel || 'Cancel'}
          </Button>
        )}

        {step === 'result' && (
          <Button onClick={handleClose} variant="contained">
            {nav.close || 'Close'}
          </Button>
        )}
      </DialogActions>

      {/* Диалог редактирования строки */}
      {editingRow && (
        <ImportRowEditor
          open={!!editingRow}
          onClose={() => setEditingRow(null)}
          row={editingRow}
          importFields={importAdapterFactory.getAdapter(entityType)?.importFields || []}
          onSave={handleSaveEditedRow}
        />
      )}
    </Dialog>
  )
}

'use client'

import { useState, useEffect, useMemo } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid2'
import IconButton from '@mui/material/IconButton'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Autocomplete from '@mui/material/Autocomplete'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Pluralization Imports
import {
  getRequiredPluralForms,
  languageNeedsComplexPlural,
  isPluralValue,
  type PluralForm,
  type PluralValue
} from '@/utils/translations/pluralization'

type Translation = {
  id: string
  key: string
  language: string
  value: string
  namespace: string
  isActive: boolean
}

type AddTranslationDialogProps = {
  open: boolean
  handleClose: () => void
  onSubmit: (data: { key: string; language: string; value: string; namespace: string; isActive: boolean }) => void
  editTranslation?: Translation | null
  onUpdate?: (data: { id: string; key: string; language: string; value: string; namespace: string; isActive: boolean }) => void
}

// Названия форм для UI
const PLURAL_FORM_LABELS: Record<PluralForm, { ru: string; en: string; example: string }> = {
  zero: { ru: 'Ноль', en: 'Zero', example: '0' },
  one: { ru: 'Один', en: 'One', example: '1, 21, 31...' },
  two: { ru: 'Два', en: 'Two', example: '2' },
  few: { ru: 'Несколько', en: 'Few', example: '2-4, 22-24...' },
  many: { ru: 'Много', en: 'Many', example: '0, 5-20, 25-30...' },
  other: { ru: 'Другое', en: 'Other', example: 'остальное' }
}

const AddTranslationDialog = ({ open, handleClose, onSubmit, editTranslation, onUpdate }: AddTranslationDialogProps) => {
  // Hooks
  const dictionary = useTranslation()

  const [formData, setFormData] = useState({
    key: '',
    language: '',
    value: '',
    namespace: 'common',
    isActive: true
  })

  // Plural mode state
  const [isPluralMode, setIsPluralMode] = useState(false)
  const [pluralForms, setPluralForms] = useState<Partial<Record<PluralForm, string>>>({})

  const [errors, setErrors] = useState<{[key: string]: string}>({})

  const isEditMode = !!editTranslation

  // Available languages and namespaces
  const [languages, setLanguages] = useState<{code: string, name: string}[]>([])

  useEffect(() => {
    import('@/data/languages.json').then(data => setLanguages(data.default))
  }, [])

  const namespaces = [
    { value: 'common', label: 'Common' },
    { value: 'navigation', label: 'Navigation' },
    { value: 'forms', label: 'Forms' },
    { value: 'messages', label: 'Messages' },
    { value: 'validation', label: 'Validation' }
  ]

  // Get required plural forms for selected language
  const requiredForms = useMemo(() => {
    if (!formData.language) return ['one', 'other'] as PluralForm[]

    return getRequiredPluralForms(formData.language)
  }, [formData.language])

  // Check if language needs complex plural
  const needsComplexPlural = useMemo(() => {
    return formData.language ? languageNeedsComplexPlural(formData.language) : false
  }, [formData.language])

  // Parse existing value when editing
  useEffect(() => {
    if (editTranslation) {
      setFormData({
        key: editTranslation.key,
        language: editTranslation.language,
        value: editTranslation.value,
        namespace: editTranslation.namespace,
        isActive: editTranslation.isActive
      })

      // Check if value is plural JSON
      try {
        const parsed = JSON.parse(editTranslation.value)

        if (isPluralValue(parsed)) {
          setIsPluralMode(true)
          setPluralForms(parsed)
        } else {
          setIsPluralMode(false)
          setPluralForms({})
        }
      } catch {
        setIsPluralMode(false)
        setPluralForms({})
      }
    } else {
      setFormData({
        key: '',
        language: '',
        value: '',
        namespace: 'common',
        isActive: true
      })
      setIsPluralMode(false)
      setPluralForms({})
    }
  }, [editTranslation])

  // Build value from plural forms
  const buildPluralValue = (): string => {
    const nonEmptyForms: Partial<Record<PluralForm, string>> = {}

    Object.entries(pluralForms).forEach(([form, value]) => {
      if (value && value.trim()) {
        nonEmptyForms[form as PluralForm] = value
      }
    })

    if (Object.keys(nonEmptyForms).length === 0) {
      return ''
    }

    return JSON.stringify(nonEmptyForms)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    const newErrors: {[key: string]: string} = {}

    if (!formData.key.trim()) {
      newErrors.key = 'Translation key is required'
    }

    if (!formData.language.trim()) {
      newErrors.language = 'Language is required'
    }

    // Validate value based on mode
    if (isPluralMode) {
      const pluralValue = buildPluralValue()

      if (!pluralValue) {
        newErrors.value = 'At least one plural form is required'
      }
    } else if (!formData.value.trim()) {
      newErrors.value = 'Translation value is required'
    }

    setErrors(newErrors)

    // If there are errors, don't submit
    if (Object.keys(newErrors).length > 0) {
      return
    }

    // Get final value
    const finalValue = isPluralMode ? buildPluralValue() : formData.value

    if (isEditMode && onUpdate && editTranslation) {
      onUpdate({ ...formData, value: finalValue, id: editTranslation.id })
    } else {
      onSubmit({ ...formData, value: finalValue })
    }

    handleCloseDialog()
  }

  const handleCloseDialog = () => {
    setFormData({ key: '', language: '', value: '', namespace: 'common', isActive: true })
    setErrors({})
    setIsPluralMode(false)
    setPluralForms({})
    handleClose()
  }

  const handlePluralFormChange = (form: PluralForm, value: string) => {
    setPluralForms(prev => ({
      ...prev,
      [form]: value
    }))

    if (errors.value) {
      setErrors({ ...errors, value: '' })
    }
  }

  return (
    <Dialog fullWidth open={open} onClose={handleCloseDialog} maxWidth='md'>
      <DialogTitle>{isEditMode ? dictionary.navigation.editTranslationTitle : dictionary.navigation.addNewTranslationTitle}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <IconButton onClick={handleCloseDialog} className='absolute block-start-4 inline-end-4'>
            <i className='ri-close-line text-textSecondary' />
          </IconButton>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label={dictionary.navigation.translationKey}
                placeholder='navigation.dashboards'
                value={formData.key}
                onChange={e => {
                  setFormData({ ...formData, key: e.target.value })

                  if (errors.key) {
                    setErrors({ ...errors, key: '' })
                  }
                }}
                error={!!errors.key}
                helperText={errors.key}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Autocomplete
                options={languages}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                value={languages.find(lang => lang.code === formData.language) || null}
                onChange={(event, newValue) => {
                  setFormData({
                    ...formData,
                    language: newValue ? newValue.code : ''
                  })

                  if (errors.language) {
                    setErrors({ ...errors, language: '' })
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={dictionary.navigation.language}
                    placeholder='Select language...'
                    error={!!errors.language}
                    helperText={errors.language}
                    required
                  />
                )}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props

                  return (
                    <li key={option.code} {...otherProps}>
                      {option.name}
                    </li>
                  )
                }}
                fullWidth
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Autocomplete
                options={namespaces}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.label}
                value={namespaces.find(ns => ns.value === formData.namespace) || namespaces[0]}
                onChange={(event, newValue) => {
                  setFormData({
                    ...formData,
                    namespace: newValue ? newValue.value : 'common'
                  })
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={dictionary.navigation.namespace}
                    placeholder='Select namespace...'
                  />
                )}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props

                  return (
                    <li key={option.value} {...otherProps}>
                      {option.label}
                    </li>
                  )
                }}
                fullWidth
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                }
                label={formData.isActive ? dictionary.navigation.active : dictionary.navigation.inactive}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider className='my-2' />
            </Grid>

            {/* Plural mode toggle */}
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={isPluralMode}
                    onChange={e => setIsPluralMode(e.target.checked)}
                  />
                }
                label={
                  <Typography variant='body1'>
                    Множественные формы (Plural)
                    {needsComplexPlural && formData.language && (
                      <Typography component='span' variant='caption' color='primary' className='ml-2'>
                        Рекомендуется для {formData.language.toUpperCase()}
                      </Typography>
                    )}
                  </Typography>
                }
              />
            </Grid>

            {/* Plural forms alert */}
            {isPluralMode && formData.language && (
              <Grid size={{ xs: 12 }}>
                <Alert severity='info' className='mb-2'>
                  <Typography variant='body2'>
                    Для языка <strong>{formData.language.toUpperCase()}</strong> используются формы:{' '}
                    {requiredForms.map(f => PLURAL_FORM_LABELS[f].ru).join(', ')}
                  </Typography>
                  <Typography variant='caption' color='textSecondary'>
                    Используйте {'{{count}}'} для подстановки числа
                  </Typography>
                </Alert>
              </Grid>
            )}

            {/* Translation value - simple mode */}
            {!isPluralMode && (
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label={dictionary.navigation.translationValue}
                  placeholder='Dashboards'
                  value={formData.value}
                  onChange={e => {
                    setFormData({ ...formData, value: e.target.value })

                    if (errors.value) {
                      setErrors({ ...errors, value: '' })
                    }
                  }}
                  error={!!errors.value}
                  helperText={errors.value}
                  required
                  multiline
                  rows={3}
                />
              </Grid>
            )}

            {/* Plural forms - plural mode */}
            {isPluralMode && requiredForms.map(form => (
              <Grid size={{ xs: 12, md: 6 }} key={form}>
                <TextField
                  fullWidth
                  label={`${PLURAL_FORM_LABELS[form].ru} (${form})`}
                  placeholder={`{{count}} ${form === 'one' ? 'пользователь' : form === 'few' ? 'пользователя' : 'пользователей'}`}
                  value={pluralForms[form] || ''}
                  onChange={e => handlePluralFormChange(form, e.target.value)}
                  helperText={`Примеры: ${PLURAL_FORM_LABELS[form].example}`}
                  multiline
                  rows={2}
                />
              </Grid>
            ))}

            {/* Validation error for plural */}
            {isPluralMode && errors.value && (
              <Grid size={{ xs: 12 }}>
                <Typography color='error' variant='caption'>
                  {errors.value}
                </Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant='outlined' onClick={handleCloseDialog}>
            {dictionary.navigation.cancel}
          </Button>
          <Button variant='contained' type='submit'>
            {isEditMode ? dictionary.navigation.updateTranslation : dictionary.navigation.addTranslation}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default AddTranslationDialog

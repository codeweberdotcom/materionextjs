'use client'

import { useState, useMemo } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid2'
import IconButton from '@mui/material/IconButton'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'

import isoLanguages from '@/data/iso-languages.json'

import { useTranslation } from '@/contexts/TranslationContext'

type IsoLanguage = {
  code: string
  name: string
  nativeName: string
  direction: string
}

type AddLanguageDialogProps = {
  open: boolean
  handleClose: () => void
  onSubmit: (data: { name: string; code: string; direction: string; isActive: boolean }) => void
  existingCodes?: string[]
}

const AddLanguageDialog = ({ open, handleClose, onSubmit, existingCodes = [] }: AddLanguageDialogProps) => {
  const dictionary = useTranslation()
  const [selectedLanguage, setSelectedLanguage] = useState<IsoLanguage | null>(null)
  const [isActive, setIsActive] = useState(true)

  const availableLanguages = useMemo(() => {
    return (isoLanguages as IsoLanguage[]).filter(lang => !existingCodes.includes(lang.code))
  }, [existingCodes])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedLanguage) return

    onSubmit({
      name: selectedLanguage.name,
      code: selectedLanguage.code,
      direction: selectedLanguage.direction,
      isActive
    })

    setSelectedLanguage(null)
    setIsActive(true)
  }

  const handleCloseDialog = () => {
    setSelectedLanguage(null)
    setIsActive(true)
    handleClose()
  }

  return (
    <Dialog fullWidth open={open} onClose={handleCloseDialog} maxWidth='sm'>
      <DialogTitle>{dictionary.navigation.addNewLanguage}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <IconButton onClick={handleCloseDialog} className='absolute block-start-4 inline-end-4'>
            <i className='ri-close-line text-textSecondary' />
          </IconButton>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                options={availableLanguages}
                value={selectedLanguage}
                onChange={(_, value) => setSelectedLanguage(value)}
                getOptionLabel={(option) => `${option.name} (${option.nativeName})`}
                renderOption={(props, option) => (
                  <li {...props} key={option.code}>
                    <div className='flex items-center justify-between w-full'>
                      <div>
                        <Typography variant='body1'>{option.name}</Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {option.nativeName} — {option.code}
                        </Typography>
                      </div>
                      {option.direction === 'rtl' && (
                        <Chip label='RTL' size='small' color='warning' variant='outlined' />
                      )}
                    </div>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={dictionary.navigation.selectLanguage}
                    placeholder={dictionary.navigation.searchByName}
                    required
                  />
                )}
                isOptionEqualToValue={(option, value) => option.code === value.code}
                noOptionsText={dictionary.navigation.noLanguagesAvailable}
              />
            </Grid>
            {selectedLanguage && (
              <Grid size={{ xs: 12 }}>
                <div className='flex items-center gap-4 p-3 rounded bg-actionHover'>
                  <div>
                    <Typography variant='body2' color='text.secondary'>{dictionary.navigation.code}</Typography>
                    <Typography variant='body1' fontWeight={500}>{selectedLanguage.code}</Typography>
                  </div>
                  <div>
                    <Typography variant='body2' color='text.secondary'>{dictionary.navigation.direction}</Typography>
                    <Typography variant='body1' fontWeight={500}>
                      {selectedLanguage.direction === 'rtl' ? dictionary.navigation.directionRtl : dictionary.navigation.directionLtr}
                    </Typography>
                  </div>
                </div>
              </Grid>
            )}
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                  />
                }
                label={isActive ? dictionary.navigation.active : dictionary.navigation.inactive}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant='outlined' onClick={handleCloseDialog}>
            {dictionary.navigation.cancel}
          </Button>
          <Button variant='contained' type='submit' disabled={!selectedLanguage}>
            {dictionary.navigation.addLanguage}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default AddLanguageDialog

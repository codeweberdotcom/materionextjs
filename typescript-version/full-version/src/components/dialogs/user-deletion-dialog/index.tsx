'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { styled } from '@mui/material/styles'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

type DeletionMode = 'delete' | 'anonymize'

type UserDeletionDialogProps = {
  open: boolean
  setOpen: (open: boolean) => void
  userName: string
  onConfirm: (mode: DeletionMode) => void
}

const SelectionCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== 'isDestructive'
})<{ selected: boolean; isDestructive?: boolean }>(({ theme, selected, isDestructive = false }) => {
  const mainColor = isDestructive ? theme.palette.error.main : theme.palette.primary.main
  const darkColor = isDestructive ? theme.palette.error.dark : theme.palette.primary.dark

  return {
    cursor: 'pointer',
    border: `2px solid ${selected ? mainColor : theme.palette.divider}`,
    backgroundColor: selected ? mainColor : (isDestructive ? 'rgba(244, 67, 54, 0.08)' : 'transparent'),
    color: selected ? 'white' : (isDestructive ? theme.palette.error.main : 'inherit'),
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      borderColor: selected ? darkColor : mainColor,
      backgroundColor: selected ? darkColor : (isDestructive ? 'rgba(244, 67, 54, 0.12)' : theme.palette.action.hover),
    },
    '& .MuiCardContent-root': {
      padding: theme.spacing(3),
      '&:last-child': {
        paddingBottom: theme.spacing(3),
      },
    },
  }
})

const UserDeletionDialog = ({ open, setOpen, userName, onConfirm }: UserDeletionDialogProps) => {
  // Hooks
  const dictionary = useTranslation()

  // States
  const [deletionMode, setDeletionMode] = useState<DeletionMode>('delete')

  const handleConfirm = () => {
    onConfirm(deletionMode)
    setOpen(false)
    setDeletionMode('delete') // Reset for next use
  }

  const handleCancel = () => {
    setOpen(false)
    setDeletionMode('delete') // Reset for next use
  }

  return (
    <Dialog fullWidth maxWidth='sm' open={open} onClose={handleCancel} closeAfterTransition={false}>
      <DialogContent className='flex items-center flex-col text-center sm:pbs-16 sm:pbe-6 sm:pli-16'>
        <i className='ri-error-warning-line text-[88px] mbe-6 text-warning' />
        <Typography variant='h4' className='mbe-2'>
          {dictionary.navigation.deleteUserConfirm?.replace('${name}', userName) || `Удалить пользователя ${userName}?`}
        </Typography>
        <Typography color='text.primary' className='mbe-6'>
          {dictionary.navigation.selectDeletionMethod || 'Выберите способ удаления данных пользователя:'}
        </Typography>

        <div className='flex flex-col gap-3 w-full mbe-6'>
          <SelectionCard
            selected={deletionMode === 'delete'}
            isDestructive={true}
            onClick={() => setDeletionMode('delete')}
          >
            <CardContent className='p-4'>
              <div className='flex items-center justify-between'>
                <Typography variant='body1' fontWeight='medium' sx={{ color: deletionMode === 'delete' ? 'white' : 'inherit' }}>
                  {dictionary.navigation.fullDeletion || 'Полное удаление'}
                </Typography>
                <Tooltip title={dictionary.navigation.deleteTooltip || "Все данные пользователя будут безвозвратно удалены"} arrow>
                  <IconButton size='small' sx={{ color: deletionMode === 'delete' ? 'white' : 'text.secondary' }}>
                    <i className='ri-information-line' />
                  </IconButton>
                </Tooltip>
              </div>
            </CardContent>
          </SelectionCard>

          <SelectionCard
            selected={deletionMode === 'anonymize'}
            onClick={() => setDeletionMode('anonymize')}
          >
            <CardContent className='p-4'>
              <div className='flex items-center justify-between'>
                <Typography variant='body1' fontWeight='medium' sx={{ color: deletionMode === 'anonymize' ? 'white' : 'inherit' }}>
                  {dictionary.navigation.anonymization || 'Анонимизация'}
                </Typography>
                <Tooltip title={dictionary.navigation.anonymizeTooltip || "Личные данные будут заменены, но пользователь останется в системе"} arrow>
                  <IconButton size='small' sx={{ color: deletionMode === 'anonymize' ? 'white' : 'text.secondary' }}>
                    <i className='ri-information-line' />
                  </IconButton>
                </Tooltip>
              </div>
            </CardContent>
          </SelectionCard>
        </div>

      </DialogContent>
      <DialogActions className='justify-center pbs-0 sm:pbe-16 sm:pli-16'>
        <Button variant='contained' onClick={handleConfirm} color={deletionMode === 'delete' ? 'error' : 'primary'}>
          {deletionMode === 'delete'
            ? (dictionary.navigation.deleteUser || 'Удалить')
            : (dictionary.navigation.anonymize || 'Анонимизировать')
          }
        </Button>
        <Button
          variant='outlined'
          color='secondary'
          onClick={handleCancel}
        >
          {dictionary.navigation.cancel || 'Отмена'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default UserDeletionDialog

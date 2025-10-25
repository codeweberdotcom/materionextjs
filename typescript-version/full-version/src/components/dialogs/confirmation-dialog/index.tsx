'use client'

// React Imports
import { Fragment, useState } from 'react'

// MUI Imports
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'

// Third-party Imports
import classnames from 'classnames'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

type ConfirmationType = 'delete-account' | 'unsubscribe' | 'suspend-account' | 'delete-order' | 'delete-customer' | 'delete-user' | 'delete-role'

type ConfirmationDialogProps = {
  open: boolean
  setOpen: (open: boolean) => void
  type: ConfirmationType
  onConfirm?: (value: boolean) => void
  name?: string
  isActive?: boolean
}

const ConfirmationDialog = ({ open, setOpen, type, onConfirm, name, isActive }: ConfirmationDialogProps) => {
  // Hooks
  const dictionary = useTranslation()

  // States
  const [secondDialog, setSecondDialog] = useState(false)
  const [userInput, setUserInput] = useState(false)

  // Vars
  const Wrapper = type === 'suspend-account' ? 'div' : Fragment

  const handleSecondDialogClose = () => {
    setSecondDialog(false)
    setOpen(false)
  }

  const handleConfirmation = (value: boolean) => {
    if (onConfirm) {
      onConfirm(value)
    } else {
      setUserInput(value)
      setSecondDialog(true)
    }
    setOpen(false)
  }

  return (
    <>
      <Dialog fullWidth maxWidth='xs' open={open} onClose={() => setOpen(false)} closeAfterTransition={false}>
        <DialogContent className='flex items-center flex-col text-center sm:pbs-16 sm:pbe-6 sm:pli-16'>
          <i className='ri-error-warning-line text-[88px] mbe-6 text-warning' />
          <Wrapper
            {...(type === 'suspend-account' && {
              className: 'flex flex-col items-center gap-2'
            })}
          >
            <Typography variant='h4'>
              {type === 'delete-account' && 'Are you sure you want to deactivate your account?'}
              {type === 'unsubscribe' && 'Are you sure to cancel your subscription?'}
              {type === 'suspend-account' && (isActive ? dictionary.navigation.suspendConfirmTitle : dictionary.navigation.activateConfirmTitle)}
              {type === 'delete-order' && 'Are you sure?'}
              {type === 'delete-customer' && 'Are you sure?'}
              {type === 'delete-user' && dictionary.navigation.deleteUserConfirm.replace('${name}', name || '')}
              {type === 'delete-role' && dictionary.navigation.deleteRoleConfirm.replace('${name}', name || '')}
            </Typography>
            {type === 'suspend-account' && (
              <Typography color='text.primary'>{isActive ? dictionary.navigation.suspendConfirmMessage : dictionary.navigation.activateConfirmMessage}</Typography>
            )}
            {type === 'delete-order' && (
              <Typography color='text.primary'>You won&#39;t be able to revert order!</Typography>
            )}
            {type === 'delete-customer' && (
              <Typography color='text.primary'>You won&#39;t be able to revert customer!</Typography>
            )}
          </Wrapper>
        </DialogContent>
        <DialogActions className='justify-center pbs-0 sm:pbe-16 sm:pli-16'>
          <Button variant='contained' onClick={() => handleConfirmation(true)}>
            {type === 'suspend-account'
              ? (isActive ? dictionary.navigation.yesSuspendUser : dictionary.navigation.yesActivateUser)
              : type === 'delete-order'
                ? 'Yes, Delete Order!'
                : type === 'delete-customer'
                  ? 'Yes, Delete Customer!'
                  : type === 'delete-user'
                    ? dictionary.navigation.deleteUser
                    : type === 'delete-role'
                      ? dictionary.navigation.yesDeleteRole
                      : 'Yes'}
          </Button>
          <Button
            variant='outlined'
            color='secondary'
            onClick={() => {
              handleConfirmation(false)
            }}
          >
            {dictionary.navigation.cancel}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={secondDialog} onClose={handleSecondDialogClose} closeAfterTransition={false}>
        <DialogContent className='flex items-center flex-col text-center sm:pbs-16 sm:pbe-6 sm:pli-16'>
          <i
            className={classnames('text-[88px] mbe-6', {
              'ri-checkbox-circle-line': userInput,
              'text-success': userInput,
              'ri-close-circle-line': !userInput,
              'text-error': !userInput
            })}
          />
          <Typography variant='h4' className='mbe-2'>
            {userInput
              ? `${type === 'delete-account' ? 'Deactivated' : type === 'unsubscribe' ? 'Unsubscribed' : type === 'delete-order' || 'delete-customer' ? 'Deleted' : type === 'suspend-account' ? (isActive ? 'Suspended!' : 'Activated!') : 'Suspended!'}`
              : 'Cancelled'}
          </Typography>
          <Typography color='text.primary'>
            {userInput ? (
              <>
                {type === 'delete-account' && 'Your account has been deactivated successfully.'}
                {type === 'unsubscribe' && 'Your subscription cancelled successfully.'}
                {type === 'suspend-account' && (isActive ? dictionary.navigation.userSuspended : dictionary.navigation.userActivated)}
                {type === 'delete-order' && 'Your order deleted successfully.'}
                {type === 'delete-customer' && 'Your customer removed successfully.'}
                {type === 'delete-user' && dictionary.navigation.deleteUser + ' ' + dictionary.navigation.successfully}
                {type === 'delete-role' && dictionary.navigation.deleteRole + ' ' + dictionary.navigation.successfully}
              </>
            ) : (
              <>
                {type === 'delete-account' && 'Account Deactivation Cancelled!'}
                {type === 'unsubscribe' && 'Unsubscription Cancelled!!'}
                {type === 'suspend-account' && (isActive ? dictionary.navigation.cancelledSuspension : dictionary.navigation.cancelledActivation)}
                {type === 'delete-order' && 'Order Deletion Cancelled'}
                {type === 'delete-customer' && 'Customer Deletion Cancelled'}
                {type === 'delete-user' && dictionary.navigation.cancelled}
                {type === 'delete-role' && dictionary.navigation.cancelled}
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions className='justify-center pbs-0 sm:pbe-16 sm:pli-16'>
          <Button variant='contained' color='success' onClick={handleSecondDialogClose}>
            Ok
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default ConfirmationDialog

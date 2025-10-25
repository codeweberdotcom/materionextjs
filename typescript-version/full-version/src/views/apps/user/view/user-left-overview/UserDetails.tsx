'use client'

// React Imports
import { useState, useEffect } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import type { ButtonProps } from '@mui/material/Button'

// Type Imports
import type { ThemeColor } from '@core/types'
import type { UsersType } from '@/types/apps/userTypes'

// Component Imports
import EditUserInfo from '@components/dialogs/edit-user-info'
import ConfirmationDialog from '@components/dialogs/confirmation-dialog'
import OpenDialogOnElementClick from '@components/dialogs/OpenDialogOnElementClick'
import CustomAvatar from '@core/components/mui/Avatar'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

interface UserDetailsProps {
  userData?: UsersType
}

// Vars - Default fallback data
const defaultUserData: UsersType = {
  id: 0,
  fullName: 'Unknown User',
  company: 'N/A',
  role: 'subscriber',
  username: '@unknown',
  country: 'Unknown',
  contact: 'N/A',
  email: 'unknown@example.com',
  currentPlan: 'basic',
  status: 'active',
  avatar: '',
  avatarColor: 'primary',
  isActive: true
}

const UserDetails = ({ userData }: UserDetailsProps) => {
  // Hooks
  const dictionary = useTranslation()

  // Use provided userData or fallback to default
  const [user, setUser] = useState(defaultUserData)
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)

  // Update user when userData changes
  useEffect(() => {
    if (userData) {
      setUser(userData)
    }
  }, [userData])

  // Split full name into first and last name
  const nameParts = user.fullName.split(' ')
  const firstName = nameParts[0] || 'Unknown'
  const lastName = nameParts.slice(1).join(' ') || 'User'
  const buttonProps = (children: string, color: ThemeColor, variant: ButtonProps['variant']): ButtonProps => ({
    children,
    color,
    variant
  })

  const handleSuspendConfirm = async (confirmed: boolean) => {
    if (confirmed) {
      try {
        const response = await fetch(`/api/admin/users/${user.id}`, {
          method: 'PATCH'
        })
        if (response.ok) {
          const updatedUser = await response.json()
          setUser(updatedUser)
        }
      } catch (error) {
        console.error('Error updating user status:', error)
      }
    }
    setSuspendDialogOpen(false)
  }

  return (
    <>
      <Card>
        <CardContent className='flex flex-col pbs-12 gap-6'>
          <div className='flex flex-col gap-6'>
            <div className='flex items-center justify-center flex-col gap-4'>
              <div className='flex flex-col items-center gap-4'>
                <CustomAvatar alt='user-profile' src={user.avatar} variant='rounded' size={120} />
                <Typography variant='h5'>{firstName} {lastName}</Typography>
              </div>
              <Chip label={user.role} color='error' size='small' variant='tonal' />
            </div>
            <div className='flex items-center justify-around flex-wrap gap-4'>
              <div className='flex items-center gap-4'>
                <CustomAvatar variant='rounded' color='primary' skin='light'>
                  <i className='ri-check-line' />
                </CustomAvatar>
                <div>
                  <Typography variant='h5'>1.23k</Typography>
                  <Typography>{dictionary.navigation.taskDone}</Typography>
                </div>
              </div>
              <div className='flex items-center gap-4'>
                <CustomAvatar variant='rounded' color='primary' skin='light'>
                  <i className='ri-star-smile-line' />
                </CustomAvatar>
                <div>
                  <Typography variant='h5'>568</Typography>
                  <Typography>{dictionary.navigation.projectDone}</Typography>
                </div>
              </div>
            </div>
          </div>
          <div>
            <Typography variant='h5'>{dictionary.navigation.details}</Typography>
            <Divider className='mlb-4' />
            <div className='flex flex-col gap-2'>
              <div className='flex items-center flex-wrap gap-x-1.5'>
                <Typography className='font-medium' color='text.primary'>
                  {dictionary.navigation.usernameLabel}
                </Typography>
                <Typography>{user.username}</Typography>
              </div>
              <div className='flex items-center flex-wrap gap-x-1.5'>
                <Typography className='font-medium' color='text.primary'>
                  {dictionary.navigation.emailLabel}
                </Typography>
                <Typography>{user.email}</Typography>
              </div>
              <div className='flex items-center flex-wrap gap-x-1.5'>
                <Typography className='font-medium' color='text.primary'>
                  {dictionary.navigation.statusLabel}
                </Typography>
                <Typography color='text.primary'>{user.status}</Typography>
              </div>
              <div className='flex items-center flex-wrap gap-x-1.5'>
                <Typography className='font-medium' color='text.primary'>
                  {dictionary.navigation.roleLabel}
                </Typography>
                <Typography color='text.primary'>{user.role}</Typography>
              </div>
              <div className='flex items-center flex-wrap gap-x-1.5'>
                <Typography className='font-medium' color='text.primary'>
                  {dictionary.navigation.planLabel}
                </Typography>
                <Typography color='text.primary'>{user.currentPlan}</Typography>
              </div>
              <div className='flex items-center flex-wrap gap-x-1.5'>
                <Typography className='font-medium' color='text.primary'>
                  {dictionary.navigation.companyLabel}
                </Typography>
                <Typography color='text.primary'>{user.company}</Typography>
              </div>
              <div className='flex items-center flex-wrap gap-x-1.5'>
                <Typography className='font-medium' color='text.primary'>
                  {dictionary.navigation.countryLabel}
                </Typography>
                <Typography color='text.primary'>{user.country}</Typography>
              </div>
            </div>
          </div>
          <div className='flex gap-4 justify-center'>
            <OpenDialogOnElementClick
              element={Button}
              elementProps={buttonProps(dictionary.navigation.edit, 'primary', 'contained')}
              dialog={EditUserInfo}
              dialogProps={{ data: user }}
            />
            <Button
              variant='outlined'
              color={user.status === 'active' ? 'error' : 'success'}
              onClick={() => setSuspendDialogOpen(true)}
            >
              {user.status === 'active' ? dictionary.navigation.suspend : dictionary.navigation.activate}
            </Button>
            <ConfirmationDialog
              open={suspendDialogOpen}
              setOpen={setSuspendDialogOpen}
              type='suspend-account'
              onConfirm={handleSuspendConfirm}
              isActive={user.status === 'active'}
            />
          </div>
        </CardContent>
      </Card>
    </>
  )
}

export default UserDetails

'use client'

// React Imports
import { useState, useEffect } from 'react'

// Next Imports
import Link from 'next/link'
import { useParams } from 'next/navigation'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import AvatarGroup from '@mui/material/AvatarGroup'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import { styled } from '@mui/material/styles'
import type { CardProps } from '@mui/material/Card'

// Type Imports
import type { Locale } from '@configs/i18n'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Third-party Imports
import { toast } from 'react-toastify'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'

// Component Imports
import RoleDialog from '@components/dialogs/role-dialog'
import OpenDialogOnElementClick from '@components/dialogs/OpenDialogOnElementClick'
import ConfirmationDialog from '@components/dialogs/confirmation-dialog'

type Role = {
  id: string
  name: string
  description?: string | null
  permissions?: string | null
  createdAt: Date
  updatedAt: Date
}

type User = {
  id: string
  fullName: string
  avatar?: string
  role: string
}

type CardDataType = {
  title: string
  avatars: string[]
  totalUsers: number
}

type UserRoleType = {
  [key: string]: { icon: string; color: string }
}

// Vars
const cardData: CardDataType[] = [
  { totalUsers: 4, title: 'Administrator', avatars: ['1.png', '2.png', '3.png', '4.png'] },
  { totalUsers: 7, title: 'Editor', avatars: ['5.png', '6.png', '7.png'] },
  { totalUsers: 5, title: 'Users', avatars: ['4.png', '5.png', '6.png'] },
  { totalUsers: 6, title: 'Support', avatars: ['1.png', '2.png', '3.png'] },
  { totalUsers: 10, title: 'Restricted User', avatars: ['4.png', '5.png', '6.png'] }
]

const userRoleObj: UserRoleType = {
  superadmin: { icon: 'ri-vip-crown-line', color: 'warning' },
  admin: { icon: 'ri-vip-crown-line', color: 'error' },
  author: { icon: 'ri-computer-line', color: 'warning' },
  editor: { icon: 'ri-edit-box-line', color: 'info' },
  maintainer: { icon: 'ri-pie-chart-2-line', color: 'success' },
  subscriber: { icon: 'ri-user-3-line', color: 'primary' }
}

// Styled Components
const Icon = styled('i')({})

const RoleCards = () => {
  // Hooks
  const t = useTranslation()
  const { lang: locale } = useParams()

  // States
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [roleUsers, setRoleUsers] = useState<User[]>([])

  // Fetch roles, users, and current user role
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rolesResponse, usersResponse, profileResponse] = await Promise.all([
          fetch('/api/admin/roles'),
          fetch('/api/admin/users'),
          fetch('/api/user/profile')
        ])

        if (rolesResponse.ok) {
          const rolesData = await rolesResponse.json()
          setRoles(rolesData)
        }

        if (usersResponse.ok) {
          const usersData = await usersResponse.json()
          setUsers(usersData)
        }

        // Current user role no longer needed for restrictions
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    fetchData()
  }, [])

  const handleRoleSuccess = () => {
    // Refetch roles, users, and current user role
    const fetchData = async () => {
      try {
        const [rolesResponse, usersResponse, profileResponse] = await Promise.all([
          fetch('/api/admin/roles'),
          fetch('/api/admin/users'),
          fetch('/api/user/profile')
        ])

        if (rolesResponse.ok) {
          const rolesData = await rolesResponse.json()
          setRoles(rolesData)
        }

        if (usersResponse.ok) {
          const usersData = await usersResponse.json()
          setUsers(usersData)
        }

        // Current user role no longer needed for restrictions
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    fetchData()
  }

  const handleDeleteRole = async (role: Role) => {
    try {
      const response = await fetch(`/api/admin/roles/${role.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        handleRoleSuccess()
        setDeleteDialogOpen(false)
        setRoleToDelete(null)
        // Show success notification
        toast.success(`${t.navigation.deleteRole} "${role.name}" ${t.navigation.successfully}`)
      } else if (response.status === 400) {
        const data = await response.json()
        if (data.users) {
          setErrorMessage(t.navigation.roleDeleteError.replace('${roleName}', role.name))
          setRoleUsers(data.users)
        }
        setDeleteDialogOpen(false)
        setRoleToDelete(null)
        // Show error notification
        toast.error(data.message || 'Error deleting role')
      } else {
        console.error('Error deleting role')
        // Show error notification
        toast.error('Error deleting role')
      }
    } catch (error) {
      console.error('Error deleting role:', error)
      // Show error notification
      toast.error('Error deleting role')
    }
  }

  const CardProps: CardProps = {
    className: 'cursor-pointer bs-full',
    children: (
      <Grid container className='bs-full'>
        <Grid size={{ xs: 5 }}>
          <div className='flex items-end justify-center bs-full'>
            <img alt='add-role' src='/images/illustrations/characters/1.png' height={130} />
          </div>
        </Grid>
        <Grid size={{ xs: 7 }}>
          <CardContent>
            <div className='flex flex-col items-end gap-4 text-right'>
              <Button variant='contained' size='small'>
                {t.navigation.addRole}
              </Button>
              <Typography>
                {t.navigation.addRoleDescription}
              </Typography>
            </div>
          </CardContent>
        </Grid>
      </Grid>
    )
  }

  return (
    <>
      {errorMessage && (
        <Alert severity="error" icon={<i className='ri-error-warning-line' />} className="mb-4 font-medium text-lg">
          <AlertTitle>{errorMessage}</AlertTitle>
          {roleUsers.length > 0 && (
            <div className="mt-2">
              <Typography variant="body2" className="font-medium">{t.navigation.usersList}:</Typography>
              {roleUsers.map(user => (
                <Typography key={user.id} variant="body2" className="ml-2">
                  - <Link href={getLocalizedUrl(`/apps/user/view?id=${user.id}`, locale as Locale)}>{user.fullName}</Link>
                </Typography>
              ))}
            </div>
          )}
          <Button
            variant="outlined"
            size="small"
            className="mt-2"
            onClick={() => {
              setErrorMessage('')
              setRoleUsers([])
            }}
          >
            {t.navigation.cancel}
          </Button>
        </Alert>
      )}
      <Grid container spacing={6} alignItems="stretch">
        {roles.map((role, index) => {
          const roleUsers = users.filter(user => user.role === role.name)
          return (
            <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={role.id}>
              <Card>
                <CardContent className='flex flex-col gap-4'>
                  <div className='flex items-center justify-between'>
                    <Typography className='flex-grow'>{t.navigation.totalUsersCount.replace('${count}', roleUsers.length.toString())}</Typography>
                    <AvatarGroup total={Math.max(roleUsers.length, 1)}>
                      {roleUsers.slice(0, 3).map((user, userIndex) => (
                        <Avatar key={user.id} alt={user.fullName} src={user.avatar || undefined} />
                      ))}
                      {roleUsers.length === 0 && (
                        <Avatar>
                          <i className='ri-user-line' />
                        </Avatar>
                      )}
                    </AvatarGroup>
                  </div>
                  <div className='flex justify-between items-center'>
                    <div className='flex flex-col items-start gap-1'>
                      {(() => {
                        const roleInfo = userRoleObj[role.name.toLowerCase()] || userRoleObj.subscriber
                        return (
                          <div className='flex items-center gap-2'>
                            <Icon className={roleInfo.icon} sx={{ color: role.name.toLowerCase() === 'superadmin' ? '#FFD700' : `var(--mui-palette-${roleInfo.color}-main)`, fontSize: '1.375rem' }} />
                            <Typography variant='h5'>{role.name}</Typography>
                          </div>
                        )
                      })()}
                      <Typography variant='body2' color='text.secondary'>
                        {role.description || 'No description'}
                      </Typography>
                    </div>
                    <div className='flex gap-2'>
                      <OpenDialogOnElementClick
                        element={IconButton}
                        elementProps={{
                          children: <i className='ri-edit-box-line text-secondary mui-1vkcxi3' />
                        }}
                        dialog={RoleDialog}
                        dialogProps={{ title: role.name, roleId: role.id, onSuccess: handleRoleSuccess }}
                      />
                      <IconButton onClick={() => {
                        setRoleToDelete(role)
                        setDeleteDialogOpen(true)
                      }}>
                        <i className='ri-delete-bin-line text-secondary' />
                      </IconButton>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <OpenDialogOnElementClick element={Card} elementProps={CardProps} dialog={RoleDialog} dialogProps={{ onSuccess: handleRoleSuccess }} />
        </Grid>
      </Grid>
      <ConfirmationDialog
        open={deleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        type='delete-role'
        name={roleToDelete?.name}
        onConfirm={(confirmed) => {
          if (confirmed && roleToDelete) {
            handleDeleteRole(roleToDelete)
          }
        }}
      />
    </>
  )
}

export default RoleCards


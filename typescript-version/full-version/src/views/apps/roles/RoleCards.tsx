'use client'

// Winston logger import
import logger from '@/lib/logger'

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
import { toast } from 'react-toastify'

import type { Locale } from '@configs/i18n'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Hook Imports
import { usePermissions } from '@/hooks/usePermissions'

// Third-party Imports
import Skeleton from '@mui/material/Skeleton'

// Util Imports
import { getLocalizedUrl } from '@/utils/formatting/i18n'
import { getUserPermissions, isAdmin } from '@/utils/permissions/permissions'

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
  const { checkPermission, isSuperadmin, user } = usePermissions()

  // States
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [roleUsers, setRoleUsers] = useState<User[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [loading, setLoading] = useState(true)

  // Fetch roles, users, and current user role
  useEffect(() => {
    logger.info('🔄 useEffect triggered - fetching data')

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
        logger.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Log isSuperadmin and user role for debugging
     // Debug logging removed'Current user:', user)
     logger.info('Current user role:', user?.role)
     logger.info('Current user permissions (raw):', user?.role?.permissions)
     logger.info('Parsed user permissions:', getUserPermissions(user || null))
     logger.info('isSuperadmin:', isSuperadmin)
     logger.info('isAdmin:', isAdmin(user || null))
     logger.info('Current page permissions - module: roleManagement, action: read')
     logger.info('Has permission for current page:', checkPermission('roleManagement', 'read'))
     // Debug logging removed
  }, [])

  const handleRoleSuccess = () => {
    logger.info('🔄 [ROLE SUCCESS] handleRoleSuccess called - refetching data in background')

    // Refetch roles and users only (remove profile fetch to reduce API calls)
    const fetchData = async () => {
      logger.info('🔄 [ROLE SUCCESS] Starting background fetch')
      try {
        const [rolesResponse, usersResponse] = await Promise.all([
          fetch('/api/admin/roles'),
          fetch('/api/admin/users')
        ])

        logger.info('🔄 [ROLE SUCCESS] API responses received - roles:', rolesResponse.status, 'users:', usersResponse.status)

        if (rolesResponse.ok) {
          const rolesData = await rolesResponse.json()
          logger.info('🔄 [ROLE SUCCESS] Roles data fetched:', rolesData.length, 'roles')
          setRoles(rolesData)
          logger.info('🔄 [ROLE SUCCESS] Roles state updated')
        } else {
          logger.error('🔄 [ROLE SUCCESS] Failed to fetch roles:', rolesResponse.status)
        }

        if (usersResponse.ok) {
          const usersData = await usersResponse.json()
          logger.info('🔄 [ROLE SUCCESS] Users data fetched:', usersData.length, 'users')
          setUsers(usersData)
          logger.info('🔄 [ROLE SUCCESS] Users state updated')
        } else {
          logger.error('🔄 [ROLE SUCCESS] Failed to fetch users:', usersResponse.status)
        }
      } catch (error) {
        logger.error('🔄 [ROLE SUCCESS] Error fetching data:', error)
      }
      logger.info('🔄 [ROLE SUCCESS] Background fetch completed')
    }

    fetchData()
  }

  const handleDeleteRole = async (role: Role) => {
    logger.info('🗑️ [DELETE START] handleDeleteRole called for role:', role.name, role.id)
    logger.info('🗑️ [DELETE STATE] Current roles before delete:', roles.map(r => ({ id: r.id, name: r.name })))

    if (isDeleting) {
      logger.info('🗑️ [DELETE SKIP] Delete already in progress, skipping')
      return
    }

    setIsDeleting(true)
    logger.info('🗑️ [DELETE PROGRESS] Set isDeleting to true')

    try {
      logger.info('🗑️ [DELETE API] Making DELETE request to:', `/api/admin/roles/${role.id}`)
      const response = await fetch(`/api/admin/roles/${role.id}`, {
        method: 'DELETE'
      })

      logger.info('🗑️ [DELETE RESPONSE] Response status:', response.status)

      if (response.ok) {
        logger.info('🗑️ [DELETE SUCCESS] Role deleted successfully from API')

        // Immediately update local state for better UX (like in UserListTable)
        logger.info('🗑️ [DELETE LOCAL] Updating local state - filtering out role:', role.id)
        const previousRoles = roles
        setRoles(prevRoles => {
          const filteredRoles = prevRoles.filter(r => r.id !== role.id)
          logger.info('🗑️ [DELETE LOCAL] Local state updated. Previous count:', previousRoles.length, 'New count:', filteredRoles.length)
          logger.info('🗑️ [DELETE LOCAL] Removed role:', role.name, 'Remaining roles:', filteredRoles.map(r => r.name))
          return filteredRoles
        })

        // Close dialog immediately
        setDeleteDialogOpen(false)
        setRoleToDelete(null)
        logger.info('🗑️ [DELETE DIALOG] Dialog closed')

        // Show success notification
        toast.success(t.navigation.roleDeletedSuccessfully.replace('${roleName}', role.name))
        logger.info('🗑️ [DELETE TOAST] Success toast shown')
      } else if (response.status === 400) {
        const data = await response.json()
        logger.info('🗑️ [DELETE ERROR 400] Delete failed with 400, data:', data)

        if (data.users) {
          setErrorMessage(t.navigation.roleDeleteError.replace('${roleName}', role.name))
          setRoleUsers(data.users)
          logger.info('🗑️ [DELETE ERROR 400] Error message set with users:', data.users.length)
        }

        setDeleteDialogOpen(false)
        setRoleToDelete(null)

        toast.error(t.navigation.roleDeleteError.replace('${roleName}', role.name))
      } else {
        logger.error('🗑️ [DELETE ERROR] Error deleting role - unexpected status')

        toast.error(t.navigation.roleDeleteFailed)
      }
    } catch (error) {
      logger.error('🗑️ [DELETE ERROR] Error deleting role:', error)

      // Show error notification
      toast.error(t.navigation.roleDeleteFailed)
    } finally {
      setIsDeleting(false)
      logger.info('🗑️ [DELETE FINISH] Set isDeleting to false')
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
              {(isSuperadmin || checkPermission('roleManagement', 'create')) && (
                <Button variant='contained' size='small'>
                  {t.navigation.addRole}
                </Button>
              )}
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
      {loading ? (
        <Grid container spacing={6} alignItems="stretch">
          {Array.from({ length: 6 }).map((_, index) => (
            <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={`skeleton-${index}`}>
              <Card>
                <CardContent className='flex flex-col gap-4'>
                  <div className='flex items-center justify-between'>
                    <Skeleton variant='rectangular' width={100} height={20} />
                    <div className='flex -space-x-2'>
                      {Array.from({ length: 3 }).map((_, avatarIndex) => (
                        <Skeleton
                          key={avatarIndex}
                          variant='circular'
                          width={32}
                          height={32}
                          className='border-2 border-white'
                        />
                      ))}
                    </div>
                  </div>
                  <div className='flex justify-between items-center'>
                    <div className='flex flex-col items-start gap-1'>
                      <div className='flex items-center gap-2'>
                        <Skeleton variant='rectangular' width={20} height={20} />
                        <Skeleton variant='rectangular' width={80} height={24} />
                      </div>
                      <Skeleton variant='rectangular' width={120} height={16} />
                    </div>
                    <div className='flex gap-2'>
                      <Skeleton variant='rectangular' width={32} height={32} />
                      <Skeleton variant='rectangular' width={32} height={32} />
                      <Skeleton variant='rectangular' width={32} height={32} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Grid container spacing={6} alignItems="stretch">
          {roles.map((role, index) => {
            const roleUsers = users.filter(user => user && user.role === role.name)

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
                        {(isSuperadmin || checkPermission('roleManagement', 'read')) && (
                          <OpenDialogOnElementClick
                            element={IconButton}
                            elementProps={{
                              children: <i className='ri-eye-line text-secondary mui-1vkcxi3' />
                            }}
                            dialog={RoleDialog}
                            dialogProps={{ title: role.name, roleId: role.id, onSuccess: handleRoleSuccess, readOnly: true }}
                          />
                        )}
                        {(isSuperadmin || checkPermission('roleManagement', 'update')) && (
                          <OpenDialogOnElementClick
                            element={IconButton}
                            elementProps={{
                              children: <i className='ri-edit-box-line text-secondary mui-1vkcxi3' />
                            }}
                            dialog={RoleDialog}
                            dialogProps={{ title: role.name, roleId: role.id, onSuccess: handleRoleSuccess }}
                          />
                        )}
                        {(isSuperadmin || checkPermission('roleManagement', 'delete')) && !['superadmin', 'subscriber', 'admin', 'user', 'moderator', 'seo', 'editor', 'marketolog', 'support', 'manager'].includes(role.name.toLowerCase()) && (
                          <IconButton
                            onClick={() => {
                              setRoleToDelete(role)
                              setDeleteDialogOpen(true)
                            }}
                            disabled={isDeleting}
                          >
                            <i className='ri-delete-bin-line text-secondary' />
                          </IconButton>
                        )}
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
      )}
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


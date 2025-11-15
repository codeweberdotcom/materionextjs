'use client'

// React Imports
import { useState, useEffect } from 'react'

// MUI Imports
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Checkbox from '@mui/material/Checkbox'
import FormGroup from '@mui/material/FormGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'

// Third-party Imports
import { toast } from 'react-toastify'

// Style Imports
import tableStyles from '@core/styles/table.module.css'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

type RoleDialogProps = {
  open: boolean
  setOpen: (open: boolean) => void
  title?: string
  roleId?: string
  onSuccess?: () => void
  readOnly?: boolean
}

type DataType =
  | string
  | {
      title: string
      read?: boolean
      write?: boolean
      select?: boolean
    }

const defaultData: string[] = [
  'userManagement',
  'roleManagement',
  'countryManagement',
  'currencyManagement',
  'stateManagement',
  'cityManagement',
  'districtManagement',
  'languageManagement',
  'translationManagement',
  'emailTemplatesManagement',
  'smtpManagement',
  'rateLimitManagement',
  'notifications',
  'chat'
]

const permissionIds = {
  userManagement: 'userManagement',
  roleManagement: 'roleManagement',
  countryManagement: 'countryManagement',
  currencyManagement: 'currencyManagement',
  stateManagement: 'stateManagement',
  cityManagement: 'cityManagement',
  districtManagement: 'districtManagement',
  languageManagement: 'languageManagement',
  translationManagement: 'translationManagement',
  emailTemplatesManagement: 'emailTemplatesManagement',
  smtpManagement: 'smtpManagement',
  rateLimitManagement: 'rateLimitManagement',
  notifications: 'notifications',
  chat: 'chat'
}

const allPermissions = defaultData.flatMap(item => {
  const id = (permissionIds as any)[item]

  return [`${id}-create`, `${id}-read`, `${id}-update`, `${id}-delete`]
})

const RoleDialog = ({ open, setOpen, title, roleId, onSuccess, readOnly = false }: RoleDialogProps) => {
  // Hooks
  const t = useTranslation()

  // States
  const [roleName, setRoleName] = useState<string>(title || '')
  const [roleDescription, setRoleDescription] = useState<string>('')
  const [selectedCheckbox, setSelectedCheckbox] = useState<string[]>([])
  const [isIndeterminateCheckbox, setIsIndeterminateCheckbox] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [isRoleLoading, setIsRoleLoading] = useState<boolean>(false)
  const [isSuperadmin, setIsSuperadmin] = useState<boolean>(false)
  const [isBaseRole, setIsBaseRole] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [currentUserRole, setCurrentUserRole] = useState<string>('')
  const [isCurrentUserRole, setIsCurrentUserRole] = useState<boolean>(false)

  const handleClose = () => {
    setOpen(false)
    setRoleName('')
    setRoleDescription('')
    setSelectedCheckbox([])
    setError('')
    setCurrentUserRole('')
    setIsCurrentUserRole(false)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    try {
      const url = roleId ? `/api/admin/roles/${roleId}` : '/api/admin/roles'
      const method = roleId ? 'PUT' : 'POST'

      const isAllSelected = selectedCheckbox.length === defaultData.length * 4
      const permissionsToSend = isAllSelected ? ['all'] : selectedCheckbox.reduce((acc, perm) => {
        // Find the module by matching the prefix
        const moduleEntry = Object.entries(permissionIds).find(([key, id]) => perm.startsWith(`${id}-`))
        if (moduleEntry) {
          const [moduleKey, moduleId] = moduleEntry
          const action = perm.replace(`${moduleId}-`, '')
          if (!acc[moduleKey]) acc[moduleKey] = []
          acc[moduleKey].push(action)
        }
        return acc
      }, {} as Record<string, string[]>)

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: roleName,
          description: roleDescription,
          permissions: permissionsToSend
        })
      })

      if (response.ok) {
        handleClose()

        if (onSuccess) {
          onSuccess()
        }

        toast.success(roleId ? t.navigation.roleUpdatedSuccessfully : t.navigation.roleCreatedSuccessfully)
      } else {
        const errorData = await response.json()

        setError(errorData.message || 'Error saving role')

        toast.error(errorData.message || 'Error saving role')
      }
    } catch (error) {
      setError((error as Error).message || 'Error saving role')

      toast.error((error as Error).message || 'Error saving role')
    } finally {
      setLoading(false)
    }
  }

  const togglePermission = (id: string) => {
    const newSelected = [...selectedCheckbox]

    if (newSelected.includes(id)) {
      newSelected.splice(newSelected.indexOf(id), 1)
    } else {
      newSelected.push(id)
    }

    setSelectedCheckbox(newSelected)
  }

  const handleSelectAllCheckbox = () => {
    if (selectedCheckbox.length === defaultData.length * 4) {
      setSelectedCheckbox([])
    } else {
      setSelectedCheckbox(allPermissions)
    }
  }

  useEffect(() => {
    if (selectedCheckbox.length > 0 && selectedCheckbox.length < defaultData.length * 4) {
      setIsIndeterminateCheckbox(true)
    } else {
      setIsIndeterminateCheckbox(false)
    }
  }, [selectedCheckbox])

  useEffect(() => {
    if (open && roleId) {
      setIsRoleLoading(true)
      const fetchRole = async () => {
        try {
          const response = await fetch(`/api/admin/roles/${roleId}`)

          if (response.ok) {
            const roleData = await response.json()

            setRoleName(roleData.name)
            setRoleDescription(roleData.description || '')

            // Check if it's a base role
            const baseRoles = ['superadmin', 'admin', 'manager', 'editor', 'moderator', 'seo', 'marketolog', 'support', 'subscriber', 'user']
            const isBaseRole = baseRoles.includes(roleData.name.toLowerCase())

            if (roleData.name.toLowerCase() === 'superadmin') {
              setSelectedCheckbox(allPermissions)
              setIsBaseRole(true)

              // isSuperadmin should be true only if the ROLE being edited is superadmin
              setIsSuperadmin(true)
            } else {
              try {
                const parsedPermissions = JSON.parse(roleData.permissions)
                if (parsedPermissions === 'all' || (Array.isArray(parsedPermissions) && parsedPermissions.includes('all'))) {
                  setSelectedCheckbox(allPermissions)
                } else if (typeof parsedPermissions === 'object' && parsedPermissions !== null) {
                  // Convert object to array of permissions
                  const permissionsArray = Object.entries(parsedPermissions).flatMap(([module, actions]) =>
                    (actions as string[]).map(action => `${(permissionIds as any)[module]}-${action}`)
                  )
                  setSelectedCheckbox(permissionsArray)
                } else {
                  setSelectedCheckbox([])
                }
              } catch {
                setSelectedCheckbox([])
              }

              setIsSuperadmin(false)
              setIsBaseRole(isBaseRole)
            }

            // Check if this is the current user's role
            try {
              const profileResponse = await fetch('/api/user/profile')

              if (profileResponse.ok) {
                const profileData = await profileResponse.json()

                setCurrentUserRole(profileData.role)
                setIsCurrentUserRole(roleData.name.toLowerCase() === profileData.role.toLowerCase())
              }
            } catch (profileError) {
              console.error('Error fetching user profile:', profileError)
            }
          }
        } catch (error) {
          console.error('Error fetching role:', error)
        } finally {
          setIsRoleLoading(false)
        }
      }

      fetchRole()
    } else if (open && !roleId) {
      // For new role
      setRoleName('')
      setRoleDescription('')
      setSelectedCheckbox([])
      setIsCurrentUserRole(false)
      setCurrentUserRole('')
      setError('')
      setIsRoleLoading(false)
    }
  }, [open, roleId])

  return (
    <Dialog fullWidth maxWidth='md' scroll='body' open={open} onClose={handleClose} closeAfterTransition={false}>
      <DialogTitle variant='h4' className='flex flex-col gap-2 text-center sm:pbs-16 sm:pbe-6 sm:pli-16'>
        {readOnly ? t.navigation.viewRoleTitle : (roleId ? t.navigation.editRoleTitle : t.navigation.addRoleTitle)}
        <Typography component='span' className='flex flex-col text-center'>
          {readOnly ? t.navigation.viewRolePermissions : t.navigation.setRolePermissions}
        </Typography>
      </DialogTitle>
      {error && (
        <Typography color="error" variant="body2" className="text-center sm:px-16">
          {error}
        </Typography>
      )}
      <form onSubmit={e => e.preventDefault()}>
        <DialogContent className='overflow-visible pbs-0 sm:pli-16'>
          <IconButton onClick={handleClose} className='absolute block-start-4 inline-end-4'>
            <i className='ri-close-line text-textSecondary' />
          </IconButton>
          {roleId && isRoleLoading ? (
            <div className='flex flex-col gap-4'>
              <Skeleton variant='rectangular' height={56} />
              <Skeleton variant='rectangular' height={56} />
              <Skeleton variant='text' width='40%' />
              {[0, 1, 2, 3].map(index => (
                <Skeleton key={`role-skeleton-${index}`} variant='rectangular' height={64} />
              ))}
            </div>
          ) : (
            <>
              <TextField
                label={t.navigation.roleName}
                variant='outlined'
                fullWidth
                placeholder={t.navigation.roleName}
                value={roleName}
                onChange={e => setRoleName(e.target.value)}
                disabled={readOnly}
              />
              <div className='mb-4' />
              <TextField
                label={t.navigation.roleDescription}
                variant='outlined'
                fullWidth
                placeholder={t.navigation.roleDescription}
                value={roleDescription}
                onChange={e => setRoleDescription(e.target.value)}
                disabled={readOnly}
              />
              <Typography variant='h5' className='plb-6'>
                {t.navigation.rolesPermissions}
              </Typography>
              <div className='flex flex-col overflow-x-auto'>
                <table className={tableStyles.table}>
                  <tbody>
                    <tr>
                      <th className='pis-0'>
                        <Typography className='font-medium whitespace-nowrap flex-grow min-is-[225px]' color='text.primary'>
                          {t.navigation.adminAccess}
                        </Typography>
                      </th>
                      <th className='!text-end pie-0'>
                        {!readOnly && (
                          <FormControlLabel
                            className='mie-0 capitalize'
                            control={
                              <Checkbox
                                onChange={handleSelectAllCheckbox}
                                indeterminate={isIndeterminateCheckbox}
                                checked={selectedCheckbox.length === defaultData.length * 4}
                              />
                            }
                            label={t.navigation.selectAll}
                          />
                        )}
                      </th>
                    </tr>
                    {defaultData.map((item, index) => {
                      const id = permissionIds[item as keyof typeof permissionIds]

                      return (
                        <tr key={index}>
                          <td className='pis-0'>
                            <Typography
                              className='font-medium whitespace-nowrap flex-grow min-is-[225px]'
                              color='text.primary'
                            >
                              {t.navigation[item as keyof typeof t.navigation]}
                            </Typography>
                          </td>
                          <td className='!text-end pie-0'>
                            <FormGroup className='flex-row gap-4 flex-nowrap justify-end'>
                              <FormControlLabel
                                className='mie-0'
                                control={
                                  <Checkbox
                                    id={`${id}-create`}
                                    onChange={() => togglePermission(`${id}-create`)}
                                    checked={selectedCheckbox.includes(`${id}-create`)}
                                    disabled={readOnly}
                                  />
                                }
                                label={t.navigation.create}
                              />
                              <FormControlLabel
                                className='mie-0'
                                control={
                                  <Checkbox
                                    id={`${id}-read`}
                                    onChange={() => togglePermission(`${id}-read`)}
                                    checked={selectedCheckbox.includes(`${id}-read`)}
                                    disabled={readOnly}
                                  />
                                }
                                label={t.navigation.readPermission}
                              />
                              <FormControlLabel
                                className='mie-0'
                                control={
                                  <Checkbox
                                    id={`${id}-update`}
                                    onChange={() => togglePermission(`${id}-update`)}
                                    checked={selectedCheckbox.includes(`${id}-update`)}
                                    disabled={readOnly}
                                  />
                                }
                                label={t.navigation.update}
                              />
                              <FormControlLabel
                                className='mie-0 text-textPrimary'
                                control={
                                  <Checkbox
                                    id={`${id}-delete`}
                                    onChange={() => togglePermission(`${id}-delete`)}
                                    checked={selectedCheckbox.includes(`${id}-delete`)}
                                    disabled={readOnly}
                                  />
                                }
                                label={t.navigation.delete}
                              />
                            </FormGroup>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DialogContent>
        <DialogActions className='justify-center pbs-0 sm:pbe-16 sm:pli-16'>
          {!readOnly && (
            <>
              <Button variant='contained' type='submit' onClick={handleSubmit} disabled={loading}>
                {loading ? t.navigation.saving : t.navigation.submit}
              </Button>
              <Button variant='outlined' type='button' color='secondary' onClick={handleClose}>
                {t.navigation.cancel}
              </Button>
            </>
          )}
          {readOnly && (
            <Button variant='outlined' type='button' color='secondary' onClick={handleClose}>
              {t.navigation.close}
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default RoleDialog


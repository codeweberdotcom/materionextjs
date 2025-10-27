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
}

type DataType =
  | string
  | {
      title: string
      read?: boolean
      write?: boolean
      select?: boolean
    }

const defaultData: DataType[] = [
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
  'smtpManagement'
]

const permissionIds = {
  userManagement: 'user-management',
  roleManagement: 'role-management',
  countryManagement: 'country-management',
  currencyManagement: 'currency-management',
  stateManagement: 'state-management',
  cityManagement: 'city-management',
  districtManagement: 'district-management',
  languageManagement: 'language-management',
  translationManagement: 'translation-management',
  emailTemplatesManagement: 'email-templates-management',
  smtpManagement: 'smtp-management'
}

const allPermissions = defaultData.flatMap(item => {
  const id = permissionIds[item as keyof typeof permissionIds]
  return [`${id}-read`, `${id}-write`, `${id}-create`]
})

const RoleDialog = ({ open, setOpen, title, roleId, onSuccess }: RoleDialogProps) => {
  // Hooks
  const t = useTranslation()

  // States
  const [roleName, setRoleName] = useState<string>(title || '')
  const [roleDescription, setRoleDescription] = useState<string>('')
  const [selectedCheckbox, setSelectedCheckbox] = useState<string[]>([])
  const [isIndeterminateCheckbox, setIsIndeterminateCheckbox] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
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

      const isAllSelected = selectedCheckbox.length === defaultData.length * 3
      const permissionsToSend = isAllSelected ? ['all'] : selectedCheckbox

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
        // Show success notification
        toast.success(
          roleId
            ? `${t.navigation.role} "${roleName}" ${t.navigation.updated} ${t.navigation.successfully}`
            : `${t.navigation.role} "${roleName}" ${t.navigation.created} ${t.navigation.successfully}`
        )
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Error saving role')
        // Show error notification
        toast.error(errorData.message || 'Error saving role')
      }
    } catch (error) {
      setError((error as Error).message || 'Error saving role')
      // Show error notification
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
    if (selectedCheckbox.length === defaultData.length * 3) {
      setSelectedCheckbox([])
    } else {
      setSelectedCheckbox(allPermissions)
    }
  }

  useEffect(() => {
    if (selectedCheckbox.length > 0 && selectedCheckbox.length < defaultData.length * 3) {
      setIsIndeterminateCheckbox(true)
    } else {
      setIsIndeterminateCheckbox(false)
    }
  }, [selectedCheckbox])

  useEffect(() => {
    if (open && roleId) {
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
              if (roleData.permissions.includes('all')) {
                setSelectedCheckbox(allPermissions)
              } else {
                setSelectedCheckbox(roleData.permissions || [])
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
    }
  }, [open, roleId])

  return (
    <Dialog fullWidth maxWidth='md' scroll='body' open={open} onClose={handleClose} closeAfterTransition={false}>
      <DialogTitle variant='h4' className='flex flex-col gap-2 text-center sm:pbs-16 sm:pbe-6 sm:pli-16'>
        {roleId ? t.navigation.editRoleTitle : t.navigation.addRoleTitle}
        <Typography component='span' className='flex flex-col text-center'>
          {t.navigation.setRolePermissions}
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
          <TextField
            label={t.navigation.roleName}
            variant='outlined'
            fullWidth
            placeholder={t.navigation.roleName}
            value={roleName}
            onChange={e => setRoleName(e.target.value)}
          />
          <div className='mb-4' />
          <TextField
            label={t.navigation.roleDescription}
            variant='outlined'
            fullWidth
            placeholder={t.navigation.roleDescription}
            value={roleDescription}
            onChange={e => setRoleDescription(e.target.value)}
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
                    <FormControlLabel
                      className='mie-0 capitalize'
                      control={
                        <Checkbox
                          onChange={handleSelectAllCheckbox}
                          indeterminate={isIndeterminateCheckbox}
                          checked={selectedCheckbox.length === defaultData.length * 3}
                        />
                      }
                      label={t.navigation.selectAll}
                    />
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
                          {typeof item === 'object' ? item.title : t.navigation[item as keyof typeof t.navigation]}
                        </Typography>
                      </td>
                      <td className='!text-end pie-0'>
                        {typeof item === 'object' ? (
                          <FormGroup className='flex-row gap-6 flex-nowrap justify-end'>
                            <FormControlLabel
                              className='mie-0'
                              control={<Checkbox checked={item.read} disabled={isCurrentUserRole || (isSuperadmin && currentUserRole.toLowerCase() !== 'superadmin')} />}
                              label={t.navigation.read}
                            />
                            <FormControlLabel
                              className='mie-0'
                              control={<Checkbox checked={item.write} disabled={isSuperadmin || isCurrentUserRole} />}
                              label={t.navigation.write}
                            />
                            <FormControlLabel
                              className='mie-0'
                              control={<Checkbox checked={item.select} disabled={isSuperadmin || isCurrentUserRole} />}
                              label={t.navigation.delete}
                            />
                          </FormGroup>
                        ) : (
                          <FormGroup className='flex-row gap-6 flex-nowrap justify-end'>
                            <FormControlLabel
                              className='mie-0'
                              control={
                                <Checkbox
                                  id={`${id}-read`}
                                  onChange={() => togglePermission(`${id}-read`)}
                                  checked={selectedCheckbox.includes(`${id}-read`)}
                                />
                              }
                              label={t.navigation.read}
                            />
                            <FormControlLabel
                              className='mie-0'
                              control={
                                <Checkbox
                                  id={`${id}-write`}
                                  onChange={() => togglePermission(`${id}-write`)}
                                  checked={selectedCheckbox.includes(`${id}-write`)}
                                />
                              }
                              label={t.navigation.write}
                            />
                            <FormControlLabel
                              className='mie-0 text-textPrimary'
                              control={
                                <Checkbox
                                  id={`${id}-create`}
                                  onChange={() => togglePermission(`${id}-create`)}
                                  checked={selectedCheckbox.includes(`${id}-create`)}
                                />
                              }
                              label={t.navigation.create}
                            />
                          </FormGroup>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
        <DialogActions className='justify-center pbs-0 sm:pbe-16 sm:pli-16'>
          <Button variant='contained' type='submit' onClick={handleSubmit} disabled={loading}>
            {loading ? t.navigation.saving : t.navigation.submit}
          </Button>
          <Button variant='outlined' type='reset' color='secondary' onClick={handleClose}>
            {t.navigation.cancel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default RoleDialog


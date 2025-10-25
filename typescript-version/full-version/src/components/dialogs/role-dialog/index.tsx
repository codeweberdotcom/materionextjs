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
  'User Management',
  'Content Management',
  'Disputes Management',
  'Database Management',
  'Financial Management',
  'Reporting',
  'API Control',
  'Repository Management',
  'Payroll'
]

const RoleDialog = ({ open, setOpen, title, roleId, onSuccess }: RoleDialogProps) => {
  // Hooks
  const t = useTranslation()

  // States
  const [roleName, setRoleName] = useState<string>(title || '')
  const [roleDescription, setRoleDescription] = useState<string>('')
  const [selectedCheckbox, setSelectedCheckbox] = useState<string[]>([])
  const [isIndeterminateCheckbox, setIsIndeterminateCheckbox] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)

  const handleClose = () => {
    setOpen(false)
    setRoleName('')
    setRoleDescription('')
    setSelectedCheckbox([])
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const url = roleId ? `/api/admin/roles/${roleId}` : '/api/admin/roles'
      const method = roleId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: roleName,
          description: roleDescription,
          permissions: selectedCheckbox
        })
      })

      if (response.ok) {
        handleClose()
        if (onSuccess) {
          onSuccess()
        }
      } else {
        console.error('Error saving role')
      }
    } catch (error) {
      console.error('Error saving role:', error)
    } finally {
      setLoading(false)
    }
  }

  const togglePermission = (id: string) => {
    const arr = selectedCheckbox

    if (selectedCheckbox.includes(id)) {
      arr.splice(arr.indexOf(id), 1)
      setSelectedCheckbox([...arr])
    } else {
      arr.push(id)
      setSelectedCheckbox([...arr])
    }
  }

  const handleSelectAllCheckbox = () => {
    if (isIndeterminateCheckbox) {
      setSelectedCheckbox([])
    } else {
      defaultData.forEach(row => {
        const id = (typeof row === 'string' ? row : row.title).toLowerCase().split(' ').join('-')

        togglePermission(`${id}-read`)
        togglePermission(`${id}-write`)
        togglePermission(`${id}-create`)
      })
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
            setSelectedCheckbox(roleData.permissions || [])
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
    }
  }, [open, roleId])

  return (
    <Dialog fullWidth maxWidth='md' scroll='body' open={open} onClose={handleClose} closeAfterTransition={false}>
      <DialogTitle variant='h4' className='flex flex-col gap-2 text-center sm:pbs-16 sm:pbe-6 sm:pli-16'>
        {roleId ? t.navigation.editRoleTitle : t.navigation.addRoleTitle}
        <Typography component='span' className='flex flex-col text-center'>
          Установить разрешения роли
        </Typography>
      </DialogTitle>
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
                      Доступ администратора
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
                      label='Выбрать все'
                    />
                  </th>
                </tr>
                {defaultData.map((item, index) => {
                  const id = (typeof item === 'string' ? item : item.title).toLowerCase().split(' ').join('-')

                  return (
                    <tr key={index}>
                      <td className='pis-0'>
                        <Typography
                          className='font-medium whitespace-nowrap flex-grow min-is-[225px]'
                          color='text.primary'
                        >
                          {typeof item === 'object' ? item.title : item}
                        </Typography>
                      </td>
                      <td className='!text-end pie-0'>
                        {typeof item === 'object' ? (
                          <FormGroup className='flex-row gap-6 flex-nowrap justify-end'>
                            <FormControlLabel
                              className='mie-0'
                              control={<Checkbox checked={item.read} />}
                              label='Чтение'
                            />
                            <FormControlLabel
                              className='mie-0'
                              control={<Checkbox checked={item.write} />}
                              label='Запись'
                            />
                            <FormControlLabel
                              className='mie-0'
                              control={<Checkbox checked={item.select} />}
                              label='Select'
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
                              label='Read'
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
                              label='Write'
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
                              label='Создание'
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
            {loading ? 'Сохранение...' : 'Отправить'}
          </Button>
          <Button variant='outlined' type='reset' color='secondary' onClick={handleClose}>
            Отмена
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default RoleDialog

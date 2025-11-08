'use client'

// React Imports
import { useState, useEffect } from 'react'

// MUI Imports
import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import FormControl from '@mui/material/FormControl'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import FormHelperText from '@mui/material/FormHelperText'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Autocomplete from '@mui/material/Autocomplete'

// Third-party Imports
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'react-toastify'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Types Imports
import type { UsersType } from '@/types/apps/userTypes'

type Props = {
  open: boolean
  handleClose: () => void
  userData?: UsersType[]
  setData: (data: UsersType[]) => void
  editUser?: UsersType
}

type FormValidateType = {
  firstName: string
  lastName: string
  username: string
  email: string
  role: string
  plan: string
  status: string
}

type FormNonValidateType = {
  company: string
  country: string
  contact: string
  avatar: File | null
}

type Role = {
  id: string
  name: string
  description?: string | null
  permissions?: string | null
  createdAt: Date
  updatedAt: Date
}

type Country = {
  id: string
  name: string
  code: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Vars
const initialData = {
  company: '',
  country: '',
  contact: '',
  avatar: null
}

const AddUserDrawer = (props: Props) => {
  // Props
  const { open, handleClose, userData, setData, editUser } = props

  // Hooks
  const dictionary = useTranslation()

  // States
  const [formData, setFormData] = useState<FormNonValidateType>(initialData)
  const [roles, setRoles] = useState<Role[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [loading, setLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [isEditingOwnProfile, setIsEditingOwnProfile] = useState<boolean>(false)

  // Hooks
  const {
    control,
    reset: resetForm,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValidateType>({
    defaultValues: {
      firstName: editUser?.fullName?.split(' ')[0] || '',
      lastName: editUser?.fullName?.split(' ').slice(1).join(' ') || '',
      username: editUser?.username || '',
      email: editUser?.email || '',
      role: editUser?.role || '',
      plan: editUser?.currentPlan || '',
      status: editUser?.status || '',

      // avatar is not in the form
    },
    mode: 'onChange'
  })

  // Fetch roles and countries
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      try {
        const [rolesResponse, countriesResponse] = await Promise.all([
          fetch('/api/admin/roles'),
          fetch('/api/admin/references/countries')
        ])

        if (rolesResponse.ok) {
          const rolesData = await rolesResponse.json()

          setRoles(rolesData)
        }

        if (countriesResponse.ok) {
          const countriesData = await countriesResponse.json()

          setCountries(countriesData)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (open) {
      fetchData()
    }
  }, [open])

  // Set formData and reset form when editUser changes
  useEffect(() => {
    if (editUser) {
      setFormData({
        company: editUser.company || '',
        country: editUser.country || '',
        contact: editUser.contact || '',
        avatar: null
      })
      resetForm({
        firstName: editUser.fullName?.split(' ')[0] || '',
        lastName: editUser.fullName?.split(' ').slice(1).join(' ') || '',
        username: editUser.username || '',
        email: editUser.email || '',
        role: editUser.role || '',
        plan: editUser.currentPlan || '',
        status: editUser.status || '',

        // avatar is not in the form
      })
    } else {
      setFormData(initialData)
      resetForm({ firstName: '', lastName: '', username: '', email: '', role: '', plan: '', status: '' })
    }
  }, [editUser, resetForm])

  // Check if editing own profile
  useEffect(() => {
    if (editUser && currentUserId) {
      setIsEditingOwnProfile(editUser.id === currentUserId)
    }
  }, [editUser, currentUserId])

  const onSubmit = async (data: FormValidateType) => {
    // Validate required fields
    if (!isEditingOwnProfile && !data.role) {
      toast.error(dictionary.navigation.roleRequired)
      
return
    }

    const formDataToSend = new FormData()

    formDataToSend.append('fullName', `${data.firstName} ${data.lastName}`.trim())
    formDataToSend.append('username', data.username)
    formDataToSend.append('email', data.email)

    if (!isEditingOwnProfile) {
      formDataToSend.append('role', data.role)
    }

    formDataToSend.append('plan', data.plan)
    formDataToSend.append('status', data.status)
    formDataToSend.append('company', formData.company)
    formDataToSend.append('country', formData.country)
    formDataToSend.append('contact', formData.contact)

    if (formData.avatar) {
      formDataToSend.append('avatar', formData.avatar)
    }

    if (editUser) {
      // Edit user
      try {
        const response = await fetch(`/api/admin/users/${editUser.id}`, {
          method: 'PUT',
          body: formDataToSend
        })

        if (response.ok) {
          const updatedUser = await response.json()

          const updatedData = (userData || []).map(user =>
            user.id === updatedUser.id ? updatedUser : user
          )

          setData(updatedData)
          toast.success(dictionary.navigation.updateUser + ' ' + dictionary.navigation.successfully)
        } else {
          // Removed error toast notification for user update
        }
      } catch (error) {
        console.error('Error updating user:', error)
        toast.error('Failed to ' + dictionary.navigation.updateUser.toLowerCase())
      }
    } else {
      // Add new user
      try {
        const response = await fetch('/api/admin/users', {
          method: 'POST',
          body: formDataToSend
        })

        if (response.ok) {
          const newUser = await response.json()

          setData([...(userData ?? []), newUser])
          toast.success(dictionary.navigation.addNewUser + ' ' + dictionary.navigation.successfully)
        } else {
          toast.error('Failed to ' + dictionary.navigation.addNewUser.toLowerCase())
        }
      } catch (error) {
        console.error('Error creating user:', error)
        // Removed error toast notification for user creation
      }
    }

    handleClose()
    setFormData(initialData)
    resetForm({ firstName: '', lastName: '', username: '', email: '', role: '', plan: '', status: '' })
  }

  const handleReset = () => {
    handleClose()
    setFormData(initialData)
  }

  return (
    <Drawer
      open={open}
      anchor='right'
      variant='temporary'
      onClose={handleReset}
      ModalProps={{ keepMounted: true }}
      sx={{ '& .MuiDrawer-paper': { width: { xs: 300, sm: 400 } } }}
    >
      <div className='flex items-center justify-between pli-5 plb-4'>
        <Typography variant='h5'>{editUser ? dictionary.navigation.editUserTitle : dictionary.navigation.addUserTitle}</Typography>
        <IconButton size='small' onClick={handleReset}>
          <i className='ri-close-line text-2xl' />
        </IconButton>
      </div>
      <Divider />
      <div className='p-5'>
        <form onSubmit={handleSubmit(data => onSubmit(data))} className='flex flex-col gap-5'>
          <div className='flex gap-4'>
            <Controller
              name='firstName'
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={dictionary.navigation.firstName}
                  placeholder='John'
                  {...(errors.firstName && { error: true, helperText: dictionary.navigation.fieldRequired })}
                />
              )}
            />
            <Controller
              name='lastName'
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={dictionary.navigation.lastName}
                  placeholder='Doe'
                  {...(errors.lastName && { error: true, helperText: dictionary.navigation.fieldRequired })}
                />
              )}
            />
          </div>
          <Controller
            name='username'
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label={dictionary.navigation.username}
                placeholder='johndoe'
                {...(errors.username && { error: true, helperText: dictionary.navigation.fieldRequired })}
              />
            )}
          />
          <Controller
            name='email'
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                type='email'
                label={dictionary.navigation.email}
                placeholder='johndoe@gmail.com'
                {...(errors.email && { error: true, helperText: dictionary.navigation.fieldRequired })}
              />
            )}
          />
         <FormControl fullWidth>
           <InputLabel id='role' error={Boolean(errors.role)}>
             {dictionary.navigation.selectRoleFilter}
           </InputLabel>
           <Controller
             name='role'
             control={control}
             rules={{ required: !isEditingOwnProfile }}
             render={({ field }) => (
               <Select
                 label={dictionary.navigation.selectRoleFilter}
                 {...field}
                 error={Boolean(errors.role)}
                 disabled={loading || isEditingOwnProfile}
               >
                 {roles.map(role => (
                   <MenuItem key={role.id} value={role.name}>
                     {role.name}
                   </MenuItem>
                 ))}
               </Select>
             )}
           />
           {errors.role && !isEditingOwnProfile && <FormHelperText error>{dictionary.navigation.fieldRequired}</FormHelperText>}
         </FormControl>
         <FormControl fullWidth>
            <InputLabel id='country' error={Boolean(errors.plan)}>
              {dictionary.navigation.selectPlanFilter}
            </InputLabel>
            <Controller
              name='plan'
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <Select label={dictionary.navigation.selectPlanFilter} {...field} error={Boolean(errors.plan)}>
                  <MenuItem value='basic'>Basic</MenuItem>
                  <MenuItem value='company'>Company</MenuItem>
                  <MenuItem value='enterprise'>Enterprise</MenuItem>
                  <MenuItem value='team'>Team</MenuItem>
                </Select>
              )}
            />
            {errors.plan && <FormHelperText error>{dictionary.navigation.fieldRequired}</FormHelperText>}
          </FormControl>
          <FormControl fullWidth>
            <InputLabel id='country' error={Boolean(errors.status)}>
              {dictionary.navigation.selectStatusFilter}
            </InputLabel>
            <Controller
              name='status'
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <Select label={dictionary.navigation.selectStatusFilter} {...field} error={Boolean(errors.status)}>
                  <MenuItem value='pending'>Pending</MenuItem>
                  <MenuItem value='active'>Active</MenuItem>
                  <MenuItem value='inactive'>Inactive</MenuItem>
                </Select>
              )}
            />
            {errors.status && <FormHelperText error>{dictionary.navigation.fieldRequired}</FormHelperText>}
          </FormControl>
          <TextField
            fullWidth
            type='file'
            label={dictionary.navigation.avatar}
            inputProps={{ accept: 'image/*' }}
            InputLabelProps={{
              shrink: true,
            }}
            onChange={e => setFormData({ ...formData, avatar: (e.target as HTMLInputElement).files?.[0] || null })}

            // avatar is not in the form
          />
          <TextField
            label={dictionary.navigation.company}
            fullWidth
            placeholder='Company PVT LTD'
            value={formData.company}
            onChange={e => setFormData({ ...formData, company: e.target.value })}
          />
          <Autocomplete
            fullWidth
            options={countries}
            getOptionLabel={(option) => option.name}
            value={countries.find(c => c.name === formData.country) || null}
            onChange={(event, newValue) => setFormData({ ...formData, country: newValue?.name || '' })}
            renderInput={(params) => (
              <TextField
                {...params}
                label={dictionary.navigation.selectCountry}
                disabled={loading}
              />
            )}
            disabled={loading}
          />
          <TextField
            label={dictionary.navigation.contact}
            type='number'
            fullWidth
            placeholder='(397) 294-5153'
            value={formData.contact}
            onChange={e => setFormData({ ...formData, contact: e.target.value })}
          />
          <div className='flex items-center gap-4'>
            <Button variant='contained' type='submit' disabled={loading}>
              {dictionary.navigation.submit}
            </Button>
            <Button variant='outlined' color='error' type='reset' onClick={() => handleReset()}>
              {dictionary.navigation.cancel}
            </Button>
          </div>
        </form>
      </div>
    </Drawer>
  )
}

export default AddUserDrawer

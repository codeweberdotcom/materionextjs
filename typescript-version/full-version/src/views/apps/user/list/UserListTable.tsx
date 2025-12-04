'use client'

// React Imports
import { useEffect, useState, useMemo } from 'react'

// Next Imports
import Link from 'next/link'
import { useParams } from 'next/navigation'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import Switch from '@mui/material/Switch'
import InputAdornment from '@mui/material/InputAdornment'
import { styled } from '@mui/material/styles'
import TablePagination from '@mui/material/TablePagination'
import type { TextFieldProps } from '@mui/material/TextField'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'

// Third-party Imports
import classnames from 'classnames'
import { rankItem } from '@tanstack/match-sorter-utils'
import Skeleton from '@mui/material/Skeleton'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnFiltersState,
  type Column
} from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import type { RankingInfo } from '@tanstack/match-sorter-utils'
import { toast } from 'react-toastify'

// Type Imports
import type { ThemeColor } from '@core/types'
import type { UsersType } from '@/types/apps/userTypes'
import type { Locale } from '@configs/i18n'

// Component Imports
import AddUserDrawer from './AddUserDrawer'
import OptionMenu from '@core/components/option-menu'
import CustomAvatar from '@core/components/mui/Avatar'
import UserDeletionDialog from '@components/dialogs/user-deletion-dialog'
import AvatarWithBadge from '@views/apps/chat/AvatarWithBadge'
import ExportButton from '@/components/export/ExportButton'
import ImportDialog from '@/components/import/ImportDialog'
import { statusObj } from '@/utils/status'
import { usePresence } from '@/contexts/PresenceProvider'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'
import { useAuth } from '@/contexts/AuthProvider'

// Hook Imports
import { usePermissions } from '@/hooks/usePermissions'

// Util Imports
import { getInitials } from '@/utils/formatting/getInitials'
import { useUnreadByContact } from '@/hooks/useUnreadByContact'
import { getLocalizedUrl } from '@/utils/formatting/i18n'

// Style Imports
import tableStyles from '@core/styles/table.module.css'

type UsersTypeWithAction = UsersType & {
  action?: string
}

type UserRoleType = {
  [key: string]: { icon: string; color: string }
}

type UserStatusType = {
  [key: string]: ThemeColor
}

// Styled Components
const Icon = styled('i')({})

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  // Rank the item
  const itemRank = rankItem(row.getValue(columnId), value)

  // Store the itemRank info
  addMeta({
    itemRank
  })

  // Return if the item should be filtered in/out
  return itemRank.passed
}

const statusFilterFn: FilterFn<UsersTypeWithAction> = (row, columnId, value) => {
  if (!value) return true

  return row.getValue(columnId) === value
}

const onlineFilterFn: FilterFn<UsersTypeWithAction> = (row, columnId, value) => {
  if (!value) return true

  return row.getValue(columnId) === value
}

const roleFilterFn: FilterFn<UsersTypeWithAction> = (row, columnId, value) => {
  if (!value) return true

  return row.getValue(columnId) === value
}

const planFilterFn: FilterFn<UsersTypeWithAction> = (row, columnId, value) => {
  if (!value) return true

  return row.getValue(columnId) === value
}

const DebouncedInput = ({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}: {
  value: string | number
  onChange: (value: string | number) => void
  debounce?: number
} & Omit<TextFieldProps, 'onChange'>) => {
  // States
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value)
    }, debounce)

    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <TextField
      {...props}
      value={value}
      onChange={e => setValue(e.target.value)}
      size='small'
      InputProps={{
        startAdornment: (
          <InputAdornment position='start'>
            <i className='ri-search-line text-[18px] text-textSecondary' />
          </InputAdornment>
        )
      }}
    />
  )
}

const FilterSelect = styled(Select)(({ theme }) => ({
  minWidth: 150,
  '& .MuiSelect-select': {
    padding: theme.spacing(1.75, 2),
    textTransform: 'none',
    color: 'var(--mui-palette-text-disabled)'
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--mui-palette-divider)'
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--mui-palette-text-secondary)'
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--mui-palette-primary-main)'
  }
}))

const ColumnFilter = ({
  column,
  placeholder,
  dictionary,
  roleOptions
}: {
  column: Column<UsersTypeWithAction, unknown>
  placeholder: string
  dictionary: ReturnType<typeof useTranslation>
  roleOptions: string[]
}) => {
  const columnFilterValue = column.getFilterValue()

  if (column.id === 'status' || column.id === 'onlineStatus') {
    const renderStatusLabel = (value: string) => {
      if (column.id === 'onlineStatus') {
        if (value === 'online') return dictionary.navigation.online || 'Online'
        if (value === 'offline') return dictionary.navigation.offline || 'Offline'
      } else {
        if (value === 'active') return dictionary.navigation.active
        if (value === 'inactive') return dictionary.navigation.inactive
        if (value === 'pending') return 'Pending'
        if (value === 'block') return 'Block'
      }

      return ''
    }

    return (
            <FormControl fullWidth size='small' sx={{ '& .MuiSelect-select': { py: 1.75 } }}>
              <FilterSelect
                value={(columnFilterValue ?? '') as string}
                onChange={e => column.setFilterValue(e.target.value)}
                displayEmpty
                renderValue={selected => {
            if (!selected) {
              if (column.id === 'onlineStatus') {
                return dictionary.navigation.all || 'All'
              }

              return <span className='text-textSecondary'>{placeholder}</span>
            }

            return renderStatusLabel(selected as string)
          }}
        >
          <MenuItem value='' sx={{ textTransform: 'none' }}>
            {column.id === 'onlineStatus' ? dictionary.navigation.all || 'All' : <span className='text-textSecondary'>{placeholder}</span>}
          </MenuItem>
          {column.id === 'onlineStatus'
            ? [
                <MenuItem
                  key='online'
                  value='online'
                  sx={{ textTransform: 'none', color: 'var(--mui-palette-text-primary)' }}
                >
                  {dictionary.navigation.online || 'Online'}
                </MenuItem>,
                <MenuItem
                  key='offline'
                  value='offline'
                  sx={{ textTransform: 'none', color: 'var(--mui-palette-text-primary)' }}
                >
                  {dictionary.navigation.offline || 'Offline'}
                </MenuItem>
              ]
            : [
                <MenuItem
                  key='pending'
                  value='pending'
                  sx={{ textTransform: 'none', color: 'var(--mui-palette-text-primary)' }}
                >
                  Pending
                </MenuItem>,
              <MenuItem
                key='active'
                value='active'
                sx={{ textTransform: 'none', color: 'var(--mui-palette-text-primary)' }}
              >
                {dictionary.navigation.active}
              </MenuItem>,
              <MenuItem
                key='inactive'
                value='inactive'
                sx={{ textTransform: 'none', color: 'var(--mui-palette-text-primary)' }}
              >
                {dictionary.navigation.inactive}
              </MenuItem>,
              <MenuItem
                key='block'
                value='block'
                sx={{ textTransform: 'none', color: 'var(--mui-palette-text-primary)' }}
              >
                Block
              </MenuItem>
            ]}
        </FilterSelect>
      </FormControl>
    )
  }

  if (column.id === 'role') {
    return (
      <FormControl fullWidth size='small' sx={{ '& .MuiSelect-select': { py: 1.75 } }}>
        <FilterSelect
          value={(columnFilterValue ?? '') as string}
          onChange={e => column.setFilterValue(e.target.value)}
          displayEmpty
          renderValue={selected => {
            if (!selected) return <span className='text-textSecondary'>{placeholder}</span>

            return selected as string
          }}
        >
          <MenuItem value='' sx={{ textTransform: 'none' }}>
            <span className='text-textSecondary'>{placeholder}</span>
          </MenuItem>
          {(roleOptions.length ? roleOptions : Object.keys(userRoleObj)).map(roleKey => (
            <MenuItem
              key={roleKey}
              value={roleKey}
              sx={{ textTransform: 'none', color: 'var(--mui-palette-text-primary)' }}
            >
              {roleKey}
            </MenuItem>
          ))}
        </FilterSelect>
      </FormControl>
    )
  }

  if (column.id === 'currentPlan') {
    const planOptions = ['basic', 'team', 'company', 'enterprise']

    return (
      <FormControl fullWidth size='small'>
        <FilterSelect
          value={(columnFilterValue ?? '') as string}
          onChange={e => column.setFilterValue(e.target.value)}
          displayEmpty
          renderValue={selected => {
            if (!selected) return <span className='text-textSecondary'>{placeholder}</span>

            return (selected as string).charAt(0).toUpperCase() + (selected as string).slice(1)
          }}
        >
            <MenuItem value='' sx={{ textTransform: 'none' }}>
              <span className='text-textSecondary'>{placeholder}</span>
            </MenuItem>
            {planOptions.map(plan => (
              <MenuItem key={plan} value={plan} sx={{ textTransform: 'none', color: 'var(--mui-palette-text-primary)' }}>
              {plan.charAt(0).toUpperCase() + plan.slice(1)}
            </MenuItem>
          ))}
        </FilterSelect>
      </FormControl>
    )
  }

  return (
    <TextField
      fullWidth
      size='small'
      value={(columnFilterValue ?? '') as string}
      onChange={e => column.setFilterValue(e.target.value)}
      placeholder={placeholder}
      InputProps={{
        startAdornment: (
          <InputAdornment position='start'>
            <i className='ri-search-line text-[18px] text-textSecondary' />
          </InputAdornment>
        )
      }}
    />
  )
}

// Vars
const userRoleObj: UserRoleType = {
  superadmin: { icon: 'ri-vip-crown-line', color: 'warning' },
  admin: { icon: 'ri-vip-crown-line', color: 'error' },
  author: { icon: 'ri-computer-line', color: 'warning' },
  editor: { icon: 'ri-edit-box-line', color: 'info' },
  maintainer: { icon: 'ri-pie-chart-2-line', color: 'success' },
  subscriber: { icon: 'ri-user-3-line', color: 'primary' }
}

const userStatusObj: UserStatusType = {
  active: 'success',
  pending: 'warning',
  inactive: 'secondary'
}

// Column Definitions
const columnHelper = createColumnHelper<UsersTypeWithAction>()

const UserListTable = ({ tableData }: { tableData?: UsersType[] }) => {
  // Hooks
  const dictionary = useTranslation()
  const { checkPermission } = usePermissions()
  const { user } = useAuth()
  const actorId = user?.id || null

  const { statuses: presenceStatuses } = usePresence()
  const { userStatuses: unreadStatuses } = useUnreadByContact()

  // Permission checks
  const canDelete = checkPermission('userManagement', 'delete')
  const canUpdate = checkPermission('userManagement', 'update')
  const canCreate = checkPermission('userManagement', 'create')

  const defaultColumn = useMemo(
    () => ({
      minSize: 100
    }),
    []
  )

  // States
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [editUser, setEditUser] = useState<UsersType | null>(null)
  const [rowSelection, setRowSelection] = useState({})
  const [data, setData] = useState(tableData || [])
  const [filteredData, setFilteredData] = useState<UsersType[]>(tableData || [])
  const [globalFilter, setGlobalFilter] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteUserId, setDeleteUserId] = useState<string>('')
  const [deleteUserName, setDeleteUserName] = useState<string>('')
  const [loading, setLoading] = useState(!tableData || tableData.length === 0)
  const [roleOptions, setRoleOptions] = useState<string[]>([])
  const [togglingUsers, setTogglingUsers] = useState<Set<string>>(new Set())
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [activateLoading, setActivateLoading] = useState(false)
  const [deactivateLoading, setDeactivateLoading] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  // Hooks
  const { lang: locale } = useParams()

  // Set loading to false when data is available
  useEffect(() => {
    if (tableData && tableData.length > 0) {
      setLoading(false)
    }
  }, [tableData])

  useEffect(() => {
    setFilteredData(data || [])
  }, [data])

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const res = await fetch('/api/admin/roles')

        if (res.ok) {
          const roles = await res.json()

          setRoleOptions(Array.isArray(roles) ? roles.map((role: { name: string }) => role.name) : [])
        }
      } catch (error) {
        console.error('Failed to fetch roles', error)
      }
    }

    void loadRoles()
  }, [])

  // No role checks needed - all authenticated users can manage users

  // Handle user deletion/anonymization
  const handleDeleteUser = async (mode: 'delete' | 'anonymize', userId: string, userName: string) => {
    try {
      if (mode === 'delete') {
        // Full deletion
        const response = await fetch(`/api/admin/users/${userId}`, {
          method: 'DELETE'
        })

        if (response.ok) {
          // Refresh data from server
          const refreshResponse = await fetch('/api/admin/users')

          if (refreshResponse.ok) {
            const updatedUsers = await refreshResponse.json()
            setData([...updatedUsers]) // Create new array reference
          } else {
            // If refresh fails, just remove from local data
            setData([...(data?.filter(user => user.id !== userId) || [])]) // Create new array reference
          }

          toast.success(dictionary.navigation.deleteUser + ' ' + dictionary.navigation.successfully)
        } else {
          const error = await response.json()
          // Removed error toast notification for user deletion
        }
      } else if (mode === 'anonymize') {
        // Anonymization using DataSanitizationService
        const response = await fetch('/api/admin/data-sanitization', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            target: { userId },
            options: {
              mode: 'anonymize',
              reason: 'User requested anonymization',
              requestedBy: 'admin'
            }
          })
        })

        if (response.ok) {
          // Refresh data from server
          const refreshResponse = await fetch('/api/admin/users')

          if (refreshResponse.ok) {
            const updatedUsers = await refreshResponse.json()
            setData([...updatedUsers]) // Create new array reference
          }

          toast.success(dictionary.navigation.userDeleted || 'User Deleted')
        } else {
          const error = await response.json()
          toast.error('Ошибка анонимизации: ' + (error.message || 'Неизвестная ошибка'))
        }
      }
    } catch (error) {
      console.error('Error processing user:', error)
      const action = mode === 'delete' ? dictionary.navigation.deleteUser : 'анонимизации'
      toast.error(error instanceof Error ? error.message : `${action} failed`)
    }
  }

  // Handle user status toggle
  const resolveUserById = (userId: string) => (data || []).find(user => String(user.id) === String(userId))

  const handleToggleUserStatus = async (userId: string, desiredStatus?: boolean) => {
    // Add user to loading set immediately for visual feedback
    setTogglingUsers(prev => new Set(prev).add(userId))

    const nextStatus =
      typeof desiredStatus === 'boolean'
        ? desiredStatus
        : !((resolveUserById(userId)?.isActive ?? true))

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: nextStatus })
      })

      if (response.ok) {
        const updatedUser = await response.json()

        const updatedData = (data || []).map(user =>
          user.id === updatedUser.id ? updatedUser : user
        )

        setData([...updatedData]) // Create new array reference
        setFilteredData([...updatedData]) // Create new array reference
        toast.success(
          `${dictionary.navigation.user} ${
            updatedUser.isActive ? dictionary.navigation.active : dictionary.navigation.inactive
          } ${dictionary.navigation.successfully}`
        )
      } else {
        const error = await response.json()

        // Removed error toast notification for user status toggle
      }
    } catch (error) {
      console.error('Error toggling user status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to toggle user status')
    } finally {
      // Remove user from loading set
      setTogglingUsers(prev => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
    }
  }

  // Bulk operations
  const getSelectedUsers = () => {
    const selectedIds = Object.keys(rowSelection).filter(id => (rowSelection as any)[id])
    // Since getRowId returns String(row.id), we need to find users by ID
    return selectedIds
      .map(id => filteredData.find(user => String(user.id) === id))
      .filter(Boolean) as UsersType[]
  }

  const getFilteredSelectedUsers = () => {
    return getSelectedUsers().filter(user => user.role.toLowerCase() !== 'superadmin')
  }

  const handleBulkDelete = async (mode: 'delete' | 'anonymize') => {
    const selectedUsers = getFilteredSelectedUsers()
    if (selectedUsers.length === 0) return

    const userIds = selectedUsers.map(u => String(u.id))

    setDeleteLoading(true)
    try {
      // Use bulk delete endpoint for delete mode
      // Note: anonymize mode still uses the old endpoint as it requires different logic
      if (mode === 'delete') {
        const response = await fetch('/api/admin/users/bulk/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || 'Bulk delete failed')
        }

        const result = await response.json()

        // Show success message
        if (result.deleted > 0) {
          if (result.skipped > 0) {
            toast.success(
              dictionary.navigation.bulkOperationPartialSuccess
                .replace('${successCount}', result.deleted.toString())
                .replace('${totalCount}', userIds.length.toString())
            )
          } else {
            toast.success(
              dictionary.navigation.bulkOperationSuccess.replace('${successCount}', result.deleted.toString())
            )
          }
        } else {
          toast.error(dictionary.navigation.bulkOperationFailed)
        }

        // Refresh data
        const refreshResponse = await fetch('/api/admin/users')
        if (refreshResponse.ok) {
          const updatedUsers = await refreshResponse.json()
          setData([...updatedUsers])
          setFilteredData([...updatedUsers])
        }

        // Clear selection
        setRowSelection({})
      } else {
        // Anonymize mode - still use old endpoint for now
        const results = await Promise.allSettled(
          selectedUsers.map(user =>
            fetch('/api/admin/data-sanitization', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                target: { userId: user.id },
                options: {
                  mode: 'anonymize',
                  reason: 'Bulk anonymization',
                  requestedBy: 'admin'
                }
              })
            })
          )
        )

        const successCount = results.filter(result => result.status === 'fulfilled' && result.value.ok).length
        const failedCount = results.length - successCount

        if (successCount === selectedUsers.length) {
          toast.success(dictionary.navigation.bulkOperationSuccess.replace('${successCount}', successCount.toString()))
        } else if (successCount > 0) {
          toast.success(
            dictionary.navigation.bulkOperationPartialSuccess
              .replace('${successCount}', successCount.toString())
              .replace('${totalCount}', selectedUsers.length.toString())
          )
        } else {
          toast.error(dictionary.navigation.bulkOperationFailed)
        }

        // Refresh data
        const refreshResponse = await fetch('/api/admin/users')
        if (refreshResponse.ok) {
          const updatedUsers = await refreshResponse.json()
          setData([...updatedUsers])
          setFilteredData([...updatedUsers])
        }

        // Clear selection
        setRowSelection({})
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Bulk delete error:', error)
      toast.error(errorMessage || dictionary.navigation.bulkOperationFailed)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleBulkStatusChange = async (activate: boolean) => {
    const selectedUsers = getFilteredSelectedUsers()
    if (selectedUsers.length === 0) return

    const userIds = selectedUsers.map(u => String(u.id))
    const endpoint = activate ? '/api/admin/users/bulk/activate' : '/api/admin/users/bulk/deactivate'

    if (activate) {
      setActivateLoading(true)
    } else {
      setDeactivateLoading(true)
    }
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Bulk status change failed')
      }

      const result = await response.json()

      // Show success message
      if (result.activated || result.deactivated) {
        const count = result.activated || result.deactivated
        if (result.skipped > 0) {
          toast.success(
            dictionary.navigation.bulkOperationPartialSuccess
              .replace('${successCount}', count.toString())
              .replace('${totalCount}', userIds.length.toString())
          )
        } else {
          toast.success(dictionary.navigation.bulkOperationSuccess.replace('${successCount}', count.toString()))
        }
      } else {
        toast.error(dictionary.navigation.bulkOperationFailed)
      }

      // Refresh data from server
      const refreshResponse = await fetch('/api/admin/users')
      if (refreshResponse.ok) {
        const updatedUsers = await refreshResponse.json()
        setData([...updatedUsers])
        setFilteredData([...updatedUsers])
      }

      // Clear selection
      setRowSelection({})
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Bulk status change error:', error)
      toast.error(errorMessage || dictionary.navigation.bulkOperationFailed)
    } finally {
      if (activate) {
        setActivateLoading(false)
      } else {
        setDeactivateLoading(false)
      }
    }
  }

   const getOnlineStatus = (user: UsersTypeWithAction) => {
     const presenceEntry = presenceStatuses?.[String(user.id)]
     const fallbackEntry = unreadStatuses?.[String(user.id)]

     let resolvedOnline = presenceEntry?.isOnline

     if (resolvedOnline === undefined && fallbackEntry) {
       resolvedOnline = fallbackEntry.isOnline
     }

     if (resolvedOnline === undefined) {
       if (user.lastSeen) {
         const lastSeenDate = new Date(user.lastSeen as string)

         resolvedOnline = Date.now() - lastSeenDate.getTime() < 30_000
       } else {
         resolvedOnline = user.isOnline ?? false
       }
     }

     return resolvedOnline
   }


  const columns = useMemo<ColumnDef<UsersTypeWithAction, any>[]>(
    () => [
      {
        id: 'select',
        size: 50,
        header: ({ table }) => (
          <Checkbox
            {...{
              checked: table.getIsAllRowsSelected(),
              indeterminate: table.getIsSomeRowsSelected(),
              onChange: table.getToggleAllRowsSelectedHandler()
            }}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            {...{
              checked: row.getIsSelected(),
              disabled: !row.getCanSelect(),
              indeterminate: row.getIsSomeSelected(),
              onChange: row.getToggleSelectedHandler()
            }}
          />
        ),
        enableColumnFilter: false
      },
      columnHelper.accessor('fullName', {
        header: dictionary.navigation.user,
        filterFn: fuzzyFilter,
        size: 280,
        minSize: 200,
        maxSize: 320,
        cell: ({ row }) => (
          <div className='flex items-center gap-4' style={{ minWidth: 0 }}>
            {getAvatar(row.original)}
            <div className='flex flex-col' style={{ minWidth: 0, flex: 1 }}>
              <Typography 
                className='font-medium' 
                color='text.primary'
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '200px'
                }}
              >
                {row.original.fullName}
              </Typography>
              <Typography 
                variant='body2'
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '200px'
                }}
              >
                {row.original.username}
              </Typography>
            </div>
          </div>
        )
      }),
      columnHelper.accessor('email', {
        header: dictionary.navigation.email,
        filterFn: fuzzyFilter,
        size: 280,
        minSize: 200,
        maxSize: 320,
        cell: ({ row }) => (
          <Typography
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '280px'
            }}
          >
            {row.original.email}
          </Typography>
        )
      }),
      columnHelper.accessor('role', {
        header: dictionary.navigation.role,
        filterFn: roleFilterFn,
        size: 170,
        cell: ({ row }) => {
          const roleInfo = userRoleObj[row.original.role] || userRoleObj.subscriber


return (
            <div className='flex items-center gap-2'>
              <Icon
                className={roleInfo.icon}
                sx={{
                  color: row.original.role.toLowerCase() === 'superadmin' ? '#FFD700' : `var(--mui-palette-${roleInfo.color}-main)`,
                  fontSize: '1.375rem'
                }}
              />
              <Typography className='capitalize' color='text.primary'>
                {row.original.role}
              </Typography>
            </div>
          )
        }
      }),
      columnHelper.accessor(
        row => row.status ?? (row.isActive ? 'active' : 'inactive'),
        {
          id: 'status',
          header: dictionary.navigation.status,
          filterFn: statusFilterFn,
          size: 180,
          cell: ({ row }) => {
            const statusValue = row.original.status ?? (row.original.isActive ? 'active' : 'inactive')

            return (
              <Chip
                variant='tonal'
                label={
                  statusValue === 'active'
                    ? dictionary.navigation.active
                    : statusValue === 'inactive'
                      ? dictionary.navigation.inactive
                      : statusValue === 'pending'
                        ? 'Pending'
                        : 'Block'
                }
                size='small'
                color={
                  statusValue === 'active'
                    ? 'success'
                    : statusValue === 'pending'
                      ? 'warning'
                      : statusValue === 'block'
                        ? 'error'
                        : 'secondary'
                }
                className='capitalize'
              />
            )
          }
        }
      ),
      columnHelper.accessor(
        row => (getOnlineStatus(row) ? 'online' : 'offline'),
        {
          id: 'onlineStatus',
          header: dictionary.navigation.online || 'Online',
          filterFn: onlineFilterFn,
          size: 180,
          cell: ({ row }) => {
            const isOnline = getOnlineStatus(row.original)
            const label = isOnline ? (dictionary.navigation.online || 'Online') : (dictionary.navigation.offline || 'Offline')

            return (
              <Chip
                variant='tonal'
                size='small'
                color={isOnline ? 'success' : 'secondary'}
                label={label}
                className='capitalize'
              />
            )
          }
        }
      ),
      columnHelper.accessor('currentPlan', {
        header: dictionary.navigation.plan,
        filterFn: planFilterFn,
        size: 160,
        cell: ({ row }) => (
          <Typography className='capitalize' color='text.primary'>
            {row.original.currentPlan}
          </Typography>
        )
      }),
      columnHelper.accessor('action', {
        header: dictionary.navigation.action,
        cell: ({ row }) => (
          <div className='flex items-center'>
            {canDelete && row.original.role.toLowerCase() !== 'superadmin' && (
              <IconButton
                aria-label={dictionary.navigation.deleteUser || 'Delete user'}
                onClick={() => {
                  setDeleteUserId(String(row.original.id))
                  setDeleteUserName(row.original.fullName)
                  setDeleteDialogOpen(true)
                }}
              >
                <i className='ri-delete-bin-line text-textSecondary' />
              </IconButton>
            )}
            <IconButton
              component={Link}
              href={getLocalizedUrl(`/apps/user/view?id=${row.original.id}`, locale as Locale)}
              aria-label={dictionary.navigation.viewUser || 'View user'}
            >
              <i className='ri-eye-line text-textSecondary' />
            </IconButton>
            {canUpdate && row.original.role.toLowerCase() !== 'superadmin' && (
              <Switch
                checked={row.original.isActive}
                onChange={() => handleToggleUserStatus(String(row.original.id), !row.original.isActive)}
                size='small'
                disabled={togglingUsers.has(String(row.original.id))}
              />
            )}
            <OptionMenu
              iconButtonProps={{ size: 'medium' }}
              iconClassName='text-textSecondary'
              options={[
                {
                  text: dictionary.navigation.download,
                  icon: 'ri-download-line',
                  menuItemProps: { className: 'flex items-center gap-2 text-textSecondary' }
                },
                ...(canUpdate && row.original.role.toLowerCase() !== 'superadmin' ? [{
                  text: dictionary.navigation.edit,
                  icon: 'ri-edit-box-line',
                  menuItemProps: {
                    className: 'flex items-center gap-2 text-textSecondary',
                    onClick: () => {
                      setEditUser(row.original)
                      setAddUserOpen(true)
                    }
                  }
                }] : [])
              ]}
            />
          </div>
        ),
        enableColumnFilter: false,
        enableSorting: false,
        size: 160
      })
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, filteredData, canDelete, canUpdate, presenceStatuses, unreadStatuses, dictionary, locale]
  )

  const table = useReactTable({
    data: filteredData as UsersType[],
    columns,
    defaultColumn,
    filterFns: {
      fuzzy: fuzzyFilter
    },
    state: {
      rowSelection,
      globalFilter,
      columnFilters
    },
    initialState: {
      pagination: {
        pageSize: 10
      }
    },
    enableRowSelection: true, //enable row selection for all rows
    // enableRowSelection: row => row.original.age > 18, // or enable row selection conditionally per row
    getRowId: (row) => String(row.id), // Use user ID instead of row index
    globalFilterFn: fuzzyFilter,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues()
  })

  const getAvatar = (user: UsersTypeWithAction) => {
    const { avatar, fullName } = user

    const resolvedOnline = getOnlineStatus(user)

    const badgeColor = resolvedOnline ? statusObj.online : statusObj.offline

    if (avatar) {
      return (
        <AvatarWithBadge
          src={avatar}
          badgeColor={badgeColor}
          alt={fullName}
          badgeSize={10}
          size={34}
        />
      )
    } else {
      return (
        <AvatarWithBadge
          badgeColor={badgeColor}
          alt={fullName}
          badgeSize={10}
          size={34}
          className='flex items-center justify-center'
          fallbackInitials={fullName || ''}
        />
      )
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton width={100} height={28} />
        </CardHeader>
        <div className='p-5'>
          <div className='flex gap-4 mb-4'>
            <Skeleton width={100} height={40} />
            <Skeleton width={100} height={40} />
            <Skeleton width={100} height={40} />
          </div>
          <Skeleton width={150} height={20} />
        </div>
        <Divider />
        <div className='flex justify-between p-5 gap-4 flex-col items-start sm:flex-row sm:items-center'>
          <Skeleton width={100} height={36} />
          <div className='flex items-center gap-4 flex-col max-sm:w-full sm:flex-row'>
            <Skeleton width={300} height={40} />
            <Skeleton width={150} height={36} />
          </div>
        </div>
        <TableContainer className='overflow-x-auto'>
          <Table className={tableStyles.table}>
            <TableHead>
              <TableRow>
                <TableCell><Skeleton width={20} height={20} /></TableCell>
                <TableCell><Skeleton width={120} height={20} /></TableCell>
                <TableCell><Skeleton width={150} height={20} /></TableCell>
                <TableCell><Skeleton width={80} height={20} /></TableCell>
                <TableCell><Skeleton width={80} height={20} /></TableCell>
                <TableCell><Skeleton width={60} height={20} /></TableCell>
                <TableCell><Skeleton width={100} height={20} /></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.from({ length: 10 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton width={20} height={20} /></TableCell>
                  <TableCell>
                    <div className='flex items-center gap-4'>
                      <Skeleton variant='circular' width={34} height={34} />
                      <div className='flex flex-col gap-1'>
                        <Skeleton width={100} height={16} />
                        <Skeleton width={80} height={14} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Skeleton width={150} height={16} /></TableCell>
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      <Skeleton width={20} height={20} />
                      <Skeleton width={60} height={16} />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton width={80} height={16} /></TableCell>
                  <TableCell><Skeleton width={60} height={24} /></TableCell>
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      <Skeleton width={24} height={24} />
                      <Skeleton width={24} height={24} />
                      <Skeleton width={40} height={20} />
                      <Skeleton width={24} height={24} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <div className='border-bs p-4'>
          <Skeleton width={200} height={24} />
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader
          title={dictionary.navigation.userList || 'Users'}
          action={
            <DebouncedInput
              value={globalFilter ?? ''}
              onChange={value => setGlobalFilter(String(value))}
              placeholder={dictionary.navigation.searchUser}
              className='min-is-[220px]'
            />
          }
        />
        <Divider />

        <div className='flex justify-between p-5 gap-4 flex-col items-start sm:flex-row sm:items-center'>
           <div className='flex items-center gap-2 max-sm:w-full sm:flex-row'>
               <ExportButton
                 entityType="users"
                 availableFormats={['xlsx', 'csv']}
                 filters={{}}
                 selectedIds={Object.keys(rowSelection).filter(id => (rowSelection as any)[id])}
                 onError={(error) => toast.error(`Export failed: ${(error as any).message || error}`)}
               />
               <Button
                 color='primary'
                 variant='outlined'
                 startIcon={<i className='ri-download-2-line text-xl' />}
                 onClick={() => setImportDialogOpen(true)}
                 className='max-sm:w-full'
               >
                 {dictionary.navigation.import || 'Import'}
               </Button>
              {canDelete && (
                <Button
                  color='error'
                  variant='outlined'
                  onClick={() => {
                    const selectedUsers = getFilteredSelectedUsers()
                    if (selectedUsers.length > 0) {
                      setDeleteUserId('bulk')
                      setDeleteUserName(`${selectedUsers.length} users`)
                      setDeleteDialogOpen(true)
                    }
                  }}
                  disabled={deleteLoading || activateLoading || deactivateLoading || getFilteredSelectedUsers().length === 0}
                  startIcon={deleteLoading ? <CircularProgress size={16} /> : <i className='ri-delete-bin-line text-xl' />}
                  className='max-sm:w-full'
                >
                  {deleteLoading ? 'Удаление...' : dictionary.navigation.bulkDelete}
                </Button>
              )}
              {canUpdate && (
                <>
                  <Button
                    color='success'
                    variant='outlined'
                    onClick={() => handleBulkStatusChange(true)}
                    disabled={deleteLoading || activateLoading || deactivateLoading || getFilteredSelectedUsers().length === 0}
                    startIcon={activateLoading ? <CircularProgress size={16} /> : <i className='ri-check-line text-xl' />}
                    className='max-sm:w-full'
                  >
                    {activateLoading ? 'Активация...' : dictionary.navigation.bulkActivate}
                  </Button>
                  <Button
                    color='warning'
                    variant='outlined'
                    onClick={() => handleBulkStatusChange(false)}
                    disabled={deleteLoading || activateLoading || deactivateLoading || getFilteredSelectedUsers().length === 0}
                    startIcon={deactivateLoading ? <CircularProgress size={16} /> : <i className='ri-pause-line text-xl' />}
                    className='max-sm:w-full'
                  >
                    {deactivateLoading ? 'Деактивация...' : dictionary.navigation.bulkDeactivate}
                  </Button>
                </>
              )}
            </div>
          <div className='flex items-center gap-4 flex-col max-sm:w-full sm:flex-row'>
            {canCreate && (
              <Button variant='contained' onClick={() => setAddUserOpen(!addUserOpen)} className='max-sm:w-full'>
                {dictionary.navigation.addNewUser}
              </Button>
            )}
          </div>
        </div>
        <TableContainer className='overflow-x-auto'>
          <Table className={tableStyles.table}>
            <TableHead>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <TableCell
                      key={header.id}
                      style={header.column.columnDef.size ? { width: header.column.getSize() } : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <>
                          <div
                            className={classnames({
                              'flex items-center': header.column.getIsSorted(),
                              'cursor-pointer select-none': header.column.getCanSort()
                            })}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{
                              asc: <i className='ri-arrow-up-s-line text-xl' />,
                              desc: <i className='ri-arrow-down-s-line text-xl' />
                            }[header.column.getIsSorted() as 'asc' | 'desc'] ?? null}
                          </div>
                          {header.column.getCanFilter() && (
                            <div className='mt-3'>
                              {(() => {
                                const headerLabel =
                                  typeof header.column.columnDef.header === 'string'
                                    ? header.column.columnDef.header
                                    : header.column.id === 'status'
                                      ? dictionary.navigation.status
                                      : header.column.id === 'onlineStatus'
                                        ? dictionary.navigation.online || 'Online'
                                        : header.column.id === 'role'
                                          ? dictionary.navigation.role
                                          : header.column.id === 'currentPlan'
                                            ? dictionary.navigation.plan
                                            : dictionary.navigation.searchUser || 'Search...'

                                return (
                              <ColumnFilter
                                column={header.column}
                                placeholder={headerLabel}
                                dictionary={dictionary}
                                roleOptions={roleOptions}
                              />
                                )
                              })()}
                            </div>
                          )}
                        </>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableHead>
            {table.getFilteredRowModel().rows.length === 0 ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={table.getVisibleFlatColumns().length} className='text-center'>
                    {dictionary.navigation.noDataAvailable}
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : (
              <TableBody>
                {table
                  .getRowModel()
                  .rows.map(row => {
                    return (
                      <TableRow key={row.id} className={classnames({ selected: row.getIsSelected() })}>
                        {row.getVisibleCells().map(cell => (
                          <TableCell
                            key={cell.id}
                            style={cell.column.columnDef.size ? { width: cell.column.getSize() } : undefined}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })}
              </TableBody>
            )}
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component='div'
          className='border-bs'
          count={table.getFilteredRowModel().rows.length}
          rowsPerPage={table.getState().pagination.pageSize}
          page={table.getState().pagination.pageIndex}
          onPageChange={(_, page) => {
            table.setPageIndex(page)
          }}
          onRowsPerPageChange={e => table.setPageSize(Number(e.target.value))}
        />
      </Card>
      <AddUserDrawer
        open={addUserOpen}
        handleClose={() => {
          setAddUserOpen(false)
          setEditUser(null)
        }}
        userData={data}
        setData={setData}
        editUser={editUser || undefined}
      />
      <UserDeletionDialog
        open={deleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        userName={deleteUserName}
        onConfirm={async (mode) => {
          if (deleteUserId === 'bulk') {
            await handleBulkDelete(mode)
          } else {
            await handleDeleteUser(mode, deleteUserId, deleteUserName)
          }
        }}
      />
      <ImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        entityType="users"
        mode="create"
        dialogMaxWidth="lg"
        onSuccess={async (result) => {
          // ImportDialog already shows success toast with proper i18n
          // Refresh data
          const refreshResponse = await fetch('/api/admin/users')
          if (refreshResponse.ok) {
            const updatedUsers = await refreshResponse.json()
            setData([...updatedUsers])
            setFilteredData([...updatedUsers])
          }
        }}
        onError={(error) => toast.error(`Import failed: ${(error as any).message || error}`)}
      />
    </>
  )
}

export default UserListTable

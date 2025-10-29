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
import { styled } from '@mui/material/styles'
import TablePagination from '@mui/material/TablePagination'
import type { TextFieldProps } from '@mui/material/TextField'

// Third-party Imports
import classnames from 'classnames'
import { rankItem } from '@tanstack/match-sorter-utils'
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
  getSortedRowModel
} from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import type { RankingInfo } from '@tanstack/match-sorter-utils'
import { toast } from 'react-toastify'

// Type Imports
import type { ThemeColor } from '@core/types'
import type { UsersType } from '@/types/apps/userTypes'
import type { Locale } from '@configs/i18n'

// Component Imports
import TableFilters from './TableFilters'
import AddUserDrawer from './AddUserDrawer'
import OptionMenu from '@core/components/option-menu'
import CustomAvatar from '@core/components/mui/Avatar'
import ConfirmationDialog from '@components/dialogs/confirmation-dialog'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Hook Imports
import { usePermissions } from '@/hooks/usePermissions'

// Util Imports
import { getInitials } from '@/utils/getInitials'
import { getLocalizedUrl } from '@/utils/i18n'

// Style Imports
import tableStyles from '@core/styles/table.module.css'

declare module '@tanstack/table-core' {
  interface FilterFns {
    fuzzy: FilterFn<unknown>
  }
  interface FilterMeta {
    itemRank: RankingInfo
  }
}

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

  return <TextField {...props} value={value} onChange={e => setValue(e.target.value)} size='small' />
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

  // Permission checks
  const canDelete = checkPermission('userManagement', 'delete')
  const canUpdate = checkPermission('userManagement', 'update')
  const canCreate = checkPermission('userManagement', 'create')

  // States
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [editUser, setEditUser] = useState<UsersType | null>(null)
  const [rowSelection, setRowSelection] = useState({})
  const [data, setData] = useState(...[tableData])
  const [filteredData, setFilteredData] = useState(data)
  const [globalFilter, setGlobalFilter] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteUserId, setDeleteUserId] = useState<string>('')
  const [deleteUserName, setDeleteUserName] = useState<string>('')

  // Hooks
  const { lang: locale } = useParams()

  // No role checks needed - all authenticated users can manage users

  // Handle user deletion
  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Refresh data from server
        const refreshResponse = await fetch('/api/admin/users')

        if (refreshResponse.ok) {
          const updatedUsers = await refreshResponse.json()

          setData(updatedUsers)
        } else {
          // If refresh fails, just remove from local data
          setData(data?.filter(user => user.id !== userId))
        }

        toast.success(dictionary.navigation.deleteUser + ' ' + dictionary.navigation.successfully)
      } else {
        const error = await response.json()

        // Removed error toast notification for user deletion
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error((error as Error).message || dictionary.navigation.deleteUser + ' failed')
    }
  }

  // Handle user status toggle
  const handleToggleUserStatus = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH'
      })

      if (response.ok) {
        const updatedUser = await response.json()

        const updatedData = (data || []).map(user =>
          user.id === updatedUser.id ? updatedUser : user
        )

        setData(updatedData)
        setFilteredData(updatedData)
        toast.success(`${dictionary.navigation.user} ${updatedUser.isActive ? dictionary.navigation.active : dictionary.navigation.inactive} ${dictionary.navigation.successfully}`)
      } else {
        const error = await response.json()

        // Removed error toast notification for user status toggle
      }
    } catch (error) {
      console.error('Error toggling user status:', error)
      toast.error(error.message || 'Failed to toggle user status')
    }
  }

  const columns = useMemo<ColumnDef<UsersTypeWithAction, any>[]>(
    () => [
      {
        id: 'select',
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
        )
      },
      columnHelper.accessor('fullName', {
        header: dictionary.navigation.user,
        cell: ({ row }) => (
          <div className='flex items-center gap-4'>
            {getAvatar({ avatar: row.original.avatar, fullName: row.original.fullName })}
            <div className='flex flex-col'>
              <Typography className='font-medium' color='text.primary'>
                {row.original.fullName}
              </Typography>
              <Typography variant='body2'>{row.original.username}</Typography>
            </div>
          </div>
        )
      }),
      columnHelper.accessor('email', {
        header: dictionary.navigation.email,
        cell: ({ row }) => <Typography>{row.original.email}</Typography>
      }),
      columnHelper.accessor('role', {
        header: dictionary.navigation.role,
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
      columnHelper.accessor('currentPlan', {
        header: dictionary.navigation.plan,
        cell: ({ row }) => (
          <Typography className='capitalize' color='text.primary'>
            {row.original.currentPlan}
          </Typography>
        )
      }),
      columnHelper.accessor('isActive', {
        header: dictionary.navigation.status,
        cell: ({ row }) => (
          <div className='flex items-center gap-3'>
            <Chip
              variant='tonal'
              label={row.original.isActive ? dictionary.navigation.active : dictionary.navigation.inactive}
              size='small'
              color={row.original.isActive ? 'success' : 'secondary'}
              className='capitalize'
            />
          </div>
        )
      }),
      columnHelper.accessor('action', {
        header: dictionary.navigation.action,
        cell: ({ row }) => (
          <div className='flex items-center'>
            {canDelete && row.original.role.toLowerCase() !== 'superadmin' && (
              <IconButton
                onClick={() => {
                  setDeleteUserId(String(row.original.id))
                  setDeleteUserName(row.original.fullName)
                  setDeleteDialogOpen(true)
                }}
              >
                <i className='ri-delete-bin-line text-textSecondary' />
              </IconButton>
            )}
            <IconButton>
              <Link href={getLocalizedUrl(`/apps/user/view?id=${row.original.id}`, locale as Locale)} className='flex'>
                <i className='ri-eye-line text-textSecondary' />
              </Link>
            </IconButton>
            {canUpdate && row.original.role.toLowerCase() !== 'superadmin' && (
              <Switch
                checked={row.original.isActive}
                onChange={() => handleToggleUserStatus(String(row.original.id))}
                size='small'
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
        enableSorting: false
      })
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, filteredData, canDelete, canUpdate]
  )

  const table = useReactTable({
    data: filteredData as UsersType[],
    columns,
    filterFns: {
      fuzzy: fuzzyFilter
    },
    state: {
      rowSelection,
      globalFilter
    },
    initialState: {
      pagination: {
        pageSize: 10
      }
    },
    enableRowSelection: true, //enable row selection for all rows
    // enableRowSelection: row => row.original.age > 18, // or enable row selection conditionally per row
    globalFilterFn: fuzzyFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues()
  })

  const getAvatar = (params: Pick<UsersType, 'avatar' | 'fullName'>) => {
    const { avatar, fullName } = params

    if (avatar) {
      return <CustomAvatar src={avatar} skin='light' size={34} />
    } else {
      return (
        <CustomAvatar skin='light' size={34}>
          {getInitials(fullName as string)}
        </CustomAvatar>
      )
    }
  }

  return (
    <>
      <Card>
        <CardHeader title={dictionary.navigation.filters} />
        <TableFilters setData={setFilteredData} tableData={data} />
        <Divider />
        <div className='flex justify-between p-5 gap-4 flex-col items-start sm:flex-row sm:items-center'>
          <Button
            color='secondary'
            variant='outlined'
            startIcon={<i className='ri-upload-2-line text-xl' />}
            className='max-sm:is-full'
          >
            {dictionary.navigation.export}
          </Button>
          <div className='flex items-center gap-x-4 gap-4 flex-col max-sm:is-full sm:flex-row'>
            <DebouncedInput
              value={globalFilter ?? ''}
              onChange={value => setGlobalFilter(String(value))}
              placeholder={dictionary.navigation.searchUser}
              className='max-sm:is-full'
            />
            {canCreate && (
              <Button variant='contained' onClick={() => setAddUserOpen(!addUserOpen)} className='max-sm:is-full'>
                {dictionary.navigation.addNewUser}
              </Button>
            )}
          </div>
        </div>
        <div className='overflow-x-auto'>
          <table className={tableStyles.table}>
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id}>
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
                        </>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            {table.getFilteredRowModel().rows.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={table.getVisibleFlatColumns().length} className='text-center'>
                    {dictionary.navigation.noDataAvailable}
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {table
                  .getRowModel()
                  .rows.slice(0, table.getState().pagination.pageSize)
                  .map(row => {
                    return (
                      <tr key={row.id} className={classnames({ selected: row.getIsSelected() })}>
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                        ))}
                      </tr>
                    )
                  })}
              </tbody>
            )}
          </table>
        </div>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
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
      <ConfirmationDialog
        open={deleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        type='delete-user'
        name={deleteUserName}
        onConfirm={async (value) => {
          if (value) {
            await handleDeleteUser(deleteUserId, deleteUserName)
          }
        }}
      />
    </>
  )
}

export default UserListTable

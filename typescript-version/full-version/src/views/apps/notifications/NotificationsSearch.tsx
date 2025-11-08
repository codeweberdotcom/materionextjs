// MUI Imports
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Tooltip from '@mui/material/Tooltip'

// Type Imports
import type { AppDispatch } from '@/redux-store'

// Slice Imports
import { setNotifications } from '@/redux-store/slices/notifications'

// Hook Imports
import { useNotifications } from '@/hooks/useNotifications'
import { useTranslation } from '@/contexts/TranslationContext'

type Props = {
  isBelowScreen: boolean
  searchTerm: string
  setSidebarOpen: (value: boolean) => void
  setBackdropOpen: (value: boolean) => void
  setSearchTerm: (value: string) => void
  dispatch: AppDispatch
}

const NotificationsSearch = (props: Props) => {
  // Props
  const { isBelowScreen, searchTerm, setSidebarOpen, setBackdropOpen, setSearchTerm, dispatch } = props

  // Hooks
  const { notifications: freshNotifications } = useNotifications()
  const dictionary = useTranslation()

  // Open sidebar on below md screen
  const handleToggleSidebar = () => {
    setSidebarOpen(true)
    setBackdropOpen(true)
  }

  // Refresh notifications from database
  const handleRefresh = () => {
    // Always refresh to ensure virtual chat notification is included
    dispatch(setNotifications(freshNotifications))
  }

  return (
    <div className='flex items-center gap-1 is-full max-sm:pli-4 pli-6 border-be'>
      {isBelowScreen && (
        <IconButton onClick={handleToggleSidebar}>
          <i className='ri-menu-line' />
        </IconButton>
      )}
      <InputBase
        fullWidth
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        startAdornment={<i className='ri-search-line text-textDisabled text-[22px] mie-4' />}
        placeholder={dictionary.navigation.searchNotifications}
        className='bs-[56px]'
      />
    </div>
  )
}

export default NotificationsSearch
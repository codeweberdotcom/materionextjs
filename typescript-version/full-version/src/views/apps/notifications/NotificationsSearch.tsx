// MUI Imports
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Tooltip from '@mui/material/Tooltip'

// Hook Imports
import { useTranslation } from '@/contexts/TranslationContext'

type Props = {
  isBelowScreen: boolean
  searchTerm: string
  setSidebarOpen: (value: boolean) => void
  setBackdropOpen: (value: boolean) => void
  setSearchTerm: (value: string) => void
  onRefresh: (reason?: string) => void
}

const NotificationsSearch = (props: Props) => {
  // Props
  const { isBelowScreen, searchTerm, setSidebarOpen, setBackdropOpen, setSearchTerm, onRefresh } = props

  // Hooks
  const dictionary = useTranslation()

  // Open sidebar on below md screen
  const handleToggleSidebar = () => {
    setSidebarOpen(true)
    setBackdropOpen(true)
  }

  // Refresh notifications from database
  const handleRefresh = () => {
    onRefresh('search-bar')
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

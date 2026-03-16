'use client'

// MUI Imports
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

// Context Imports
import { useTranslationSafe } from '@/contexts/TranslationContext'

const ModeDropdown = () => {
  // Hooks
  const { settings, updateSettings } = useSettings()
  const dictionary = useTranslationSafe()

  const isDark = settings.mode === 'dark'

  const handleToggle = () => {
    updateSettings({ mode: isDark ? 'light' : 'dark' })
  }

  const tooltip = isDark
    ? (dictionary?.navigation?.lightMode ?? 'Light Mode')
    : (dictionary?.navigation?.darkMode ?? 'Dark Mode')

  return (
    <Tooltip title={tooltip} PopperProps={{ className: 'capitalize' }}>
      <IconButton onClick={handleToggle} className='!text-textPrimary' aria-label={tooltip}>
        <i className={isDark ? 'ri-sun-line' : 'ri-moon-clear-line'} />
      </IconButton>
    </Tooltip>
  )
}

export default ModeDropdown

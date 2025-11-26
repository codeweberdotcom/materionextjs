'use client'

// React Imports
import { useRef, useState } from 'react'

// MUI Imports
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Popper from '@mui/material/Popper'
import Fade from '@mui/material/Fade'
import Paper from '@mui/material/Paper'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import MenuList from '@mui/material/MenuList'
import MenuItem from '@mui/material/MenuItem'

// Type Imports
import type { Mode } from '@core/types'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

// Context Imports
import { useTranslationSafe } from '@/contexts/TranslationContext'

// Fallback labels when TranslationProvider is not available
const fallbackLabels = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
  lightMode: 'Light Mode',
  darkMode: 'Dark Mode',
  systemMode: 'System Mode'
}

const ModeDropdown = () => {
  // States
  const [open, setOpen] = useState(false)
  const [tooltipOpen, setTooltipOpen] = useState(false)

  // Refs
  const anchorRef = useRef<HTMLButtonElement>(null)

  // Hooks
  const { settings, updateSettings } = useSettings()
  const dictionary = useTranslationSafe()

  const handleClose = () => {
    setOpen(false)
    setTooltipOpen(false)
  }

  const handleToggle = () => {
    setOpen(prevOpen => !prevOpen)
  }

  const handleModeSwitch = (mode: Mode) => {
    handleClose()

    if (settings.mode !== mode) {
      updateSettings({ mode: mode })
    }
  }

  const getModeIcon = () => {
    if (settings.mode === 'system') {
      return 'ri-computer-line'
    } else if (settings.mode === 'dark') {
      return 'ri-moon-clear-line'
    } else {
      return 'ri-sun-line'
    }
  }

  const getModeTooltip = () => {
    if (settings.mode === 'system') {
      return dictionary?.navigation?.systemMode ?? fallbackLabels.systemMode
    } else if (settings.mode === 'dark') {
      return dictionary?.navigation?.darkMode ?? fallbackLabels.darkMode
    } else {
      return dictionary?.navigation?.lightMode ?? fallbackLabels.lightMode
    }
  }

  // Labels with fallback
  const labels = {
    light: dictionary?.navigation?.light ?? fallbackLabels.light,
    dark: dictionary?.navigation?.dark ?? fallbackLabels.dark,
    system: dictionary?.navigation?.system ?? fallbackLabels.system
  }

  return (
    <>
      <Tooltip
        title={getModeTooltip()}
        onOpen={() => setTooltipOpen(true)}
        onClose={() => setTooltipOpen(false)}
        open={open ? false : tooltipOpen ? true : false}
        PopperProps={{ className: 'capitalize' }}
      >
        <IconButton ref={anchorRef} onClick={handleToggle} className='!text-textPrimary'>
          <i className={getModeIcon()} />
        </IconButton>
      </Tooltip>
      <Popper
        open={open}
        transition
        disablePortal
        placement='bottom-start'
        anchorEl={anchorRef.current}
        className='min-is-[160px] !mbs-4 z-[1]'
      >
        {({ TransitionProps, placement }) => (
          <Fade
            {...TransitionProps}
            style={{ transformOrigin: placement === 'bottom-start' ? 'left top' : 'right top' }}
          >
            <Paper className={settings.skin === 'bordered' ? 'border shadow-none' : 'shadow-lg'}>
              <ClickAwayListener onClickAway={handleClose}>
                <MenuList onKeyDown={handleClose}>
                  <MenuItem
                    className='gap-3'
                    onClick={() => handleModeSwitch('light')}
                    selected={settings.mode === 'light'}
                  >
                    <i className='ri-sun-line' />
                    {labels.light}
                  </MenuItem>
                  <MenuItem
                    className='gap-3'
                    onClick={() => handleModeSwitch('dark')}
                    selected={settings.mode === 'dark'}
                  >
                    <i className='ri-moon-clear-line' />
                    {labels.dark}
                  </MenuItem>
                  <MenuItem
                    className='gap-3'
                    onClick={() => handleModeSwitch('system')}
                    selected={settings.mode === 'system'}
                  >
                    <i className='ri-computer-line' />
                    {labels.system}
                  </MenuItem>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  )
}

export default ModeDropdown

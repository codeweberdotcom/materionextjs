// React Imports
import { useState } from 'react'
import type { ReactNode, RefObject } from 'react'

// MUI Imports
import Avatar from '@mui/material/Avatar'
import TextField from '@mui/material/TextField'
import Drawer from '@mui/material/Drawer'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Autocomplete from '@mui/material/Autocomplete'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'

// Third-party Imports
import classnames from 'classnames'
import PerfectScrollbar from 'react-perfect-scrollbar'
import { useAuth } from '@/contexts/AuthProvider'
import Skeleton from '@mui/material/Skeleton'

// Type Imports
import type { ThemeColor } from '@core/types'
import type { ChatDataType, StatusObjType } from '@/types/apps/chatTypes'
import type { AppDispatch } from '@/redux-store'

// Slice Imports
import { addNewChat } from '@/redux-store/slices/chat'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'
import UserProfileLeft from './UserProfileLeft'
import AvatarWithBadge from './AvatarWithBadge'
import { useTranslation } from '@/contexts/TranslationContext'
import { useTranslate } from '@/hooks/useTranslate'

// Util Imports
import { getInitials } from '@/utils/formatting/getInitials'
import { formatDateToMonthShort } from './utils'
import { statusObj } from '@/utils/status'

// Custom Hooks
import { useUnreadByContact } from '@/hooks/useUnreadByContact'
import { usePresence } from '@/contexts/PresenceProvider'

type Props = {
  chatStore: ChatDataType
  getActiveUserData: (id: string) => void
  dispatch: AppDispatch
  backdropOpen: boolean
  setBackdropOpen: (value: boolean) => void
  sidebarOpen: boolean
  setSidebarOpen: (value: boolean) => void
  isBelowLgScreen: boolean
  isBelowMdScreen: boolean
  isBelowSmScreen: boolean
  messageInputRef: RefObject<HTMLDivElement>
  unreadCount: number
  initializeRoom: (userId: string) => void
}

type RenderChatType = {
  chatStore: ChatDataType
  getActiveUserData: (id: string) => void
  setSidebarOpen: (value: boolean) => void
  backdropOpen: boolean
  setBackdropOpen: (value: boolean) => void
  isBelowMdScreen: boolean
  navigation: any
  initializeRoom: (userId: string) => void
  t: (key: string, variables?: Record<string, string | number>) => string
}

// Render contacts list (all users except current)
const renderContacts = (props: RenderChatType & { session: any; unreadByContact: { [contactId: string]: number }; userStatuses: { [userId: string]: { isOnline: boolean; lastSeen?: string } }; navigation: any; user: any }) => {
  // Props
  const { chatStore, getActiveUserData, setSidebarOpen, backdropOpen, setBackdropOpen, isBelowMdScreen, session, unreadByContact, userStatuses, navigation, user, initializeRoom, t } = props

  return chatStore.contacts.map(contact => {
    const isContactActive = chatStore.activeUser?.id === contact.id


    // Get unread count for this contact
    const unreadCount = unreadByContact[contact.id] || 0

    // Get user status
    const userStatus = userStatuses[contact.id]
    const isOnline = userStatus?.isOnline || false
    const lastSeen = userStatus?.lastSeen

    // Determine status text, last seen text and color
    let statusText: string
    let lastSeenText: string
    let statusColor: ThemeColor

    if (!userStatus) {
      // Data is still loading
      statusText = navigation.offline
      lastSeenText = navigation.loadingStatus
      statusColor = statusObj.offline
    } else if (isOnline) {
      statusText = navigation.online
      lastSeenText = navigation.justNow
      statusColor = statusObj.online
    } else if (lastSeen) {
      statusText = navigation.offline
      // Format last seen time
      const lastSeenDate = new Date(lastSeen)
      const now = new Date()
      const diffMs = now.getTime() - lastSeenDate.getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffMins < 1) {
        lastSeenText = navigation.recently
      } else if (diffMins < 60) {
        lastSeenText = t('navigation.minutesAgo', { count: diffMins })
      } else if (diffHours < 24) {
        lastSeenText = t('navigation.hoursAgo', { count: diffHours })
      } else if (diffDays < 7) {
        lastSeenText = t('navigation.daysAgo', { count: diffDays })
      } else {
        lastSeenText = lastSeenDate.toLocaleDateString('ru-RU')
      }
      statusColor = statusObj.offline
    } else {
      // User is offline and has no last seen time (null in database)
      statusText = navigation.offline
      lastSeenText = navigation.longAgo
      statusColor = statusObj.offline
    }

    return (
      <li
        key={`contact-${Math.random()}-${contact.about || 'no-about'}`}
        className={classnames('flex items-start gap-4 pli-3 plb-2 cursor-pointer rounded mbe-1', {
          'bg-primary shadow-xs': isContactActive,
          'text-[var(--mui-palette-primary-contrastText)]': isContactActive
        })}
        onClick={async () => {
           // Initialize room for the selected contact
           initializeRoom(contact.id.toString())

           // Set active user for UI
           getActiveUserData(contact.id)
           isBelowMdScreen && setSidebarOpen(false)
           isBelowMdScreen && backdropOpen && setBackdropOpen(false)

           // HTTP fallback for room creation (for testing/E2E)
           try {
             await fetch('/api/chat/rooms', {
               method: 'POST',
               headers: {
                 'Content-Type': 'application/json'
               },
               body: JSON.stringify({ userId: contact.id.toString() })
             })
           } catch (error) {
             // Ignore HTTP fallback errors - WebSocket should handle it
             console.warn('HTTP room creation fallback failed:', error)
           }
         }}
      >
        <AvatarWithBadge
          src={contact.avatar}
          isChatActive={isContactActive}
          alt={contact.fullName}
          badgeColor={statusColor}
          color={contact.avatarColor}
        />
        <div className='min-is-0 flex-auto'>
          <Typography color='inherit'>{contact.fullName || 'Unknown User'}</Typography>
          <Typography variant='body2' color={isContactActive ? 'inherit' : 'text.secondary'} className='truncate'>
            {lastSeenText}
          </Typography>
        </div>
        <div className='flex flex-col items-end justify-start'>
          {unreadCount > 0 ? (
            <Chip label={unreadCount > 99 ? '99+' : unreadCount} color='error' size='small' />
          ) : (
            <Typography
              variant='body2'
              color='inherit'
              className={classnames('truncate', {
                'text-textDisabled': !isContactActive
              })}
            >
              {statusText}
            </Typography>
          )}
        </div>
      </li>
    )
  })
}

// Scroll wrapper for chat list
const ScrollWrapper = ({ children, isBelowLgScreen }: { children: ReactNode; isBelowLgScreen: boolean }) => {
  if (isBelowLgScreen) {
    return <div className='bs-full overflow-y-auto overflow-x-hidden'>{children}</div>
  } else {
    return <PerfectScrollbar options={{ wheelPropagation: false }}>{children}</PerfectScrollbar>
  }
}

const SidebarLeft = (props: Props) => {
  // Props
  const {
    chatStore,
    getActiveUserData,
    dispatch,
    backdropOpen,
    setBackdropOpen,
    sidebarOpen,
    setSidebarOpen,
    isBelowLgScreen,
    isBelowMdScreen,
    isBelowSmScreen,
    messageInputRef,
    unreadCount,
    initializeRoom
  } = props

  // Hooks
  const { user, session } = useAuth()
  const { unreadByContact, userStatuses: unreadStatuses } = useUnreadByContact()
  const { statuses: presenceStatuses } = usePresence()
  const { navigation } = useTranslation()
  const { t } = useTranslate()
  const userStatuses = presenceStatuses && Object.keys(presenceStatuses).length > 0 ? presenceStatuses : unreadStatuses

  // Make session available in renderContacts function
  const currentSession = session
  const currentNavigation = navigation

  // States
  const [userSidebar, setUserSidebar] = useState(false)
  const [searchValue, setSearchValue] = useState<string | null>()

  const handleChange = (event: any, newValue: string | null) => {
    setSearchValue(newValue)
    const contact = chatStore.contacts.find(contact => contact.fullName === newValue)
    if (contact) {
      dispatch(addNewChat({ id: contact.id }))
      getActiveUserData(contact.id)
    }
    isBelowMdScreen && setSidebarOpen(false)
    setBackdropOpen(false)
    setSearchValue(null)
    messageInputRef.current?.focus()
  }

  return (
    <>
      <Drawer
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        className='bs-full'
        variant={!isBelowMdScreen ? 'permanent' : 'persistent'}
        ModalProps={{
          disablePortal: true,
          keepMounted: true // Better open performance on mobile.
        }}
        sx={{
          zIndex: isBelowMdScreen && sidebarOpen ? 11 : 10,
          position: !isBelowMdScreen ? 'static' : 'absolute',
          ...(isBelowSmScreen && sidebarOpen && { width: '100%' }),
          '& .MuiDrawer-paper': {
            overflow: 'hidden',
            boxShadow: 'none',
            width: isBelowSmScreen ? '100%' : '370px',
            position: !isBelowMdScreen ? 'static' : 'absolute'
          }
        }}
      >
        <div className='flex plb-[18px] pli-5 gap-4 border-be'>
          <AvatarWithBadge
            alt={session?.user?.name || ''}
            src={session?.user?.image || ''}
            badgeColor={statusObj.online}
          />
          <div className='flex is-full items-center flex-auto sm:gap-x-3'>
            <Autocomplete
              fullWidth
              size='small'
              id='select-contact'
              options={chatStore.contacts.map(contact => contact.fullName) || []}
              value={searchValue || null}
              onChange={handleChange}
              renderInput={params => (
                <TextField
                  {...params}
                  variant='outlined'
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '999px !important' } }}
                  placeholder={navigation.searchContacts}
                  slotProps={{
                    input: {
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position='end'>
                          <i className='ri-search-line text-xl' />
                        </InputAdornment>
                      )
                    }
                  }}
                />
              )}
              renderOption={(props, option) => {
                const contact = chatStore.contacts.find(contact => contact.fullName === option)

                return (
                  <li
                    {...props}
                    key={option.toLowerCase().replace(/\s+/g, '-')}
                    className={classnames('gap-3 max-sm:pli-3', props.className)}
                  >
                    {contact ? (
                      contact.avatar ? (
                        <Avatar
                          alt={contact.fullName}
                          src={contact.avatar}
                          key={option.toLowerCase().replace(/\s+/g, '-')}
                        />
                      ) : (
                        <CustomAvatar
                          color={contact.avatarColor as ThemeColor}
                          skin='light'
                          key={option.toLowerCase().replace(/\s+/g, '-')}
                        >
                          {getInitials(contact.fullName)}
                        </CustomAvatar>
                      )
                    ) : null}
                    {option}
                  </li>
                )
              }}
            />
            {isBelowMdScreen ? (
              <IconButton
                className='p-0 mis-2'
                onClick={() => {
                  setSidebarOpen(false)
                  setBackdropOpen(false)
                }}
              >
                <i className='ri-close-line' />
              </IconButton>
            ) : null}
          </div>
        </div>
        <ScrollWrapper isBelowLgScreen={isBelowLgScreen}>
          <ul className='p-3 pbs-4'>
            {chatStore.contacts.length === 0 ? (
              // Show skeleton loading for contacts
              Array.from({ length: 8 }).map((_, index) => (
                <li key={`skeleton-${index}`} className='flex items-start gap-4 pli-3 plb-2 mbe-1'>
                  <Skeleton variant='circular' width={40} height={40} />
                  <div className='min-is-0 flex-auto space-y-1.5'>
                    <Skeleton variant='rectangular' width={120} height={16} sx={{ borderRadius: 1 }} />
                    <Skeleton variant='rectangular' width={80} height={14} sx={{ borderRadius: 1 }} />
                  </div>
                  <div className='flex flex-col items-end justify-start'>
                    <Skeleton variant='rectangular' width={40} height={20} sx={{ borderRadius: 1 }} />
                  </div>
                </li>
              ))
            ) : (
              renderContacts({
                chatStore,
                getActiveUserData,
                backdropOpen,
                setSidebarOpen,
                isBelowMdScreen,
                setBackdropOpen,
                session: currentSession,
                unreadByContact,
                userStatuses,
                navigation: currentNavigation,
                user,
                initializeRoom,
                t
              })
            )}
          </ul>
        </ScrollWrapper>
      </Drawer>

      <UserProfileLeft
        userSidebar={userSidebar}
        setUserSidebar={setUserSidebar}
        profileUserData={chatStore.profileUser}
        dispatch={dispatch}
        isBelowLgScreen={isBelowLgScreen}
        isBelowSmScreen={isBelowSmScreen}
      />
    </>
  )
}

export default SidebarLeft

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
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

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

// Util Imports
import { getInitials } from '@/utils/formatting/getInitials'
import { formatDateToMonthShort } from './utils'

// Custom Hooks
import { useSocket } from '@/hooks/useSocket'
import { useUnreadByContact } from '@/hooks/useUnreadByContact'

export const statusObj: StatusObjType = {
  busy: 'error',
  away: 'warning',
  online: 'success',
  offline: 'secondary'
}

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
}

type RenderChatType = {
  chatStore: ChatDataType
  getActiveUserData: (id: string) => void
  setSidebarOpen: (value: boolean) => void
  backdropOpen: boolean
  setBackdropOpen: (value: boolean) => void
  isBelowMdScreen: boolean
  navigation: any
}

// Render contacts list (all users except current)
const renderContacts = (props: RenderChatType & { session: any; socket: any; unreadByContact: { [contactId: string]: number }; navigation: any; user: any }) => {
  // Props
  const { chatStore, getActiveUserData, setSidebarOpen, backdropOpen, setBackdropOpen, isBelowMdScreen, session, socket, unreadByContact, navigation, user } = props

  return chatStore.contacts.map(contact => {
    const isContactActive = chatStore.activeUser?.id === contact.id

    // Find the chat for this contact to get the last message
    const contactChat = chatStore.chats.find(chat => {
      const match = chat.id === contact.id.toString()
      return match
    })

    const lastMessage = contactChat?.chat && contactChat.chat.length > 0 ? contactChat.chat[contactChat.chat.length - 1]?.message : null

    // Get unread count for this contact
    const unreadCount = unreadByContact[contact.id] || 0

    return (
      <li
        key={`contact-${Math.random()}-${contact.about || 'no-about'}`}
        className={classnames('flex items-start gap-4 pli-3 plb-2 cursor-pointer rounded mbe-1', {
          'bg-primary shadow-xs': isContactActive,
          'text-[var(--mui-palette-primary-contrastText)]': isContactActive
        })}
        onClick={() => {
          if (socket && user?.id) {
            // Listen for room data response
            const handleRoomData = (data: any) => {
              socket.off('roomData', handleRoomData)
            }

            socket.on('roomData', handleRoomData)

            // Emit to socket to get or create room between current user and selected contact
            socket.emit('getOrCreateRoom', {
              user1Id: user.id,
              user2Id: contact.id.toString()
            })
          }

          // Set active user for UI
          getActiveUserData(contact.id)
          isBelowMdScreen && setSidebarOpen(false)
          isBelowMdScreen && backdropOpen && setBackdropOpen(false)
        }}
      >
        <AvatarWithBadge
          src={contact.avatar}
          isChatActive={isContactActive}
          alt={contact.fullName}
          badgeColor={statusObj[contact.status]}
          color={contact.avatarColor}
        />
        <div className='min-is-0 flex-auto'>
          <Typography color='inherit'>{contact.fullName}</Typography>
          <Typography variant='body2' color={isContactActive ? 'inherit' : 'text.secondary'} className='truncate'>
            {lastMessage || navigation.noMessagesYet}
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
              {contact.status}
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
    unreadCount
  } = props

  // Hooks
  const { user, session } = useAuth()
  const { socket } = useSocket(user?.id || null)
  const { unreadByContact } = useUnreadByContact()
  const { navigation } = useTranslation()

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
                  <Skeleton circle width={40} height={40} />
                  <div className='min-is-0 flex-auto'>
                    <Skeleton width={120} height={16} />
                    <Skeleton width={80} height={14} />
                  </div>
                  <div className='flex flex-col items-end justify-start'>
                    <Skeleton width={40} height={20} />
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
                socket,
                unreadByContact,
                navigation: currentNavigation,
                user
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

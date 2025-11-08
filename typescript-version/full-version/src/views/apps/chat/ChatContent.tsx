// @ts-nocheck
// React Imports
import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

// Next Imports
import { useRouter, useParams } from 'next/navigation'

// MUI Imports
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import CardContent from '@mui/material/CardContent'

import type { ChatRoom } from '@/lib/sockets/types/chat'

// Type Imports
import type { AppDispatch } from '@/redux-store'
import type { ChatDataType, ContactType } from '@/types/apps/chatTypes'

// Component Imports
import AvatarWithBadge from './AvatarWithBadge'
import { statusObj } from '@/utils/status'
import ChatLog from './ChatLog'
import SendMsgForm from './SendMsgForm'
import UserProfileRight from './UserProfileRight'
import CustomAvatar from '@core/components/mui/Avatar'
import { useTranslation } from '@/contexts/TranslationContext'

// Custom Hooks
import { useUnreadByContact } from '@/hooks/useUnreadByContact'

import type { ChatMessage } from '@/lib/sockets/types/chat'

type Props = {
  chatStore: ChatDataType
  dispatch: AppDispatch
  backdropOpen: boolean
  setBackdropOpen: (open: boolean) => void
  setSidebarOpen: (open: boolean) => void
  isBelowMdScreen: boolean
  isBelowLgScreen: boolean
  isBelowSmScreen: boolean
  messageInputRef: RefObject<HTMLDivElement>
  room: ChatRoom | null
  isRoomLoading: boolean
  sendMessage: (content: string) => Promise<void>
  messages: ChatMessage[]
  rateLimitData: { retryAfter: number; blockedUntil: number } | null
  markMessagesAsRead: () => void
}

// Renders the user avatar with badge and user information
const UserAvatar = ({
  activeUser,
  setUserProfileLeftOpen,
  setBackdropOpen,
  navigation,
  userStatuses
}: {
  activeUser: ContactType
  setUserProfileLeftOpen: (open: boolean) => void
  setBackdropOpen: (open: boolean) => void
  navigation: any
  userStatuses: { [userId: string]: { isOnline: boolean; lastSeen?: string } }
}) => {
  // Get real-time user status
  const userStatus = userStatuses[activeUser?.id || '']

  // Determine status text, last seen text and color
  let statusText: string
  let statusColor: string

  if (!userStatus) {
    // Data is still loading - fallback to static status
    statusText = activeUser?.status === 'online' ? navigation.online : navigation.offline
    statusColor = statusObj[activeUser?.status || 'offline']
  } else if (userStatus.isOnline) {
    statusText = navigation.online
    statusColor = statusObj.online
  } else if (userStatus.lastSeen) {
    // Format last seen time
    const lastSeenDate = new Date(userStatus.lastSeen)
    const now = new Date()
    const diffMs = now.getTime() - lastSeenDate.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) {
      statusText = navigation.justNow
    } else if (diffMins < 60) {
      statusText = navigation.minutesAgo.replace('{{count}}', diffMins.toString())
    } else if (diffHours < 24) {
      statusText = navigation.hoursAgo.replace('{{count}}', diffHours.toString())
    } else if (diffDays < 7) {
      statusText = navigation.daysAgo.replace('{{count}}', diffDays.toString())
    } else {
      statusText = lastSeenDate.toLocaleDateString('ru-RU')
    }
    statusColor = statusObj.offline
  } else {
    // User is offline and has no last seen time
    statusText = navigation.offline
    statusColor = statusObj.offline
  }

  return (
    <div
      className='flex items-center gap-4 cursor-pointer'
      onClick={() => {
        setUserProfileLeftOpen(true)
        setBackdropOpen(true)
      }}
    >
      <AvatarWithBadge
        alt={activeUser?.fullName}
        src={activeUser?.avatar}
        color={activeUser?.avatarColor}
        badgeColor={statusColor}
      />
      <div>
        <Typography color='text.primary'>{activeUser?.fullName}</Typography>
        <Typography variant='body2' color='text.secondary'>
          {statusText}
        </Typography>
      </div>
    </div>
  )
}

const ChatContent = (props: Props) => {
  // Props
  const {
    chatStore,
    dispatch,
    backdropOpen,
    setBackdropOpen,
    setSidebarOpen,
    isBelowMdScreen,
    isBelowSmScreen,
    isBelowLgScreen,
    messageInputRef,
    room,
    isRoomLoading,
    sendMessage,
    messages,
    rateLimitData,
    markMessagesAsRead
  } = props

  const { activeUser } = chatStore

  // Hooks
  const router = useRouter()
  const { lang } = useParams()
  const { navigation } = useTranslation()
  const { userStatuses } = useUnreadByContact()

  // States
  const [userProfileRightOpen, setUserProfileRightOpen] = useState(false)

  console.log('🔍 [ChatContent] Render:', {
    hasActiveUser: !!activeUser,
    activeUserId: activeUser?.id,
    activeUserName: activeUser?.fullName
  })

  // Close user profile right drawer if backdrop is closed and user profile right drawer is open
  useEffect(() => {
    if (!backdropOpen && userProfileRightOpen) {
      setUserProfileRightOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backdropOpen])

  return !chatStore.activeUser ? (
    <CardContent className='flex flex-col flex-auto items-center justify-center bs-full gap-[18px] bg-[var(--mui-palette-customColors-chatBg)]'>
      <CustomAvatar variant='circular' size={98} color='primary' skin='light'>
        <i className='ri-wechat-line text-[50px]' />
      </CustomAvatar>
      <Typography className='text-center'>{navigation.selectContact}</Typography>
      {isBelowMdScreen && (
        <Button
          variant='contained'
          className='rounded-full'
          onClick={() => {
            setSidebarOpen(true)
            isBelowSmScreen ? setBackdropOpen(false) : setBackdropOpen(true)
          }}
        >
          {navigation.selectContact}
        </Button>
      )}
    </CardContent>
  ) : (
    <>
      {activeUser && (
        <div className='flex flex-col flex-grow bs-full'>
          <div className='flex items-center justify-between border-be plb-[17px] pli-5 bg-[var(--mui-palette-customColors-chatBg)]'>
            {isBelowMdScreen ? (
              <div className='flex items-center gap-4'>
                <IconButton
                  size='small'
                  onClick={() => {
                    setSidebarOpen(true)
                    setBackdropOpen(true)
                  }}
                >
                  <i className='ri-menu-line text-textSecondary' />
                </IconButton>
                <UserAvatar
                  activeUser={activeUser}
                  setBackdropOpen={setBackdropOpen}
                  setUserProfileLeftOpen={setUserProfileRightOpen}
                  navigation={navigation}
                  userStatuses={userStatuses}
                />
              </div>
            ) : (
              <UserAvatar
                activeUser={activeUser}
                setBackdropOpen={setBackdropOpen}
                setUserProfileLeftOpen={setUserProfileRightOpen}
                navigation={navigation}
                userStatuses={userStatuses}
              />
            )}
            {isBelowMdScreen ? null : (
              <div className='flex items-center gap-1'>
                <IconButton size='small'>
                  <i className='ri-search-line text-textSecondary' />
                </IconButton>
              </div>
            )}
          </div>

          <ChatLog
            chatStore={chatStore}
            isBelowMdScreen={isBelowMdScreen}
            isBelowSmScreen={isBelowSmScreen}
            isBelowLgScreen={isBelowLgScreen}
            messages={messages}
            markMessagesAsRead={markMessagesAsRead}
            room={room}
            isRoomLoading={isRoomLoading}
          />

          <SendMsgForm
            dispatch={dispatch}
            activeUser={activeUser}
            isBelowSmScreen={isBelowSmScreen}
            messageInputRef={messageInputRef}
            room={room}
            isRoomLoading={isRoomLoading}
            sendMessage={sendMessage}
            rateLimitData={rateLimitData}
          />
        </div>
      )}

      {activeUser && (
        <UserProfileRight
          open={userProfileRightOpen}
          handleClose={() => {
            setUserProfileRightOpen(false)
            setBackdropOpen(false)
          }}
          activeUser={activeUser}
          isBelowSmScreen={isBelowSmScreen}
          isBelowLgScreen={isBelowLgScreen}
        />
      )}
    </>
  )
}

export default ChatContent

// @ts-nocheck
'use client'

// React Imports
import { useEffect, useRef, useState } from 'react'

// Hook Imports
import { usePermissions } from '@/hooks/usePermissions'

// MUI Imports
import Backdrop from '@mui/material/Backdrop'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { Theme } from '@mui/material/styles'

// Third-party Imports
import classNames from 'classnames'
import { useDispatch, useSelector } from 'react-redux'
import { useAuth } from '@/contexts/AuthProvider'

// Type Imports
import type { RootState } from '@/redux-store'

// Slice Imports
import { getActiveUserData, fetchUsers, sendMsg } from '@/redux-store/slices/chat'

// Component Imports
import SidebarLeft from './SidebarLeft'
import ChatContent from './ChatContent'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'
import { useChatNew } from '@/hooks/useChatNew'

// Util Imports
import { commonLayoutClasses } from '@layouts/utils/layoutClasses'

const ChatWrapper = () => {
  // Hooks
  const { settings } = useSettings()
  const dispatch = useDispatch()
  const chatStore = useSelector((state: RootState) => state.chatReducer)
  const { user, session } = useAuth()
  const unreadCount = (typeof window !== 'undefined' && (window as any).notificationsManager)
    ? (window as any).notificationsManager.unreadCount
    : 0
  const {
    initializeRoom,
    room,
    isRoomLoading,
    sendMessage,
    messages,
    rateLimitData,
    markMessagesAsRead,
    loadMoreMessages,
    historyLoading,
    hasMoreHistory,
    isConnected
  } = useChatNew()
  const { checkPermission } = usePermissions()
  const isBelowLgScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('lg'))
  const isBelowMdScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'))
  const isBelowSmScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'))

  // States
  const [backdropOpen, setBackdropOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Refs
  const messageInputRef = useRef<HTMLDivElement>(null)

  // Get active user’s data
  const activeUser = (id: string) => {
    dispatch(getActiveUserData(id))
  }

  // Focus on message input when active user changes
  useEffect(() => {
    if (chatStore.activeUser?.id !== null && messageInputRef.current) {
      messageInputRef.current.focus()
    }
  }, [chatStore.activeUser])

  // Load users from database on component mount
  useEffect(() => {
    dispatch(fetchUsers())
  }, [dispatch])

  // Mark messages as read when active user changes
  useEffect(() => {
    if (chatStore.activeUser?.id && user?.id && room?.id) {
      markMessagesAsRead()
    }
  }, [chatStore.activeUser?.id, user?.id, room?.id, markMessagesAsRead])

  // Load existing chat messages for all contacts on component mount
  useEffect(() => {
    if (chatStore.contacts.length > 0 && user?.id) {
      // Load messages immediately without delay
      chatStore.contacts.forEach((contact) => {
        if (contact.id !== user?.id) {
          // Since sockets are global, we can emit directly
          // SocketProvider keeps the connection alive for us
        }
      })
    }
  }, [chatStore.contacts.length, user?.id])

  // Close backdrop when sidebar is open on below md screen
  useEffect(() => {
    if (!isBelowMdScreen && backdropOpen && sidebarOpen) {
      setBackdropOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBelowMdScreen])

  // Open backdrop when sidebar is open on below sm screen
  useEffect(() => {
    if (!isBelowSmScreen && sidebarOpen) {
      setBackdropOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBelowSmScreen])

  // Close sidebar when backdrop is closed on below md screen
  useEffect(() => {
    if (!backdropOpen && sidebarOpen) {
      setSidebarOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backdropOpen])

  return (
    <>
      <div
        className={classNames(commonLayoutClasses.contentHeightFixed, 'flex is-full overflow-hidden rounded relative', {
          border: settings.skin === 'bordered',
          'shadow-md': settings.skin !== 'bordered'
        })}
      >
      <SidebarLeft
        chatStore={chatStore}
        getActiveUserData={activeUser}
        dispatch={dispatch}
        backdropOpen={backdropOpen}
        setBackdropOpen={setBackdropOpen}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isBelowLgScreen={isBelowLgScreen}
        isBelowMdScreen={isBelowMdScreen}
        isBelowSmScreen={isBelowSmScreen}
        messageInputRef={messageInputRef}
        unreadCount={unreadCount}
        initializeRoom={initializeRoom}
      />

      <ChatContent
        chatStore={chatStore}
        dispatch={dispatch}
        backdropOpen={backdropOpen}
        setBackdropOpen={setBackdropOpen}
        setSidebarOpen={setSidebarOpen}
        isBelowMdScreen={isBelowMdScreen}
        isBelowLgScreen={isBelowLgScreen}
        isBelowSmScreen={isBelowSmScreen}
        messageInputRef={messageInputRef}
        room={room}
        isRoomLoading={isRoomLoading}
        sendMessage={sendMessage}
        messages={messages}
        rateLimitData={rateLimitData}
        markMessagesAsRead={markMessagesAsRead}
        loadMoreMessages={loadMoreMessages}
        historyLoading={historyLoading}
        hasMoreHistory={hasMoreHistory}
        isConnected={isConnected}
      />

      <Backdrop open={backdropOpen} onClick={() => setBackdropOpen(false)} className='absolute z-10' />
    </div>
    </>
  )
}

export default ChatWrapper

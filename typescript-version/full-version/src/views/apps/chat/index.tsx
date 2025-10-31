'use client'

// React Imports
import { useEffect, useRef, useState } from 'react'

// MUI Imports
import Backdrop from '@mui/material/Backdrop'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { Theme } from '@mui/material/styles'

// Third-party Imports
import classNames from 'classnames'
import { useDispatch, useSelector } from 'react-redux'
import { useSession } from 'next-auth/react'

// Type Imports
import type { RootState } from '@/redux-store'

// Slice Imports
import { getActiveUserData, fetchUsers, sendMsg } from '@/redux-store/slices/chat'

// Component Imports
import SidebarLeft from './SidebarLeft'
import ChatContent from './ChatContent'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'
import { useSocket } from '@/hooks/useSocket'

// Util Imports
import { commonLayoutClasses } from '@layouts/utils/layoutClasses'

const ChatWrapper = () => {
  // States
  const [backdropOpen, setBackdropOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Refs
  const messageInputRef = useRef<HTMLDivElement>(null)

  // Hooks
  const { settings } = useSettings()
  const dispatch = useDispatch()
  const chatStore = useSelector((state: RootState) => state.chatReducer)
  const { data: session } = useSession()
  const { socket, isConnected } = useSocket(session?.user?.id || null)
  const isBelowLgScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('lg'))
  const isBelowMdScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'))
  const isBelowSmScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'))

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
    if (chatStore.activeUser?.id) {
      console.log('👁️ Активный пользователь изменился, помечаем сообщения как прочитанные')
      // Here we would call markMessagesAsRead, but we need to get it from useChat hook
      // For now, we'll use a direct API call
      const markAsRead = async () => {
        try {
          // Find the room for current user and active user
          const currentUserId = session?.user?.id
          const activeUserId = chatStore.activeUser!.id

          if (currentUserId && activeUserId) {
            // We need to find the actual room ID from the database
            // For now, let's skip this and implement it properly later
            console.log('⏭️ Пропускаем отметку сообщений как прочитанных - нужно получить roomId')
          }
        } catch (error) {
          console.error('❌ Ошибка при отметке сообщений как прочитанных:', error)
        }
      }

      // markAsRead() // Temporarily disabled
    }
  }, [chatStore.activeUser?.id, session?.user?.id])

  // Load existing chat messages for all contacts on component mount
  useEffect(() => {
    console.log('🚀 [PAGE LOAD] useEffect сработал:', {
      contactsLength: chatStore.contacts.length,
      sessionUserId: session?.user?.id,
      isConnected: isConnected,
      socketExists: !!socket
    })

    if (chatStore.contacts.length > 0 && session?.user?.id && isConnected) {
      console.log('🔄 [PAGE LOAD] Загрузка сообщений для всех контактов при монтировании компонента')

      // Load messages immediately without delay
      chatStore.contacts.forEach((contact, index) => {
        if (contact.id !== session.user.id) {
          console.log(`📤 [PAGE LOAD] Запрос комнаты ${index + 1} для контакта:`, {
            contactId: contact.id,
            contactName: contact.fullName,
            user1Id: session.user.id,
            user2Id: contact.id
          })

          socket?.emit('getOrCreateRoom', {
            user1Id: session.user.id,
            user2Id: contact.id
          })
        }
      })
    } else {
      console.log('⏳ [PAGE LOAD] Условия не выполнены для загрузки сообщений:', {
        contactsLength: chatStore.contacts.length,
        sessionUserId: session?.user?.id,
        isConnected: isConnected
      })
    }
  }, [chatStore.contacts.length, session?.user?.id, socket, isConnected])

  // Load last messages from database directly
  useEffect(() => {
    const loadLastMessages = async () => {
      console.log('👤 [DEBUG] ID текущего пользователя:', session?.user?.id)
      console.log('👥 [DEBUG] ID пользователей в сайдбаре:', chatStore.contacts.map(c => ({ id: c.id, name: c.fullName })))

      if (chatStore.contacts.length > 0 && session?.user?.id) {
        console.log('📚 [DB LOAD] Загрузка последних сообщений из базы данных для пользователя:', session.user.id)

        try {
          console.log('🌐 [DB LOAD] Отправка запроса к /api/chat/last-messages')
          const response = await fetch('/api/chat/last-messages')
          console.log('📡 [DB LOAD] Ответ сервера:', response.status, response.statusText)

          if (response.ok) {
            const lastMessages = await response.json()
            console.log('📨 [DB LOAD] Получены последние сообщения:', lastMessages.length, 'шт.')
            console.log('🏠 [DEBUG] Найденные комнаты с пользователями и последними сообщениями:')
            lastMessages.forEach((msg: any, index: number) => {
              console.log(`   Комната ${index + 1}:`, {
                senderId: msg.senderId,
                receiverId: msg.receiverId,
                content: msg.content.substring(0, 50) + '...',
                createdAt: msg.createdAt
              })
            })

            // Update Redux store with last messages
            lastMessages.forEach((msg: any, index: number) => {
              console.log(`💾 [DB LOAD] Сохранение сообщения ${index + 1}:`, {
                content: msg.content.substring(0, 30) + '...',
                senderId: msg.senderId,
                receiverId: msg.receiverId
              })

              dispatch(sendMsg({
                message: msg.content,
                senderId: msg.senderId,
                receiverId: msg.receiverId
              }))
            })

            console.log('✅ [DB LOAD] Все сообщения сохранены в Redux store')
          } else {
            console.error('❌ [DB LOAD] Ошибка ответа сервера:', response.status)
          }
        } catch (error) {
          console.error('❌ [DB LOAD] Ошибка загрузки последних сообщений:', error)
        }
      } else {
        console.log('⏳ [DB LOAD] Условия не выполнены:', {
          contactsLength: chatStore.contacts.length,
          sessionUserId: session?.user?.id
        })
      }
    }

    loadLastMessages()
  }, [chatStore.contacts.length, session?.user?.id, dispatch])

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
      />

      <Backdrop open={backdropOpen} onClick={() => setBackdropOpen(false)} className='absolute z-10' />
    </div>
  )
}

export default ChatWrapper

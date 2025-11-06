// React Imports
import { useRef, useEffect, useState } from 'react'
import type { MutableRefObject, ReactNode } from 'react'

// Next Imports
import { useParams } from 'next/navigation'

// MUI Imports
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import CardContent from '@mui/material/CardContent'
import Backdrop from '@mui/material/Backdrop'
import CircularProgress from '@mui/material/CircularProgress'

// Third-party Imports
import classnames from 'classnames'
import PerfectScrollbar from 'react-perfect-scrollbar'
import { useAuth } from '@/contexts/AuthProvider'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

// Type Imports
import type { ChatType, ChatDataType, UserChatType, ProfileUserType } from '@/types/apps/chatTypes'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Util Imports
import { getInitials } from '@/utils/formatting/getInitials'

// Custom Hooks
import { useChat } from '@/hooks/useChat'

type MsgGroupType = {
  senderId: string
  messages: Omit<UserChatType, 'senderId'>[]
}

type ChatLogProps = {
  chatStore: ChatDataType
  isBelowLgScreen: boolean
  isBelowMdScreen: boolean
  isBelowSmScreen: boolean
}

// Formats the chat data into a structured format for display.
const formatedChatData = (chats: ChatType['chat'], profileUser: ProfileUserType) => {
  const formattedChatData: MsgGroupType[] = []
  let chatMessageSenderId = chats[0] ? chats[0].senderId : profileUser.id
  let msgGroup: MsgGroupType = {
    senderId: chatMessageSenderId,
    messages: []
  }

  chats.forEach((chat, index) => {
    if (chatMessageSenderId === chat.senderId) {
      msgGroup.messages.push({
        time: chat.time,
        message: chat.message,
        msgStatus: chat.msgStatus
      })
    } else {
      chatMessageSenderId = chat.senderId

      formattedChatData.push(msgGroup)
      msgGroup = {
        senderId: chat.senderId,
        messages: [
          {
            time: chat.time,
            message: chat.message,
            msgStatus: chat.msgStatus
          }
        ]
      }
    }

    if (index === chats.length - 1) formattedChatData.push(msgGroup)
  })

  return formattedChatData
}

// Wrapper for the chat log to handle scrolling
const ScrollWrapper = ({
  children,
  isBelowLgScreen,
  scrollRef,
  className
}: {
  children: ReactNode
  isBelowLgScreen: boolean
  scrollRef: MutableRefObject<null>
  className?: string
}) => {
  if (isBelowLgScreen) {
    return (
      <div ref={scrollRef} className={classnames('bs-full overflow-y-auto overflow-x-hidden', className)}>
        {children}
      </div>
    )
  } else {
    return (
      <PerfectScrollbar ref={scrollRef} options={{ wheelPropagation: false }} className={className}>
        {children}
      </PerfectScrollbar>
    )
  }
}

const ChatLog = ({ chatStore, isBelowLgScreen, isBelowMdScreen, isBelowSmScreen }: ChatLogProps) => {
  // Props
  const { profileUser, contacts } = chatStore

  // Vars
  const activeUserChat = chatStore.chats.find((chat: ChatType) => chat.userId === chatStore.activeUser?.id)

  // Hooks
  const { user, session } = useAuth()
  const { lang: locale } = useParams()
  const { messages: socketMessages, markMessagesAsRead, room, isRoomLoading } = useChat(chatStore.activeUser?.id?.toString())


  // Refs
  const scrollRef = useRef(null)
  const lastProcessedMessageId = useRef<string | null>(null)

  // Function to scroll to bottom when new message is sent
  const scrollToBottom = () => {
    if (scrollRef.current) {
      if (isBelowLgScreen) {
        // @ts-ignore
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      } else {
        // @ts-ignore
        scrollRef.current._container.scrollTop = scrollRef.current._container.scrollHeight
      }
    }
  }

  // Function to play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio(`/${locale}/new_message_codeweber.wav`)
      audio.volume = 0.2
      audio.play().catch(() => {})
    } catch (err) {
      // Error handling
    }
  }

  // Scroll to bottom on new message
  useEffect(() => {
    if (activeUserChat && activeUserChat.chat && activeUserChat.chat.length) {
      scrollToBottom()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatStore])

  // Scroll to bottom when socket messages change
  useEffect(() => {
    if (socketMessages && socketMessages.length) {
      scrollToBottom()

      // Play notification sound for new messages (only for messages not sent by current user)
      const latestMessage = socketMessages[socketMessages.length - 1]
      if (latestMessage && latestMessage.senderId !== user?.id && latestMessage.id !== lastProcessedMessageId.current) {
        lastProcessedMessageId.current = latestMessage.id
        playNotificationSound()
      }
    }
  }, [socketMessages, user?.id])

  // Mark messages as read when chat is opened
  useEffect(() => {
    if (chatStore.activeUser?.id && user?.id && markMessagesAsRead && room?.id) {
      markMessagesAsRead()
    }
  }, [chatStore.activeUser?.id, user?.id, room?.id])


  return (
    <ScrollWrapper
      isBelowLgScreen={isBelowLgScreen}
      scrollRef={scrollRef}
      className='bg-[var(--mui-palette-customColors-chatBg)]'
    >
      <CardContent className='p-0'>
        {/* Show loading state while room is loading */}
        {isRoomLoading ? (
          <div className='flex flex-col gap-4 p-5 absolute inset-0 z-10 bg-[var(--mui-palette-customColors-chatBg)]'>
            {/* Skeleton for messages */}
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className={classnames('flex gap-4', { 'flex-row-reverse': index % 2 === 1 })}>
                <Skeleton circle width={32} height={32} />
                <div className='flex flex-col gap-2'>
                  <Skeleton width={200} height={20} />
                  <Skeleton width={150} height={16} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Render Socket.IO messages if available, otherwise fallback to Redux */}
            {socketMessages && socketMessages.filter(message => message.content && message.content.trim() !== '').length > 0 ? (
           socketMessages.filter(message => message.content && message.content.trim() !== '').map((message, index) => {
            const isSender = message.senderId === user?.id;

            return (
              <div key={message.id} className={classnames('flex gap-4 p-5', { 'flex-row-reverse': isSender })}>
                {!isSender ? (
                  contacts.find(contact => contact.id === message.senderId)?.avatar ? (
                    <Avatar
                      alt={contacts.find(contact => contact.id === message.senderId)?.fullName}
                      src={contacts.find(contact => contact.id === message.senderId)?.avatar}
                      className='is-8 bs-8'
                    />
                  ) : (
                    <CustomAvatar
                      color={contacts.find(contact => contact.id === message.senderId)?.avatarColor}
                      skin='light'
                      size={32}
                    >
                      {getInitials(contacts.find(contact => contact.id === message.senderId)?.fullName as string)}
                    </CustomAvatar>
                  )
                ) : session?.user?.image ? (
                  <Avatar alt={session?.user?.name || ''} src={session?.user?.image} className='is-8 bs-8' />
                ) : (
                  <CustomAvatar alt={session?.user?.name || ''} src={session?.user?.image || undefined} size={32} />
                )}
                <div
                  className={classnames('flex flex-col gap-2', {
                    'items-end': isSender,
                    'max-is-[65%]': !isBelowMdScreen,
                    'max-is-[75%]': isBelowMdScreen && !isBelowSmScreen,
                    'max-is-[calc(100%-5.75rem)]': isBelowSmScreen
                  })}
                >
                  {message.content && message.content.trim() !== '' ? (
                    <Typography
                      className={classnames('whitespace-pre-wrap pli-4 plb-2 shadow-xs', {
                        'bg-backgroundPaper rounded-e rounded-b': !isSender,
                        'bg-primary text-[var(--mui-palette-primary-contrastText)] rounded-s rounded-b': isSender
                      })}
                      style={{ wordBreak: 'break-word' }}
                    >
                      {message.content}
                    </Typography>
                  ) : (
                    <Typography
                      className={classnames('whitespace-pre-wrap pli-4 plb-2 shadow-xs', {
                        'bg-backgroundPaper rounded-e rounded-b': !isSender,
                        'bg-primary text-[var(--mui-palette-primary-contrastText)] rounded-s rounded-b': isSender
                      })}
                      style={{ wordBreak: 'break-word' }}
                    >
                      Вы можете написать мне личное сообщение
                    </Typography>
                  )}
                  <div className='flex items-center gap-2'>
                    {isSender && (
                      <>
                        {message.readAt ? (
                          <i className='ri-check-double-line text-success text-base' />
                        ) : (
                          <i className='ri-check-line text-base' />
                        )}
                      </>
                    )}
                    <Typography variant='caption'>
                      {new Date(message.createdAt).toLocaleString('en-US', {
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: false
                      })}
                    </Typography>
                  </div>
                </div>
              </div>
            );
          })
            ) : (
              activeUserChat &&
              formatedChatData(activeUserChat.chat, profileUser).map((msgGroup, index) => {
                const isSender = msgGroup.senderId === profileUser.id

                return (
                  <div key={index} className={classnames('flex gap-4 p-5', { 'flex-row-reverse': isSender })}>
                    {!isSender ? (
                      contacts.find(contact => contact.id === activeUserChat?.userId)?.avatar ? (
                        <Avatar
                          alt={contacts.find(contact => contact.id === activeUserChat?.userId)?.fullName}
                          src={contacts.find(contact => contact.id === activeUserChat?.userId)?.avatar}
                          className='is-8 bs-8'
                        />
                      ) : (
                        <CustomAvatar
                          color={contacts.find(contact => contact.id === activeUserChat?.userId)?.avatarColor}
                          skin='light'
                          size={32}
                        >
                          {getInitials(contacts.find(contact => contact.id === activeUserChat?.userId)?.fullName as string)}
                        </CustomAvatar>
                      )
                    ) : session?.user?.image ? (
                      <Avatar alt={session?.user?.name || ''} src={session?.user?.image} className='is-8 bs-8' />
                    ) : (
                      <CustomAvatar alt={session?.user?.name || ''} src={session?.user?.image || undefined} size={32} />
                    )}
                    <div
                      className={classnames('flex flex-col gap-2', {
                        'items-end': isSender,
                        'max-is-[65%]': !isBelowMdScreen,
                        'max-is-[75%]': isBelowMdScreen && !isBelowSmScreen,
                        'max-is-[calc(100%-5.75rem)]': isBelowSmScreen
                      })}
                    >
                      {msgGroup.messages.map((msg, index) => (
                        msg.message && msg.message.trim() !== '' ? (
                          <Typography
                            key={index}
                            className={classnames('whitespace-pre-wrap pli-4 plb-2 shadow-xs', {
                              'bg-backgroundPaper rounded-e rounded-b': !isSender,
                              'bg-primary text-[var(--mui-palette-primary-contrastText)] rounded-s rounded-b': isSender
                            })}
                            style={{ wordBreak: 'break-word' }}
                          >
                            {msg.message}
                          </Typography>
                        ) : (
                          <Typography
                            key={index}
                            className={classnames('whitespace-pre-wrap pli-4 plb-2 shadow-xs', {
                              'bg-backgroundPaper rounded-e rounded-b': !isSender,
                              'bg-primary text-[var(--mui-palette-primary-contrastText)] rounded-s rounded-b': isSender
                            })}
                            style={{ wordBreak: 'break-word' }}
                          >
                            Вы можете написать мне личное сообщение
                          </Typography>
                        )
                      ))}
                      {msgGroup.messages.map(
                        (msg, index) =>
                          index === msgGroup.messages.length - 1 &&
                          (isSender ? (
                            <div key={index} className='flex items-center gap-2'>
                              {msg.msgStatus?.isSeen ? (
                                <i className='ri-check-double-line text-success text-base' />
                              ) : msg.msgStatus?.isDelivered ? (
                                <i className='ri-check-double-line text-base' />
                              ) : (
                                msg.msgStatus?.isSent && <i className='ri-check-line text-base' />
                              )}
                              {index === activeUserChat.chat.length - 1 ? (
                                <Typography variant='caption'>
                                  {new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: false })}
                                </Typography>
                              ) : msg.time ? (
                                <Typography variant='caption'>
                                  {new Date(msg.time).toLocaleString('en-US', {
                                    hour: 'numeric',
                                    minute: 'numeric',
                                    hour12: false
                                  })}
                                </Typography>
                              ) : null}
                            </div>
                          ) : index === activeUserChat.chat.length - 1 ? (
                            <Typography key={index} variant='caption'>
                              {new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: false })}
                            </Typography>
                          ) : msg.time ? (
                            <Typography key={index} variant='caption'>
                              {new Date(msg.time).toLocaleString('en-US', {
                                hour: 'numeric',
                                minute: 'numeric',
                                hour12: false
                              })}
                            </Typography>
                          ) : null)
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}
      </CardContent>
    </ScrollWrapper>
  )
}

export default ChatLog

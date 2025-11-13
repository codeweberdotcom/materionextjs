// @ts-nocheck
// React Imports
import { useRef, useEffect, useCallback } from 'react'

// Next Imports
import { useParams } from 'next/navigation'

// MUI Imports
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import CardContent from '@mui/material/CardContent'
import CircularProgress from '@mui/material/CircularProgress'

// Third-party Imports
import classnames from 'classnames'
import { useAuth } from '@/contexts/AuthProvider'
import Skeleton from '@mui/material/Skeleton'

// Type Imports
import type { ChatDataType } from '@/types/apps/chatTypes'
import type { ChatMessage, ChatRoom } from '@/lib/sockets/types/chat'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'
import { useTranslation } from '@/contexts/TranslationContext'

// Util Imports
import { getInitials } from '@/utils/formatting/getInitials'

type ChatLogProps = {
  chatStore: ChatDataType
  isBelowMdScreen: boolean
  isBelowSmScreen: boolean
  messages: ChatMessage[]
  markMessagesAsRead: () => void
  room: ChatRoom | null
  isRoomLoading: boolean
  loadMoreMessages: () => Promise<void>
  historyLoading: boolean
  hasMoreHistory: boolean
}

const ChatLog = ({
  chatStore,
  isBelowMdScreen,
  isBelowSmScreen,
  messages,
  markMessagesAsRead,
  room,
  isRoomLoading,
  loadMoreMessages,
  historyLoading,
  hasMoreHistory
}: ChatLogProps) => {
  const { contacts } = chatStore
  const { user, session } = useAuth()
  const { lang: locale } = useParams()
  const dictionary = useTranslation()

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const lastProcessedMessageId = useRef<string | null>(null)
  const shouldAutoScrollRef = useRef(true)
  const prevScrollHeightRef = useRef<number | null>(null)
  const prevScrollTopRef = useRef<number>(0)

  const playNotificationSound = () => {
    try {
      const audio = new Audio(`/${locale}/new_message_codeweber.wav`)
      audio.volume = 0.2
      audio.play().catch(() => {})
    } catch (err) {}
  }

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  const handleScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    shouldAutoScrollRef.current = scrollHeight - (scrollTop + clientHeight) < 80

    if (scrollTop < 80 && hasMoreHistory && !historyLoading) {
      prevScrollHeightRef.current = scrollHeight
      prevScrollTopRef.current = scrollTop
      loadMoreMessages()
    }
  }, [hasMoreHistory, historyLoading, loadMoreMessages])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  useEffect(() => {
    if (historyLoading) return

    const container = scrollRef.current
    if (!container) return

    if (prevScrollHeightRef.current !== null) {
      const diff = container.scrollHeight - prevScrollHeightRef.current
      container.scrollTop = (prevScrollTopRef.current ?? 0) + diff
      prevScrollHeightRef.current = null
      return
    }

    if (messages.length && shouldAutoScrollRef.current) {
      scrollToBottom()
    }

    const latestMessage = messages[messages.length - 1]
    if (latestMessage && latestMessage.senderId !== user?.id && latestMessage.id !== lastProcessedMessageId.current) {
      lastProcessedMessageId.current = latestMessage.id
      playNotificationSound()
    }
  }, [messages, historyLoading, user?.id])

  useEffect(() => {
    if (chatStore.activeUser?.id && user?.id && room?.id) {
      markMessagesAsRead()
    }
  }, [chatStore.activeUser?.id, user?.id, room?.id, markMessagesAsRead])

  const renderedMessages = messages.filter(message => message.content && message.content.trim() !== '')

  return (
    <div className='bg-[var(--mui-palette-customColors-chatBg)] flex flex-col flex-1 overflow-hidden'>
      <div ref={scrollRef} className='flex-1 overflow-y-auto overflow-x-hidden relative'>
        <CardContent className='p-0'>
          {historyLoading && (
            <div className='flex justify-center py-3'>
              <CircularProgress size={18} />
            </div>
          )}

          {isRoomLoading ? (
            <div className='flex flex-col gap-4 p-5 absolute inset-0 z-10 bg-[var(--mui-palette-customColors-chatBg)]'>
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className={classnames('flex gap-4', { 'flex-row-reverse': index % 2 === 1 })}>
                  <Skeleton variant='circular' width={32} height={32} />
                  <div className='flex flex-col gap-2'>
                    <Skeleton variant='rectangular' width={200} height={20} sx={{ borderRadius: 1 }} />
                    <Skeleton variant='rectangular' width={150} height={16} sx={{ borderRadius: 1 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : renderedMessages.length > 0 ? (
            renderedMessages.map(message => {
              const isSender = message.senderId === user?.id
              const isOptimistic = message.isOptimistic
              const isFailed = message.deliveryStatus === 'failed'

              const contact = contacts.find(contact => contact.id === message.senderId)

              return (
                <div key={message.id} className={classnames('flex gap-4 p-5', { 'flex-row-reverse': isSender })}>
                  {!isSender ? (
                    contact?.avatar ? (
                      <Avatar
                        alt={contact?.fullName}
                        src={contact?.avatar}
                        className='is-8 bs-8'
                      />
                    ) : (
                      <CustomAvatar color={contact?.avatarColor} skin='light' size={32}>
                        {getInitials(contact?.fullName || '')}
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
                    <div className='flex items-center gap-2'>
                      {(() => {
                        const baseClasses = classnames('whitespace-pre-wrap pli-4 plb-2 shadow-xs', {
                          'bg-backgroundPaper rounded-e rounded-b': !isSender,
                          'bg-primary text-[var(--mui-palette-primary-contrastText)] rounded-s rounded-b': isSender,
                          'opacity-60': isOptimistic && !isFailed
                        })

                      const bubbleStyle = isFailed
                        ? {
                            wordBreak: 'break-word' as const,
                            background: 'var(--mui-palette-error-light)',
                            color: 'var(--mui-palette-error-main)'
                          }
                        : { wordBreak: 'break-word' as const }

                      return (
                        <Typography
                          className={classnames(baseClasses, 'flex items-center gap-2')}
                          style={bubbleStyle}
                        >
                          <span>{message.content}</span>
                          {isOptimistic && !isFailed && (
                            <CircularProgress
                              size={14}
                              sx={{
                                color: isSender
                                  ? 'var(--mui-palette-primary-contrastText)'
                                  : 'var(--mui-palette-text-primary)'
                              }}
                            />
                          )}
                        </Typography>
                      )
                    })()}
                  </div>
                    {isFailed && (
                      <Typography variant='caption' color='error'>
                        Не отправлено
                      </Typography>
                    )}
                    <div className='flex items-center gap-2'>
                      {isSender && !isOptimistic && !isFailed && (
                        <>{message.readAt ? <i className='ri-check-double-line text-success text-base' /> : <i className='ri-check-line text-base' />}</>
                      )}
                      <Typography variant='caption'>
                        {new Date(message.createdAt).toLocaleString('ru-RU', {
                          hour: 'numeric',
                          minute: 'numeric'
                        })}
                      </Typography>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className='flex flex-col items-center justify-center text-center gap-2 py-12 min-h-[260px] grow'>
              <Typography variant='body1' color='text.secondary' className='text-center'>
                {dictionary.navigation?.chatNoMessagesPlaceholder || 'Select a contact to start a conversation.'}
              </Typography>
            </div>
          )}
        </CardContent>
      </div>
    </div>
  )
}

export default ChatLog

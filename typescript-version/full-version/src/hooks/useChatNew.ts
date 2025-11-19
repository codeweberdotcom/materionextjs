import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthProvider'
import { useDispatch, useSelector } from 'react-redux'
import { sendMsg } from '@/redux-store/slices/chat'
import { useSockets } from '@/contexts/SocketProvider'
import type { ChatMessage, ChatRoom } from '@/lib/sockets/types/chat'
import { normalizeMessageContent } from '@/utils/chat/normalizeMessageContent'
import { toast } from 'react-toastify'
import { useTranslation } from '@/contexts/TranslationContext'
import type { RootState } from '@/redux-store'
import {
  enqueueMessage,
  markMessageDelivered,
  markMessageFailed,
  markMessageSending
} from '@/redux-store/slices/chatQueue'

type RateLimitExceededPayload = {
  retryAfter?: number
  blockedUntil?: number
  retryAfterSec?: number
  blockedUntilMs?: number
}

type SendMessageAck = {
  ok: boolean
  message?: ChatMessage
  error?: string
  retryAfter?: number
  blockedUntil?: number
}

const generateClientId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useChatNew = (otherUserId?: string) => {
  const { user } = useAuth()
  const { chatSocket } = useSockets()
  const dispatch = useDispatch()
  const dictionary = useTranslation()
  const queuedMessagesMap = useSelector((state: RootState) => state.chatQueue.messages)
  const queuedMessages = useMemo(() => Object.values(queuedMessagesMap), [queuedMessagesMap])
  const isConnected = Boolean(chatSocket?.connected)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [loading, setLoading] = useState(false)
  const [isRoomLoading, setIsRoomLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState(false)
  const [historyCursor, setHistoryCursor] = useState<string | null>(null)
  const [rateLimitData, setRateLimitData] = useState<{ retryAfter: number; blockedUntil: number } | null>(null)
  const [currentOtherUserId, setCurrentOtherUserId] = useState<string | undefined>(otherUserId)
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

  const historyFetchAbort = useRef<AbortController | null>(null)
  const warningToastRemaining = useRef<number | null>(null)

  useEffect(() => {
    if (!rateLimitData) {
      warningToastRemaining.current = null
    }
  }, [rateLimitData])

  const showRateLimitWarning = useCallback((remaining: number) => {
    if (remaining <= 0) return
    if (warningToastRemaining.current === remaining) return
    warningToastRemaining.current = remaining

    const template = dictionary.navigation.rateLimitMonitorWarning || dictionary.navigation.rateLimitWarning || 'You are close to being rate limited. Only ${countdown} messages left.'
    const message = template.replace('${countdown}', remaining.toString())
    toast.warning(message)
  }, [dictionary.navigation.rateLimitWarning])

  const clearCachedRateLimit = useCallback(() => {
    setRateLimitData(null)
  }, [])

  const requestRateLimitStatus = useCallback(async (): Promise<{ blockedUntil?: number; warningRemaining?: number; remaining?: number } | null> => {
    if (!user?.id || !isOnline) {
      return null
    }

    try {
      const response = await fetch('/api/chat/messages/check-rate-limit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user.id })
      })

      const data = await response.json().catch(() => ({}))

      if (response.status === 429) {
        const blockedUntilMs =
          typeof data.blockedUntilMs === 'number'
            ? data.blockedUntilMs
            : typeof data.blockedUntil === 'number'
              ? data.blockedUntil
              : null
        const retryAfterSec = Number.isFinite(data.retryAfterSec)
          ? data.retryAfterSec
          : Number.isFinite(data.retryAfter)
            ? data.retryAfter
            : 300
        const blockedUntil =
          blockedUntilMs ??
          Date.now() + retryAfterSec * 1000

        setRateLimitData({
          retryAfter: retryAfterSec,
          blockedUntil
        })

        return { blockedUntil }
      }

      if (response.ok) {
        const warningRemaining = data?.warning?.remaining
        const remaining = typeof data?.remaining === 'number' ? data.remaining : undefined
        const resetTimeMs = typeof data?.resetTime === 'number' ? data.resetTime : undefined
        const warningBlockedUntil =
          typeof data?.warning?.blockedUntilMs === 'number'
            ? data.warning.blockedUntilMs
            : typeof data?.warning?.blockedUntil === 'number'
              ? data.warning.blockedUntil
              : resetTimeMs

        const isHardBlock =
          data?.allowed === false &&
          typeof remaining === 'number' &&
          remaining <= 0 &&
          resetTimeMs &&
          resetTimeMs > Date.now()

        if (isHardBlock && resetTimeMs) {
          const retryAfter = Math.max(1, Math.ceil((resetTimeMs - Date.now()) / 1000))
          setRateLimitData({
            retryAfter,
            blockedUntil: resetTimeMs
          })
          return { blockedUntil: resetTimeMs, warningRemaining, remaining }
        }

        if (warningRemaining && warningRemaining > 0) {
          showRateLimitWarning(warningRemaining)
        } else {
          warningToastRemaining.current = null
        }

        if (!isHardBlock) {
          clearCachedRateLimit()
        }

        return {
          blockedUntil: isHardBlock ? warningBlockedUntil : undefined,
          warningRemaining,
          remaining
        }
      }
    } catch (error) {
      console.error('Failed to check rate limit:', error)
    }

    return null
  }, [user?.id, isOnline, showRateLimitWarning, clearCachedRateLimit])

  useEffect(() => {
    if (!rateLimitData || rateLimitData.blockedUntil <= Date.now()) {
      return
    }

    let cancelled = false

    const interval = setInterval(async () => {
      if (cancelled) return

      const status = await requestRateLimitStatus()
      if (!status?.blockedUntil) {
        clearCachedRateLimit()
      }
    }, 10000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [rateLimitData, requestRateLimitStatus, clearCachedRateLimit])

  const mergeMessages = useCallback((incoming: ChatMessage[], existing: ChatMessage[]) => {
    const map = new Map<string, ChatMessage>()

    ;[...existing, ...incoming].forEach(message => {
      map.set(message.id, message)
    })

    return Array.from(map.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }, [])

  const sanitizeSender = useCallback((sender?: ChatMessage['sender']): ChatMessage['sender'] => {
    if (sender?.id) {
      return {
        id: sender.id,
        name: sender.name || undefined,
        email: sender.email
      }
    }

    return {
      id: user?.id ?? '',
      name: user?.name ?? undefined,
      email: user?.email ?? ''
    }
  }, [user?.email, user?.id, user?.name])

  const normalizeMessage = useCallback((message: ChatMessage): ChatMessage => ({
    ...message,
    sender: sanitizeSender(message.sender),
    content: normalizeMessageContent(message.content)
  }), [sanitizeSender])

  const applyIncomingMessages = useCallback((incoming: ChatMessage[]) => {
    setMessages(prev => {
      const sanitized = incoming.map(normalizeMessage)

      const filtered = prev.filter(existing => {
        if (!existing.isOptimistic || !existing.clientId) return true
        return !sanitized.some(msg => msg.clientId && msg.clientId === existing.clientId)
      })

      return mergeMessages(sanitized, filtered)
    })
  }, [mergeMessages, normalizeMessage])

  const markMessagesAsRead = useCallback(() => {
    if (!chatSocket || !chatSocket.connected) {
      return
    }

    if (!room?.id || !user?.id) {
      return
    }

    setMessages(prev => prev.map(msg => (
      msg.roomId === room.id && msg.senderId !== user?.id && !msg.readAt
        ? { ...msg, readAt: new Date().toISOString() }
        : msg
    )))

    try {
      chatSocket.emit('markMessagesRead', {
        roomId: room.id,
        userId: user?.id
      })
    } catch (error) {
      console.error('Failed to mark messages as read:', error)
    }
  }, [chatSocket, room?.id, user?.id])

  useEffect(() => {
    if (!chatSocket) return

    const handleRoomData = (data: { room: ChatRoom; messages: ChatMessage[]; nextCursor?: string | null }) => {
      setRoom(data.room)

      const incoming = Array.isArray(data.messages) ? data.messages : []
      applyIncomingMessages(incoming)

      setHistoryCursor(data.nextCursor ?? null)
      setHasMoreHistory(Boolean(data.nextCursor))

      setLoading(false)
      setIsRoomLoading(false)

      if (user?.id && data.messages.length > 0) {
        data.messages.forEach(message => {
          const receiverId =
            user?.id === message.senderId
              ? data.room.user1Id === user?.id
                ? data.room.user2Id
                : data.room.user1Id
              : message.senderId

          dispatch(
            sendMsg({
              message: normalizeMessageContent(message.content),
              senderId: message.senderId,
              receiverId: receiverId
            })
          )
        })
      }
    }

    const handleReceiveMessage = (message: ChatMessage) => {
      applyIncomingMessages([message])

      if (user?.id) {
        dispatch(sendMsg({
          message: normalizeMessageContent(message.content),
          senderId: message.senderId,
          receiverId: user?.id
        }))
      }
    }

    const handleRateLimitExceeded = (data: RateLimitExceededPayload) => {
      const blockedUntilMs =
        typeof (data as any).blockedUntilMs === 'number'
          ? (data as any).blockedUntilMs
          : typeof data.blockedUntil === 'number'
            ? data.blockedUntil
            : null

      const retryAfterSecRaw =
        typeof (data as any).retryAfterSec === 'number'
          ? (data as any).retryAfterSec
          : data.retryAfter

      const retryAfter = Number.isFinite(retryAfterSecRaw) ? retryAfterSecRaw! : 300
      const blockedUntilTimestamp = blockedUntilMs ?? Date.now() + retryAfter * 1000

      setRateLimitData({
        retryAfter,
        blockedUntil: blockedUntilTimestamp
      })
      writeStoredRateLimit(user?.id, blockedUntilTimestamp)
    }

    const handleRateLimitWarning = (data: { remaining: number }) => {
      showRateLimitWarning(data.remaining)
    }

    const handleMessagesRead = (data: { roomId: string; readerId: string; count: number }) => {
      setMessages(prev => prev.map(msg => (
        msg.roomId === data.roomId && msg.senderId !== data.readerId
          ? { ...msg, readAt: new Date().toISOString() }
          : msg
      )))
    }

    chatSocket.on('roomData', handleRoomData)
    chatSocket.on('receiveMessage', handleReceiveMessage)
    chatSocket.on('messagesRead', handleMessagesRead)
    chatSocket.on('rateLimitExceeded', handleRateLimitExceeded)
    chatSocket.on('rateLimitWarning', handleRateLimitWarning)

    return () => {
      chatSocket.off('roomData', handleRoomData)
      chatSocket.off('receiveMessage', handleReceiveMessage)
      chatSocket.off('messagesRead', handleMessagesRead)
      chatSocket.off('rateLimitExceeded', handleRateLimitExceeded)
      chatSocket.off('rateLimitWarning', handleRateLimitWarning)
    }
  }, [chatSocket, dispatch, applyIncomingMessages, showRateLimitWarning, user?.id])

  useEffect(() => {
    if (chatSocket && isConnected && currentOtherUserId && user?.id) {
      setIsRoomLoading(true)
      chatSocket.emit('getOrCreateRoom', {
        user1Id: user?.id,
        user2Id: currentOtherUserId
      })
    }
  }, [chatSocket, isConnected, currentOtherUserId, user?.id])

  useEffect(() => {
    if (!user?.id || !currentOtherUserId || !isOnline) {
      return
    }

    if (rateLimitData && rateLimitData.blockedUntil > Date.now()) {
      return
    }

    let cancelled = false

    const run = async () => {
      if (cancelled) return
      await requestRateLimitStatus()
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [user?.id, currentOtherUserId, isOnline, rateLimitData?.blockedUntil, requestRateLimitStatus])

  useEffect(() => {
    if (!room?.id || !user?.id) {
      return
    }

    const queuedForRoom = queuedMessages.filter(message => message.roomId === room.id)
    const queueIds = new Set(queuedForRoom.map(message => message.clientId))

    setMessages(prev => {
      const withoutStaleOptimistic = prev.filter(existing => {
        if (!existing.isOptimistic || !existing.clientId) return true
        return queueIds.has(existing.clientId)
      })

      if (!queuedForRoom.length) {
        return withoutStaleOptimistic
      }

      const queueMessages: ChatMessage[] = queuedForRoom.map(message => ({
        id: message.clientId,
        clientId: message.clientId,
        content: message.content,
        senderId: user.id,
        sender: {
          id: user.id,
          name: user.name ?? undefined,
          email: user.email ?? ''
        },
        roomId: message.roomId,
        createdAt: message.createdAt,
        isOptimistic: message.status !== 'failed',
        deliveryStatus: message.status === 'failed' ? 'failed' : 'pending'
      }))

      const filtered = withoutStaleOptimistic.filter(existing => {
        if (!existing.clientId) return true
        return !queueIds.has(existing.clientId)
      })

      return mergeMessages(queueMessages, filtered)
    })
  }, [queuedMessages, room?.id, user?.id, mergeMessages])

  const initializeRoom = (userId: string) => {
    setCurrentOtherUserId(userId)
    setHistoryCursor(null)
    setHasMoreHistory(false)
    setMessages([])
    setIsRoomLoading(true)
  }

  const createOptimisticMessage = (content: string) => {
    const clientId = generateClientId()

    const optimistic: ChatMessage = {
      id: clientId,
      clientId,
      content,
      senderId: user?.id ?? '',
      sender: {
        id: user?.id ?? '',
        name: user?.name ?? undefined,
        email: user?.email ?? ''
      },
      roomId: room?.id ?? '',
      createdAt: new Date().toISOString(),
      isOptimistic: true,
      deliveryStatus: 'pending'
    }

    setMessages(prev => [...prev, optimistic])

    if (room?.id) {
      dispatch(enqueueMessage({
        clientId,
        roomId: room.id,
        content,
        status: 'sending',
        createdAt: optimistic.createdAt
      }))
    }

    console.log('🟡 [CHAT] Сообщение стало серым (ожидание)', {
      clientId,
      roomId: room?.id,
      length: content.length
    })

    return clientId
  }

  const finalizeOptimisticMessage = (clientId: string, serverMessage: ChatMessage) => {
    const normalized = normalizeMessage(serverMessage)
    normalized.isOptimistic = false

    applyIncomingMessages([normalized])
    dispatch(markMessageDelivered({ clientId }))

    console.log('🟣 [CHAT] Сообщение стало фиолетовым (доставлено)', {
      clientId,
      messageId: serverMessage.id,
      roomId: serverMessage.roomId
    })
  }

  const removeOptimisticMessage = (clientId: string) => {
    setMessages(prev => prev.filter(message => message.clientId !== clientId))
    dispatch(markMessageDelivered({ clientId }))
  }

  const failOptimisticMessage = (clientId: string, errorMessage?: string) => {
    if (errorMessage === 'RATE_LIMITED') {
      removeOptimisticMessage(clientId)
      return
    }

    setMessages(prev => prev.map(msg => (
      msg.clientId === clientId && msg.isOptimistic
        ? { ...msg, deliveryStatus: 'failed' }
        : msg
    )))

    dispatch(markMessageFailed({ clientId, error: errorMessage }))
  }

  const sendViaSocket = (payload: { roomId: string; message: string; senderId: string; clientId: string }) => {
    return new Promise<ChatMessage>((resolve, reject) => {
      if (!chatSocket || !chatSocket.connected) {
        reject(new Error('Socket disconnected'))
        return
      }

      chatSocket.timeout(5000).emit('sendMessage', payload, (first?: unknown, second?: SendMessageAck) => {
        let error: Error | null = null
        let ack: SendMessageAck | undefined

        if (first instanceof Error) {
          error = first
        } else if (typeof first === 'string' && !second) {
          error = new Error(first)
        } else if (typeof first === 'object' && first !== null && 'ok' in (first as SendMessageAck)) {
          ack = first as SendMessageAck
        } else if (second && typeof second === 'object' && 'ok' in second) {
          ack = second
        }

        if (error) {
          reject(error)
          return
        }

        if (!ack || !ack.ok || !ack.message) {
          const errorMessage = ack?.error || 'Failed to send message'

          if (ack?.error === 'RATE_LIMITED') {
            const retryAfter = ack.retryAfter && Number.isFinite(ack.retryAfter) ? ack.retryAfter : 300
            const blockedUntil =
              typeof ack.blockedUntil === 'number'
                ? ack.blockedUntil
                : Date.now() + retryAfter * 1000

            setRateLimitData({
              retryAfter,
              blockedUntil
            })
            writeStoredRateLimit(user?.id, blockedUntil)

            const rateLimitError = new Error('RATE_LIMITED') as Error & { blockedUntil?: number }
            rateLimitError.blockedUntil = blockedUntil
            reject(rateLimitError)
            return
          }

          reject(new Error(errorMessage))
          return
        }

        resolve(ack.message)
      })
    })
  }

  const sendViaHttp = async (payload: { roomId: string; message: string; clientId: string }) => {
    const response = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const payloadData: any = await response.json().catch(() => ({}))

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = Number.isFinite(payloadData.retryAfter) ? payloadData.retryAfter : 300
        const blockedUntil =
          typeof payloadData.blockedUntil === 'number'
            ? payloadData.blockedUntil
            : Date.now() + retryAfter * 1000

        setRateLimitData({
          retryAfter,
          blockedUntil
        })
        writeStoredRateLimit(user?.id, blockedUntil)

        const rateLimitError = new Error('RATE_LIMITED') as Error & { blockedUntil?: number }
        rateLimitError.blockedUntil = blockedUntil
        throw rateLimitError
      }

      throw new Error(payloadData.error || 'Failed to send message')
    }

    if (payloadData?.warning?.remaining) {
      showRateLimitWarning(payloadData.warning.remaining)
    }

    return payloadData.message as ChatMessage
  }

  const deliverPayload = async (payload: { roomId: string; message: string; senderId: string; clientId: string }) => {
    if (!isOnline) {
      throw new TypeError('Network offline')
    }

    if (isConnected) {
      try {
        return await sendViaSocket(payload)
      } catch (socketError) {
        console.warn('Socket send failed, falling back to HTTP:', socketError)
        return await sendViaHttp({ roomId: payload.roomId, message: payload.message, clientId: payload.clientId })
      }
    }

    return await sendViaHttp({ roomId: payload.roomId, message: payload.message, clientId: payload.clientId })
  }

  const sendMessage = async (content: string) => {
    if (!room?.id || !user?.id || !content.trim()) return

    const throwRateLimited = (blockedUntil?: number) => {
      const rateLimitError = new Error('RATE_LIMITED') as Error & { blockedUntil?: number }
      if (blockedUntil) {
        rateLimitError.blockedUntil = blockedUntil
      }
      throw rateLimitError
    }

    const latestStatus = await requestRateLimitStatus()
    const latestBlockedUntil = latestStatus?.blockedUntil

    if (latestBlockedUntil && latestBlockedUntil > Date.now()) {
      throwRateLimited(latestBlockedUntil)
    }

    if (latestStatus?.blockedUntil && typeof latestStatus.remaining === 'number' && latestStatus.remaining <= 0) {
      throwRateLimited(latestBlockedUntil)
    }

    if (!latestBlockedUntil && rateLimitData?.blockedUntil && rateLimitData.blockedUntil > Date.now()) {
      clearCachedRateLimit()
    }

    if (latestStatus?.warningRemaining) {
      showRateLimitWarning(latestStatus.warningRemaining)
    }

    const now = Date.now()
    const currentBlock = rateLimitData?.blockedUntil && rateLimitData.blockedUntil > now
    if (currentBlock) {
      throwRateLimited(rateLimitData?.blockedUntil)
    }

    const trimmed = content.trim()

    if (!isOnline) {
      const queuedForRoom = queuedMessages.filter(message => message.roomId === room.id)

      if (queuedForRoom.length >= 1) {
        throw new Error('OFFLINE_LIMIT_REACHED')
      }
    }

    const clientId = createOptimisticMessage(trimmed)

    const payload = {
      roomId: room.id,
      message: trimmed,
      senderId: user.id,
      clientId
    }

    dispatch(markMessageSending({ clientId }))

    try {
      const serverMessage = await deliverPayload(payload)

      console.log('✅ [CHAT] Сообщение отправлено', {
        clientId,
        via: isConnected ? 'socket' : 'http',
        roomId: payload.roomId
      })

      finalizeOptimisticMessage(clientId, serverMessage)
    } catch (error) {
      const isNetworkError =
        error instanceof TypeError &&
        (
          error.message === 'Failed to fetch' ||
          error.message === 'NetworkError when attempting to fetch resource' ||
          error.message === 'Network offline'
        )

      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false

      if (error instanceof Error && error.message === 'RATE_LIMITED') {
        console.warn('⏱️ [CHAT] Rate limit in effect, message blocked', {
          clientId,
          roomId: room?.id
        })
      } else if (isNetworkError || isOffline) {
        console.warn('🌐 [CHAT] Нет сети, сообщение не отправлено', {
          clientId,
          roomId: room?.id
        })
      } else {
        console.error('Failed to send message:', error)
      }

      failOptimisticMessage(clientId, error instanceof Error ? error.message : undefined)

      if (error instanceof Error && error.message === 'RATE_LIMITED') {
        throw error
      }

      if (isNetworkError || isOffline) {
        throw new Error('NETWORK_OFFLINE')
      }

      if (!isNetworkError) {
        throw error
      }
    }
  }

  const loadMoreMessages = useCallback(async () => {
    if (!room?.id || historyLoading || !hasMoreHistory) {
      return
    }

    setHistoryLoading(true)
    historyFetchAbort.current?.abort()

    const controller = new AbortController()
    historyFetchAbort.current = controller

    try {
      const params = new URLSearchParams({
        roomId: room.id,
        limit: '30'
      })

      if (historyCursor) {
        params.set('cursor', historyCursor)
      }

      const response = await fetch(`/api/chat/messages?${params.toString()}`, {
        signal: controller.signal
      })

      if (!response.ok) {
        throw new Error('Failed to load history')
      }

      const payload = await response.json()
    const normalizedItems = (payload.items ?? []).map((msg: ChatMessage) => normalizeMessage(msg))

      applyIncomingMessages(normalizedItems)
      setHistoryCursor(payload.nextCursor ?? null)
      setHasMoreHistory(Boolean(payload.nextCursor))
    } catch (error) {
      const isAbortError =
        (error as DOMException)?.name === 'AbortError' ||
        (error as Error)?.message === 'Failed to fetch' && controller.signal.aborted

      if (isAbortError) {
        console.log('ℹ️ [CHAT] Загрузка истории отменена (AbortController)')
      } else {
        console.error('Failed to load older messages:', error)
      }
    } finally {
      setHistoryLoading(false)
    }
  }, [room?.id, historyCursor, historyLoading, hasMoreHistory, applyIncomingMessages, normalizeMessage])

  useEffect(() => {
    return () => {
      historyFetchAbort.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])


  useEffect(() => {
    if (!room?.id || !user?.id) {
      return
    }

    const retryable = queuedMessages.filter(message => {
      if (message.roomId !== room.id) return false
      return message.status === 'failed' || message.status === 'pending'
    })

    if (!retryable.length) {
      return
    }

    if (!isOnline) {
      return
    }

    let cancelled = false

    const processQueue = async () => {
      for (const message of retryable) {
        if (cancelled) break

        dispatch(markMessageSending({ clientId: message.clientId }))

        try {
          const serverMessage = await deliverPayload({
            roomId: message.roomId,
            message: message.content,
            senderId: user.id,
            clientId: message.clientId
          })

          finalizeOptimisticMessage(message.clientId, serverMessage)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : undefined
          failOptimisticMessage(message.clientId, errorMessage)
        }
      }
    }

    processQueue()

    return () => {
      cancelled = true
    }
  }, [queuedMessages, room?.id, user?.id, isConnected, isOnline])

  return {
    messages,
    room,
    sendMessage,
    markMessagesAsRead,
    initializeRoom,
    isConnected,
    loading,
    isRoomLoading,
    rateLimitData,
    loadMoreMessages,
    historyLoading,
    hasMoreHistory
  }
}

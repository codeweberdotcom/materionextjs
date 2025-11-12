// React Imports
import { useRef, useState, useEffect } from 'react'
import type { FormEvent, KeyboardEvent, RefObject, MouseEvent } from 'react'

// MUI Imports
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Popper from '@mui/material/Popper'
import Fade from '@mui/material/Fade'
import Paper from '@mui/material/Paper'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'

// Third-party Imports
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'
import { useAuth } from '@/contexts/AuthProvider'
import { toast } from 'react-toastify'

import type { ChatRoom } from '@/lib/sockets/types/chat'

// Type Imports
import type { ContactType } from '@/types/apps/chatTypes'
import type { AppDispatch } from '@/redux-store'

// Slice Imports
import { sendMsg } from '@/redux-store/slices/chat'

// Component Imports
import CustomIconButton from '@core/components/mui/IconButton'
import { useTranslation } from '@/contexts/TranslationContext'

// Custom Hooks

type Props = {
  dispatch: AppDispatch
  activeUser: ContactType
  isBelowSmScreen: boolean
  messageInputRef: RefObject<HTMLDivElement>
  room: ChatRoom | null
  isRoomLoading: boolean
  sendMessage: (content: string) => Promise<void>
  rateLimitData: { retryAfter: number; blockedUntil: number } | null
  isConnected: boolean
}

// Emoji Picker Component for selecting emojis
const EmojiPicker = ({
  onChange,
  isBelowSmScreen,
  openEmojiPicker,
  setOpenEmojiPicker,
  anchorRef
}: {
  onChange: (value: string) => void
  isBelowSmScreen: boolean
  openEmojiPicker: boolean
  setOpenEmojiPicker: (value: boolean | ((prevVar: boolean) => boolean)) => void
  anchorRef: RefObject<HTMLButtonElement>
}) => {
  return (
    <>
      <Popper
        open={openEmojiPicker}
        transition
        disablePortal
        placement='top-start'
        className='z-[12]'
        anchorEl={anchorRef.current}
      >
        {({ TransitionProps, placement }) => (
          <Fade {...TransitionProps} style={{ transformOrigin: placement === 'top-start' ? 'right top' : 'left top' }}>
            <Paper>
              <ClickAwayListener onClickAway={() => setOpenEmojiPicker(false)}>
                <span>
                  <Picker
                    emojiSize={18}
                    theme='light'
                    data={data}
                    maxFrequentRows={1}
                    onEmojiSelect={(emoji: any) => {
                      onChange(emoji.native)
                      setOpenEmojiPicker(false)
                    }}
                    {...(isBelowSmScreen && { perLine: 8 })}
                  />
                </span>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  )
}

const SendMsgForm = ({ dispatch, activeUser, isBelowSmScreen, messageInputRef, room, isRoomLoading, sendMessage, rateLimitData, isConnected }: Props) => {
  // States
  const [msg, setMsg] = useState('')
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [openEmojiPicker, setOpenEmojiPicker] = useState(false)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [isSending, setIsSending] = useState(false)

  // Refs
  const anchorRef = useRef<HTMLButtonElement>(null)

  // Hooks
  const { user, session } = useAuth()
  const { navigation } = useTranslation()

  // Handle rate limit countdown
  useEffect(() => {
    if (rateLimitData) {
      setIsRateLimited(true)
      const initialCountdown = Math.ceil((rateLimitData.blockedUntil - Date.now()) / 1000)
      setCountdown(Math.max(0, initialCountdown))

      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setIsRateLimited(false)
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(interval)
    } else {
      setIsRateLimited(false)
      setCountdown(0)
    }
  }, [rateLimitData])

  const open = Boolean(anchorEl)

  const handleToggle = () => {
    setOpenEmojiPicker(prevOpen => !prevOpen)
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(prev => (prev ? null : event.currentTarget))
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleSendMsg = async (event: FormEvent | KeyboardEvent, value: string) => {
    event.preventDefault()

    if (isRateLimited || isSending || !room) {
      return
    }

    const trimmed = value.trim()
    if (!trimmed) return

    console.log('🟠 [CHAT UI] Кнопка отправки нажата', {
      roomId: room.id,
      isConnected,
      length: trimmed.length
    })

    setIsSending(true)
    console.log('🔒 [CHAT UI] Кнопка отправки деактивирована')

    try {
      if (user?.id && sendMessage) {
        await sendMessage(trimmed)
      } else {
        dispatch(sendMsg({ message: trimmed, senderId: user?.id || '', receiverId: activeUser?.id || '' }))
      }

      setMsg('')
    } catch (error: any) {
      const blockedUntil =
        (error as { blockedUntil?: number })?.blockedUntil ??
        rateLimitData?.blockedUntil

      if (error?.message === 'NETWORK_OFFLINE') {
        toast.error(navigation.checkInternetConnection ?? 'Check your internet connection')
      } else if (error?.message === 'OFFLINE_LIMIT_REACHED') {
        toast.error(navigation.offlineLimitReached ?? 'Only one offline message can be queued')
      } else if (error?.message === 'RATE_LIMITED') {
        const seconds = blockedUntil
          ? Math.max(1, Math.ceil((blockedUntil - Date.now()) / 1000))
          : 1
        const message = navigation.rateLimitMessage
          ? navigation.rateLimitMessage.replace('${countdown}', seconds.toString())
          : 'You are sending messages too frequently.'
        toast.error(message)
      } else if (error?.message !== 'Rate limit exceeded') {
        toast.error(navigation.failedToSendMessage ?? 'Failed to send message')
      }
    } finally {
      setIsSending(false)
      console.log('🔓 [CHAT UI] Кнопка отправки активирована')
    }
  }

  // Handle user selection to block input and show loading
  const handleUserSelect = () => {
    if (room) {
      // Room is already loaded, no need to block
      return
    }
    // Block input when user is selected but room is not yet loaded
  }

  // Effect to handle user selection
  useEffect(() => {
    console.log('🔍 [SendMsgForm] User selection effect:', {
      activeUser: activeUser?.id,
      room: room?.id,
      isRoomLoading,
      rateLimitData: !!rateLimitData
    });

    if (activeUser && !room) {
      console.log('🚫 [SendMsgForm] User selected but no room - blocking input');
      handleUserSelect()
    } else if (room) {
      console.log('✅ [SendMsgForm] Room loaded - enabling input');
    }
  }, [activeUser, room])

  const handleInputEndAdornment = () => {
    return (
      <div className='flex items-center gap-1'>
        {isBelowSmScreen ? (
          <>
            <IconButton
              size='small'
              id='option-menu'
              aria-haspopup='true'
              {...(open && { 'aria-expanded': true, 'aria-controls': 'share-menu' })}
              onClick={handleClick}
              ref={anchorRef}
              disabled={isRateLimited}
            >
              <i className='ri-more-2-line text-textPrimary' />
            </IconButton>
            <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
              <MenuItem
                onClick={() => {
                  handleToggle()
                  handleClose()
                }}
                className='justify-center'
              >
                <i className='ri-emotion-happy-line text-textPrimary' />
              </MenuItem>
              <MenuItem onClick={handleClose} className='justify-center'>
                <i className='ri-mic-line text-textPrimary' />
              </MenuItem>
              <MenuItem onClick={handleClose} className='p-0'>
                <label htmlFor='upload-img' className='plb-2 pli-5'>
                  <i className='ri-attachment-2 text-textPrimary' />
                  <input hidden type='file' id='upload-img' />
                </label>
              </MenuItem>
            </Menu>
            <EmojiPicker
              anchorRef={anchorRef}
              openEmojiPicker={openEmojiPicker}
              setOpenEmojiPicker={setOpenEmojiPicker}
              isBelowSmScreen={isBelowSmScreen}
              onChange={value => {
                setMsg(msg + value)

                if (messageInputRef.current) {
                  messageInputRef.current.focus()
                }
              }}
            />
          </>
        ) : (
          <>
            <IconButton ref={anchorRef} size='small' onClick={handleToggle} disabled={isRateLimited || isRoomLoading || !room}>
              <i className='ri-emotion-happy-line text-textPrimary' />
            </IconButton>
            <EmojiPicker
              anchorRef={anchorRef}
              openEmojiPicker={openEmojiPicker}
              setOpenEmojiPicker={setOpenEmojiPicker}
              isBelowSmScreen={isBelowSmScreen}
              onChange={value => {
                setMsg(msg + value)

                if (messageInputRef.current) {
                  messageInputRef.current.focus()
                }
              }}
            />
          </>
        )}
        {isBelowSmScreen ? (
          <CustomIconButton
            variant='contained'
            color='primary'
            type='submit'
            disabled={isRateLimited || isRoomLoading || !room || isSending}
          >
            <div className='flex items-center gap-2'>
              {isRateLimited ? (
                countdown
              ) : isRoomLoading || !room ? (
                '...'
              ) : (
                <i className='ri-send-plane-line' />
              )}
              {isSending && <CircularProgress size={16} color='inherit' />}
            </div>
          </CustomIconButton>
        ) : (
          <Button
            variant='contained'
            color='primary'
            type='submit'
            disabled={isRateLimited || isRoomLoading || !room || isSending}
            sx={{
              whiteSpace: 'nowrap',
              minWidth: 'auto'
            }}
          >
            <div className='flex items-center gap-2'>
              {isRateLimited ? (
                navigation.waitMessage.replace('${countdown}', countdown.toString())
              ) : isRoomLoading || !room ? (
                navigation.loadingButton
              ) : (
                <span className='flex items-center gap-2'>
                  {navigation.send}
                  <i className='ri-send-plane-line' />
                </span>
              )}
              {isSending && <CircularProgress size={16} color='inherit' />}
            </div>
          </Button>
        )}
      </div>
    )
  }

  return (
    <form
      autoComplete='off'
      onSubmit={event => {
        void handleSendMsg(event, msg)
      }}
      className=' bg-[var(--mui-palette-customColors-chatBg)]'
    >
      <TextField
        fullWidth
        multiline
        maxRows={4}
        placeholder={isRateLimited ? navigation.rateLimitMessage.replace('${countdown}', countdown.toString()) : isRoomLoading ? navigation.loading : navigation.typeMessage}
        value={isRateLimited ? '' : msg}
        disabled={isRateLimited || isRoomLoading || !room}
        className='p-5'
        onChange={e => setMsg(e.target.value)}
        sx={{
          '& fieldset': { border: '0' },
          '& .MuiOutlinedInput-root': {
            background: 'var(--mui-palette-background-paper)',
            boxShadow: 'var(--mui-customShadows-xs)',
            opacity: (isRateLimited || isRoomLoading || !room) ? 0.6 : 1
          }
        }}
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            void handleSendMsg(e, msg)
          }
        }}
        size='small'
        inputRef={messageInputRef}
        slotProps={{ input: { endAdornment: handleInputEndAdornment() } }}
      />
    </form>
  )
}

export default SendMsgForm

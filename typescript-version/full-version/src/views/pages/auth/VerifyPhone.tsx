'use client'

// React Imports
import { useState } from 'react'

// Next Imports
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

// MUI Imports
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'

// Third-party Imports
import { OTPInput } from 'input-otp'
import type { SlotProps } from 'input-otp'
import classnames from 'classnames'
import { toast } from 'react-toastify'

// Type Imports
import type { Mode } from '@core/types'
import type { Locale } from '@configs/i18n'

// Component Imports
import Logo from '@components/layout/shared/Logo'
import Illustrations from '@components/Illustrations'
import Form from '@components/Form'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'
import { useSettings } from '@core/hooks/useSettings'

// Util Imports
import { getLocalizedUrl } from '@/utils/formatting/i18n'
import { formatPhoneForDisplay } from '@/lib/utils/phone-utils'

// Style Imports
import styles from '@/libs/styles/inputOtp.module.css'

const Slot = (props: SlotProps) => {
  return (
    <div className={classnames(styles.slot, { [styles.slotActive]: props.isActive })}>
      {props.char !== null && <div>{props.char}</div>}
      {props.hasFakeCaret && <FakeCaret />}
    </div>
  )
}

const FakeCaret = () => {
  return (
    <div className={styles.fakeCaret}>
      <div className='w-px h-5 bg-textPrimary' />
    </div>
  )
}

const VerifyPhone = ({ mode }: { mode: Mode }) => {
  // States
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Vars
  const darkImg = '/images/pages/auth-v2-mask-dark.png'
  const lightImg = '/images/pages/auth-v2-mask-light.png'
  const darkIllustration = '/images/illustrations/auth/v2-two-steps-dark.png'
  const lightIllustration = '/images/illustrations/auth/v2-two-steps-light.png'
  const borderedDarkIllustration = '/images/illustrations/auth/v2-two-steps-dark-border.png'
  const borderedLightIllustration = '/images/illustrations/auth/v2-two-steps-light-border.png'

  // Hooks
  const router = useRouter()
  const { lang: locale } = useParams()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')
  const { settings } = useSettings()
  const authBackground = useImageVariant(mode, lightImg, darkImg)

  const characterIllustration = useImageVariant(
    mode,
    lightIllustration,
    darkIllustration,
    borderedLightIllustration,
    borderedDarkIllustration
  )

  const handleSendCode = async () => {
    if (!phone) {
      setError('Введите номер телефона')
      return
    }

    setIsSending(true)
    setError(null)

    try {
      const response = await fetch('/api/verify/phone/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone })
      })

      const data = await response.json()

      if (response.ok) {
        setCodeSent(true)
        toast.success('SMS код отправлен на ваш телефон')
        setError(null)
      } else {
        setError(data.message || 'Ошибка при отправке SMS кода')
        toast.error(data.message || 'Ошибка при отправке SMS кода')
      }
    } catch (err) {
      setError('Ошибка при отправке SMS кода')
      toast.error('Ошибка при отправке SMS кода')
      console.error('Send phone code error:', err)
    } finally {
      setIsSending(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!phone || !otp || otp.length !== 6) {
      setError('Введите номер телефона и 6-значный код')
      return
    }

    setIsVerifying(true)
    setError(null)

    try {
      const response = await fetch('/api/verify/phone/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone, code: otp })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        toast.success('Телефон успешно подтвержден!')

        // Редирект через 2 секунды
        setTimeout(() => {
          if (callbackUrl) {
            router.push(callbackUrl)
          } else {
            router.push('/apps/user/list')
          }
        }, 2000)
      } else {
        setError(data.message || 'Неверный код подтверждения')
        toast.error(data.message || 'Неверный код подтверждения')
      }
    } catch (err) {
      setError('Ошибка при проверке кода')
      toast.error('Ошибка при проверке кода')
      console.error('Verify phone code error:', err)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    await handleSendCode()
  }

  if (success) {
    return (
      <div className='flex bs-full justify-center'>
        <div
          className={classnames(
            'flex bs-full items-center justify-center flex-1 min-bs-[100dvh] relative p-6 max-md:hidden',
            {
              'border-ie': settings.skin === 'bordered'
            }
          )}
        >
          <div className='plb-12 pis-12'>
            <img
              src={characterIllustration}
              alt='character-illustration'
              className='max-bs-[500px] max-is-full bs-auto'
            />
          </div>
          <Illustrations
            image1={{ src: '/images/illustrations/objects/tree-3.png' }}
            image2={null}
            maskImg={{ src: authBackground }}
          />
        </div>
        <div className='flex justify-center items-center bs-full bg-backgroundPaper !min-is-full p-6 md:!min-is-[unset] md:p-12 md:is-[480px]'>
          <Link
            href={getLocalizedUrl('/', locale as Locale)}
            className='absolute block-start-5 sm:block-start-[38px] inline-start-6 sm:inline-start-[38px]'
          >
            <Logo />
          </Link>
          <div className='flex flex-col gap-5 is-full sm:is-auto md:is-full sm:max-is-[400px] md:max-is-[unset]'>
            <Alert severity='success'>
              <Typography variant='h6'>Телефон успешно подтвержден! 💬</Typography>
              <Typography className='mbs-1'>
                Теперь у вас полный доступ к управлению. Вы будете перенаправлены...
              </Typography>
            </Alert>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='flex bs-full justify-center'>
      <div
        className={classnames(
          'flex bs-full items-center justify-center flex-1 min-bs-[100dvh] relative p-6 max-md:hidden',
          {
            'border-ie': settings.skin === 'bordered'
          }
        )}
      >
        <div className='plb-12 pis-12'>
          <img
            src={characterIllustration}
            alt='character-illustration'
            className='max-bs-[500px] max-is-full bs-auto'
          />
        </div>
        <Illustrations
          image1={{ src: '/images/illustrations/objects/tree-3.png' }}
          image2={null}
          maskImg={{ src: authBackground }}
        />
      </div>
      <div className='flex justify-center items-center bs-full bg-backgroundPaper !min-is-full p-6 md:!min-is-[unset] md:p-12 md:is-[480px]'>
        <Link
          href={getLocalizedUrl('/', locale as Locale)}
          className='absolute block-start-5 sm:block-start-[38px] inline-start-6 sm:inline-start-[38px]'
        >
          <Logo />
        </Link>
        <div className='flex flex-col gap-5 is-full sm:is-auto md:is-full sm:max-is-[400px] md:max-is-[unset]'>
          {error && (
            <Alert severity='error' onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <div className='flex flex-col gap-1'>
            <Typography variant='h4'>Подтверждение телефона 💬</Typography>
            {!codeSent ? (
              <Typography>
                Введите ваш номер телефона и мы отправим вам SMS код для подтверждения.
              </Typography>
            ) : (
              <>
                <Typography>
                  Мы отправили код верификации на ваш телефон. Введите код из SMS в поле ниже.
                </Typography>
                {phone && (
                  <Typography className='font-medium' color='text.primary'>
                    {formatPhoneForDisplay(phone)}
                  </Typography>
                )}
              </>
            )}
          </div>
          <Form noValidate autoComplete='off' className='flex flex-col gap-5'>
            {!codeSent ? (
              <>
                <TextField
                  fullWidth
                  label='Номер телефона'
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder='+79991234567'
                  helperText='Формат: +7XXXXXXXXXX'
                  disabled={isSending}
                />
                <Button
                  fullWidth
                  variant='contained'
                  onClick={handleSendCode}
                  disabled={isSending || !phone}
                  startIcon={isSending ? <CircularProgress size={20} /> : null}
                >
                  {isSending ? 'Отправка...' : 'Отправить SMS код'}
                </Button>
              </>
            ) : (
              <>
                <div className='flex flex-col gap-2'>
                  <Typography>Введите 6-значный код из SMS</Typography>
                  <OTPInput
                    onChange={setOtp}
                    value={otp ?? ''}
                    maxLength={6}
                    containerClassName='group flex items-center'
                    render={({ slots }) => (
                      <div className='flex items-center justify-between w-full gap-4'>
                        {slots.slice(0, 6).map((slot, idx) => (
                          <Slot key={idx} {...slot} />
                        ))}
                      </div>
                    )}
                  />
                </div>
                <Button
                  fullWidth
                  variant='contained'
                  onClick={handleVerifyCode}
                  disabled={isVerifying || !otp || otp.length !== 6}
                  startIcon={isVerifying ? <CircularProgress size={20} /> : null}
                >
                  {isVerifying ? 'Проверка...' : 'Подтвердить телефон'}
                </Button>
                <div className='flex justify-center items-center flex-wrap gap-2'>
                  <Typography>Не получили код?</Typography>
                  <Typography
                    color='primary.main'
                    component={Link}
                    href='#'
                    onClick={e => {
                      e.preventDefault()
                      handleResend()
                    }}
                    sx={{ cursor: 'pointer' }}
                  >
                    Отправить повторно
                  </Typography>
                </div>
              </>
            )}
          </Form>
        </div>
      </div>
    </div>
  )
}

export default VerifyPhone


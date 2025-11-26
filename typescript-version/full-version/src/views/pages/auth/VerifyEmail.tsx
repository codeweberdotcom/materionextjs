'use client'

// React Imports
import { useState, useEffect } from 'react'
import { useSearchParams, useRouter, useParams } from 'next/navigation'

// Next Imports
import Link from 'next/link'

// MUI Imports
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'

// Third-party Imports
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

const VerifyEmail = ({ mode }: { mode: Mode }) => {
  // States
  const [email, setEmail] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Vars
  const darkImg = '/images/pages/auth-v2-mask-dark.png'
  const lightImg = '/images/pages/auth-v2-mask-light.png'
  const darkIllustration = '/images/illustrations/auth/v2-verify-email-dark.png'
  const lightIllustration = '/images/illustrations/auth/v2-verify-email-light.png'
  const borderedDarkIllustration = '/images/illustrations/auth/v2-verify-email-dark-border.png'
  const borderedLightIllustration = '/images/illustrations/auth/v2-verify-email-light-border.png'

  // Hooks
  const router = useRouter()
  const { lang: locale } = useParams()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
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

  // Автоматическая верификация при наличии токена
  useEffect(() => {
    if (token && !isVerifying && !success) {
      handleVerify(token)
    }
  }, [token])

  const handleVerify = async (verifyToken?: string) => {
    const tokenToVerify = verifyToken || token
    if (!tokenToVerify) {
      setError('Токен верификации не указан')
      return
    }

    setIsVerifying(true)
    setError(null)

    try {
      const response = await fetch('/api/verify/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: tokenToVerify })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        toast.success('Email успешно подтвержден!')

        // Редирект через 2 секунды
        setTimeout(() => {
          if (callbackUrl) {
            router.push(callbackUrl)
          } else {
            router.push('/apps/user/list')
          }
        }, 2000)
      } else {
        setError(data.message || 'Ошибка при подтверждении email')
        toast.error(data.message || 'Ошибка при подтверждении email')
      }
    } catch (err) {
      setError('Ошибка при подтверждении email')
      toast.error('Ошибка при подтверждении email')
      console.error('Email verification error:', err)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    if (!email) {
      setError('Введите email адрес')
      return
    }

    setIsResending(true)
    setError(null)

    try {
      const response = await fetch('/api/verify/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, type: 'email' })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Письмо с подтверждением отправлено на ваш email')
        setError(null)
      } else {
        setError(data.message || 'Ошибка при отправке письма')
        toast.error(data.message || 'Ошибка при отправке письма')
      }
    } catch (err) {
      setError('Ошибка при отправке письма')
      toast.error('Ошибка при отправке письма')
      console.error('Resend email error:', err)
    } finally {
      setIsResending(false)
    }
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
              <Typography variant='h6'>Email успешно подтвержден! ✉️</Typography>
              <Typography className='mbs-1'>
                Вы будете перенаправлены в админ-панель...
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
          <div>
            <Typography variant='h4'>Подтвердите ваш email ✉️</Typography>
            {token ? (
              <Typography className='mbs-1'>
                {isVerifying ? 'Подтверждение email...' : 'Нажмите кнопку ниже для подтверждения'}
              </Typography>
            ) : (
              <Typography className='mbs-1'>
                Для подтверждения email введите ваш email адрес и мы отправим вам письмо с подтверждением.
              </Typography>
            )}
          </div>
          <Form noValidate autoComplete='off' className='flex flex-col gap-5'>
            {!token && (
              <TextField
                fullWidth
                label='Email адрес'
                type='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isResending}
                placeholder='john.doe@email.com'
              />
            )}
            {token ? (
              <Button
                fullWidth
                variant='contained'
                onClick={() => handleVerify()}
                disabled={isVerifying}
                startIcon={isVerifying ? <CircularProgress size={20} /> : null}
              >
                {isVerifying ? 'Подтверждение...' : 'Подтвердить email'}
              </Button>
            ) : (
              <Button
                fullWidth
                variant='contained'
                onClick={handleResend}
                disabled={isResending || !email}
                startIcon={isResending ? <CircularProgress size={20} /> : null}
              >
                {isResending ? 'Отправка...' : 'Отправить письмо с подтверждением'}
              </Button>
            )}
            {!token && (
              <div className='flex justify-center items-center flex-wrap gap-2'>
                <Typography>Не получили письмо?</Typography>
                <Typography
                  color='primary.main'
                  component={Link}
                  href='#'
                  onClick={e => {
                    e.preventDefault()
                    if (email) {
                      handleResend()
                    }
                  }}
                  sx={{ cursor: 'pointer' }}
                >
                  Отправить повторно
                </Typography>
              </div>
            )}
          </Form>
        </div>
      </div>
    </div>
  )
}

export default VerifyEmail


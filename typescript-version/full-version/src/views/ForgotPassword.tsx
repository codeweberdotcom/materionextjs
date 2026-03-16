'use client'

// React Imports
import { useState, useEffect, useMemo } from 'react'

// Next Imports
import Link from 'next/link'
import { useParams } from 'next/navigation'

// MUI Imports
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'

// Third-party Imports
import { Controller, useForm } from 'react-hook-form'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { object, string, minLength, pipe, email as emailValidator } from 'valibot'
import classnames from 'classnames'
import type { SubmitHandler } from 'react-hook-form'
import type { InferInput } from 'valibot'

// Type Imports
import type { Mode } from '@core/types'
import type { Locale } from '@configs/i18n'

// Component Imports
import Logo from '@components/layout/shared/Logo'
import Illustrations from '@components/Illustrations'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'
import { useSettings } from '@core/hooks/useSettings'

// Util Imports
import { getLocalizedUrl } from '@/utils/formatting/i18n'

const ForgotPassword = ({ mode }: { mode: Mode }) => {
  // States
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [dictionary, setDictionary] = useState<Record<string, any> | null>(null)

  // Vars
  const darkImg = '/images/pages/auth-v2-mask-dark.png'
  const lightImg = '/images/pages/auth-v2-mask-light.png'
  const darkIllustration = '/images/illustrations/auth/v2-forgot-password-dark.png'
  const lightIllustration = '/images/illustrations/auth/v2-forgot-password-light.png'
  const borderedDarkIllustration = '/images/illustrations/auth/v2-forgot-password-dark-border.png'
  const borderedLightIllustration = '/images/illustrations/auth/v2-forgot-password-light-border.png'

  // Hooks
  const { lang: locale } = useParams()
  const authBackground = useImageVariant(mode, lightImg, darkImg)
  const { settings } = useSettings()

  const characterIllustration = useImageVariant(
    mode,
    lightIllustration,
    darkIllustration,
    borderedLightIllustration,
    borderedDarkIllustration
  )

  useEffect(() => {
    import(`@/data/dictionaries/${locale}.json`).then(module => setDictionary(module.default))
  }, [locale])

  const schema = useMemo(
    () =>
      object({
        email: pipe(
          string(),
          minLength(1, dictionary?.navigation?.fieldRequired || 'This field is required'),
          emailValidator(dictionary?.navigation?.invalidEmail || 'Please enter a valid email address')
        )
      }),
    [dictionary]
  )

  type FormData = InferInput<typeof schema>

  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<FormData>({
    resolver: valibotResolver(schema),
    defaultValues: { email: '' }
  })

  const onSubmit: SubmitHandler<FormData> = async data => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email })
      })

      // Always show success (even if email not found) to prevent enumeration
      if (res.status === 429) {
        const json = await res.json()

        setError(json.message || 'Too many requests. Please try again later.')
        setLoading(false)

        return
      }

      setSuccess(true)
    } catch {
      setError('Something went wrong. Please try again.')
    }

    setLoading(false)
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
          image1={{ src: '/images/illustrations/objects/tree-2.png' }}
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
          <div>
            <Typography variant='h4'>
              {dictionary?.forgotPasswordTitle || 'Forgot Password 🔒'}
            </Typography>
            <Typography className='mbs-1'>
              {dictionary?.forgotPasswordSubtitle || "Enter your email and we'll send you instructions to reset your password"}
            </Typography>
          </div>

          {success ? (
            <Alert severity='success'>
              {dictionary?.forgotPasswordSuccess || 'Check your email! We sent password reset instructions.'}
            </Alert>
          ) : (
            <form
              noValidate
              autoComplete='off'
              onSubmit={handleSubmit(onSubmit)}
              className='flex flex-col gap-5'
            >
              {error && <Alert severity='error'>{error}</Alert>}

              <Controller
                name='email'
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    autoFocus
                    fullWidth
                    label={dictionary?.forgotPasswordEmailLabel || 'Email'}
                    type='email'
                    error={!!errors.email}
                    helperText={errors.email?.message}
                    disabled={loading}
                  />
                )}
              />

              <Button
                fullWidth
                variant='contained'
                type='submit'
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} color='inherit' /> : undefined}
              >
                {loading ? '...' : (dictionary?.forgotPasswordSendLink || 'Send reset link')}
              </Button>

              <Typography className='flex justify-center items-center' color='primary.main'>
                <Link href={getLocalizedUrl('/login', locale as Locale)} className='flex items-center'>
                  <i className='ri-arrow-left-s-line' />
                  <span>{dictionary?.forgotPasswordBackToLogin || 'Back to Login'}</span>
                </Link>
              </Typography>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword

'use client'

// React Imports
import { useState, useEffect, useMemo } from 'react'

// Next Imports
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

// MUI Imports
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'

// Third-party Imports
import { Controller, useForm } from 'react-hook-form'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { object, string, minLength, pipe, nonEmpty } from 'valibot'
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

interface Props {
  mode: Mode
  token: string
  email: string
}

const ResetPassword = ({ mode, token, email }: Props) => {
  // States
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [isConfirmPasswordShown, setIsConfirmPasswordShown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [dictionary, setDictionary] = useState<Record<string, any> | null>(null)

  // Vars
  const darkImg = '/images/pages/auth-v2-mask-dark.png'
  const lightImg = '/images/pages/auth-v2-mask-light.png'
  const darkIllustration = '/images/illustrations/auth/v2-reset-password-dark.png'
  const lightIllustration = '/images/illustrations/auth/v2-reset-password-light.png'
  const borderedDarkIllustration = '/images/illustrations/auth/v2-reset-password-dark-border.png'
  const borderedLightIllustration = '/images/illustrations/auth/v2-reset-password-light-border.png'

  // Hooks
  const { lang: locale } = useParams()
  const router = useRouter()
  const { settings } = useSettings()
  const authBackground = useImageVariant(mode, lightImg, darkImg)

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
        password: pipe(
          string(),
          nonEmpty(dictionary?.resetPasswordMinLength || 'Password is required'),
          minLength(8, dictionary?.resetPasswordMinLength || 'Password must be at least 8 characters')
        ),
        confirmPassword: pipe(
          string(),
          nonEmpty(dictionary?.resetPasswordMinLength || 'Please confirm your password')
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
    defaultValues: { password: '', confirmPassword: '' }
  })

  const onSubmit: SubmitHandler<FormData> = async data => {
    if (data.password !== data.confirmPassword) {
      setError(dictionary?.resetPasswordPasswordsMustMatch || 'Passwords must match')

      return
    }

    if (!token || !email) {
      setError(dictionary?.resetPasswordInvalidToken || 'Invalid or expired reset link. Please request a new one.')

      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password: data.password, confirmPassword: data.confirmPassword })
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.message || 'Failed to reset password')
        setLoading(false)

        return
      }

      setSuccess(true)

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push(getLocalizedUrl('/login', locale as Locale))
      }, 2000)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const invalidLink = !token || !email

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
        <Illustrations image2={null} maskImg={{ src: authBackground }} />
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
            <Typography variant='h4'>{dictionary?.resetPasswordTitle || 'Reset Password 🔒'}</Typography>
            <Typography className='mbs-1'>
              {dictionary?.resetPasswordSubtitle || 'Your new password must be different from previously used passwords'}
            </Typography>
          </div>

          {invalidLink && (
            <Alert severity='error'>
              {dictionary?.resetPasswordInvalidToken || 'Invalid or expired reset link. Please request a new one.'}
              <br />
              <Link href={getLocalizedUrl('/forgot-password', locale as Locale)}>
                {dictionary?.forgotPasswordTitle || 'Request new reset link'}
              </Link>
            </Alert>
          )}

          {success ? (
            <Alert severity='success'>
              {dictionary?.resetPasswordSuccess || 'Password changed successfully! Redirecting to login...'}
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
                name='password'
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    autoFocus
                    fullWidth
                    label={dictionary?.resetPasswordNewPassword || 'New Password'}
                    type={isPasswordShown ? 'text' : 'password'}
                    error={!!errors.password}
                    helperText={errors.password?.message}
                    disabled={loading || invalidLink}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position='end'>
                            <IconButton
                              size='small'
                              edge='end'
                              onClick={() => setIsPasswordShown(s => !s)}
                              onMouseDown={e => e.preventDefault()}
                            >
                              <i className={isPasswordShown ? 'ri-eye-off-line' : 'ri-eye-line'} />
                            </IconButton>
                          </InputAdornment>
                        )
                      }
                    }}
                  />
                )}
              />

              <Controller
                name='confirmPassword'
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label={dictionary?.resetPasswordConfirmPassword || 'Confirm Password'}
                    type={isConfirmPasswordShown ? 'text' : 'password'}
                    error={!!errors.confirmPassword}
                    helperText={errors.confirmPassword?.message}
                    disabled={loading || invalidLink}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position='end'>
                            <IconButton
                              size='small'
                              edge='end'
                              onClick={() => setIsConfirmPasswordShown(s => !s)}
                              onMouseDown={e => e.preventDefault()}
                            >
                              <i className={isConfirmPasswordShown ? 'ri-eye-off-line' : 'ri-eye-line'} />
                            </IconButton>
                          </InputAdornment>
                        )
                      }
                    }}
                  />
                )}
              />

              <Button
                fullWidth
                variant='contained'
                type='submit'
                disabled={loading || invalidLink}
                startIcon={loading ? <CircularProgress size={16} color='inherit' /> : undefined}
              >
                {loading ? '...' : (dictionary?.resetPasswordSubmit || 'Set New Password')}
              </Button>

              <Typography className='flex justify-center items-center' color='primary.main'>
                <Link
                  href={getLocalizedUrl('/login', locale as Locale)}
                  className='flex items-center gap-1.5'
                >
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

export default ResetPassword

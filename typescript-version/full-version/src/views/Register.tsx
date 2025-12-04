'use client'

// React Imports
import { useState } from 'react'

import { useRouter , useParams } from 'next/navigation'

// Next Imports
import Link from 'next/link'

// MUI Imports
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Checkbox from '@mui/material/Checkbox'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'

// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { Mode } from '@core/types'
import type { Locale } from '@configs/i18n'
import type { AccountType } from '@/types/accounts/types'

// Component Imports
import Logo from '@components/layout/shared/Logo'
import Illustrations from '@components/Illustrations'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'
import { useSettings } from '@core/hooks/useSettings'

// Util Imports
import { getLocalizedUrl } from '@/utils/formatting/i18n'
import logger from '@/lib/logger'

const RegisterV2 = ({ mode }: { mode: Mode }) => {
  // States
  const [isPasswordShown, setIsPasswordShown] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountType: 'LISTING' as any as AccountType
  })

  const [errors, setErrors] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockTimeLeft, setBlockTimeLeft] = useState(0)

  // Vars
  const darkImg = '/images/pages/auth-v2-mask-dark.png'
  const lightImg = '/images/pages/auth-v2-mask-light.png'
  const darkIllustration = '/images/illustrations/auth/v2-register-dark.png'
  const lightIllustration = '/images/illustrations/auth/v2-register-light.png'
  const borderedDarkIllustration = '/images/illustrations/auth/v2-register-dark-border.png'
  const borderedLightIllustration = '/images/illustrations/auth/v2-register-light-border.png'

  // Hooks
  const { lang: locale } = useParams()
  const router = useRouter()
  const authBackground = useImageVariant(mode, lightImg, darkImg)
  const { settings } = useSettings()

  const characterIllustration = useImageVariant(
    mode,
    lightIllustration,
    darkIllustration,
    borderedLightIllustration,
    borderedDarkIllustration
  )

  const handleClickShowPassword = () => setIsPasswordShown(show => !show)

  const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }))


    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([])
    }
  }

  const validateForm = () => {
    const newErrors: string[] = []

    if (!formData.name.trim()) {
      newErrors.push('Username is required')
    }

    if (!formData.email.trim()) {
      newErrors.push('Email is required')
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.push('Please enter a valid email address')
    }

    if (!formData.password) {
      newErrors.push('Password is required')
    } else if (formData.password.length < 6) {
      newErrors.push('Password must be at least 6 characters long')
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.push('Passwords do not match')
    }

    if (!agreeToTerms) {
      newErrors.push('You must agree to the privacy policy and terms')
    }

    setErrors(newErrors)

    return newErrors.length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!validateForm() || isBlocked) {
      return
    }

    setIsLoading(true)
    setErrors([])

    try {
      logger.info('🆕 [REGISTER] Attempting registration', { email: formData.email.trim() })

      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          accountType: formData.accountType
        })
      })

      logger.info('🆕 [REGISTER] Response status:', response.status)

      let data

      try {
        data = await response.json()
      } catch (parseError) {
        logger.error('❌ [REGISTER] Failed to parse response JSON', {
          error: parseError instanceof Error ? parseError.message : 'Unknown error',
          file: 'src/views/Register.tsx'
        })
        throw new Error('Invalid response from server')
      }

      if (response.ok) {
        logger.info('✅ [REGISTER] Registration succeeded', { email: formData.email.trim() })
        setSuccess(true)
        setTimeout(() => {
          router.push('/login?message=Registration successful! Please log in.')
        }, 2000)
      } else {
        const logClientError = response.status >= 400 && response.status < 500
          ? logger.warn.bind(logger)
          : logger.error.bind(logger)

        logClientError('❌ [REGISTER] Registration failed', {
          status: response.status,
          errors: data?.message,
          file: 'src/views/Register.tsx'
        })

        // Проверить на rate limit ошибку
        if (response.status === 429 && data.retryAfter) {
          logger.info('🚫 [REGISTER] Rate limit triggered', { retryAfter: data.retryAfter })
          setIsBlocked(true)
          setBlockTimeLeft(data.retryAfter)
          setErrors([`Слишком много попыток регистрации. Повторите через ${Math.ceil(data.retryAfter / 3600)} часов.`])

          // Запустить таймер
          const timer = setInterval(() => {
            setBlockTimeLeft(prev => {
              if (prev <= 1) {
                setIsBlocked(false)
                setErrors([])
                clearInterval(timer)
                return 0
              }
              return prev - 1
            })
          }, 1000)
        } else {
          setErrors(Array.isArray(data.message) ? data.message : [data.message || 'Registration failed'])
        }
      }
    } catch (error) {
      logger.error('❌ [REGISTER] Registration request failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        file: 'src/views/Register.tsx'
      })
      setErrors(['Network error. Please try again.'])
    } finally {
      setIsLoading(false)
    }
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
          <div>
            <Typography variant='h4'>Adventure starts here 🚀</Typography>
            <Typography className='mbe-1'>Make your app management easy and fun!</Typography>
          </div>
          <form noValidate autoComplete='off' onSubmit={handleSubmit} className='flex flex-col gap-5'>
            {errors.length > 0 && (
              <Alert severity='error' variant='outlined'>
                {errors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </Alert>
            )}

            {isBlocked && (
              <Alert severity='warning' variant='filled'>
                <Typography variant='body2'>
                  Слишком много попыток регистрации. Повторите через: {Math.floor(blockTimeLeft / 3600)}ч {Math.floor((blockTimeLeft % 3600) / 60)}м
                </Typography>
              </Alert>
            )}

            {success && (
              <Alert severity='success' variant='outlined'>
                Registration successful! Redirecting to login...
              </Alert>
            )}

            <TextField
              autoFocus
              fullWidth
              label='Username'
              value={formData.name}
              onChange={handleInputChange('name')}
              disabled={isLoading || isBlocked}
              error={errors.some(error => error.includes('Username'))}
            />

            <TextField
              fullWidth
              label='Email'
              type='email'
              value={formData.email}
              onChange={handleInputChange('email')}
              disabled={isLoading || isBlocked}
              error={errors.some(error => error.includes('Email'))}
            />

            <TextField
              fullWidth
              label='Password'
              type={isPasswordShown ? 'text' : 'password'}
              value={formData.password}
              onChange={handleInputChange('password')}
              disabled={isLoading || isBlocked}
              error={errors.some(error => error.includes('Password'))}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position='end'>
                      <IconButton
                        size='small'
                        edge='end'
                        onClick={handleClickShowPassword}
                        onMouseDown={e => e.preventDefault()}
                        disabled={isLoading || isBlocked}
                      >
                        <i className={isPasswordShown ? 'ri-eye-off-line' : 'ri-eye-line'} />
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
            />

            <TextField
              fullWidth
              label='Confirm Password'
              type='password'
              value={formData.confirmPassword}
              onChange={handleInputChange('confirmPassword')}
              disabled={isLoading || isBlocked}
              error={errors.some(error => error.includes('match'))}
            />

            {/* Выбор типа аккаунта */}
            <div className='flex flex-col gap-3'>
              <Typography variant='body2' color='text.secondary'>
                Выберите тип аккаунта:
              </Typography>
              <RadioGroup
                value={formData.accountType}
                onChange={(e) => setFormData(prev => ({ ...prev, accountType: e.target.value as AccountType }))}
                className='gap-2'
              >
                <Card
                  variant='outlined'
                  className={classnames('cursor-pointer transition-all', {
                    'border-primary': formData.accountType === 'LISTING',
                    'border-default': formData.accountType !== 'LISTING'
                  })}
                  onClick={() => setFormData(prev => ({ ...prev, accountType: 'LISTING' as any }))}
                >
                  <CardContent className='flex items-center gap-3 p-4'>
                    <Radio value='LISTING' checked={formData.accountType === 'LISTING'} />
                    <Box className='flex-1'>
                      <Typography className='font-medium' color='text.primary'>
                        Для публикации объявления
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        Создается базовый аккаунт с тарифом Free
                      </Typography>
                    </Box>
                    <i className='ri-file-list-3-line text-2xl text-textSecondary' />
                  </CardContent>
                </Card>

                <Card
                  variant='outlined'
                  className={classnames('cursor-pointer transition-all', {
                    'border-primary': formData.accountType === 'COMPANY',
                    'border-default': formData.accountType !== 'COMPANY'
                  })}
                  onClick={() => setFormData(prev => ({ ...prev, accountType: 'COMPANY' as any }))}
                >
                  <CardContent className='flex items-center gap-3 p-4'>
                    <Radio value='COMPANY' checked={formData.accountType === 'COMPANY'} />
                    <Box className='flex-1'>
                      <Typography className='font-medium' color='text.primary'>
                        Для размещения компании
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        Откроется возможность размещать услуги. Создается базовый аккаунт с тарифом Free
                      </Typography>
                    </Box>
                    <i className='ri-building-line text-2xl text-textSecondary' />
                  </CardContent>
                </Card>

                <Card
                  variant='outlined'
                  className={classnames('cursor-pointer transition-all', {
                    'border-primary': formData.accountType === 'NETWORK',
                    'border-default': formData.accountType !== 'NETWORK'
                  })}
                  onClick={() => setFormData(prev => ({ ...prev, accountType: 'NETWORK' as any }))}
                >
                  <CardContent className='flex items-center gap-3 p-4'>
                    <Radio value='NETWORK' checked={formData.accountType === 'NETWORK'} />
                    <Box className='flex-1'>
                      <Typography className='font-medium' color='text.primary'>
                        Сеть компаний
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        Возможность создать несколько аккаунтов и назначить других пользователей для управления ими. Создается базовый аккаунт с тарифом Free
                      </Typography>
                    </Box>
                    <i className='ri-group-line text-2xl text-textSecondary' />
                  </CardContent>
                </Card>
              </RadioGroup>
            </div>

            <div className='flex justify-between items-center gap-3'>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={agreeToTerms}
                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                  />
                }
                label={
                  <>
                    <span>I agree to </span>
                    <Link className='text-primary' href='/' onClick={e => e.preventDefault()}>
                      privacy policy & terms
                    </Link>
                  </>
                }
              />
            </div>

            <Button
              fullWidth
              variant='contained'
              type='submit'
              disabled={isLoading || success || isBlocked}
              startIcon={isLoading ? <CircularProgress size={20} /> : null}
            >
              {isBlocked
                ? `Заблокировано (${Math.floor(blockTimeLeft / 3600)}ч ${Math.floor((blockTimeLeft % 3600) / 60)}м)`
                : isLoading
                  ? 'Creating Account...'
                  : 'Sign Up'
              }
            </Button>
            <div className='flex justify-center items-center flex-wrap gap-2'>
              <Typography>Already have an account?</Typography>
              <Typography component={Link} href='/login' color='primary.main'>
                Sign in instead
              </Typography>
            </div>
            <Divider className='gap-3'>or</Divider>
            <div className='flex justify-center items-center gap-2'>
              <IconButton size='small'>
                <i className='ri-facebook-fill text-facebook' />
              </IconButton>
              <IconButton size='small'>
                <i className='ri-twitter-fill text-twitter' />
              </IconButton>
              <IconButton size='small'>
                <i className='ri-github-fill text-github' />
              </IconButton>
              <IconButton size='small'>
                <i className='ri-google-fill text-googlePlus' />
              </IconButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default RegisterV2

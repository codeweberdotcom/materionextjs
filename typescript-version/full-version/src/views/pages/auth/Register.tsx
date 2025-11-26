'use client'

// React Imports
import { useState, useEffect } from 'react'

// Next Imports
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

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
import RadioGroup from '@mui/material/RadioGroup'
import Radio from '@mui/material/Radio'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import Box from '@mui/material/Box'

// Third-party Imports
import classnames from 'classnames'
import { toast } from 'react-toastify'

// Type Imports
import type { Locale } from '@configs/i18n'
import type { Mode } from '@core/types'

// Component Imports
import Logo from '@components/layout/shared/Logo'
import Illustrations from '@components/Illustrations'
import Form from '@components/Form'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'
import { useSettings } from '@core/hooks/useSettings'

// Util Imports
import { getLocalizedUrl } from '@/utils/formatting/i18n'
import { validatePhoneFormat } from '@/lib/utils/phone-utils'

interface RegistrationSettings {
  registrationMode: 'email_or_phone' | 'email_and_phone'
  requireEmailVerification: boolean
  requirePhoneVerification: boolean
}

type RegistrationType = 'email' | 'phone'

const Register = ({ mode }: { mode: Mode }) => {
  // States
  const [settings, setSettings] = useState<RegistrationSettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registrationType, setRegistrationType] = useState<RegistrationType>('email')
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  // Form fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  // Validation errors
  const [nameError, setNameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // Vars
  const darkImg = '/images/pages/auth-v2-mask-dark.png'
  const lightImg = '/images/pages/auth-v2-mask-light.png'
  const darkIllustration = '/images/illustrations/auth/v2-register-dark.png'
  const lightIllustration = '/images/illustrations/auth/v2-register-light.png'
  const borderedDarkIllustration = '/images/illustrations/auth/v2-register-dark-border.png'
  const borderedLightIllustration = '/images/illustrations/auth/v2-register-light-border.png'

  // Hooks
  const router = useRouter()
  const { lang: locale } = useParams()
  const { settings: appSettings } = useSettings()
  const authBackground = useImageVariant(mode, lightImg, darkImg)

  const characterIllustration = useImageVariant(
    mode,
    lightIllustration,
    darkIllustration,
    borderedLightIllustration,
    borderedDarkIllustration
  )

  // Load registration settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings/registration')
        if (response.ok) {
          const data = await response.json()
          setSettings(data)
        } else {
          // Default settings if API fails
          setSettings({
            registrationMode: 'email_or_phone',
            requireEmailVerification: true,
            requirePhoneVerification: true
          })
        }
      } catch (err) {
        console.error('Failed to load registration settings:', err)
        // Default settings
        setSettings({
          registrationMode: 'email_or_phone',
          requireEmailVerification: true,
          requirePhoneVerification: true
        })
      } finally {
        setLoadingSettings(false)
      }
    }

    loadSettings()
  }, [])

  const handleClickShowPassword = () => setIsPasswordShown(show => !show)

  const validateForm = (): boolean => {
    let isValid = true

    // Reset errors
    setNameError('')
    setEmailError('')
    setPhoneError('')
    setPasswordError('')

    // Validate name
    if (!name.trim()) {
      setNameError('Имя обязательно')
      isValid = false
    } else if (name.trim().length < 2) {
      setNameError('Имя должно содержать минимум 2 символа')
      isValid = false
    }

    // Validate based on mode
    if (settings?.registrationMode === 'email_and_phone') {
      // Both email and phone required
      if (!email.trim()) {
        setEmailError('Email обязателен')
        isValid = false
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setEmailError('Некорректный email')
        isValid = false
      }

      if (!phone.trim()) {
        setPhoneError('Телефон обязателен')
        isValid = false
      } else if (!validatePhoneFormat(phone)) {
        setPhoneError('Некорректный формат телефона')
        isValid = false
      }
    } else {
      // email_or_phone mode
      if (registrationType === 'email') {
        if (!email.trim()) {
          setEmailError('Email обязателен')
          isValid = false
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setEmailError('Некорректный email')
          isValid = false
        }
      } else {
        if (!phone.trim()) {
          setPhoneError('Телефон обязателен')
          isValid = false
        } else if (!validatePhoneFormat(phone)) {
          setPhoneError('Некорректный формат телефона')
          isValid = false
        }
      }
    }

    // Validate password
    if (!password) {
      setPasswordError('Пароль обязателен')
      isValid = false
    } else if (password.length < 8) {
      setPasswordError('Пароль должен содержать минимум 8 символов')
      isValid = false
    }

    // Check terms
    if (!agreedToTerms) {
      setError('Необходимо согласиться с условиями')
      isValid = false
    }

    return isValid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const requestBody: {
        name: string
        password: string
        email?: string
        phone?: string
      } = {
        name: name.trim(),
        password
      }

      if (settings?.registrationMode === 'email_and_phone') {
        requestBody.email = email.trim()
        requestBody.phone = phone.trim()
      } else if (registrationType === 'email') {
        requestBody.email = email.trim()
      } else {
        requestBody.phone = phone.trim()
      }

      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Регистрация успешна!')

        // Redirect based on verification requirements
        if (data.emailVerificationSent) {
          toast.info('Проверьте почту для подтверждения email')
          router.push(getLocalizedUrl('/pages/auth/verify-email', locale as Locale))
        } else if (data.phoneVerificationSent) {
          toast.info('Введите код из SMS для подтверждения телефона')
          router.push(getLocalizedUrl('/pages/auth/verify-phone', locale as Locale))
        } else {
          router.push(getLocalizedUrl('/login', locale as Locale))
        }
      } else {
        setError(data.message || 'Ошибка при регистрации')
        toast.error(data.message || 'Ошибка при регистрации')
      }
    } catch (err) {
      setError('Ошибка при регистрации')
      toast.error('Ошибка при регистрации')
      console.error('Registration error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadingSettings) {
    return (
      <div className='flex bs-full justify-center items-center min-bs-[100dvh]'>
        <CircularProgress />
      </div>
    )
  }

  return (
    <div className='flex bs-full justify-center'>
      <div
        className={classnames(
          'flex bs-full items-center justify-center flex-1 min-bs-[100dvh] relative p-6 max-md:hidden',
          {
            'border-ie': appSettings.skin === 'bordered'
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
            <Typography variant='h4'>Добро пожаловать! 🚀</Typography>
            <Typography className='mbs-1'>Создайте аккаунт для начала работы</Typography>
          </div>

          {error && (
            <Alert severity='error' onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Form noValidate autoComplete='off' onSubmit={handleSubmit} className='flex flex-col gap-5'>
            <TextField
              autoFocus
              fullWidth
              label='Имя'
              value={name}
              onChange={e => setName(e.target.value)}
              error={!!nameError}
              helperText={nameError}
              disabled={isSubmitting}
            />

            {/* Registration type selector for email_or_phone mode */}
            {settings?.registrationMode === 'email_or_phone' && (
              <FormControl component='fieldset'>
                <FormLabel component='legend'>Способ регистрации</FormLabel>
                <RadioGroup
                  row
                  value={registrationType}
                  onChange={e => setRegistrationType(e.target.value as RegistrationType)}
                >
                  <FormControlLabel
                    value='email'
                    control={<Radio />}
                    label='По email'
                    disabled={isSubmitting}
                  />
                  <FormControlLabel
                    value='phone'
                    control={<Radio />}
                    label='По телефону'
                    disabled={isSubmitting}
                  />
                </RadioGroup>
              </FormControl>
            )}

            {/* Email field */}
            {(settings?.registrationMode === 'email_and_phone' ||
              (settings?.registrationMode === 'email_or_phone' && registrationType === 'email')) && (
              <TextField
                fullWidth
                label='Email'
                type='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                error={!!emailError}
                helperText={emailError || (settings.requireEmailVerification ? 'Потребуется подтверждение' : '')}
                disabled={isSubmitting}
                placeholder='john.doe@email.com'
              />
            )}

            {/* Phone field */}
            {(settings?.registrationMode === 'email_and_phone' ||
              (settings?.registrationMode === 'email_or_phone' && registrationType === 'phone')) && (
              <TextField
                fullWidth
                label='Телефон'
                value={phone}
                onChange={e => setPhone(e.target.value)}
                error={!!phoneError}
                helperText={phoneError || (settings.requirePhoneVerification ? 'Потребуется подтверждение по SMS' : 'Формат: +79991234567')}
                disabled={isSubmitting}
                placeholder='+79991234567'
              />
            )}

            <TextField
              fullWidth
              label='Пароль'
              type={isPasswordShown ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              error={!!passwordError}
              helperText={passwordError || 'Минимум 8 символов'}
              disabled={isSubmitting}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position='end'>
                      <IconButton
                        size='small'
                        edge='end'
                        onClick={handleClickShowPassword}
                        onMouseDown={e => e.preventDefault()}
                        disabled={isSubmitting}
                      >
                        <i className={isPasswordShown ? 'ri-eye-off-line' : 'ri-eye-line'} />
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
            />

            <div className='flex justify-between items-center gap-3'>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={agreedToTerms}
                    onChange={e => setAgreedToTerms(e.target.checked)}
                    disabled={isSubmitting}
                  />
                }
                label={
                  <>
                    <span>Я согласен с </span>
                    <Link className='text-primary' href='/' onClick={e => e.preventDefault()}>
                      политикой конфиденциальности и условиями
                    </Link>
                  </>
                }
              />
            </div>

            {/* Info about verification requirements */}
            {settings?.registrationMode === 'email_and_phone' && (
              <Alert severity='info'>
                После регистрации потребуется подтвердить email и телефон для полного доступа к функционалу.
              </Alert>
            )}

            <Button
              fullWidth
              variant='contained'
              type='submit'
              disabled={isSubmitting || !agreedToTerms}
              startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
            >
              {isSubmitting ? 'Регистрация...' : 'Зарегистрироваться'}
            </Button>

            <div className='flex justify-center items-center flex-wrap gap-2'>
              <Typography>Уже есть аккаунт?</Typography>
              <Typography
                component={Link}
                href={getLocalizedUrl('/login', locale as Locale)}
                color='primary.main'
              >
                Войти
              </Typography>
            </div>

            <Divider className='gap-3'>или</Divider>
            <div className='flex justify-center items-center gap-2'>
              <IconButton size='small' className='text-facebook' disabled={isSubmitting}>
                <i className='ri-facebook-fill' />
              </IconButton>
              <IconButton size='small' className='text-twitter' disabled={isSubmitting}>
                <i className='ri-twitter-fill' />
              </IconButton>
              <IconButton size='small' className='text-github' disabled={isSubmitting}>
                <i className='ri-github-fill' />
              </IconButton>
              <IconButton size='small' className='text-googlePlus' disabled={isSubmitting}>
                <i className='ri-google-fill' />
              </IconButton>
            </div>
          </Form>
        </div>
      </div>
    </div>
  )
}

export default Register








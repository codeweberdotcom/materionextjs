'use client'

// React Imports
import { useState, useEffect, useMemo } from 'react'

// Next Imports
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

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

// Third-party Imports
import { Controller, useForm } from 'react-hook-form'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { object, minLength, string, email, pipe, nonEmpty } from 'valibot'
import classnames from 'classnames'
import type { SubmitHandler } from 'react-hook-form'
import type { InferInput } from 'valibot'

// Context Imports
import { useAuth } from '@/contexts/AuthProvider'

// Type Imports
import type { Mode } from '@core/types'
import type { Locale } from '@configs/i18n'

// Component Imports
import Logo from '@components/layout/shared/Logo'
import Illustrations from '@components/Illustrations'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Context Imports
// import { useTranslation } from '@/contexts/TranslationContext'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'
import { useSettings } from '@core/hooks/useSettings'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'

type ErrorType = {
  message: string[]
}

const Login = ({ mode }: { mode: Mode }) => {
  // States
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [errorState, setErrorState] = useState<ErrorType | null>(null)
  const [loading, setLoading] = useState(false)

  // Vars
  const darkImg = '/images/pages/auth-v2-mask-dark.png'
  const lightImg = '/images/pages/auth-v2-mask-light.png'
  const darkIllustration = '/images/illustrations/auth/v2-login-dark.png'
  const lightIllustration = '/images/illustrations/auth/v2-login-light.png'
  const borderedDarkIllustration = '/images/illustrations/auth/v2-login-dark-border.png'
  const borderedLightIllustration = '/images/illustrations/auth/v2-login-light-border.png'

  // Hooks
  const router = useRouter()
  const searchParams = useSearchParams()
  const { lang: locale } = useParams()
  const { settings } = useSettings()
  const { login } = useAuth()

  // Dictionary
  const [dictionary, setDictionary] = useState<any>(null)

  useEffect(() => {
    import(`@/data/dictionaries/${locale}.json`).then(module => setDictionary(module.default))
  }, [locale])

  const schema = useMemo(() => object({
    email: pipe(string(), minLength(1, dictionary?.navigation?.fieldRequired || 'This field is required'), email(dictionary?.navigation?.invalidEmail || 'Please enter a valid email address')),
    password: pipe(
      string(),
      nonEmpty(dictionary?.navigation?.fieldRequired || 'This field is required'),
      minLength(5, dictionary?.navigation?.passwordTooShort || 'Password must be at least 5 characters long')
    )
  }), [dictionary])

  type FormData = InferInput<typeof schema>

  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<FormData>({
    resolver: valibotResolver(schema),
    defaultValues: {
      email: 'admin@example.com',
      password: 'admin123'
    }
  })

  const authBackground = useImageVariant(mode, lightImg, darkImg)

  const characterIllustration = useImageVariant(
    mode,
    lightIllustration,
    darkIllustration,
    borderedLightIllustration,
    borderedDarkIllustration
  )

  const handleClickShowPassword = () => setIsPasswordShown(show => !show)

  const onSubmit: SubmitHandler<FormData> = async (data: FormData) => {
    setLoading(true)

    try {
      await login(data.email, data.password)

      // Vars
      const redirectURL = searchParams.get('redirectTo') ?? '/en/apps/references/countries'

      router.replace(getLocalizedUrl(redirectURL, locale as Locale))
    } catch (error: any) {
      setErrorState({ message: [error.message || 'Login failed'] })
      setLoading(false) // Не разблокировать поля при ошибке
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
          image1={{ src: '/images/illustrations/objects/tree-2.png' }}
          image2={null}
          maskImg={{ src: authBackground }}
        />
      </div>
      <div className='flex justify-center items-center bs-full bg-backgroundPaper !min-is-full p-6 md:!min-is-[unset] md:p-12 md:is-[480px]'>
        <div className='absolute block-start-5 sm:block-start-[33px] inline-start-6 sm:inline-start-[38px]'>
          <Logo />
        </div>
        <div className='flex flex-col gap-5 is-full sm:is-auto md:is-full sm:max-is-[400px] md:max-is-[unset]'>
          <div>
            <Typography variant='h4'>{dictionary?.navigation?.welcomeMessage?.replace('${templateName}', themeConfig.templateName) || `Welcome to ${themeConfig.templateName}!👋🏻`}</Typography>
            <Typography>{dictionary?.navigation?.signInDescription || 'Please sign-in to your account and start the adventure'}</Typography>
          </div>
          <Alert icon={false} className='bg-primaryLight'>
            <Typography variant='body2' color='primary.main'>
              {dictionary?.navigation?.demoCredentials || 'Email: admin@example.com / Pass: admin123'}
            </Typography>
          </Alert>

          <form
            noValidate
            action={() => {}}
            autoComplete='off'
            onSubmit={handleSubmit(onSubmit)}
            className='flex flex-col gap-5'
          >
            <Controller
              name='email'
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  autoFocus
                  type='email'
                  label={dictionary?.navigation?.emailLabel || 'Email'}
                  disabled={loading}
                  onChange={e => {
                    field.onChange(e.target.value)
                    errorState !== null && setErrorState(null)
                  }}
                  {...((errors.email || errorState !== null) && {
                    error: true,
                    helperText: errors?.email?.message || errorState?.message[0]
                  })}
                />
              )}
            />
            <Controller
              name='password'
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={dictionary?.navigation?.passwordLabel || 'Password'}
                  id='login-password'
                  type={isPasswordShown ? 'text' : 'password'}
                  autoComplete='current-password'
                  disabled={loading}
                  onChange={e => {
                    field.onChange(e.target.value)
                    errorState !== null && setErrorState(null)
                  }}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position='end'>
                          <IconButton
                            size='small'
                            edge='end'
                            onClick={handleClickShowPassword}
                            onMouseDown={e => e.preventDefault()}
                            aria-label='toggle password visibility'
                            disabled={loading}
                          >
                            <i className={isPasswordShown ? 'ri-eye-off-line' : 'ri-eye-line'} />
                          </IconButton>
                        </InputAdornment>
                      )
                    }
                  }}
                  {...(errors.password && { error: true, helperText: errors.password.message })}
                />
              )}
            />
            <div className='flex justify-between items-center flex-wrap gap-x-3 gap-y-1'>
              <FormControlLabel control={<Checkbox defaultChecked />} label={dictionary?.navigation?.rememberMe || 'Remember me'} />
              <Typography className='text-end' color='primary.main' component={Link} href='/forgot-password'>
                {dictionary?.navigation?.forgotPassword || 'Forgot password?'}
              </Typography>
            </div>
            <Button fullWidth variant='contained' type='submit' disabled={loading}>
              {loading ? dictionary?.navigation?.loggingIn || 'Logging in...' : dictionary?.navigation?.login || 'Log In'}
            </Button>
            <div className='flex justify-center items-center flex-wrap gap-2'>
              <Typography>{dictionary?.navigation?.newUser || 'New on our platform?'}</Typography>
              <Typography component={Link} href='/register' color='primary.main'>
                {dictionary?.navigation?.createAccount || 'Create an account'}
              </Typography>
            </div>
          </form>
          <Divider className='gap-3'>{dictionary?.navigation?.or || 'or'}</Divider>
          <Button
            color='secondary'
            className='self-center text-textPrimary'
            startIcon={<img src='/images/logos/google.png' alt='Google' width={22} />}
            sx={{ '& .MuiButton-startIcon': { marginInlineEnd: 3 } }}
            onClick={() => {
              // TODO: Implement Google OAuth with Lucia
              alert('Google OAuth will be implemented with Lucia')
            }}
          >
            {dictionary?.navigation?.signInWithGoogle || 'Sign in with Google'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Login

import { z } from 'zod'

const booleanFromEnv = z
  .enum(['true', 'false'])
  .optional()
  .transform(value => (value === undefined ? undefined : value === 'true'))

const numberFromEnv = z
  .string()
  .optional()
  .refine(value => value === undefined || !Number.isNaN(Number(value)), {
    message: 'Must be a valid number'
  })
  .transform(value => (value === undefined ? undefined : Number(value)))

const logLevelSchema = z.enum(['error', 'warn', 'info', 'debug'])

const isAbsoluteUrl = (value: string) => {
  try {
    // eslint-disable-next-line no-new
    new URL(value)

    return true
  } catch {
    return false
  }
}

const optionalUrlish = z
  .string()
  .optional()
  .refine(value => !value || isAbsoluteUrl(value) || value.startsWith('/'), {
    message: 'Invalid url'
  })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_API_URL: optionalUrlish,
  NEXT_PUBLIC_DOCS_URL: optionalUrlish,
  NEXT_PUBLIC_SOCKET_URL: optionalUrlish,
  NEXT_PUBLIC_SOCKET_PATH: z.string().optional(),
  NEXT_PUBLIC_ENABLE_SOCKET_IO: booleanFromEnv,
  AUTH_BASE_URL: optionalUrlish,
  AUTH_JWT_SECRET: z.string().optional(),
  NEXTAUTH_URL: optionalUrlish,
  NEXTAUTH_SECRET: z.string().optional(),
  API_URL: optionalUrlish,
  FRONTEND_URL: optionalUrlish,
  SOCKET_ENABLED: booleanFromEnv,
  SOCKET_PORT: numberFromEnv,
  PORT: numberFromEnv,
  LOG_LEVEL: logLevelSchema.default('info'),
  LOG_DIR: z.string().optional(),
  LOG_MAX_SIZE: z.string().optional(),
  LOG_MAX_FILES: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: numberFromEnv,
  SMTP_ENCRYPTION: z.enum(['ssl', 'tls', 'starttls']).optional(),
  SMTP_USERNAME: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  SMTP_FROM_NAME: z.string().optional(),
  MAPBOX_ACCESS_TOKEN: z.string().optional(),
  GLITCHTIP_DSN: z.string().optional(),
  SENTRY_DSN: z.string().optional()
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error('❌ Invalid environment configuration', parsedEnv.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = parsedEnv.data

export const authBaseUrl =
  env.AUTH_BASE_URL ??
  env.NEXTAUTH_URL ??
  env.API_URL ??
  env.FRONTEND_URL ??
  (env.NEXT_PUBLIC_API_URL ? env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '') : undefined) ??
  'http://localhost:3000'

export const authJwtSecret = env.AUTH_JWT_SECRET ?? env.NEXTAUTH_SECRET ?? ''

export const publicEnv = {
  NEXT_PUBLIC_API_URL: env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_DOCS_URL: env.NEXT_PUBLIC_DOCS_URL,
  NEXT_PUBLIC_SOCKET_URL: env.NEXT_PUBLIC_SOCKET_URL,
  NEXT_PUBLIC_SOCKET_PATH: env.NEXT_PUBLIC_SOCKET_PATH,
  NEXT_PUBLIC_ENABLE_SOCKET_IO: env.NEXT_PUBLIC_ENABLE_SOCKET_IO ?? false
} as const

export const isDevelopment = env.NODE_ENV === 'development'
export const isProduction = env.NODE_ENV === 'production'

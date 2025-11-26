const commonPasswords = [
  'password',
  '123456',
  '123456789',
  'qwerty',
  'abc123',
  'password123',
  'admin',
  'letmein',
  'welcome',
  'monkey'
]

type PasswordValidationOptions = {
  minLength?: number
  maxLength?: number
  requireUppercase?: boolean
  requireLowercase?: boolean
  requireNumbers?: boolean
  requireSpecialChars?: boolean
  banCommonPasswords?: boolean
}

const defaultOptions: Required<PasswordValidationOptions> = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  banCommonPasswords: true
}

export type PasswordValidationResult = {
  isValid: boolean
  errors: string[]
}

export const validatePassword = (
  password: string,
  options: PasswordValidationOptions = {}
): PasswordValidationResult => {
  const config = { ...defaultOptions, ...options }
  const errors: string[] = []

  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters long.`)
  }

  if (password.length > config.maxLength) {
    errors.push(`Password must be no longer than ${config.maxLength} characters.`)
  }

  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must include at least one uppercase letter.')
  }

  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must include at least one lowercase letter.')
  }

  if (config.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must include at least one digit.')
  }

  if (config.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must include at least one special character.')
  }

  if (config.banCommonPasswords) {
    const lowerPassword = password.toLowerCase()
    if (commonPasswords.some(common => common === lowerPassword)) {
      errors.push('Password is too common. Choose a more secure password.')
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

export { commonPasswords }

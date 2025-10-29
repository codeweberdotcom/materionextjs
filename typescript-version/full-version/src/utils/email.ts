import nodemailer from 'nodemailer'

// SMTP configuration interface
export interface SmtpConfig {
  host: string
  port: string
  username: string
  password: string
  encryption: string
  fromEmail: string
  fromName: string
}

// Get SMTP configuration from environment variables or database
export const getSmtpConfig = async (): Promise<SmtpConfig> => {
  console.log('🔍 [SMTP CONFIG] Getting SMTP configuration...')

  try {
    // Try to fetch from API first (only in server-side context)
    if (typeof window === 'undefined') {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
        console.log('🔍 [SMTP CONFIG] Fetching from API:', `${baseUrl}/api/settings/smtp`)

        // Try direct file read first (bypass API to avoid auth issues)
        try {
          const fs = require('fs')
          const path = require('path')
          const SETTINGS_FILE = path.join(process.cwd(), 'smtp-settings.json')

          if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf8')
            const settings = JSON.parse(data)

            console.log('🔍 [SMTP CONFIG] Direct file read successful:', {
              ...settings,
              password: settings.password ? '***provided***' : 'missing'
            })

            // Check if settings have actual values (not just defaults)
            const hasValidSettings = settings.username && settings.password && settings.host

            if (hasValidSettings) {
              console.log('✅ [SMTP CONFIG] Using direct file settings')
              return {
                host: settings.host,
                port: settings.port,
                username: settings.username,
                password: settings.password,
                encryption: settings.encryption,
                fromEmail: settings.fromEmail,
                fromName: settings.fromName
              }
            }
          } else {
            console.log('🔍 [SMTP CONFIG] Settings file does not exist')
          }
        } catch (fileError) {
          console.error('❌ [SMTP CONFIG] Error reading settings file directly:', fileError)
        }

        const response = await fetch(`${baseUrl}/api/settings/smtp`)

        console.log('🔍 [SMTP CONFIG] API response status:', response.status)

        if (response.ok) {
          const settings = await response.json()
          console.log('🔍 [SMTP CONFIG] API response data:', {
            ...settings,
            password: settings.password ? '***provided***' : 'missing'
          })

          // Check if settings have actual values (not just defaults)
          const hasValidSettings = settings.username && settings.password && settings.host
          console.log('🔍 [SMTP CONFIG] Has valid settings:', hasValidSettings)

          if (hasValidSettings) {
            console.log('✅ [SMTP CONFIG] Using API settings')
            return {
              host: settings.host,
              port: settings.port,
              username: settings.username,
              password: settings.password,
              encryption: settings.encryption,
              fromEmail: settings.fromEmail,
              fromName: settings.fromName
            }
          }
        } else {
          console.log('❌ [SMTP CONFIG] API request failed')
        }
      } catch (error) {
        console.error('❌ [SMTP CONFIG] Error fetching SMTP settings from API:', error)
      }
    } else {
      console.log('🔍 [SMTP CONFIG] Client-side context, skipping API fetch')
    }
  } catch (error) {
    console.error('❌ [SMTP CONFIG] Error in SMTP config fetch:', error)
  }

  // Fallback to environment variables
  console.log('🔄 [SMTP CONFIG] Using fallback environment variables')
  const fallbackConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || '587',
    username: process.env.SMTP_USERNAME || '',
    password: process.env.SMTP_PASSWORD || '',
    encryption: process.env.SMTP_ENCRYPTION || 'tls',
    fromEmail: process.env.SMTP_FROM_EMAIL || 'admin@example.com',
    fromName: process.env.SMTP_FROM_NAME || 'Admin'
  }

  console.log('🔄 [SMTP CONFIG] Fallback config:', {
    ...fallbackConfig,
    password: fallbackConfig.password ? '***provided***' : 'missing'
  })

  return fallbackConfig
}

// Create email transporter
export const createTransporter = async () => {
  const config = await getSmtpConfig()

  // Special handling for different providers
  const transporterConfig: any = {
    host: config.host,
    port: parseInt(config.port),
    auth: {
      user: config.username,
      pass: config.password
    }
  }

  // Configure based on encryption method
  if (config.encryption === 'ssl') {
    transporterConfig.secure = true
    transporterConfig.tls = {
      rejectUnauthorized: false
    }
  } else if (config.encryption === 'tls') {
    transporterConfig.secure = false
    transporterConfig.tls = {
      ciphers: 'SSLv3',
      rejectUnauthorized: false
    }


    // Require TLS for Yandex and other providers
    if (config.host.includes('yandex') || config.host.includes('mail.ru') || config.host.includes('rambler')) {
      transporterConfig.requireTLS = true
    }
  } else {
    // None - no encryption
    transporterConfig.secure = false
    transporterConfig.tls = {
      rejectUnauthorized: false
    }
  }

  // Special configuration for Russian providers
  if (config.host.includes('yandex')) {
    transporterConfig.auth.type = 'login'
  } else if (config.host.includes('mail.ru') || config.host.includes('rambler')) {
    transporterConfig.auth.type = 'login'


    // Mail.ru and Rambler may need different TLS settings
    if (config.encryption === 'tls') {
      transporterConfig.tls = {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      }
    }
  }

  return nodemailer.createTransport(transporterConfig)
}

// Send email function
export const sendEmail = async (options: {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  templateId?: string
  variables?: Record<string, string>
}) => {
  const transporter = await createTransporter()
  const config = await getSmtpConfig()

  let htmlContent = options.html
  let subject = options.subject

  // If template is specified, fetch and render it
  if (options.templateId) {
    try {
      // Only fetch in server-side context
      if (typeof window === 'undefined') {
        const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/settings/email-templates/${options.templateId}`)

        if (response.ok) {
          const template = await response.json()

          // Replace variables in subject and content
          subject = replaceVariables(template.subject, options.variables || {})
          htmlContent = replaceVariables(template.content, options.variables || {})
        }
      }
    } catch (error) {
      console.error('Error fetching email template:', error)
    }
  }

  const mailOptions = {
    from: options.from || `"${config.fromName}" <${config.fromEmail}>`,
    to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
    subject,
    html: htmlContent,
    text: options.text
  }

  const info = await transporter.sendMail(mailOptions)

  
return info
}

// Replace template variables
const replaceVariables = (text: string, variables: Record<string, string>): string => {
  let result = text

  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(new RegExp(`{${key}}`, 'g'), value)
  })
  
return result
}

// Test SMTP connection
export const testSmtpConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const config = await getSmtpConfig()

    // Check if we have credentials
    console.log('🔍 [SMTP TEST] Checking credentials:', {
      hasUsername: !!config.username,
      hasPassword: !!config.password,
      usernameLength: config.username?.length || 0,
      passwordLength: config.password?.length || 0
    })

    if (!config.username || !config.password) {
      console.log('❌ [SMTP TEST] Missing credentials detected')
      return {
        success: false,
        message: 'Missing credentials. Please enter your email and password.'
      }
    }

    const transporter = await createTransporter()

    console.log('Testing SMTP connection with config:', {
      host: config.host,
      port: config.port,
      encryption: config.encryption,
      username: config.username ? '***provided***' : 'missing'
    })

    // Enable detailed logging for SMTP connection
    console.log('🔄 [SMTP TEST] Starting SMTP connection verification...')

    // Create a new transporter with debug logging enabled
    const debugTransporter = nodemailer.createTransport({
      ...transporter.options,
      logger: true,
      debug: true
    } as any)

    try {
      await debugTransporter.verify()
      console.log('✅ [SMTP TEST] SMTP connection verification successful')
    } catch (error) {
      console.log('❌ [SMTP TEST] SMTP connection verification failed:', error)
      throw error
    }
    
return { success: true, message: 'SMTP connection successful' }
  } catch (error) {
    console.error('SMTP connection test failed:', error)
    let errorMessage = 'Unknown error'

    if (error instanceof Error) {
      errorMessage = error.message

      // Handle specific provider errors
      if (errorMessage.includes('Missing credentials') || errorMessage.includes('EAUTH')) {
        errorMessage = 'Authentication failed. Please check your email and password.'
      } else if (errorMessage.includes('Invalid login')) {
        errorMessage = 'Invalid email or password. Please verify your credentials.'
      } else if (errorMessage.includes('Certificate') || errorMessage.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE')) {
        errorMessage = 'SSL/TLS certificate error. Try changing encryption method.'
      } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
        errorMessage = 'Connection refused. Please check the SMTP host and port.'
      } else if (errorMessage.includes('ETIMEDOUT')) {
        errorMessage = 'Connection timeout. Please check your internet connection and SMTP settings.'
      }
    }

    return {
      success: false,
      message: `SMTP connection failed: ${errorMessage}`
    }
  }
}

import nodemailer from 'nodemailer'
import * as cron from 'node-cron'
import * as fs from 'fs'
import * as path from 'path'
import Handlebars from 'handlebars'

// SMTP configuration interface
import logger from '@/lib/logger'
import { authBaseUrl } from '@/shared/config/env'

export interface SmtpConfig {
  host: string
  port: string
  username: string
  password: string
  encryption: string
  fromEmail: string
  fromName: string
  // DKIM settings
  dkim?: {
    domainName: string
    keySelector: string
    privateKey: string
  }
  // S/MIME settings
  smime?: {
    cert: string
    key: string
    passphrase?: string
  }
  // Webhook settings
  webhook?: {
    url: string
    secret: string
  }
}

// Extended email options
export interface ExtendedEmailOptions {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  templateId?: string
  variables?: Record<string, string>
  // Attachments
  attachments?: Array<{
    filename: string
    path?: string
    content?: Buffer | string
    contentType?: string
    cid?: string // Content-ID for embedded images
  }>
  // Embedded images
  embeddedImages?: Array<{
    filename: string
    path: string
    cid: string
  }>
  // Security options
  dkim?: boolean
  smime?: {
    sign?: boolean
    encrypt?: boolean
    cert?: string
  }
  // Scheduling
  schedule?: {
    cron: string // cron expression
    timezone?: string
  }
  // Webhook notifications
  webhook?: {
    delivery?: boolean
    bounce?: boolean
    complaint?: boolean
  }
  // Metadata
  metadata?: Record<string, any>
}

// Get SMTP configuration from environment variables or database
export const getSmtpConfig = async (): Promise<SmtpConfig> => {
  logger.info('🔍 [SMTP CONFIG] Getting SMTP configuration...')

  try {
    // Try to fetch from API first (only in server-side context)
    if (typeof window === 'undefined') {
      try {
        const baseUrl = authBaseUrl || 'http://localhost:3000'
        logger.info('🔍 [SMTP CONFIG] Fetching from API:', `${baseUrl}/api/settings/smtp`)

        // Try direct file read first (bypass API to avoid auth issues)
        try {
          const fs = require('fs')
          const path = require('path')
          const SETTINGS_FILE = path.join(process.cwd(), 'smtp-settings.json')

          if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf8')
            const settings = JSON.parse(data)

            logger.info('🔍 [SMTP CONFIG] Direct file read successful:', {
              ...settings,
              password: settings.password ? '***provided***' : 'missing'
            })

            // Check if settings have actual values (not just defaults)
            const hasValidSettings = settings.username && settings.password && settings.host

            if (hasValidSettings) {
              logger.info('✅ [SMTP CONFIG] Using direct file settings')
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
            logger.info('🔍 [SMTP CONFIG] Settings file does not exist')
          }
        } catch (fileError) {
          logger.error('❌ [SMTP CONFIG] Error reading settings file directly:', { error: fileError, file: 'src/utils/email.ts' })
        }

        const response = await fetch(`${baseUrl}/api/settings/smtp`)

        logger.info('🔍 [SMTP CONFIG] API response status:', response.status)

        if (response.ok) {
          const settings = await response.json()
          logger.info('🔍 [SMTP CONFIG] API response data:', {
            ...settings,
            password: settings.password ? '***provided***' : 'missing'
          })

          // Check if settings have actual values (not just defaults)
          const hasValidSettings = settings.username && settings.password && settings.host
          logger.info('🔍 [SMTP CONFIG] Has valid settings:', hasValidSettings)

          if (hasValidSettings) {
            logger.info('✅ [SMTP CONFIG] Using API settings')
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
          logger.info('❌ [SMTP CONFIG] API request failed')
        }
      } catch (error) {
        logger.error('❌ [SMTP CONFIG] Error fetching SMTP settings from API:', { error: error, file: 'src/utils/email.ts' })
      }
    } else {
      logger.info('🔍 [SMTP CONFIG] Client-side context, skipping API fetch')
    }
  } catch (error) {
    logger.error('❌ [SMTP CONFIG] Error in SMTP config fetch:', { error: error, file: 'src/utils/email.ts' })
  }

  // Fallback to environment variables
  logger.info('🔄 [SMTP CONFIG] Using fallback environment variables')
  const fallbackConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || '587',
    username: process.env.SMTP_USERNAME || '',
    password: process.env.SMTP_PASSWORD || '',
    encryption: process.env.SMTP_ENCRYPTION || 'tls',
    fromEmail: process.env.SMTP_FROM_EMAIL || 'admin@example.com',
    fromName: process.env.SMTP_FROM_NAME || 'Admin'
  }

  logger.info('🔄 [SMTP CONFIG] Fallback config:', {
    ...fallbackConfig,
    password: fallbackConfig.password ? '***provided***' : 'missing'
  })

  return fallbackConfig
}

// Create email transporter with advanced features
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

  const transporter = nodemailer.createTransport(transporterConfig)

  // DKIM and S/MIME plugins removed - not needed for basic email functionality

  return transporter
}

// Email queue for scheduled sending
const emailQueue: Array<{
  id: string
  options: ExtendedEmailOptions
  scheduledTime: Date
  status: 'pending' | 'sent' | 'failed'
}> = []

// Start email scheduler
export const startEmailScheduler = () => {
  // Check every minute for emails to send
  cron.schedule('* * * * *', async () => {
    const now = new Date()
    const emailsToSend = emailQueue.filter(
      email => email.status === 'pending' && email.scheduledTime <= now
    )

    for (const email of emailsToSend) {
      try {
        await sendEmailImmediate(email.options)
        email.status = 'sent'
      } catch (error) {
        email.status = 'failed'
      }
    }

    // Clean up old emails (keep last 24 hours)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oldEmails = emailQueue.filter(email => email.scheduledTime < oneDayAgo)
    oldEmails.forEach(email => {
      const index = emailQueue.indexOf(email)
      if (index > -1) emailQueue.splice(index, 1)
    })
  })

  // Email scheduler started
}

// Send email function with advanced features
export const sendEmail = async (options: ExtendedEmailOptions) => {
  // If scheduling is requested, add to queue
  if (options.schedule) {
    const scheduledTime = new Date() // Parse cron expression or use provided time
    const emailId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    emailQueue.push({
      id: emailId,
      options,
      scheduledTime,
      status: 'pending'
    })

    return { scheduled: true, id: emailId }
  }

  // Send immediately
  return await sendEmailImmediate(options)
}

// Internal function to send email immediately
const sendEmailImmediate = async (options: ExtendedEmailOptions) => {
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

          // Render templates with Handlebars
          subject = renderTemplate(template.subject, options.variables || {})
          htmlContent = renderTemplate(template.content, options.variables || {})
        }
      }
    } catch (error) {
      logger.error('Error fetching email template:', { error: error, file: 'src/utils/email.ts' })
    }
  }

  // Prepare attachments array
  const attachments: any[] = []

  // Add regular attachments
  if (options.attachments) {
    attachments.push(...options.attachments)
  }

  // Add embedded images
  if (options.embeddedImages) {
    for (const image of options.embeddedImages) {
      attachments.push({
        filename: image.filename,
        path: image.path,
        cid: image.cid
      })
    }
  }

  const mailOptions: any = {
    from: options.from || `"${config.fromName}" <${config.fromEmail}>`,
    to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
    subject,
    html: htmlContent,
    text: options.text,
    attachments: attachments.length > 0 ? attachments : undefined
  }

  // Add S/MIME encryption/signing if requested
  if (options.smime && config.smime) {
    if (options.smime.sign) {
      mailOptions.smime = {
        sign: {
          cert: options.smime.cert || config.smime.cert,
          key: config.smime.key,
          passphrase: config.smime.passphrase
        }
      }
    }

    if (options.smime.encrypt && options.smime.cert) {
      mailOptions.smime = {
        ...mailOptions.smime,
        encrypt: {
          cert: options.smime.cert
        }
      }
    }
  }

  // Add webhook tracking if configured
  if (options.webhook && config.webhook) {
    mailOptions.webhook = {
      url: config.webhook.url,
      secret: config.webhook.secret,
      events: []
    }

    if (options.webhook.delivery) mailOptions.webhook.events.push('delivered')
    if (options.webhook.bounce) mailOptions.webhook.events.push('bounced')
    if (options.webhook.complaint) mailOptions.webhook.events.push('complained')
  }

  const info = await transporter.sendMail(mailOptions)

  logger.info('📧 Email sent successfully:', {
    messageId: info.messageId,
    envelope: info.envelope,
    accepted: info.accepted,
    rejected: info.rejected
  })

  return info
}

// Template compilation cache
const templateCache = new Map<string, HandlebarsTemplateDelegate>()

// Register Handlebars helpers
Handlebars.registerHelper('formatDate', (date: Date | string, format?: string) => {
  const d = new Date(date)
  if (format === 'short') {
    return d.toLocaleDateString()
  }
  return d.toLocaleString()
})

Handlebars.registerHelper('uppercase', (str: string) => {
  return str.toUpperCase()
})

Handlebars.registerHelper('lowercase', (str: string) => {
  return str.toLowerCase()
})

Handlebars.registerHelper('eq', (a: any, b: any) => {
  return a === b
})

Handlebars.registerHelper('ifCond', function(this: any, v1: any, operator: string, v2: any, options: any) {
  switch (operator) {
    case '==':
      return (v1 == v2) ? options.fn(this) : options.inverse(this)
    case '===':
      return (v1 === v2) ? options.fn(this) : options.inverse(this)
    case '!=':
      return (v1 != v2) ? options.fn(this) : options.inverse(this)
    case '!==':
      return (v1 !== v2) ? options.fn(this) : options.inverse(this)
    case '<':
      return (v1 < v2) ? options.fn(this) : options.inverse(this)
    case '<=':
      return (v1 <= v2) ? options.fn(this) : options.inverse(this)
    case '>':
      return (v1 > v2) ? options.fn(this) : options.inverse(this)
    case '>=':
      return (v1 >= v2) ? options.fn(this) : options.inverse(this)
    case '&&':
      return (v1 && v2) ? options.fn(this) : options.inverse(this)
    case '||':
      return (v1 || v2) ? options.fn(this) : options.inverse(this)
    default:
      return options.inverse(this)
  }
})

// Render template with Handlebars
const renderTemplate = (template: string, variables: Record<string, any>): string => {
  try {
    // Check cache first
    let compiledTemplate = templateCache.get(template)

    if (!compiledTemplate) {
      // Compile and cache template
      compiledTemplate = Handlebars.compile(template)
      templateCache.set(template, compiledTemplate)
    }

    // Render with variables
    return compiledTemplate(variables)
  } catch (error) {
    logger.error('Error rendering Handlebars template:', { error: error, file: 'src/utils/email.ts' })
    // Fallback to simple variable replacement
    return replaceVariables(template, variables)
  }
}

// Fallback function for simple variable replacement (backward compatibility)
const replaceVariables = (text: string, variables: Record<string, any>): string => {
  let result = text

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{${key}\\}`, 'g')
    result = result.replace(regex, String(value))
  })

  return result
}

// Initialize email scheduler on module load
if (typeof window === 'undefined') {
  startEmailScheduler()
}

// Certificate and key utilities
export const loadCertificate = (certPath: string): string => {
  try {
    return fs.readFileSync(certPath, 'utf8')
  } catch (error) {
    throw new Error(`Failed to load certificate from ${certPath}: ${error}`)
  }
}

export const loadPrivateKey = (keyPath: string): string => {
  try {
    return fs.readFileSync(keyPath, 'utf8')
  } catch (error) {
    throw new Error(`Failed to load private key from ${keyPath}: ${error}`)
  }
}

export const generateSelfSignedCert = () => {
  // This would require additional crypto libraries
  // For now, return placeholder
  throw new Error('Self-signed certificate generation not implemented. Please provide certificate files.')
}

// Email queue management
export const getEmailQueue = () => {
  return emailQueue.map(email => ({
    id: email.id,
    scheduledTime: email.scheduledTime,
    status: email.status,
    subject: email.options.subject,
    to: email.options.to
  }))
}

export const cancelScheduledEmail = (emailId: string): boolean => {
  const index = emailQueue.findIndex(email => email.id === emailId)
  if (index > -1) {
    emailQueue.splice(index, 1)
    return true
  }
  return false
}

// Test SMTP connection
export const testSmtpConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const config = await getSmtpConfig()

    // Check if we have credentials
    logger.info('🔍 [SMTP TEST] Checking credentials:', {
      hasUsername: !!config.username,
      hasPassword: !!config.password,
      usernameLength: config.username?.length || 0,
      passwordLength: config.password?.length || 0
    })

    if (!config.username || !config.password) {
      logger.info('❌ [SMTP TEST] Missing credentials detected')
      return {
        success: false,
        message: 'Missing credentials. Please enter your email and password.'
      }
    }

    const transporter = await createTransporter()

    logger.info('Testing SMTP connection with config:', {
      host: config.host,
      port: config.port,
      encryption: config.encryption,
      username: config.username ? '***provided***' : 'missing'
    })

    // Enable detailed logging for SMTP connection
    logger.info('🔄 [SMTP TEST] Starting SMTP connection verification...')

    // Create a new transporter with debug logging enabled
    const debugTransporter = nodemailer.createTransport({
      ...transporter.options,
      logger: true,
      debug: true
    })

    try {
      await debugTransporter.verify()
      logger.info('✅ [SMTP TEST] SMTP connection verification successful')
    } catch (error) {
      logger.info('❌ [SMTP TEST] SMTP connection verification failed:', error)
      throw error
    }

return { success: true, message: 'SMTP connection successful' }
  } catch (error) {
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

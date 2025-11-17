import logger from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import { testSmtpConnection } from '@/utils/email'

// Simple settings storage (in production, use database)
const SETTINGS_FILE = path.join(process.cwd(), 'smtp-settings.json')

type SmtpSettingsPayload = {
  host: string
  port: string
  username: string
  password: string
  encryption: string
  fromEmail: string
  fromName: string
  updatedAt?: string
}

const isSmtpSettings = (data: unknown): data is SmtpSettingsPayload => {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.host === 'string' &&
    typeof obj.port === 'string' &&
    typeof obj.username === 'string' &&
    typeof obj.password === 'string' &&
    typeof obj.encryption === 'string' &&
    typeof obj.fromEmail === 'string' &&
    typeof obj.fromName === 'string'
  )
}

const getStoredSettings = (): Partial<SmtpSettingsPayload> => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8')
      const settings = JSON.parse(data)

      if (isSmtpSettings(settings)) {
        return settings
      }
    }
  } catch (error) {
    logger.error('Error reading SMTP settings file:', { error: error, file: 'src/app/api/settings/smtp/route.ts' })
  }

  return {}
}

const saveStoredSettings = (settings: SmtpSettingsPayload) => {
  try {
    // Ensure directory exists
    const dir = path.dirname(SETTINGS_FILE)

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
    logger.info('SMTP settings saved to file')
  } catch (error) {
    logger.error('Error saving SMTP settings file:', { error: error, file: 'src/app/api/settings/smtp/route.ts' })
    throw new Error('Failed to save settings')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user || !checkPermission(user, 'smtpManagement', 'update')) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { host, port, username, password, encryption, fromEmail, fromName } = body as Partial<SmtpSettingsPayload>

    // Validate required fields
    if (!host || !port || !username || !password || !fromEmail || !fromName) {
      return NextResponse.json(
        { message: 'All fields are required' },
        { status: 400 }
      )
    }

    // Note: SMTP connection test is not performed during save operation
    // Users can test connection separately using the test endpoint

    // Save settings to file for demo purposes
    const settingsToSave: SmtpSettingsPayload = {
      host: host ?? '',
      port: port ?? '',
      username: username ?? '',
      password: password ?? '',
      encryption: encryption ?? '',
      fromEmail: fromEmail ?? '',
      fromName: fromName ?? '',
      updatedAt: new Date().toISOString()
    }

    saveStoredSettings(settingsToSave)

    logger.info('SMTP settings saved successfully:', {
      ...settingsToSave,
      password: password ? '***provided***' : 'missing'
    })

    return NextResponse.json({ message: 'SMTP settings saved successfully' })
  } catch (error) {
    logger.error('Error saving SMTP settings:', { error: error, file: 'src/app/api/settings/smtp/route.ts' })
    
return NextResponse.json(
      { message: 'Failed to save SMTP settings' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user || !checkPermission(user, 'smtpManagement', 'read')) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }


    // Try to get stored settings first, then fall back to environment variables
    const storedSettings = getStoredSettings()

    const settings = {
      host: storedSettings.host || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: storedSettings.port || process.env.SMTP_PORT || '587',
      username: storedSettings.username || process.env.SMTP_USERNAME || '',
      password: storedSettings.password || process.env.SMTP_PASSWORD || '',
      encryption: storedSettings.encryption || process.env.SMTP_ENCRYPTION || 'tls',
      fromEmail: storedSettings.fromEmail || process.env.SMTP_FROM_EMAIL || 'admin@example.com',
      fromName: storedSettings.fromName || process.env.SMTP_FROM_NAME || 'Admin'
    }

    logger.info('Returning SMTP settings:', {
      ...settings,
      password: settings.password ? '***provided***' : 'missing'
    })

    return NextResponse.json(settings)
  } catch (error) {
    logger.error('Error fetching SMTP settings:', { error: error, file: 'src/app/api/settings/smtp/route.ts' })
    
return NextResponse.json(
      { message: 'Failed to fetch SMTP settings' },
      { status: 500 }
    )
  }
}



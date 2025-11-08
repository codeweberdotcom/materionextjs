// @ts-nocheck
import logger from '@/lib/logger'

﻿// Next Imports

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRole } from '@/utils/permissions/permissions'

import { sendEmail } from '@/utils/email'

import { checkPermission } from '@/utils/permissions/permissions'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!session || !checkPermission(user, 'smtpManagement', 'update')) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await ({} as any).json()
    const { host, port, username, password, encryption, fromEmail, fromName, recipientEmail } = body

    logger.info('SMTP send test request body:', {
      host,
      port,
      username: username ? '***provided***' : 'missing',
      password: password ? '***provided***' : 'missing',
      encryption,
      fromEmail,
      fromName,
      recipientEmail
    })

    // Validate required fields
    if (!recipientEmail) {
      return NextResponse.json(
        { success: false, message: 'Recipient email is required' },
        { status: 400 }
      )
    }

    // Temporarily save settings for testing
    const fs = require('fs')
    const path = require('path')
    const SETTINGS_FILE = path.join(process.cwd(), 'smtp-settings.json')

    const testSettings = {
      host,
      port,
      username,
      password,
      encryption,
      fromEmail,
      fromName,
      updatedAt: new Date().toISOString()
    }

    try {
      // Ensure directory exists
      const dir = path.dirname(SETTINGS_FILE)

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(testSettings, null, 2))
      logger.info('Testing with provided settings:', { ...testSettings, password: '***hidden***' })
    } catch (error) {
      console.error('Error saving test settings:', error)

      return NextResponse.json(
        {
          success: false,
          message: 'Failed to save test settings'
        },
        { status: 500 }
      )
    }

    // Send test email
    try {
      await sendEmail({
        to: recipientEmail,
        subject: 'SMTP Test Email',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">SMTP Test Email</h2>
            <p>This is a test email sent from your SMTP configuration.</p>
            <p><strong>SMTP Settings:</strong></p>
            <ul>
              <li>Host: ${host}</li>
              <li>Port: ${port}</li>
              <li>Encryption: ${encryption}</li>
              <li>From Email: ${fromEmail}</li>
              <li>From Name: ${fromName}</li>
            </ul>
            <p>If you received this email, your SMTP configuration is working correctly!</p>
            <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toLocaleString()}</p>
          </div>
        `,
        text: `
SMTP Test Email

This is a test email sent from your SMTP configuration.

SMTP Settings:
- Host: ${host}
- Port: ${port}
- Encryption: ${encryption}
- From Email: ${fromEmail}
- From Name: ${fromName}

If you received this email, your SMTP configuration is working correctly!

Sent at: ${new Date().toLocaleString()}
        `
      })

      logger.info('Test email sent successfully to:', recipientEmail)

      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully'
      })
    } catch (emailError) {
      console.error('Error sending test email:', emailError)

      return NextResponse.json(
        {
          success: false,
          message: `Failed to send test email: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('SMTP send test error:', error)

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}



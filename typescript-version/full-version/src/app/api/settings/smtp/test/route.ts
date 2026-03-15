import fs from 'fs'

import path from 'path'

import { NextResponse } from 'next/server'

import logger from '@/lib/logger'
import { withApiHandler } from '@/lib/api/withApiHandler'
import { testSmtpConnection } from '@/utils/email'
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'


type TestSmtpPayload = {
  host?: string
  port?: string
  username?: string
  password?: string
  encryption?: string
}

export const POST = withApiHandler({
  permission: 'smtpManagement.update',
  handler: async ({ user, request }) => {
    const body = (await request.json()) as TestSmtpPayload
    const { host, port, username, password, encryption } = body ?? {}

    logger.info('SMTP test request body:', { host, port, username: username ? '***provided***' : 'missing', password: password ? '***provided***' : 'missing', encryption })

    // If specific settings are provided, temporarily override
    if (host && username && password) {
      // Temporarily save settings for testing
      const SETTINGS_FILE = path.join(process.cwd(), 'smtp-settings.json')

      const testSettings = {
        host,
        port,
        username,
        password,
        encryption,
        fromEmail: username,
        fromName: 'Test User'
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
        logger.error('Error saving test settings:', { error: error, file: 'src/app/api/settings/smtp/test/route.ts' })

        return NextResponse.json(
          {
            success: false,
            message: 'Failed to save test settings'
          },
          { status: 500 }
        )
      }
    }

    const result = await testSmtpConnection()

    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'admin',
      module: 'settings',
      type: 'smtp.connection_tested',
      severity: result.success ? 'info' : 'warning',
      message: `SMTP connection test: ${result.success ? 'success' : 'failed'}`,
      actor: { type: 'user', id: user.id },
      subject: { type: 'settings', id: 'smtp' },
      payload: { success: result.success, host }
    }))

    return NextResponse.json({
      success: result.success,
      message: result.message
    })
  }
})

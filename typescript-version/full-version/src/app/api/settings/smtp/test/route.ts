// Next Imports
import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { testSmtpConnection } from '@/utils/email'
import { authOptions } from '@/libs/auth'
import { checkPermission } from '@/utils/permissions'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !checkPermission(session.user, 'smtpManagement', 'update')) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { host, port, username, password, encryption } = body

    console.log('SMTP test request body:', { host, port, username: username ? '***provided***' : 'missing', password: password ? '***provided***' : 'missing', encryption })

    // If specific settings are provided, temporarily override
    if (host && username && password) {
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
        console.log('Testing with provided settings:', { ...testSettings, password: '***hidden***' })
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
    }

    const result = await testSmtpConnection()

    return NextResponse.json({
      success: result.success,
      message: result.message
    })
  } catch (error) {
    console.error('SMTP test error:', error)
    
return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

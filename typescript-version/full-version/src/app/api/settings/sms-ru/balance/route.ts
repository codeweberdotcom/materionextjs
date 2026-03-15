import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { smsRuSettingsService } from '@/services/settings/SMSRuSettingsService'
import { SMSRuProvider } from '@/services/sms'

// GET - Проверить баланс SMS.ru (admin only)
export const GET = withApiHandler({
  permission: 'smtpManagement.read',
  handler: async () => {
    const settings = await smsRuSettingsService.getSettings()

    if (!settings.apiKey) {
      return NextResponse.json(
        { message: 'SMS.ru API key not configured' },
        { status: 400 }
      )
    }

    const provider = new SMSRuProvider({
      apiKey: settings.apiKey,
      sender: settings.sender,
      testMode: settings.testMode
    })

    const balance = await provider.getBalance()

    return NextResponse.json({
      balance,
      currency: 'RUB',
      testMode: settings.testMode
    })
  }
})



import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { smsRuSettingsService } from '@/services/settings/SMSRuSettingsService'
import { SMSRuProvider } from '@/services/sms'

// GET - Проверить остаток бесплатных SMS на сегодня (admin only)
export const GET = withApiHandler({
  permission: 'smsManagement.read',
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
      testMode: settings.testMode,
      useFreeFirst: settings.useFreeFirst
    })

    const freeInfo = await provider.getFreeCount()

    return NextResponse.json({
      free: freeInfo.free,
      used: freeInfo.used,
      total: freeInfo.free + freeInfo.used,
      testMode: settings.testMode
    })
  }
})

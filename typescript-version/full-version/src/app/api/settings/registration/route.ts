import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { registrationSettingsService } from '@/services/settings/RegistrationSettingsService'
import {
  registrationSettingsSchema,
  updateRegistrationSettingsSchema,
  formatZodError
} from '@/lib/validations/registration-settings-schemas'
import logger from '@/lib/logger'

// GET - Получить текущие настройки регистрации (admin only)
export const GET = withApiHandler({
  permission: 'settings.read',
  handler: async () => {
    const settings = await registrationSettingsService.getSettings()

    return NextResponse.json({
      id: settings.id,
      registrationMode: settings.registrationMode,
      requirePhoneVerification: settings.requirePhoneVerification,
      requireEmailVerification: settings.requireEmailVerification,
      smsProvider: settings.smsProvider,
      updatedBy: settings.updatedBy,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt
    })
  }
})

// PUT - Обновить настройки регистрации (admin only)
export const PUT = withApiHandler({
  permission: 'settings.update',
  handler: async ({ user, request }) => {
    // Validate request body
    const body = await request.json()
    const validationResult = updateRegistrationSettingsSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { message: formatZodError(validationResult.error) },
        { status: 400 }
      )
    }

    const updateData = validationResult.data

    // Get current settings to merge with updates
    const currentSettings = await registrationSettingsService.getSettings()

    // Prepare full settings object with defaults
    const fullSettings = {
      registrationMode: updateData.registrationMode ?? currentSettings.registrationMode,
      requirePhoneVerification: updateData.requirePhoneVerification ?? currentSettings.requirePhoneVerification,
      requireEmailVerification: updateData.requireEmailVerification ?? currentSettings.requireEmailVerification,
      smsProvider: updateData.smsProvider ?? currentSettings.smsProvider
    }

    // Validate full settings
    const fullValidationResult = registrationSettingsSchema.safeParse(fullSettings)

    if (!fullValidationResult.success) {
      return NextResponse.json(
        { message: formatZodError(fullValidationResult.error) },
        { status: 400 }
      )
    }

    // Update settings
    const updatedSettings = await registrationSettingsService.updateSettings(
      fullValidationResult.data,
      user.id
    )

    logger.info('Registration settings updated:', {
      updatedBy: user.id,
      settings: {
        registrationMode: updatedSettings.registrationMode,
        requirePhoneVerification: updatedSettings.requirePhoneVerification,
        requireEmailVerification: updatedSettings.requireEmailVerification,
        smsProvider: updatedSettings.smsProvider
      },
      file: 'src/app/api/settings/registration/route.ts'
    })

    return NextResponse.json({
      id: updatedSettings.id,
      registrationMode: updatedSettings.registrationMode,
      requirePhoneVerification: updatedSettings.requirePhoneVerification,
      requireEmailVerification: updatedSettings.requireEmailVerification,
      smsProvider: updatedSettings.smsProvider,
      updatedBy: updatedSettings.updatedBy,
      createdAt: updatedSettings.createdAt,
      updatedAt: updatedSettings.updatedAt,
      message: 'Registration settings updated successfully'
    })
  }
})

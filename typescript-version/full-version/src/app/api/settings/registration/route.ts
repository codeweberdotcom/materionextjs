import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import { registrationSettingsService } from '@/services/settings/RegistrationSettingsService'
import {
  registrationSettingsSchema,
  updateRegistrationSettingsSchema,
  formatZodError
} from '@/lib/validations/registration-settings-schemas'
import logger from '@/lib/logger'

// GET - Получить текущие настройки регистрации (admin only)
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check permissions
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user has permission to read settings
    if (!checkPermission(currentUser, 'settings', 'read')) {
      return NextResponse.json(
        { message: 'Permission denied: settings read required' },
        { status: 403 }
      )
    }

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
  } catch (error) {
    logger.error('Error fetching registration settings:', { error, file: 'src/app/api/settings/registration/route.ts' })
    
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Обновить настройки регистрации (admin only)
export async function PUT(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check permissions
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user has permission to update settings
    if (!checkPermission(currentUser, 'settings', 'update')) {
      return NextResponse.json(
        { message: 'Permission denied: settings update required' },
        { status: 403 }
      )
    }

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
      currentUser.id
    )

    logger.info('Registration settings updated:', {
      updatedBy: currentUser.id,
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
  } catch (error) {
    logger.error('Error updating registration settings:', { error, file: 'src/app/api/settings/registration/route.ts' })
    
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}


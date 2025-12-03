/**
 * Admin API для настроек slug системы
 * 
 * GET /api/admin/settings/slug - Получить настройки
 * PUT /api/admin/settings/slug - Обновить настройки
 */

import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import { eventService } from '@/services/events'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

// Настройки по умолчанию
const DEFAULT_SETTINGS = {
  changeIntervalDays: 30,
  minLength: 3,
  maxLength: 50,
  reservedSlugs: '[]',
  allowAdminOverride: true
}

/**
 * GET - Получить настройки slug
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    // Проверяем права администратора
    const hasPermission = await checkPermission(user, 'settings', 'read')
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const settings = await prisma.slugSettings.findFirst()
    
    if (!settings) {
      return NextResponse.json(DEFAULT_SETTINGS)
    }

    return NextResponse.json({
      changeIntervalDays: settings.changeIntervalDays,
      minLength: settings.minLength,
      maxLength: settings.maxLength,
      reservedSlugs: settings.reservedSlugs,
      allowAdminOverride: settings.allowAdminOverride,
      updatedAt: settings.updatedAt
    })
  } catch (error) {
    console.error('Error getting slug settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Обновить настройки slug
 */
export async function PUT(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    // Проверяем права администратора
    const hasPermission = await checkPermission(user, 'settings', 'edit')
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      changeIntervalDays,
      minLength,
      maxLength,
      reservedSlugs,
      allowAdminOverride
    } = body

    // Валидация
    if (changeIntervalDays !== undefined && (changeIntervalDays < 0 || changeIntervalDays > 365)) {
      return NextResponse.json(
        { error: 'changeIntervalDays must be between 0 and 365' },
        { status: 400 }
      )
    }

    if (minLength !== undefined && (minLength < 1 || minLength > 50)) {
      return NextResponse.json(
        { error: 'minLength must be between 1 and 50' },
        { status: 400 }
      )
    }

    if (maxLength !== undefined && (maxLength < 10 || maxLength > 100)) {
      return NextResponse.json(
        { error: 'maxLength must be between 10 and 100' },
        { status: 400 }
      )
    }

    if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
      return NextResponse.json(
        { error: 'minLength cannot be greater than maxLength' },
        { status: 400 }
      )
    }

    // Валидация reservedSlugs (должен быть JSON массив)
    if (reservedSlugs !== undefined) {
      try {
        const parsed = JSON.parse(reservedSlugs)
        if (!Array.isArray(parsed)) {
          return NextResponse.json(
            { error: 'reservedSlugs must be a JSON array' },
            { status: 400 }
          )
        }
      } catch {
        return NextResponse.json(
          { error: 'reservedSlugs must be valid JSON' },
          { status: 400 }
        )
      }
    }

    // Ищем существующие настройки
    const existingSettings = await prisma.slugSettings.findFirst()

    let settings
    if (existingSettings) {
      settings = await prisma.slugSettings.update({
        where: { id: existingSettings.id },
        data: {
          ...(changeIntervalDays !== undefined && { changeIntervalDays }),
          ...(minLength !== undefined && { minLength }),
          ...(maxLength !== undefined && { maxLength }),
          ...(reservedSlugs !== undefined && { reservedSlugs }),
          ...(allowAdminOverride !== undefined && { allowAdminOverride }),
          updatedBy: user.id
        }
      })
    } else {
      settings = await prisma.slugSettings.create({
        data: {
          changeIntervalDays: changeIntervalDays ?? DEFAULT_SETTINGS.changeIntervalDays,
          minLength: minLength ?? DEFAULT_SETTINGS.minLength,
          maxLength: maxLength ?? DEFAULT_SETTINGS.maxLength,
          reservedSlugs: reservedSlugs ?? DEFAULT_SETTINGS.reservedSlugs,
          allowAdminOverride: allowAdminOverride ?? DEFAULT_SETTINGS.allowAdminOverride,
          updatedBy: user.id
        }
      })
    }

    // Записываем событие
    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'admin',
      module: 'settings',
      type: 'slug_settings_updated',
      severity: 'info',
      message: 'Slug settings updated',
      actor: { type: 'user', id: user.id },
      subject: { type: 'system', id: 'slug_settings' },
      key: 'slug_settings',
      payload: {
        settings: {
          changeIntervalDays: settings.changeIntervalDays,
          minLength: settings.minLength,
          maxLength: settings.maxLength,
          allowAdminOverride: settings.allowAdminOverride
        }
      }
    }))

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        changeIntervalDays: settings.changeIntervalDays,
        minLength: settings.minLength,
        maxLength: settings.maxLength,
        reservedSlugs: settings.reservedSlugs,
        allowAdminOverride: settings.allowAdminOverride,
        updatedAt: settings.updatedAt
      }
    })
  } catch (error) {
    console.error('Error updating slug settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { accountManagerService } from '@/services/accounts'
import { assignManagerSchema } from '@/lib/validations/account-schemas'
import { formatZodError } from '@/lib/validations/user-schemas'
import { eventService } from '@/services/events/EventService'

/**
 * GET /api/accounts/[id]/managers
 * Получить список менеджеров аккаунта
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)
    const { id } = await params

    if (!user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const managers = await accountManagerService.getAccountManagers(id, user.id)

    return NextResponse.json({
      success: true,
      data: managers
    })
  } catch (error) {
    console.error('[GET /api/accounts/[id]/managers] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/accounts/[id]/managers
 * Назначить менеджера для аккаунта
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)
    const { id } = await params

    if (!user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validationResult = assignManagerSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: formatZodError(validationResult.error)
        },
        { status: 400 }
      )
    }

    const { userId, permissions } = validationResult.data

    const manager = await accountManagerService.assignManager(
      id,
      user.id,
      userId,
      permissions,
      user.id
    )

    // Логируем событие
    await eventService.record({
      source: 'api',
      module: 'account',
      type: 'manager.assigned',
      severity: 'info',
      actor: { type: 'user', id: user.id },
      subject: { type: 'account', id: id },
      message: `Пользователь ${user.email || user.id} назначил менеджера для аккаунта`,
      payload: {
        managerUserId: userId,
        permissions
      }
    })

    return NextResponse.json({
      success: true,
      data: manager,
      message: 'Manager assigned successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/accounts/[id]/managers] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}




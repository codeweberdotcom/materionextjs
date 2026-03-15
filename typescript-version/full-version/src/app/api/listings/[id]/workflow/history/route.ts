/**
 * API: Listing Workflow History
 *
 * GET /api/listings/[id]/workflow/history - Получить историю переходов
 */

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { listingWorkflowService } from '@/services/workflows/ListingWorkflowService'
import { listingStateLabels, listingEventLabels } from '@/services/workflows/machines/ListingMachine'
import { prisma } from '@/libs/prisma'

/**
 * GET /api/listings/[id]/workflow/history
 *
 * Получить историю переходов объявления
 *
 * Query params:
 * - limit: number (default: 50)
 */
export const GET = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, request, params }) => {
    const { id: listingId } = params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // Проверяем существование объявления
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, ownerId: true }
    })

    if (!listing) {
      return NextResponse.json({ error: 'Объявление не найдено' }, { status: 404 })
    }

    // Проверка прав: владелец или модератор
    const userRole = user.role?.code
    const isOwner = listing.ownerId === user.id
    const isModerator = ['SUPERADMIN', 'ADMIN', 'MODERATOR'].includes(userRole || '')

    if (!isOwner && !isModerator) {
      return NextResponse.json(
        { error: 'Нет доступа к истории этого объявления' },
        { status: 403 }
      )
    }

    // Получить историю
    const history = await listingWorkflowService.getTransitionHistory(listingId, limit)

    // Обогащаем labels и информацией об акторе
    const enrichedHistory = await Promise.all(
      history.map(async (transition) => {
        // Получаем имя актора
        let actorName = 'Система'

        if (transition.actorId) {
          const actor = await prisma.user.findUnique({
            where: { id: transition.actorId },
            select: { name: true, email: true }
          })

          actorName = actor?.name || actor?.email || 'Неизвестный'
        }

        return {
          id: transition.id,
          fromState: transition.fromState,
          fromStateLabel: listingStateLabels[transition.fromState as keyof typeof listingStateLabels] || transition.fromState,
          toState: transition.toState,
          toStateLabel: listingStateLabels[transition.toState as keyof typeof listingStateLabels] || transition.toState,
          event: transition.event,
          eventLabel: listingEventLabels[transition.event] || transition.event,
          actorId: transition.actorId,
          actorName,
          actorType: transition.actorType,
          metadata: transition.metadata ? JSON.parse(transition.metadata) : null,
          createdAt: transition.createdAt
        }
      })
    )

    return NextResponse.json({
      listingId,
      history: enrichedHistory,
      total: history.length
    })
  }
})

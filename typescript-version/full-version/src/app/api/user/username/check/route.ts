/**
 * API для проверки доступности username
 *
 * GET /api/user/username/check?username=xxx - Проверить доступность
 */

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { slugService } from '@/services/slug'

/**
 * GET - Проверить доступность username
 */
export const GET = withApiHandler({
  handler: async ({ user, request }) => {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    if (!username) {
      return NextResponse.json(
        { error: 'Username parameter is required' },
        { status: 400 }
      )
    }

    // Валидация формата
    const validation = slugService.validateSlug(username)

    if (!validation.valid) {
      return NextResponse.json({
        available: false,
        valid: false,
        error: validation.error
      })
    }

    // Проверка доступности (исключаем текущего пользователя)
    const available = await slugService.isSlugAvailable(username, 'user', user.id)

    return NextResponse.json({
      available,
      valid: true,
      username
    })
  }
})

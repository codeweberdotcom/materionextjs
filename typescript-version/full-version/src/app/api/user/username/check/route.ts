/**
 * API для проверки доступности username
 * 
 * GET /api/user/username/check?username=xxx - Проверить доступность
 */

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { slugService } from '@/services/slug'

/**
 * GET - Проверить доступность username
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    
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
  } catch (error) {
    console.error('Error checking username availability:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


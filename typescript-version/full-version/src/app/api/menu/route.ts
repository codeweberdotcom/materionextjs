import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import type { Locale } from '@configs/i18n'
import type { VerticalMenuDataType } from '@/types/menuTypes'

import { requireAuth } from '@/utils/auth/auth'
import { getDictionary } from '@/utils/formatting/getDictionary'
import menuData from '@/data/navigation/verticalMenuData'
import logger from '@/lib/logger'
import { hasMenuChildren } from '@/utils/menu/shared'
import { problemJson } from '@/shared/http/problem-details'

const serializeMenuItem = (item: VerticalMenuDataType): VerticalMenuDataType => {
  const serializedItem: VerticalMenuDataType = { ...item }

  if ('suffix' in serializedItem && typeof serializedItem.suffix === 'object') {
    serializedItem.suffix = undefined
  }

  if ('prefix' in serializedItem && typeof serializedItem.prefix === 'object') {
    serializedItem.prefix = undefined
  }

  if (hasMenuChildren(serializedItem)) {
    serializedItem.children = serializedItem.children
      .map(serializeMenuItem)
      .filter((child): child is VerticalMenuDataType => Boolean(child))
  }

  return serializedItem
}

export const GET = async (request: NextRequest) => {
  logger.info('=== API MENU GET REQUEST STARTED ===')

  try {
    const { user } = await requireAuth(request)

    if (!user) {
      return problemJson({
        status: 401,
        title: 'Unauthorized',
        detail: 'User session not found'
      })
    }

    const url = new URL(request.url)
    const locale = (url.searchParams.get('locale') ?? 'en') as Locale
    const dictionary = await getDictionary(locale)

    const filteredMenuData = menuData(dictionary).map(serializeMenuItem)

    logger.info('API MENU: Final filtered menu length:', filteredMenuData.length)

    return NextResponse.json({ menu: filteredMenuData })
  } catch (error) {
    logger.error('Error fetching menu', { error })

    return problemJson({
      status: 500,
      title: 'Internal Server Error',
      detail: 'Unable to build navigation menu',
      type: 'https://materio.dev/problems/menu-fetch-failed'
    })
  }
}



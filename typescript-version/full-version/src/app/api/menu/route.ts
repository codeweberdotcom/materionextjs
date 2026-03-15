import { NextResponse } from 'next/server'

import type { Locale } from '@configs/i18n'
import type { VerticalMenuDataType } from '@/types/menuTypes'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { getDictionary } from '@/utils/formatting/getDictionary'
import menuData from '@/data/navigation/verticalMenuData'
import logger from '@/lib/logger'
import { hasMenuChildren } from '@/utils/menu/shared'

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

export const GET = withApiHandler({
  handler: async ({ request }) => {
    logger.info('=== API MENU GET REQUEST STARTED ===')

    const url = new URL(request.url)
    const locale = (url.searchParams.get('locale') ?? 'en') as Locale
    const dictionary = await getDictionary(locale)

    const filteredMenuData = menuData(dictionary).map(serializeMenuItem)

    logger.info('API MENU: Final filtered menu length:', filteredMenuData.length)

    return NextResponse.json({ menu: filteredMenuData })
  }
})

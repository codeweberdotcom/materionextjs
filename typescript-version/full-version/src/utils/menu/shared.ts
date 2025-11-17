import type { VerticalMenuDataType } from '@/types/menuTypes'
import type { getDictionary } from '@/utils/formatting/getDictionary'

export const MENU_NAVIGATION_KEYS = [
  'appsPages',
  'adminAndSettings',
  'userSettings',
  'userList',
  'roles',
  'permissions',
  'smtpSettings',
  'emailTemplates',
  'rateLimitCategory',
  'rateLimitManagement',
  'rateLimitEvents',
  'blocking',
  'monitoring',
  'monitoringOverview',
  'monitoringMetrics',
  'monitoringErrorTracking',
  'monitoringApplicationInsights',
  'maintenance',
  'references'
] as const

export type MenuNavigationKey = (typeof MENU_NAVIGATION_KEYS)[number]

export type MenuNavigationLabels = Record<MenuNavigationKey, string>

export const getMenuNavigationLabels = (
  dictionary: Awaited<ReturnType<typeof getDictionary>>
): MenuNavigationLabels => {
  const navigationSection =
    (dictionary as { navigation?: Record<string, unknown> })?.navigation ?? {}

  return MENU_NAVIGATION_KEYS.reduce<MenuNavigationLabels>((labels, key) => {
    const value = navigationSection[key]
    labels[key] = typeof value === 'string' ? value : key

    return labels
  }, {} as MenuNavigationLabels)
}

export type MenuBranch = Extract<VerticalMenuDataType, { children: VerticalMenuDataType[] }>

export const hasMenuChildren = (item: VerticalMenuDataType): item is MenuBranch =>
  Boolean(
    item &&
      typeof item === 'object' &&
      'children' in item &&
      Array.isArray((item as MenuBranch).children)
  )

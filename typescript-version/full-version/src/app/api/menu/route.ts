import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRole } from '@/utils/permissions/permissions'


import { checkPermission, isSuperadmin, getUserPermissions } from '@/utils/permissions/permissions'
import menuData from '@/data/navigation/verticalMenuData'
import { getDictionary } from '@/utils/formatting/getDictionary'

// Helper function to filter menu recursively
import logger from '@/lib/logger'

function filterMenuRecursively(items: any[], user: any, dictionary: any): any[] {
  return items.map((item: any) => {
    // If item has children, filter them recursively
    if (item.children && Array.isArray(item.children)) {
      const filteredChildren = filterMenuRecursively(item.children, user, dictionary)

      // Apply permission filtering to specific menu items
      if (item.label === dictionary['navigation'].userSettings) {
        logger.info('API MENU: Processing userSettings, children count:', item.children?.length)
        const filteredSubChildren = item.children?.filter((subChild: any) => {
          logger.info('API MENU: Processing subChild:', subChild.label)
          if (subChild.label === dictionary['navigation'].userList) {
            const hasPermission = checkPermission(user as UserWithRole || null, 'userManagement', 'read')
            logger.info('API MENU: userList permission:', hasPermission)
            return hasPermission
          }
          if (subChild.label === dictionary['navigation'].roles) {
            const hasPermission = checkPermission(user as UserWithRole || null, 'roleManagement', 'read')
            logger.info('API MENU: roles permission:', hasPermission)
            return hasPermission
          }
          if (subChild.label === dictionary['navigation'].permissions) {
            const hasPermission = checkPermission(user as UserWithRole || null, 'permissionsManagement', 'read')
            logger.info('API MENU: permissions permission:', hasPermission)
            return hasPermission
          }
          return true
        })
        logger.info('API MENU: filteredSubChildren length:', filteredSubChildren?.length)
        if (filteredSubChildren && filteredSubChildren.length > 0) {
          return { ...item, children: filteredSubChildren }
        }
        return null
      }

      // For admin section, filter its children based on permissions
      if (item.label === dictionary['navigation'].adminAndSettings) {
        logger.info('API MENU: Processing admin section, children count:', filteredChildren?.length)
        const permissionFilteredChildren = filteredChildren.filter((child: any) => {
          logger.info('API MENU: Processing child:', child.label)
          if (child.label === dictionary['navigation'].smtpSettings) {
            const hasPermission = checkPermission(user as UserWithRole || null, 'smtpManagement', 'read')
            logger.info('API MENU: smtpSettings permission:', hasPermission)
            return hasPermission
          }
          if (child.label === dictionary['navigation'].emailTemplates) {
            const hasPermission = checkPermission(user as UserWithRole || null, 'emailTemplatesManagement', 'read')
            logger.info('API MENU: emailTemplates permission:', hasPermission)
            return hasPermission
          }
          // Keep other children (like userSettings, references) if they have content
          return true
        }).filter((item: any) => Boolean)

        logger.info('API MENU: permissionFilteredChildren length:', permissionFilteredChildren?.length)
        if (permissionFilteredChildren && permissionFilteredChildren.length > 0) {
          return { ...item, children: permissionFilteredChildren }
        }
        return null
      }

      // For other sections with children, keep them if they have children
      if (filteredChildren.length > 0) {
        return { ...item, children: filteredChildren }
      }
      return null
    }

    // For items without children, keep them
    return item
  }).filter((item: any) => Boolean)
}

// Helper function to serialize menu data (remove JSX elements)
function serializeMenuItem(item: any): any {
  if (!item) return item

  const serialized = { ...item }

  // Remove JSX elements from suffix and prefix
  if (serialized.suffix && typeof serialized.suffix === 'object') {
    delete serialized.suffix
  }
  if (serialized.prefix && typeof serialized.prefix === 'object') {
    delete serialized.prefix
  }

  // Recursively serialize children
  if (serialized.children && Array.isArray(serialized.children)) {
    serialized.children = serialized.children.map(serializeMenuItem).filter((item: any) => Boolean)
  }

  return serialized
}

export async function GET(request: NextRequest) {
  logger.info('=== API MENU GET REQUEST STARTED ===')
  try {
    const { user, session } = await requireAuth(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get locale from query params or default to 'en'
    const url = new URL(request.url)
    const locale = url.searchParams.get('locale') || 'en'

    // Get dictionary for the locale
    const dictionary = await getDictionary(locale as any)

    logger.info('API MENU: User permissions:', getUserPermissions(user as UserWithRole))
    logger.info('API MENU: isSuperadmin:', isSuperadmin(user as UserWithRole))
    logger.info('API MENU: dictionary adminAndSettings:', dictionary['navigation'].adminAndSettings)

    // Filter menu data based on permissions (skip for superadmin)
    const rawMenuData = menuData(dictionary)
    logger.info('API MENU: Raw menu data length:', rawMenuData.length)

    const filteredMenuData = isSuperadmin(user as UserWithRole || null) ? rawMenuData : filterMenuRecursively(rawMenuData, user as UserWithRole, dictionary)

    logger.info('API MENU: Final filtered menu length:', filteredMenuData.length)
    logger.info('API MENU: Final filtered menu:', JSON.stringify(filteredMenuData, null, 2))

    // Debug: Check if references section exists
    const adminSection = filteredMenuData.find((item: any) => item.label === dictionary['navigation'].adminAndSettings)
    logger.info('API MENU: Admin section found:', !!adminSection)
    if (adminSection && adminSection.children) {
      const referencesSection = adminSection.children.find((child: any) => child.label === dictionary['navigation'].references)
      logger.info('API MENU: References section found:', !!referencesSection)
      if (referencesSection && referencesSection.children) {
        logger.info('API MENU: References children:', referencesSection.children.map((child: any) => child.label))
      }
    }

    // Serialize menu data to remove JSX elements
    const serializedMenu = filteredMenuData.map(serializeMenuItem)

    return NextResponse.json({ menu: serializedMenu })
  } catch (error) {
    console.error('Error fetching menu:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



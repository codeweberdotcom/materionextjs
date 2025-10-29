import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'
import { checkPermission, isSuperadmin, getUserPermissions } from '@/utils/permissions'
import menuData from '@/data/navigation/verticalMenuData'
import { getDictionary } from '@/utils/getDictionary'

// Helper function to filter menu recursively
function filterMenuRecursively(items: any[], user: any, dictionary: any): any[] {
  return items.map((item) => {
    // If item has children, filter them recursively
    if (item.children && Array.isArray(item.children)) {
      const filteredChildren = filterMenuRecursively(item.children, user, dictionary)

      // Apply permission filtering to specific menu items
      if (item.label === dictionary['navigation'].userSettings) {
        console.log('API MENU: Processing userSettings, children count:', item.children?.length)
        const filteredSubChildren = item.children?.filter((subChild: any) => {
          console.log('API MENU: Processing subChild:', subChild.label)
          if (subChild.label === dictionary['navigation'].userList) {
            const hasPermission = checkPermission(user || null, 'userManagement', 'read')
            console.log('API MENU: userList permission:', hasPermission)
            return hasPermission
          }
          if (subChild.label === dictionary['navigation'].roles) {
            const hasPermission = checkPermission(user || null, 'roleManagement', 'read')
            console.log('API MENU: roles permission:', hasPermission)
            return hasPermission
          }
          if (subChild.label === dictionary['navigation'].permissions) {
            const hasPermission = checkPermission(user || null, 'permissionsManagement', 'read')
            console.log('API MENU: permissions permission:', hasPermission)
            return hasPermission
          }
          return true
        })
        console.log('API MENU: filteredSubChildren length:', filteredSubChildren?.length)
        if (filteredSubChildren && filteredSubChildren.length > 0) {
          return { ...item, children: filteredSubChildren }
        }
        return null
      }

      // For admin section, filter its children based on permissions
      if (item.label === dictionary['navigation'].adminAndSettings) {
        console.log('API MENU: Processing admin section, children count:', filteredChildren?.length)
        const permissionFilteredChildren = filteredChildren.filter((child: any) => {
          console.log('API MENU: Processing child:', child.label)
          if (child.label === dictionary['navigation'].smtpSettings) {
            const hasPermission = checkPermission(user || null, 'smtpManagement', 'read')
            console.log('API MENU: smtpSettings permission:', hasPermission)
            return hasPermission
          }
          if (child.label === dictionary['navigation'].emailTemplates) {
            const hasPermission = checkPermission(user || null, 'emailTemplatesManagement', 'read')
            console.log('API MENU: emailTemplates permission:', hasPermission)
            return hasPermission
          }
          // Keep other children (like userSettings, references) if they have content
          return true
        }).filter(Boolean)

        console.log('API MENU: permissionFilteredChildren length:', permissionFilteredChildren?.length)
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
  }).filter(Boolean)
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
    serialized.children = serialized.children.map(serializeMenuItem).filter(Boolean)
  }

  return serialized
}

export async function GET(request: Request) {
  console.log('=== API MENU GET REQUEST STARTED ===')
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Get locale from query params or default to 'en'
    const url = new URL(request.url)
    const locale = url.searchParams.get('locale') || 'en'

    // Get dictionary for the locale
    const dictionary = await getDictionary(locale as any)

    console.log('API MENU: User permissions:', getUserPermissions(user))
    console.log('API MENU: isSuperadmin:', isSuperadmin(user))
    console.log('API MENU: dictionary adminAndSettings:', dictionary['navigation'].adminAndSettings)

    // Filter menu data based on permissions (skip for superadmin)
    const rawMenuData = menuData(dictionary)
    console.log('API MENU: Raw menu data length:', rawMenuData.length)

    const filteredMenuData = isSuperadmin(user || null) ? rawMenuData : filterMenuRecursively(rawMenuData, user, dictionary)

    console.log('API MENU: Final filtered menu length:', filteredMenuData.length)
    console.log('API MENU: Final filtered menu:', JSON.stringify(filteredMenuData, null, 2))

    // Debug: Check if references section exists
    const adminSection = filteredMenuData.find(item => item.label === dictionary['navigation'].adminAndSettings)
    console.log('API MENU: Admin section found:', !!adminSection)
    if (adminSection && adminSection.children) {
      const referencesSection = adminSection.children.find(child => child.label === dictionary['navigation'].references)
      console.log('API MENU: References section found:', !!referencesSection)
      if (referencesSection && referencesSection.children) {
        console.log('API MENU: References children:', referencesSection.children.map(child => child.label))
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

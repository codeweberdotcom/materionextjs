import { checkPermission, isSuperadmin } from '@/utils/permissions'
import menuData from '@/data/navigation/verticalMenuData'
import type { getDictionary } from '@/utils/getDictionary'
import type { VerticalMenuDataType } from '@/types/menuTypes'
import type { UserWithRole } from '@/utils/permissions'

export function getFilteredMenuDataClient(dictionary: Awaited<ReturnType<typeof getDictionary>>, user: UserWithRole | null): VerticalMenuDataType[] {
  // Debug logging
  console.log('=== MENU FILTER DEBUG ===')
  console.log('User:', user)
  console.log('User role:', user?.role)
  console.log('User permissions:', user?.role?.permissions)
  console.log('isSuperadmin:', isSuperadmin(user))
  console.log('isAdmin:', user?.role?.name === 'admin')

  // Filter menu data based on permissions (skip for superadmin)
  const fullMenuData = menuData(dictionary)

  const filteredMenuData = isSuperadmin(user) ? fullMenuData : fullMenuData.map((item) => {
    console.log('Processing menu item:', item.label)

    // For Apps & Pages section that contains admin settings
    if (item.label === dictionary['navigation'].appsPages && (item as any).children) {
      console.log('Processing Apps & Pages section')
      const sectionItem = item as any
      const filteredChildren = sectionItem.children.map((child: any) => {
        console.log('Processing child in Apps & Pages:', child.label)

        // Check if this is the admin section
        if (child.label === dictionary['navigation'].adminAndSettings) {
          console.log('Found admin section, processing it')
          const adminSection = child as any
          const filteredAdminChildren = adminSection.children?.filter((adminChild: any) => {
            console.log('Processing admin child:', adminChild.label)

            if (adminChild.label === dictionary['navigation'].userSettings) {
              console.log('Processing user settings')
              const filteredSubChildren = adminChild.children?.filter((subChild: any) => {
                console.log('Processing subChild:', subChild.label)

                if (subChild.label === dictionary['navigation'].userList) {
                  const hasPermission = checkPermission(user, 'userManagement', 'read')
                  console.log('userList permission check:', hasPermission)
                  return hasPermission
                }
                if (subChild.label === dictionary['navigation'].roles) {
                  const hasPermission = checkPermission(user, 'roleManagement', 'read')
                  console.log('roles permission check:', hasPermission)
                  return hasPermission
                }
                if (subChild.label === dictionary['navigation'].permissions) {
                  const hasPermission = checkPermission(user, 'permissionsManagement', 'read')
                  console.log('permissions permission check:', hasPermission)
                  return hasPermission
                }
                console.log('subChild allowed by default:', subChild.label)
                return true
              })

              console.log('filteredSubChildren length:', filteredSubChildren?.length)
              if (filteredSubChildren && filteredSubChildren.length > 0) {
                console.log('Returning user settings with filtered children')
                return { ...adminChild, children: filteredSubChildren }
              }
              console.log('No subChildren left, returning false')
              return false
            }

            if (adminChild.label === dictionary['navigation'].smtpSettings) {
              const hasPermission = checkPermission(user, 'smtpManagement', 'read')
              console.log('smtpSettings permission check:', hasPermission)
              return hasPermission
            }
            if (adminChild.label === dictionary['navigation'].emailTemplates) {
              const hasPermission = checkPermission(user, 'emailTemplatesManagement', 'read')
              console.log('emailTemplates permission check:', hasPermission)
              return hasPermission
            }

            // Handle References section
            if (adminChild.label === dictionary['navigation'].references) {
              console.log('Processing references section')
              // References section is always visible for now (no specific permissions required)
              console.log('References section allowed by default')
              return true
            }

            console.log('Admin child allowed by default:', adminChild.label)
            return true
          }).filter(Boolean)

          console.log('filteredAdminChildren length:', filteredAdminChildren?.length)
          if (filteredAdminChildren && filteredAdminChildren.length > 0) {
            console.log('Returning admin section with filtered children')
            return { ...adminSection, children: filteredAdminChildren }
          }
          console.log('No admin children left, returning false')
          return false
        }

        console.log('Child in Apps & Pages allowed by default:', child.label)
        return child
      }).filter(Boolean)

      console.log('Returning Apps & Pages section with filtered children')
      return { ...sectionItem, children: filteredChildren }
    }

    console.log('Item allowed by default:', item.label)
    return item
  }).filter(Boolean)

  console.log('Final filtered menu data length:', filteredMenuData.length)

  // Check if references section is present
  const adminSection = filteredMenuData.find(item => item.label === dictionary['navigation'].adminAndSettings)
  if (adminSection && (adminSection as any).children) {
    const referencesSection = (adminSection as any).children.find((child: any) => child.label === dictionary['navigation'].references)
    console.log('References section found in final menu:', !!referencesSection)
    if (referencesSection && referencesSection.children) {
      console.log('References children:', referencesSection.children.map((child: any) => child.label))
    }
  }

  console.log('Final filtered menu data:', filteredMenuData)
  console.log('=== END MENU FILTER DEBUG ===')

  return filteredMenuData
}

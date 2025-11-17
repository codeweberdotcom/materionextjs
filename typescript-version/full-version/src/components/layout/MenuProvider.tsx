import menuData from '@/data/navigation/verticalMenuData'
import type { getDictionary } from '@/utils/formatting/getDictionary'
import type { VerticalMenuDataType } from '@/types/menuTypes'
import type { UserWithRole } from '@/utils/permissions/permissions'

export const getFilteredMenuDataClient = (
  dictionary: Awaited<ReturnType<typeof getDictionary>>,
  user: UserWithRole | null
): VerticalMenuDataType[] => {
  // User param is kept for API-compatibility but menu is no longer filtered by permissions
  void user

  return menuData(dictionary)
}

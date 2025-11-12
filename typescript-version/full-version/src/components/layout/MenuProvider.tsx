import menuData from '@/data/navigation/verticalMenuData'
import type { getDictionary } from '@/utils/formatting/getDictionary'
import type { VerticalMenuDataType } from '@/types/menuTypes'
import type { UserWithRole } from '@/utils/permissions/permissions'
import { filterMenuDataByPermissions } from '@/utils/menu/filterMenu'

export const getFilteredMenuDataClient = (
  dictionary: Awaited<ReturnType<typeof getDictionary>>,
  user: UserWithRole | null
): VerticalMenuDataType[] => {
  const fullMenuData = menuData(dictionary)

  return filterMenuDataByPermissions({
    items: fullMenuData,
    dictionary,
    user
  })
}

// React Imports
import { useEffect, useState } from 'react'

// Type Imports
import type { getDictionary } from '@/utils/formatting/getDictionary'
import type { VerticalMenuDataType } from '@/types/menuTypes'
import type { Locale } from '@configs/i18n'
import type { ScrollMenuHandler } from '@core/types'

// Component Imports
import ClientVerticalMenu from './ClientVerticalMenu'

type Props = {
  dictionary: Awaited<ReturnType<typeof getDictionary>>
  scrollMenu: ScrollMenuHandler
  locale: Locale
}

const ServerVerticalMenu = ({ dictionary, scrollMenu, locale }: Props) => {
  const [menuData, setMenuData] = useState<VerticalMenuDataType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const response = await fetch(`/api/menu?locale=${locale}`)
        if (response.ok) {
           const data = await response.json()
           console.log('SERVER MENU: Received menu data:', data.menu)
           console.log('SERVER MENU: Menu data length:', data.menu?.length)
           setMenuData(data.menu)
        } else {
          console.error('Failed to fetch menu')
          // Fallback to empty menu or handle error
          setMenuData([])
        }
      } catch (error) {
        console.error('Error fetching menu:', error)
        setMenuData([])
      } finally {
        setLoading(false)
      }
    }

    fetchMenu()
  }, [locale])

  if (loading) {
    // Return loading state or empty menu
    return (
      <ClientVerticalMenu
        menuData={[]}
        dictionary={dictionary}
        scrollMenu={scrollMenu}
        locale={locale}
      />
    )
  }

  return (
    <ClientVerticalMenu
      menuData={menuData}
      dictionary={dictionary}
      scrollMenu={scrollMenu}
      locale={locale}
    />
  )
}

export default ServerVerticalMenu

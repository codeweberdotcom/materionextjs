'use client'

// MUI Imports
import { useTheme } from '@mui/material/styles'

// Third-party Imports
import PerfectScrollbar from 'react-perfect-scrollbar'

// Type Imports
import type { getDictionary } from '@/utils/formatting/getDictionary'
import type { VerticalMenuContextProps } from '@menu/components/vertical-menu/Menu'
import type { VerticalMenuDataType } from '@/types/menuTypes'
import type { Locale } from '@configs/i18n'
import type { ScrollMenuHandler } from '@core/types'
import type { MenuBranch } from '@/utils/menu/shared'

// Component Imports
import { Menu } from '@menu/vertical-menu'
import { GenerateVerticalMenu } from '@components/GenerateMenu'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

// Styled Component Imports
import StyledVerticalNavExpandIcon from '@menu/styles/vertical/StyledVerticalNavExpandIcon'

// Style Imports
import menuItemStyles from '@core/styles/vertical/menuItemStyles'
import menuSectionStyles from '@core/styles/vertical/menuSectionStyles'
import { getMenuNavigationLabels, hasMenuChildren } from '@/utils/menu/shared'

type RenderExpandIconProps = {
  open?: boolean
  transitionDuration?: VerticalMenuContextProps['transitionDuration']
}

type Props = {
  menuData: VerticalMenuDataType[]
  dictionary: Awaited<ReturnType<typeof getDictionary>>
  scrollMenu: ScrollMenuHandler
  locale: Locale
}

const RenderExpandIcon = ({ open, transitionDuration }: RenderExpandIconProps) => (
  <StyledVerticalNavExpandIcon open={open} transitionDuration={transitionDuration}>
    <i className='ri-arrow-right-s-line' />
  </StyledVerticalNavExpandIcon>
)

const ClientVerticalMenu = ({ menuData, dictionary, scrollMenu, locale }: Props) => {
  // Debug logging
  console.log('CLIENT MENU: Received menuData:', menuData)
  console.log('CLIENT MENU: Menu data length:', menuData?.length)

  const navigationLabels = getMenuNavigationLabels(dictionary)

  const findSectionByLabel = (items: VerticalMenuDataType[] | undefined, label: string) =>
    items?.find(
      (item): item is MenuBranch =>
        hasMenuChildren(item) && typeof item.label === 'string' && item.label === label
    )

  const adminSection = findSectionByLabel(menuData, navigationLabels.adminAndSettings)
  console.log('CLIENT MENU: Admin section found:', Boolean(adminSection))

  const referencesSection = findSectionByLabel(adminSection?.children, navigationLabels.references)
  console.log('CLIENT MENU: References section found:', Boolean(referencesSection))

  if (referencesSection?.children) {
    const referencesChildren = referencesSection.children
      .map(child => (typeof child.label === 'string' ? child.label : null))
      .filter((label): label is string => Boolean(label))

    console.log('CLIENT MENU: References children count:', referencesChildren.length)
    console.log('CLIENT MENU: References children:', referencesChildren)
  }

  // Hooks
  const theme = useTheme()
  const verticalNavOptions = useVerticalNav()

  // Vars
  const { isBreakpointReached, transitionDuration } = verticalNavOptions

  const ScrollWrapper = isBreakpointReached ? 'div' : PerfectScrollbar

  return (
    // eslint-disable-next-line lines-around-comment
    /* Custom scrollbar instead of browser scroll, remove if you want browser scroll only */
    <ScrollWrapper
      {...(isBreakpointReached
        ? {
            className: 'bs-full overflow-y-auto overflow-x-hidden',
            onScroll: container => scrollMenu(container, false)
          }
        : {
            options: { wheelPropagation: false, suppressScrollX: true },
            onScrollY: container => scrollMenu(container, true)
          })}
    >
      {/* Incase you also want to scroll NavHeader to scroll with Vertical Menu, remove NavHeader from above and paste it below this comment */}
      {/* Vertical Menu */}
      <Menu
        popoutMenuOffset={{ mainAxis: 10 }}
        menuItemStyles={menuItemStyles(verticalNavOptions, theme)}
        renderExpandIcon={({ open }) => <RenderExpandIcon open={open} transitionDuration={transitionDuration} />}
        renderExpandedMenuItemIcon={{ icon: <i className='ri-circle-line' /> }}
        menuSectionStyles={menuSectionStyles(verticalNavOptions, theme)}
      >
        <GenerateVerticalMenu menuData={menuData} locale={locale} />
      </Menu>
    </ScrollWrapper>
  )
}

export default ClientVerticalMenu

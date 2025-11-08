// MUI Imports
import { useTheme } from '@mui/material/styles'

// Third-party Imports
import PerfectScrollbar from 'react-perfect-scrollbar'

// Type Imports
import type { getDictionary } from '@/utils/formatting/getDictionary'
import type { VerticalMenuContextProps } from '@menu/components/vertical-menu/Menu'
import type { VerticalMenuDataType } from '@/types/menuTypes'
import type { Locale } from '@configs/i18n'

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

type RenderExpandIconProps = {
  open?: boolean
  transitionDuration?: VerticalMenuContextProps['transitionDuration']
}

type Props = {
  menuData: VerticalMenuDataType[]
  dictionary: Awaited<ReturnType<typeof getDictionary>>
  scrollMenu: (container: any, isPerfectScrollbar: boolean) => void
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

  // Check if menuData contains references
  if (menuData && Array.isArray(menuData)) {
    const adminSection = menuData.find(item => item.label === 'Admin & Settings')
    console.log('CLIENT MENU: Admin section found:', !!adminSection)
    if (adminSection && (adminSection as any)?.children) {
      const referencesSection = (adminSection as any)?.children?.find((child: any) => child.label === 'References')
      console.log('CLIENT MENU: References section found:', !!referencesSection)
      if (referencesSection && referencesSection.children) {
        console.log('CLIENT MENU: References children count:', referencesSection.children.length)
        console.log('CLIENT MENU: References children:', referencesSection.children.map((child: any) => child.label))
      }
    }
  }

  // Check if references section exists
  const adminSection = menuData?.find(item => item.label === dictionary['navigation'].adminAndSettings)
  console.log('CLIENT MENU: Admin section found:', !!adminSection)
  if (adminSection && (adminSection as any).children) {
    const referencesSection = (adminSection as any).children.find((child: any) => child.label === dictionary['navigation'].references)
    console.log('CLIENT MENU: References section found:', !!referencesSection)
    if (referencesSection && referencesSection.children) {
      console.log('CLIENT MENU: References children:', referencesSection.children.map((child: any) => child.label))
    }
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

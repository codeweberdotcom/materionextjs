// Next Imports
import { useParams } from 'next/navigation'

// MUI Imports
import Chip from '@mui/material/Chip'
import { useTheme } from '@mui/material/styles'

// Third-party Imports
import PerfectScrollbar from 'react-perfect-scrollbar'

// Type Imports
import type { getDictionary } from '@/utils/formatting/getDictionary'
import type { VerticalMenuContextProps } from '@menu/components/vertical-menu/Menu'
import type { ScrollMenuHandler } from '@core/types'

// Component Imports
import { Menu, SubMenu, MenuItem, MenuSection } from '@menu/vertical-menu'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'
import { usePermissions } from '@/hooks/usePermissions'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'
import { useNotifications } from '@/hooks/useNotifications'

// Redux Imports
import { useSelector } from 'react-redux'
import type { RootState } from '@/redux-store'

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
  dictionary: Awaited<ReturnType<typeof getDictionary>>
  scrollMenu: ScrollMenuHandler
}

const RenderExpandIcon = ({ open, transitionDuration }: RenderExpandIconProps) => (
  <StyledVerticalNavExpandIcon open={open} transitionDuration={transitionDuration}>
    <i className='ri-arrow-right-s-line' />
  </StyledVerticalNavExpandIcon>
)

const VerticalMenu = ({ dictionary, scrollMenu }: Props) => {
  // Hooks
  const theme = useTheme()
  const verticalNavOptions = useVerticalNav()
  const params = useParams()
  const { checkPermission, isAuthenticated, user } = usePermissions()
  const { unreadCount } = useUnreadMessages()
  const { unreadCount: notificationsUnreadCount } = useNotifications()

  console.log('🔍 [MENU] User authenticated:', isAuthenticated)
  console.log('🔍 [MENU] User role:', user?.role?.name)
  console.log('🔍 [MENU] User role permissions:', user?.role?.permissions)

  // Redux
  const notifications = useSelector((state: RootState) => state.notificationsReducer.notifications)
  const notificationsUnreadCountFromRedux = notifications.filter(notification => notification.status === 'unread').length

  // Vars
  const { isBreakpointReached, transitionDuration } = verticalNavOptions
  const { lang: locale } = params

  const ScrollWrapper = isBreakpointReached ? 'div' : PerfectScrollbar

  // Create filtered menu structure
  const getFilteredMenuJSX = () => {
    const menuItems = []

    // Always include dashboards
    menuItems.push(
      <SubMenu
        key="dashboards"
        label={dictionary['navigation'].dashboards}
        icon={<i className='ri-home-smile-line' />}
        suffix={<Chip label='5' size='small' color='error' />}
      >
        <MenuItem href={`/${locale}/dashboards/crm`}>{dictionary['navigation'].crm}</MenuItem>
        <MenuItem href={`/${locale}/dashboards/analytics`}>{dictionary['navigation'].analytics}</MenuItem>
        <MenuItem href={`/${locale}/dashboards/ecommerce`}>{dictionary['navigation'].eCommerce}</MenuItem>
        <MenuItem href={`/${locale}/dashboards/academy`}>{dictionary['navigation'].academy}</MenuItem>
        <MenuItem href={`/${locale}/dashboards/logistics`}>{dictionary['navigation'].logistics}</MenuItem>
      </SubMenu>
    )

    // Always include front pages
    menuItems.push(
      <SubMenu key="frontPages" label={dictionary['navigation'].frontPages} icon={<i className='ri-file-copy-line' />}>
        <MenuItem href='/front-pages/landing-page' target='_blank'>
          {dictionary['navigation'].landing}
        </MenuItem>
        <MenuItem href='/front-pages/pricing' target='_blank'>
          {dictionary['navigation'].pricing}
        </MenuItem>
        <MenuItem href='/front-pages/payment' target='_blank'>
          {dictionary['navigation'].payment}
        </MenuItem>
        <MenuItem href='/front-pages/checkout' target='_blank'>
          {dictionary['navigation'].checkout}
        </MenuItem>
        <MenuItem href='/front-pages/help-center' target='_blank'>
          {dictionary['navigation'].helpCenter}
        </MenuItem>
      </SubMenu>
    )

    // Apps & Pages section
    const appsPagesChildren = []

    // Always include eCommerce
    appsPagesChildren.push(
      <SubMenu key="ecommerce" label={dictionary['navigation'].eCommerce} icon={<i className='ri-shopping-bag-3-line' />}>
        <MenuItem href={`/${locale}/apps/ecommerce/dashboard`}>{dictionary['navigation'].dashboard}</MenuItem>
        <SubMenu label={dictionary['navigation'].products}>
          <MenuItem href={`/${locale}/apps/ecommerce/products/list`}>{dictionary['navigation'].list}</MenuItem>
          <MenuItem href={`/${locale}/apps/ecommerce/products/add`}>{dictionary['navigation'].add}</MenuItem>
          <MenuItem href={`/${locale}/apps/ecommerce/products/category`}>
            {dictionary['navigation'].category}
          </MenuItem>
        </SubMenu>
        <SubMenu label={dictionary['navigation'].orders}>
          <MenuItem href={`/${locale}/apps/ecommerce/orders/list`}>{dictionary['navigation'].list}</MenuItem>
          <MenuItem
            href={`/${locale}/apps/ecommerce/orders/details/5434`}
            exactMatch={false}
            activeUrl='/apps/ecommerce/orders/details'
          >
            {dictionary['navigation'].details}
          </MenuItem>
        </SubMenu>
        <SubMenu label={dictionary['navigation'].customers}>
          <MenuItem href={`/${locale}/apps/ecommerce/customers/list`}>{dictionary['navigation'].list}</MenuItem>
          <MenuItem
            href={`/${locale}/apps/ecommerce/customers/details/879861`}
            exactMatch={false}
            activeUrl='/apps/ecommerce/customers/details'
          >
            {dictionary['navigation'].details}
          </MenuItem>
        </SubMenu>
        <MenuItem href={`/${locale}/apps/ecommerce/manage-reviews`}>
          {dictionary['navigation'].manageReviews}
        </MenuItem>
        <MenuItem href={`/${locale}/apps/ecommerce/referrals`}>{dictionary['navigation'].referrals}</MenuItem>
        <MenuItem href={`/${locale}/apps/ecommerce/settings`}>{dictionary['navigation'].settings}</MenuItem>
      </SubMenu>
    )

    // Always include academy
    appsPagesChildren.push(
      <SubMenu key="academy" label={dictionary['navigation'].academy} icon={<i className='ri-graduation-cap-line' />}>
        <MenuItem href={`/${locale}/apps/academy/dashboard`}>{dictionary['navigation'].dashboard}</MenuItem>
        <MenuItem href={`/${locale}/apps/academy/my-courses`}>{dictionary['navigation'].myCourses}</MenuItem>
        <MenuItem href={`/${locale}/apps/academy/course-details`}>
          {dictionary['navigation'].courseDetails}
        </MenuItem>
      </SubMenu>
    )

    // Always include logistics
    appsPagesChildren.push(
      <SubMenu key="logistics" label={dictionary['navigation'].logistics} icon={<i className='ri-car-line' />}>
        <MenuItem href={`/${locale}/apps/logistics/dashboard`}>{dictionary['navigation'].dashboard}</MenuItem>
        <MenuItem href={`/${locale}/apps/logistics/fleet`}>{dictionary['navigation'].fleet}</MenuItem>
      </SubMenu>
    )

    // Always include email, chat, calendar, kanban
    appsPagesChildren.push(
      <MenuItem
        key="email"
        href={`/${locale}/apps/email`}
        exactMatch={false}
        activeUrl='/apps/email'
        icon={<i className='ri-mail-open-line' />}
      >
        {dictionary['navigation'].email}
      </MenuItem>
    )
    appsPagesChildren.push(
      <MenuItem key="calendar" href={`/${locale}/apps/calendar`} icon={<i className='ri-calendar-line' />}>
        {dictionary['navigation'].calendar}
      </MenuItem>
    )
    appsPagesChildren.push(
      <MenuItem key="kanban" href={`/${locale}/apps/kanban`} icon={<i className='ri-drag-drop-line' />}>
        {dictionary['navigation'].kanban}
      </MenuItem>
    )

    // Always include invoice
    appsPagesChildren.push(
      <SubMenu key="invoice" label={dictionary['navigation'].invoice} icon={<i className='ri-bill-line' />}>
        <MenuItem href={`/${locale}/apps/invoice/list`}>{dictionary['navigation'].list}</MenuItem>
        <MenuItem
          href={`/${locale}/apps/invoice/preview/4987`}
          exactMatch={false}
          activeUrl='/apps/invoice/preview'
        >
          {dictionary['navigation'].preview}
        </MenuItem>
        <MenuItem href={`/${locale}/apps/invoice/edit/4987`} exactMatch={false} activeUrl='/apps/invoice/edit'>
          {dictionary['navigation'].edit}
        </MenuItem>
        <MenuItem href={`/${locale}/apps/invoice/add`}>{dictionary['navigation'].add}</MenuItem>
      </SubMenu>
    )


    // Admin & Settings section (always visible)
    const adminSettingsChildren = []

    // User Settings
    const userSettingsChildren = []
    if (checkPermission('userManagement', 'read')) {
      userSettingsChildren.push(
        <MenuItem key="userList" href={`/${locale}/apps/user/list`}>{dictionary['navigation'].userList}</MenuItem>
      )
    }
    if (checkPermission('roleManagement', 'read') || checkPermission('permissionsManagement', 'read')) {
      userSettingsChildren.push(
        <MenuItem key="roles" href={`/${locale}/apps/roles`}>{dictionary['navigation'].roles}</MenuItem>
      )
    }
    // Permissions menu item removed as requested

    if (userSettingsChildren.length > 0) {
      adminSettingsChildren.push(
        <SubMenu key="userSettings" label={dictionary['navigation'].userSettings} icon={<i className='ri-user-settings-line' />}>
          {userSettingsChildren}
        </SubMenu>
      )
    }

    // References (only show if user has at least one reference permission)
    const referencesChildren = []
    if (checkPermission('languageManagement', 'read')) {
      referencesChildren.push(
        <MenuItem key="languages" href={`/${locale}/apps/references/languages`} icon={<i className='ri-translate-2' />}>
          {dictionary['navigation'].languages}
        </MenuItem>
      )
    }

    // Countries
    if (checkPermission('countryManagement', 'read')) {
      referencesChildren.push(
        <MenuItem key="countries" href={`/${locale}/apps/references/countries`} icon={<i className='ri-earth-line' />}>
          {dictionary['navigation'].countries}
        </MenuItem>
      )
    }

    // States
    if (checkPermission('stateManagement', 'read')) {
      referencesChildren.push(
        <MenuItem key="states" href={`/${locale}/apps/references/states`} icon={<i className='ri-map-pin-2-line' />}>
          {dictionary['navigation'].states}
        </MenuItem>
      )
    }

    // Cities
    if (checkPermission('cityManagement', 'read')) {
      referencesChildren.push(
        <MenuItem key="cities" href={`/${locale}/apps/references/cities`} icon={<i className='ri-map-pin-4-line' />}>
          {dictionary['navigation'].cities}
        </MenuItem>
      )
    }

    // Districts
    if (checkPermission('districtManagement', 'read')) {
      referencesChildren.push(
        <MenuItem key="districts" href={`/${locale}/apps/references/districts`} icon={<i className='ri-map-pin-5-line' />}>
          {dictionary['navigation'].districts}
        </MenuItem>
      )
    }

    if (checkPermission('currencyManagement', 'read')) {
      referencesChildren.push(
        <MenuItem key="currencies" href={`/${locale}/apps/references/currencies`} icon={<i className='ri-money-dollar-circle-line' />}>
          {dictionary['navigation'].currencies}
        </MenuItem>
      )
    }
    // Translations moved to admin settings section

    if (referencesChildren.length > 0) {
      adminSettingsChildren.push(
        <SubMenu key="references" label={dictionary['navigation'].references} icon={<i className='ri-database-2-line' />}>
          {referencesChildren}
        </SubMenu>
      )
    }

    // SMTP Settings
    if (checkPermission('smtpManagement', 'read')) {
      adminSettingsChildren.push(
        <MenuItem key="smtpSettings" href={`/${locale}/apps/settings/smtp`} icon={<i className='ri-mail-settings-line' />}>
          {dictionary['navigation'].smtpSettings}
        </MenuItem>
      )
    }

    // Email Templates
    if (checkPermission('emailTemplatesManagement', 'read')) {
      adminSettingsChildren.push(
        <MenuItem key="emailTemplates" href={`/${locale}/apps/settings/email-templates`} icon={<i className='ri-file-text-line' />}>
          {dictionary['navigation'].emailTemplates}
        </MenuItem>
      )
    }

    // Translations (moved from references section)
    if (checkPermission('translationManagement', 'read')) {
      adminSettingsChildren.push(
        <MenuItem key="translations" href={`/${locale}/apps/references/translations`} icon={<i className='ri-global-line' />}>
          {dictionary['navigation'].translations}
        </MenuItem>
      )
    }

    const rateLimitChildren = []
    if (checkPermission('rateLimitManagement', 'read')) {
      rateLimitChildren.push(
        <MenuItem key="rateLimitManagement" href={`/${locale}/admin/rate-limits`} icon={<i className='ri-timer-flash-line' />}>
          {dictionary['navigation'].rateLimitManagement}
        </MenuItem>
      )
      rateLimitChildren.push(
        <MenuItem key="rateLimitEvents" href={`/${locale}/admin/rate-limits/events`} icon={<i className='ri-line-chart-line' />}>
          {dictionary['navigation'].rateLimitEvents}
        </MenuItem>
      )
    }

    // Communications section (only show if user has at least one communication permission)
    const communicationsChildren = []

    // Only show chat if user has read permission
    if (checkPermission('chat', 'read')) {
      communicationsChildren.push(
        <MenuItem
          key="chat"
          href={`/${locale}/apps/chat`}
          icon={<i className='ri-wechat-line' />}
          suffix={unreadCount > 0 ? (
            <Chip label={unreadCount > 99 ? '99+' : unreadCount} size='small' color='error' />
          ) : undefined}
        >
          {dictionary['navigation'].chat}
        </MenuItem>
      )
    }

    // Only show notifications if user has read permission
    if (checkPermission('notifications', 'read')) {
      communicationsChildren.push(
        <MenuItem
          key="notifications"
          href={`/${locale}/apps/notifications`}
          icon={<i className='ri-notification-2-line' />}
          suffix={notificationsUnreadCountFromRedux > 0 ? (
            <Chip label={notificationsUnreadCountFromRedux > 99 ? '99+' : notificationsUnreadCountFromRedux} size='small' color='error' />
          ) : undefined}
        >
          {dictionary['navigation'].notifications || 'Notifications'}
        </MenuItem>
      )
    }

    if (communicationsChildren.length > 0) {
      menuItems.push(
        <MenuSection key="communications" label={dictionary['navigation'].communications}>
          {communicationsChildren}
        </MenuSection>
      )
    }

    // Monitoring section (only show if user has at least one monitoring permission)
    const monitoringChildren = []

    // Overview - always visible for monitoring access
    monitoringChildren.push(
      <MenuItem key="monitoringOverview" href={`/${locale}/admin/monitoring/overview`} icon={<i className='ri-eye-line' />}>
        {dictionary['navigation'].monitoringOverview}
      </MenuItem>
    )

    // Metrics
    monitoringChildren.push(
      <MenuItem key="monitoringMetrics" href={`/${locale}/admin/monitoring/metrics`} icon={<i className='ri-bar-chart-2-line' />}>
        {dictionary['navigation'].monitoringMetrics}
      </MenuItem>
    )

    // Error Tracking
    monitoringChildren.push(
      <MenuItem key="monitoringErrorTracking" href={`/${locale}/admin/monitoring/error-tracking`} icon={<i className='ri-error-warning-line' />}>
        {dictionary['navigation'].monitoringErrorTracking}
      </MenuItem>
    )

    // Application Insights
    monitoringChildren.push(
      <MenuItem key="monitoringApplicationInsights" href={`/${locale}/admin/monitoring/application-insights`} icon={<i className='ri-lightbulb-line' />}>
        {dictionary['navigation'].monitoringApplicationInsights}
      </MenuItem>
    )

    // Testing
    monitoringChildren.push(
      <MenuItem key="monitoringTesting" href={`/${locale}/admin/monitoring/testing`} icon={<i className='ri-test-tube-line' />} >
        Testing
      </MenuItem>
    )

    if (monitoringChildren.length > 0) {
      menuItems.push(
        <MenuSection key="monitoring" label={dictionary['navigation'].monitoring}>
          {monitoringChildren}
        </MenuSection>
      )
    }

    if (adminSettingsChildren.length > 0) {
      menuItems.push(
        <MenuSection key="adminAndSettings" label={dictionary['navigation'].adminAndSettings}>
          {adminSettingsChildren}
        </MenuSection>
      )
    }

    if (rateLimitChildren.length > 0) {
      menuItems.push(
        <MenuSection key="rateLimitCategory" label={dictionary['navigation'].rateLimitCategory}>
          {rateLimitChildren}
        </MenuSection>
      )
    }

    menuItems.push(
      <MenuSection key="appsPages" label={dictionary['navigation'].appsPages}>
        {appsPagesChildren}
      </MenuSection>
    )

    // Forms & Tables section
    const formsTablesChildren = []
    formsTablesChildren.push(
      <MenuItem key="formLayouts" href={`/${locale}/forms/form-layouts`} icon={<i className='ri-layout-4-line' />}>
        {dictionary['navigation'].formLayouts}
      </MenuItem>
    )
    formsTablesChildren.push(
      <MenuItem key="formValidation" href={`/${locale}/forms/form-validation`} icon={<i className='ri-checkbox-multiple-line' />}>
        {dictionary['navigation'].formValidation}
      </MenuItem>
    )
    formsTablesChildren.push(
      <MenuItem key="formWizard" href={`/${locale}/forms/form-wizard`} icon={<i className='ri-git-commit-line' />}>
        {dictionary['navigation'].formWizard}
      </MenuItem>
    )
    formsTablesChildren.push(
      <MenuItem key="reactTable" href={`/${locale}/react-table`} icon={<i className='ri-table-alt-line' />}>
        {dictionary['navigation'].reactTable}
      </MenuItem>
    )

    menuItems.push(
      <MenuSection key="formsTables" label={dictionary['navigation'].formsAndTables}>
        {formsTablesChildren}
      </MenuSection>
    )

    // Widget Examples section
    const widgetExamplesChildren = []
    widgetExamplesChildren.push(
      <MenuItem key="basicWidgets" href={`/${locale}/pages/widget-examples/basic`}>
        {dictionary['navigation'].basic}
      </MenuItem>
    )
    widgetExamplesChildren.push(
      <MenuItem key="advancedWidgets" href={`/${locale}/pages/widget-examples/advanced`}>
        {dictionary['navigation'].advanced}
      </MenuItem>
    )
    widgetExamplesChildren.push(
      <MenuItem key="statisticsWidgets" href={`/${locale}/pages/widget-examples/statistics`}>
        {dictionary['navigation'].statistics}
      </MenuItem>
    )
    widgetExamplesChildren.push(
      <MenuItem key="chartsWidgets" href={`/${locale}/pages/widget-examples/charts`}>
        {dictionary['navigation'].charts}
      </MenuItem>
    )
    widgetExamplesChildren.push(
      <MenuItem key="gamificationWidgets" href={`/${locale}/pages/widget-examples/gamification`}>
        {dictionary['navigation'].gamification}
      </MenuItem>
    )
    widgetExamplesChildren.push(
      <MenuItem key="actionsWidgets" href={`/${locale}/pages/widget-examples/actions`}>
        {dictionary['navigation'].actions}
      </MenuItem>
    )

    menuItems.push(
      <MenuSection key="widgetExamples" label={dictionary['navigation'].widgetExamples}>
        {widgetExamplesChildren}
      </MenuSection>
    )

    return menuItems
  }

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
        {getFilteredMenuJSX()}
      </Menu>
    </ScrollWrapper>
  )
}

export default VerticalMenu

// Next Imports
import { useParams } from 'next/navigation'

// MUI Imports
import { useTheme } from '@mui/material/styles'
import Chip from '@mui/material/Chip'

// Type Imports
import type { getDictionary } from '@/utils/formatting/getDictionary'
import type { VerticalMenuContextProps } from '@menu/components/vertical-menu/Menu'

// Component Imports
import HorizontalNav, { Menu, SubMenu, MenuItem } from '@menu/horizontal-menu'
import VerticalNavContent from './VerticalNavContent'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'
import { useSettings } from '@core/hooks/useSettings'

// Styled Component Imports
import StyledHorizontalNavExpandIcon from '@menu/styles/horizontal/StyledHorizontalNavExpandIcon'
import StyledVerticalNavExpandIcon from '@menu/styles/vertical/StyledVerticalNavExpandIcon'

// Style Imports
import menuRootStyles from '@core/styles/horizontal/menuRootStyles'
import menuItemStyles from '@core/styles/horizontal/menuItemStyles'
import verticalNavigationCustomStyles from '@core/styles/vertical/navigationCustomStyles'
import verticalMenuItemStyles from '@core/styles/vertical/menuItemStyles'
import verticalMenuSectionStyles from '@core/styles/vertical/menuSectionStyles'

type RenderExpandIconProps = {
  level?: number
}

type RenderVerticalExpandIconProps = {
  open?: boolean
  transitionDuration?: VerticalMenuContextProps['transitionDuration']
}

const RenderExpandIcon = ({ level }: RenderExpandIconProps) => (
  <StyledHorizontalNavExpandIcon level={level}>
    <i className='ri-arrow-right-s-line' />
  </StyledHorizontalNavExpandIcon>
)

const RenderVerticalExpandIcon = ({ open, transitionDuration }: RenderVerticalExpandIconProps) => (
  <StyledVerticalNavExpandIcon open={open} transitionDuration={transitionDuration}>
    <i className='ri-arrow-right-s-line' />
  </StyledVerticalNavExpandIcon>
)

const HorizontalMenu = ({ dictionary }: { dictionary: Awaited<ReturnType<typeof getDictionary>> }) => {
  // Hooks
  const verticalNavOptions = useVerticalNav()
  const theme = useTheme()
  const { settings } = useSettings()
  const params = useParams()

  // Vars
  const { skin } = settings
  const { transitionDuration } = verticalNavOptions
  const { lang: locale } = params

  return (
    <HorizontalNav
      switchToVertical
      verticalNavContent={VerticalNavContent}
      verticalNavProps={{
        customStyles: verticalNavigationCustomStyles(verticalNavOptions, theme),
        backgroundColor:
          skin === 'bordered' ? 'var(--mui-palette-background-paper)' : 'var(--mui-palette-background-default)'
      }}
    >
      <Menu
        rootStyles={menuRootStyles(theme)}
        renderExpandIcon={({ level }) => <RenderExpandIcon level={level} />}
        renderExpandedMenuItemIcon={{ icon: <i className='ri-circle-line' /> }}
        menuItemStyles={menuItemStyles(theme, 'ri-circle-line')}
        popoutMenuOffset={{
          mainAxis: ({ level }) => (level && level > 0 ? 4 : 16),
          alignmentAxis: 0
        }}
        verticalMenuProps={{
          menuItemStyles: verticalMenuItemStyles(verticalNavOptions, theme),
          renderExpandIcon: ({ open }) => (
            <RenderVerticalExpandIcon open={open} transitionDuration={transitionDuration} />
          ),
          renderExpandedMenuItemIcon: { icon: <i className='ri-circle-line' /> },
          menuSectionStyles: verticalMenuSectionStyles(verticalNavOptions, theme)
        }}
      >
        <SubMenu label={dictionary['navigation'].dashboards} icon={<i className='ri-home-smile-line' />}>
          <MenuItem href={`/${locale}/dashboards/crm`} icon={<i className='ri-pie-chart-2-line' />}>
            {dictionary['navigation'].crm}
          </MenuItem>
          <MenuItem href={`/${locale}/dashboards/analytics`} icon={<i className='ri-bar-chart-line' />}>
            {dictionary['navigation'].analytics}
          </MenuItem>
          <MenuItem href={`/${locale}/dashboards/ecommerce`} icon={<i className='ri-shopping-bag-3-line' />}>
            {dictionary['navigation'].eCommerce}
          </MenuItem>
          <MenuItem href={`/${locale}/dashboards/academy`} icon={<i className='ri-graduation-cap-line' />}>
            {dictionary['navigation'].academy}
          </MenuItem>
          <MenuItem href={`/${locale}/dashboards/logistics`} icon={<i className='ri-car-line' />}>
            {dictionary['navigation'].logistics}
          </MenuItem>
        </SubMenu>

        <SubMenu label={dictionary['navigation'].communications} icon={<i className='ri-customer-service-2-line' />}>
          <MenuItem href={`/${locale}/apps/chat`} icon={<i className='ri-wechat-line' />}>
            {dictionary['navigation'].chat}
          </MenuItem>
          <MenuItem href={`/${locale}/apps/notifications`} icon={<i className='ri-notification-2-line' />}>
            {dictionary['navigation'].notifications}
          </MenuItem>
        </SubMenu>
<SubMenu label={dictionary['navigation'].adminAndSettings} icon={<i className='ri-settings-5-line' />}>
          <SubMenu label={dictionary['navigation'].userSettings} icon={<i className='ri-user-settings-line' />}>
            <MenuItem href={`/${locale}/apps/user/list`}>{dictionary['navigation'].userList}</MenuItem>
            <MenuItem href={`/${locale}/apps/user/view`}>{dictionary['navigation'].view}</MenuItem>
            <MenuItem href={`/${locale}/apps/roles`}>{dictionary['navigation'].roles}</MenuItem>
            <MenuItem href={`/${locale}/apps/permissions`}>{dictionary['navigation'].permissions}</MenuItem>
          </SubMenu>
          <SubMenu label={dictionary['navigation'].references} icon={<i className='ri-database-2-line' />}>
            <MenuItem href={`/${locale}/apps/references/languages`} icon={<i className='ri-translate-2' />}>
              {dictionary['navigation'].languages}
            </MenuItem>
            <SubMenu label={dictionary['navigation'].countriesAndStates} icon={<i className='ri-flag-line' />}>
              <MenuItem href={`/${locale}/apps/references/countries`}>
                {dictionary['navigation'].countries}
              </MenuItem>
              <MenuItem href={`/${locale}/apps/references/states`} icon={<i className='ri-map-pin-2-line' />}>
                {dictionary['navigation'].states}
              </MenuItem>
              <MenuItem href={`/${locale}/apps/references/cities`} icon={<i className='ri-map-pin-4-line' />}>
                {dictionary['navigation'].cities}
              </MenuItem>
              <MenuItem href={`/${locale}/apps/references/districts`} icon={<i className='ri-map-pin-5-line' />}>
                {dictionary['navigation'].districts}
              </MenuItem>
            </SubMenu>
            <MenuItem href={`/${locale}/apps/references/currencies`} icon={<i className='ri-money-dollar-circle-line' />}>
              {dictionary['navigation'].currencies}
            </MenuItem>
            <MenuItem href={`/${locale}/apps/references/translations`} icon={<i className='ri-global-line' />}>
              {dictionary['navigation'].translations}
            </MenuItem>
          </SubMenu>
          <MenuItem href={`/${locale}/apps/settings/smtp`} icon={<i className='ri-mail-settings-line' />}>
            {dictionary['navigation'].smtpSettings}
          </MenuItem>
          <MenuItem href={`/${locale}/apps/settings/email-templates`} icon={<i className='ri-file-text-line' />}>
            {dictionary['navigation'].emailTemplates}
          </MenuItem>
        </SubMenu>
<SubMenu label={dictionary['navigation'].monitoring} icon={<i className='ri-bar-chart-line' />}>
          <MenuItem href={`/${locale}/admin/monitoring/overview`} icon={<i className='ri-eye-line' />}>
            {dictionary['navigation'].monitoringOverview}
          </MenuItem>
          <MenuItem href={`/${locale}/admin/monitoring/metrics`} icon={<i className='ri-bar-chart-2-line' />}>
            {dictionary['navigation'].monitoringMetrics}
          </MenuItem>
          <MenuItem href={`/${locale}/admin/monitoring/error-tracking`} icon={<i className='ri-error-warning-line' />}>
            {dictionary['navigation'].monitoringErrorTracking}
          </MenuItem>
          <MenuItem
            href={`/${locale}/admin/monitoring/application-insights`}
            icon={<i className='ri-lightbulb-line' />}
          >
            {dictionary['navigation'].monitoringApplicationInsights}
          </MenuItem>
          <MenuItem href={`/${locale}/admin/monitoring/testing`} icon={<i className='ri-test-tube-line' />}>
            {dictionary['navigation'].monitoringTesting || dictionary['navigation'].testingConnection || 'Testing'}
          </MenuItem>
          <MenuItem href={`/${locale}/admin/maintenance`} icon={<i className='ri-tools-line' />}>
            {(dictionary['navigation'] as any)?.cron || dictionary['navigation'].maintenance || 'Cron'}
          </MenuItem>
        </SubMenu>
<SubMenu label={dictionary['navigation'].blocking} icon={<i className='ri-shield-check-line' />}>
          <MenuItem href={`/${locale}/admin/rate-limits`} icon={<i className='ri-timer-flash-line' />}>
            {dictionary['navigation'].rateLimitManagement}
          </MenuItem>
          <MenuItem href={`/${locale}/admin/rate-limits/events`} icon={<i className='ri-line-chart-line' />}>
            {dictionary['navigation'].rateLimitEvents}
          </MenuItem>
          <MenuItem href={`/${locale}/admin/blocks`} icon={<i className='ri-shield-check-line' />}>
            {dictionary['navigation'].blocking}
          </MenuItem>
          <MenuItem href={`/${locale}/admin/events`} icon={<i className='ri-history-line' />}>
            {dictionary['navigation'].eventsJournal}
          </MenuItem>
        </SubMenu>
<SubMenu label={dictionary['navigation'].apps} icon={<i className='ri-mail-open-line' />}>
          <SubMenu label={dictionary['navigation'].eCommerce} icon={<i className='ri-shopping-bag-3-line' />}>
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
          <SubMenu label={dictionary['navigation'].academy} icon={<i className='ri-graduation-cap-line' />}>
            <MenuItem href={`/${locale}/apps/academy/dashboard`}>{dictionary['navigation'].dashboard}</MenuItem>
            <MenuItem href={`/${locale}/apps/academy/my-courses`}>{dictionary['navigation'].myCourses}</MenuItem>
            <MenuItem href={`/${locale}/apps/academy/course-details`}>
              {dictionary['navigation'].courseDetails}
            </MenuItem>
          </SubMenu>
          <SubMenu label={dictionary['navigation'].logistics} icon={<i className='ri-car-line' />}>
            <MenuItem href={`/${locale}/apps/logistics/dashboard`}>{dictionary['navigation'].dashboard}</MenuItem>
            <MenuItem href={`/${locale}/apps/logistics/fleet`}>{dictionary['navigation'].fleet}</MenuItem>
          </SubMenu>
          <MenuItem
            href={`/${locale}/apps/email`}
            exactMatch={false}
            activeUrl='/apps/email'
            icon={<i className='ri-mail-open-line' />}
          >
            {dictionary['navigation'].email}
          </MenuItem>
          <MenuItem href={`/${locale}/apps/chat`} icon={<i className='ri-wechat-line' />}>
            {dictionary['navigation'].chat}
          </MenuItem>
          <MenuItem href={`/${locale}/apps/calendar`} icon={<i className='ri-calendar-line' />}>
            {dictionary['navigation'].calendar}
          </MenuItem>
          <MenuItem href={`/${locale}/apps/kanban`} icon={<i className='ri-drag-drop-line' />}>
            {dictionary['navigation'].kanban}
          </MenuItem>
          <SubMenu label={dictionary['navigation'].invoice} icon={<i className='ri-file-list-2-line' />}>
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
          <SubMenu label={dictionary['navigation'].user} icon={<i className='ri-user-line' />}>
            <MenuItem href={`/${locale}/apps/user/list`}>{dictionary['navigation'].list}</MenuItem>
            <MenuItem href={`/${locale}/apps/user/view`}>{dictionary['navigation'].view}</MenuItem>
          </SubMenu>
          <SubMenu label={dictionary['navigation'].rolesPermissions} icon={<i className='ri-lock-line' />}>
            <MenuItem href={`/${locale}/apps/roles`}>{dictionary['navigation'].roles}</MenuItem>
            <MenuItem href={`/${locale}/apps/permissions`}>{dictionary['navigation'].permissions}</MenuItem>
          </SubMenu>
        </SubMenu>
<SubMenu label={dictionary['navigation'].formsAndTables} icon={<i className='ri-pages-line' />}>
          <MenuItem href={`/${locale}/forms/form-layouts`} icon={<i className='ri-layout-4-line' />}>
            {dictionary['navigation'].formLayouts}
          </MenuItem>
          <MenuItem href={`/${locale}/forms/form-validation`} icon={<i className='ri-checkbox-multiple-line' />}>
            {dictionary['navigation'].formValidation}
          </MenuItem>
          <MenuItem href={`/${locale}/forms/form-wizard`} icon={<i className='ri-git-commit-line' />}>
            {dictionary['navigation'].formWizard}
          </MenuItem>
          <MenuItem href={`/${locale}/react-table`} icon={<i className='ri-table-alt-line' />}>
            {dictionary['navigation'].reactTable}
          </MenuItem>
          <MenuItem
            href={`${process.env.NEXT_PUBLIC_DOCS_URL}/docs/user-interface/form-elements`}
            icon={<i className='ri-radio-button-line' />}
            suffix={<i className='ri-external-link-line text-xl' />}
            target='_blank'
          >
            {dictionary['navigation'].formELements}
          </MenuItem>
          <MenuItem
            href={`${process.env.NEXT_PUBLIC_DOCS_URL}/docs/user-interface/mui-table`}
            icon={<i className='ri-table-2' />}
            suffix={<i className='ri-external-link-line text-xl' />}
            target='_blank'
          >
            {dictionary['navigation'].muiTables}
          </MenuItem>
        </SubMenu>
<SubMenu label={dictionary['navigation'].charts} icon={<i className='ri-bar-chart-2-line' />}>
          <MenuItem href={`/${locale}/charts/apex-charts`} icon={<i className='ri-line-chart-line' />}>
            {dictionary['navigation'].apex}
          </MenuItem>
          <MenuItem href={`/${locale}/charts/recharts`} icon={<i className='ri-bar-chart-line' />}>
            {dictionary['navigation'].recharts}
          </MenuItem>
        </SubMenu>

        <SubMenu label={dictionary['navigation'].others} icon={<i className='ri-more-line' />}>
          <MenuItem
            href={`${process.env.NEXT_PUBLIC_DOCS_URL}/docs/user-interface/foundation`}
            icon={<i className='ri-pantone-line' />}
            suffix={<i className='ri-external-link-line text-xl' />}
            target='_blank'
          >
            {dictionary['navigation'].foundation}
          </MenuItem>
          <MenuItem
            href={`${process.env.NEXT_PUBLIC_DOCS_URL}/docs/user-interface/components`}
            icon={<i className='ri-toggle-line' />}
            suffix={<i className='ri-external-link-line text-xl' />}
            target='_blank'
          >
            {dictionary['navigation'].components}
          </MenuItem>
          <MenuItem
            href={`${process.env.NEXT_PUBLIC_DOCS_URL}/docs/menu-examples/overview`}
            icon={<i className='ri-menu-search-line' />}
            suffix={<i className='ri-external-link-line text-xl' />}
            target='_blank'
          >
            {dictionary['navigation'].menuExamples}
          </MenuItem>
          <MenuItem
            href='https://themeselection.com/support'
            icon={<i className='ri-lifebuoy-line' />}
            suffix={<i className='ri-external-link-line text-xl' />}
            target='_blank'
          >
            {dictionary['navigation'].raiseSupport}
          </MenuItem>
          <MenuItem
            href={`${process.env.NEXT_PUBLIC_DOCS_URL}`}
            icon={<i className='ri-book-line' />}
            suffix={<i className='ri-external-link-line text-xl' />}
            target='_blank'
          >
            {dictionary['navigation'].documentation}
          </MenuItem>
        <MenuItem suffix={<Chip label='New' size='small' color='info' />} icon={<i className='ri-notification-badge-line' />}>
          {dictionary['navigation'].itemWithBadge}
        </MenuItem>
          <MenuItem
            href='https://themeselection.com'
            icon={<i className='ri-link' />}
            suffix={<i className='ri-external-link-line text-xl' />}
            target='_blank'
          >
            {dictionary['navigation'].externalLink}
          </MenuItem>
          <SubMenu label={dictionary['navigation'].menuLevels} icon={<i className='ri-menu-2-line' />}>
            <MenuItem suffix={<Chip label='New' size='small' color='info' />}>
              {dictionary['navigation'].menuLevel2}
            </MenuItem>
            <SubMenu label={dictionary['navigation'].menuLevel2}>
              <MenuItem>{dictionary['navigation'].menuLevel3}</MenuItem>
              <MenuItem>{dictionary['navigation'].menuLevel3}</MenuItem>
            </SubMenu>
          </SubMenu>
          <MenuItem disabled icon={<i className='ri-indeterminate-circle-line' />}>
            {dictionary['navigation'].disabledMenu}
          </MenuItem>
        </SubMenu>
      </Menu>
    </HorizontalNav>
  )
}

export default HorizontalMenu

# Navigation & Layout

## Layout Types

Our application supports three primary layout types to cater to diverse UI needs:

- **Vertical Layout** (default)
- **Horizontal Layout**
- **Blank Layout**

Each layout type is designed with flexibility and customization in mind.

**Note:** Before diving into layout types, we highly recommend reviewing the [Next.js Layout Docs](https://nextjs.org/docs/app/building-your-application/routing/layouts-and-templates) for foundational understanding.

### Vertical Layout

The Vertical Layout serves as the default configuration with these key components:

- **Navigation Menu**: Positioned on the left side for easy access
- **Navbar**: Located at the top with actions
- **Content**: Main section for page content
- **Footer**: Bottom section with auxiliary information

For detailed component information, see [Vertical Layout Components](#vertical-layout-components).

### Horizontal Layout

Opt for the Horizontal Layout for a different feel:

- **Navbar**: At the very top
- **Navigation Menu**: Below the navbar, spanning horizontally
- **Content**: Main section for page content
- **Footer**: At the bottom

For detailed component information, see [Horizontal Layout Components](#horizontal-layout-components).

### Blank Layout

The Blank Layout is a clean slate for pages where standard layout is unnecessary (login, registration). It offers no predefined components, giving complete creative control.

## Vertical Layout Components

### Navigation Menu (left sidebar)

The Navigation Menu organizes access with:

- **Navigation Header**: Brand logo/name with sidebar toggle icons
- **Navigation Section (MenuSection)**: Groups navigation items
- **Navigation Group (SubMenu)**: Items or subgroups in hierarchical structure
- **Navigation Item (MenuItem)**: Links to specific pages

#### Navigation Component

Located at `src/components/layout/vertical/Navigation.tsx`.

**Props:**
- `dictionary`: Localization object (with i18n)
- `settingsCookie`: Settings stored in cookie
- `mode`: system/light/dark
- `systemMode`: light/dark
- `skin`: default/bordered

#### NavHeader Component

Styled wrapper of logo and toggle icons at `src/@menu/components/vertical-menu/NavHeader.tsx`.

#### Logo Component

Renders company logo/text at `src/components/layout/shared/Logo.tsx`.

#### NavCollapseIcons Component

Toggle icons at `src/@menu/components/vertical-menu/NavCollapseIcons.tsx`.

#### VerticalMenu Component

Renders menu items at `src/components/layout/vertical/VerticalMenu.tsx`.

**Props:**
- `dictionary`: Localization object (with i18n)
- `scrollMenu`: Function for scrollable menu detection

### Navbar

Spans the top with quick access functions:

- **Left Side**: Menu toggler, search
- **Right Side**: Language switcher, user actions

#### Navbar Component

Wrapper at `src/@layouts/components/vertical/Navbar.tsx`.

**Props:**
- `children`: Child components
- `overrideStyles`: Custom styles

#### Content Update

Modify `src/components/layout/vertical/NavbarContent.tsx`.

#### Styling Update

```typescript
import LayoutNavbar from '@layouts/components/vertical/Navbar'

const Navbar = () => {
  return (
    <LayoutNavbar overrideStyles={{ '& .ts-vertical-layout-navbar': { backgroundColor: 'lightcyan !important' } }}>
      {/* content */}
    </LayoutNavbar>
  )
}
```

### Content

Primary area displaying page content.

#### LayoutContent Component

Wrapper at `src/@layouts/components/vertical/LayoutContent.tsx`.

### Footer

Bottom section with copyright and links.

#### Footer Component

Wrapper at `src/@layouts/components/vertical/Footer.tsx`.

**Props:**
- `children`: Child components
- `overrideStyles`: Custom styles

#### Content Update

Modify `src/components/layout/vertical/FooterContent.tsx`.

#### Styling Update

```typescript
import LayoutFooter from '@layouts/components/vertical/Footer'

const Footer = () => {
  return (
    <LayoutFooter overrideStyles={{ '& .ts-vertical-layout-footer-content-wrapper': { backgroundColor: 'lightcyan' } }}>
      {/* content */}
    </LayoutFooter>
  )
}
```

## Horizontal Layout Components

### Header

Topmost section containing Navbar and Navigation menu.

#### Header Component

Wrapper at `src/@layouts/components/horizontal/Header.tsx`.

**Props:**
- `children`: Child components
- `overrideStyles`: Custom styles

#### Content Update

Modify `src/components/layout/horizontal/Header.tsx`.

#### Styling Update

```typescript
import LayoutHeader from '@layouts/components/horizontal/Header'

const Header = () => {
  return (
    <LayoutHeader overrideStyles={{ backgroundColor: 'lightcyan !important' }}>
      {/* content */}
    </LayoutHeader>
  )
}
```

### Navbar

Top functions:

- **Left Side**: Menu toggler, company logo/name
- **Right Side**: Search, language switcher, user actions

#### Navbar Component

Wrapper at `src/@layouts/components/horizontal/Navbar.tsx`.

#### Content Update

Modify `src/components/layout/horizontal/NavbarContent.tsx`.

### Navigation Menu

Horizontal navigation with groups and items.

#### Navigation Component

Wrapper at `src/components/layout/horizontal/Navigation.tsx`.

**Props:**
- `dictionary`: Localization object (with i18n)

#### HorizontalMenu Component

Renders items at `src/components/layout/horizontal/HorizontalMenu.tsx`.

**Props:**
- `dictionary`: Localization object (with i18n)

#### VerticalNavContent Component

Vertical menu for mobile/tablet at `src/components/layout/horizontal/VerticalNavContent.tsx`.

### Content

Primary content area.

#### LayoutContent Component

Wrapper at `src/@layouts/components/horizontal/LayoutContent.tsx`.

### Footer

Bottom section.

#### Footer Component

Wrapper at `src/@layouts/components/horizontal/Footer.tsx`.

**Props:**
- `children`: Child components
- `overrideStyles`: Custom styles

#### Content Update

Modify `src/components/layout/horizontal/FooterContent.tsx`.

#### Styling Update

```typescript
import LayoutFooter from '@layouts/components/horizontal/Footer'

const Footer = () => {
  return (
    <LayoutFooter
      overrideStyles={{ '& .ts-horizontal-layout-footer-content-wrapper': { backgroundColor: 'lightcyan' } }}
    >
      {/* content */}
    </LayoutFooter>
  )
}
```

## Layout Classes

Comprehensive classes for vertical, horizontal, and blank layouts at `src/@layouts/utils/layoutClasses.ts`.

### Vertical Layout Classes

| Variable Name | Class Name |
|---------------|------------|
| root | ts-vertical-layout |
| contentWrapper | ts-vertical-layout-content-wrapper |
| header | ts-vertical-layout-header |
| navbar | ts-vertical-layout-navbar |
| content | ts-vertical-layout-content |
| footer | ts-vertical-layout-footer |

### Horizontal Layout Classes

| Variable Name | Class Name |
|---------------|------------|
| root | ts-horizontal-layout |
| header | ts-horizontal-layout-header |
| navbar | ts-horizontal-layout-navbar |
| navigation | ts-horizontal-layout-navigation |
| content | ts-horizontal-layout-content |
| footer | ts-horizontal-layout-footer |

### Blank Layout Classes

| Variable Name | Class Name |
|---------------|------------|
| root | ts-blank-layout |

### Creating Custom Classes

Create `src/utils/userLayoutClasses.ts`:

```typescript
export const verticalLayoutClasses = {
  customClass: 'custom-layout-class'
}
```

**Usage:**

```typescript
import { verticalLayoutClasses } from 'src/utils/userLayoutClasses'

<SomeComponent className={verticalLayoutClasses.customClass}>
  {/* content */}
</SomeComponent>
```

## Menu Styling

### Vertical Layout Menu Styling

#### Root Styles

Navigation menu styles (excluding items) at `src/@core/styles/vertical/navigationCustomStyles.ts`.

#### Menu Item Styles

Item/submenu styles at `src/@core/styles/vertical/menuItemStyles.ts`.

#### Menu Section Styles

Section styles at `src/@core/styles/vertical/menuSectionStyles.ts`.

### Horizontal Layout Menu Styling

#### Navigation Content Wrapper Styles

Styled component in `src/components/layout/horizontal/Navigation.tsx`.

#### Menu Root Styles

At `src/@core/styles/horizontal/menuRootStyles.ts`.

#### Menu Item Styles

At `src/@core/styles/horizontal/menuItemStyles.ts`.

### Adapting Navigation for Small Screens

Horizontal menu becomes vertical on smaller screens using `switchToVertical` prop.

### Customizing Menu Styling

```typescript
import menuItemStyles from '@core/styles/vertical/menuItemStyles'

const userMenuItemStyles = (/* parameters */) => ({
  // custom styles
})

<Menu
  menuItemStyles={{
    ...menuItemStyles(/* parameters */),
    ...userMenuItemStyles(/* parameters */)
  }}
/>
```

## Menu Classes

Classes at `src/@menu/utils/menuClasses.ts`.

### Common Classes

| Variable Name | Class Name |
|---------------|------------|
| root | ts-menu-root |
| menuItemRoot | ts-menuitem-root |
| subMenuRoot | ts-submenu-root |

### Vertical Menu Classes

| Variable Name | Class Name |
|---------------|------------|
| root | ts-vertical-nav-root |
| collapsed | ts-collapsed |
| toggled | ts-toggled |

### Horizontal Menu Classes

| Variable Name | Class Name |
|---------------|------------|
| root | ts-horizontal-nav-root |

### Creating Custom Classes

Create `src/utils/userMenuClasses.ts`:

```typescript
export const verticalNavClasses = {
  customClass: 'custom-menu-class'
}
```

**Usage:**

```typescript
import { verticalNavClasses } from 'src/utils/userMenuClasses'

<Menu className={verticalNavClasses.customClass}>
  {/* content */}
</Menu>
```

## Before/After Menu Content

### Scrollable Before Content

```typescript
const BeforeMenuContent = () => {
  return <div>User Details</div>
}

const Navigation = () => {
  return (
    <VerticalNav>
      <PerfectScrollbar options={{ wheelPropagation: false }}>
        <BeforeMenuContent />
        <Menu>
          {/* menu items */}
        </Menu>
      </PerfectScrollbar>
    </VerticalNav>
  )
}
```

### Scrollable After Content

```typescript
const AfterMenuContent = () => {
  return (
    <div>
      <progress id="file" max="100" value="70">70%</progress>
      <div>Log Out</div>
    </div>
  )
}

const Navigation = () => {
  return (
    <VerticalNav>
      <PerfectScrollbar options={{ wheelPropagation: false }}>
        <Menu>
          {/* menu items */}
        </Menu>
        <AfterMenuContent />
      </PerfectScrollbar>
    </VerticalNav>
  )
}
```

### Fixed Before & After Content

```typescript
const Navigation = () => {
  return (
    <VerticalNav>
      <BeforeMenuContent />
      <PerfectScrollbar options={{ wheelPropagation: false }}>
        <Menu>
          {/* menu items */}
        </Menu>
      </PerfectScrollbar>
      <AfterMenuContent />
    </VerticalNav>
  )
}
```

## Icons

### Overview

Template uses Remix Icons from Iconify. Visit [Iconify](https://iconify.design/) for available icons.

**Warning:** Using offline icons via Iconify bundle is recommended. For few icons from other libraries, use online API.

### Iconify Bundle

Generates offline icon bundle at `src/assets/iconify-icons/bundle-icons-css.ts`.

#### Generate Bundle

**All icons from library:**

```typescript
const sources: BundleScriptConfig = {
  json: [
    require.resolve('@iconify/json/json/ri.json'), // Remix Icons
    require.resolve('@iconify/json/json/bi.json')  // Bootstrap Icons
  ]
}
```

**Some icons from library:**

```typescript
const sources: BundleScriptConfig = {
  json: [
    {
      filename: require.resolve('@iconify/json/json/ri.json'),
      icons: ['home-twotone-alt', 'github', 'document-list']
    }
  ]
}
```

**Icons from different libraries:**

```typescript
const sources: BundleScriptConfig = {
  icons: [
    'bx:basket',        // BoxIcons
    'bi:airplane-engines', // Bootstrap Icons
    'tabler:anchor',    // Tabler Icons
    'fa6-regular:comment' // Font Awesome
  ]
}
```

#### Target & Import

Set target path and import generated CSS:

```typescript
const target = join(__dirname, 'generated-icons.css')
// Import: import '@assets/iconify-icons/generated-icons.css'
```

#### Run Command

```bash
pnpm build:icons
```

### Usage

```typescript
const Component = () => {
  return <i className='ri-home' />
}
```

### Style Icons

**With MUI:**

```typescript
import Box from '@mui/material/Box'

const Component = () => {
  return (
    <Box sx={{ display: 'flex', color: theme => theme.palette.primary.main }}>
      <i className='ri-home' />
    </Box>
  )
}
```

**With Tailwind:**

```typescript
const Component = () => {
  return <i className='ri-home text-red-500 text-xl' />
}
```

### React Icons

**Installation:**

```bash
pnpm install react-icons --save
```

**Usage:**

```typescript
import { FaBeer } from 'react-icons/fa'

const MyComponent = () => {
  return (
    <div>
      <h1>Let's have a <FaBeer />!</h1>
    </div>
  )
}
```

**Customization:**

```typescript
import { FaHeart } from 'react-icons/fa'

const MyComponent = () => {
  return (
    <FaHeart color="red" size="2em" />
  )
}
```

## Customizer

### Overview

Customizer allows users to change app appearance: colors, light/dark mode, layout style, text direction.

### Using Customizer in Starter Kit

For starter-kit, add `disableDirection` prop unless you have RTL languages with i18n.

### Usage

Import and use:

```typescript
import Customizer from '@core/components/customizer'

<Customizer />
```

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| breakpoint | xs, sm, md, lg, xl, xxl, px, rem, em | lg | Display breakpoint |
| dir | ltr or rtl | ltr | Customizer direction |
| disableDirection | boolean | false | Remove direction section |

### Override Customizer

To change direction based on language (e.g., Portuguese LTR, Hebrew RTL):

```typescript
// src/components/customizer/index.tsx
<div className='flex items-center gap-4'>
  <Link href={getLocalePath(pathName, 'pt')}>Portuguese</Link>
  <Link href={getLocalePath(pathName, 'he')}>Hebrew</Link>
</div>
```

Ensure languages are configured in `src/configs/i18n.ts`, `src/utils/getDictionary.ts`, and `src/data/dictionaries/`.

## Theme Configurations

### Overview

Configure your template using `src/configs/themeConfig.ts`. This file contains various template configurations with their valid values.

**Note:** For demo configurations, see the [demo configs documentation](https://demos.themeselection.com/materio-mui-nextjs-admin-template/documentation/docs/guide/demo-configs).

**Warning:** Keep `contentWidth` property equal for navbar, page content, and footer to ensure consistent layout.

**Important:** Clear browser local storage to see configuration changes. Instructions [here](https://www.google.com/search?q=how+to+clear+browser+local+storage).

### Properties

```typescript
const themeConfig: Config = {
  templateName: 'Materio',
  homePageUrl: '/dashboards/crm',
  settingsCookieName: 'materio-mui-next-demo-1',
  mode: 'system',
  skin: 'default',
  semiDark: false,
  layout: 'vertical',
  layoutPadding: 24,
  compactContentWidth: 1440,
  navbar: {
    type: 'fixed',
    contentWidth: 'compact',
    floating: false,
    detached: true,
    blur: true
  },
  contentWidth: 'compact',
  footer: {
    type: 'static',
    contentWidth: 'compact',
    detached: true
  },
  disableRipple: false,
  toastPosition: 'top-right'
}
```

### Property Options

| Property | Values | Description |
|----------|--------|-------------|
| `templateName` | string | Name of template, project, or company |
| `homePageUrl` | string | Home page URL |
| `settingsCookieName` | string | Cookie name for storing settings |
| `mode` | system, light, dark | Color mode |
| `skin` | default, bordered | Template skin |
| `semiDark` | true, false | Semi-dark mode |
| `layout` | vertical, horizontal, collapsed | Layout type |
| `layoutPadding` | number | Layout padding in px |
| `compactContentWidth` | number | Content area width |
| `navbar.type` | fixed, static | Navbar position |
| `navbar.contentWidth` | compact, wide | Navbar width |
| `navbar.floating` | true, false | Floating navbar |
| `navbar.detached` | true, false | Detached navbar |
| `navbar.blur` | true, false | Blur effect on navbar |
| `contentWidth` | compact, wide | Content area width |
| `footer.type` | fixed, static | Footer type |
| `footer.contentWidth` | compact, wide | Footer width |
| `footer.detached` | true, false | Detached footer |
| `disableRipple` | true, false | Ripple effect |
| `toastPosition` | top-right, top-center, top-left, bottom-right, bottom-center, bottom-left | Toast message position |

Customize these properties according to your project requirements.

## Settings Context

### Overview

Settings Context is created to make the template independent of Redux store for storing template variables.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `settings` | Settings | Stores the settings |
| `updateSettings` | (settings: Partial<Settings>, options?: UpdateSettingsOptions) => void | Function to update settings |
| `isSettingsChanged` | boolean | Indicates if settings have been modified |
| `resetSettings` | () => void | Resets settings to default values |
| `updatePageSettings` | (settings: Partial<Settings>) => () => void | Updates settings for a specific page |

### Settings

| Property | Values | Description |
|----------|--------|-------------|
| `mode` | system, light, dark | Color theme (system aligns with device) |
| `skin` | default, bordered | Template style (bordered adds borders) |
| `semiDark` | true, false | Semi-dark theme toggle |
| `layout` | vertical, horizontal, collapsed | Layout arrangement |
| `navbarContentWidth` | compact, wide | Navbar width |
| `contentWidth` | compact, wide | Main content width |
| `footerContentWidth` | compact, wide | Footer width |
| `primaryColor` | string | Main color theme |

Settings values are also saved in cookies.

## useVerticalNav Hook

### Overview

The `useVerticalNav()` hook handles navigation sidebar functionality and state management, providing variables to customize sidebar behavior.

### Values

| Value | Type | Description |
|-------|------|-------------|
| `width` | number | Navigation sidebar width |
| `collapsedWidth` | number | Width when collapsed |
| `isCollapsed` | boolean | Whether sidebar is collapsed |
| `isHovered` | boolean | Whether sidebar is hovered when collapsed |
| `isToggled` | boolean | Whether sidebar is toggled |
| `isScrollWithContent` | boolean | Whether sidebar scrolls with content |
| `isPopoutWhenCollapsed` | boolean | Whether sidebar pops out when collapsed |
| `isBreakpointReached` | boolean | Whether breakpoint has been reached |
| `transitionDuration` | number | Transition duration in ms |
| `updateVerticalNavState` | (values: VerticalNavState) => void | Update sidebar state |
| `collapseVerticalNav` | (value?: VerticalNavState['isCollapsed']) => void | Collapse sidebar |
| `hoverVerticalNav` | (value?: VerticalNavState['isHovered']) => void | Apply hover effect |
| `toggleVerticalNav` | (value?: VerticalNavState['isToggled']) => void | Toggle visibility |

### Usage Examples

#### toggleVerticalNav

```typescript
'use client'

// MUI Imports
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'

// Component Imports
import VerticalNav, { Menu, MenuItem, SubMenu } from '@menu/vertical-menu'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

const ToggleFunction = () => {
  // Hooks
  const { toggleVerticalNav, isToggled } = useVerticalNav()

  return (
    <div className='flex min-bs-full bs-dvh'>
      <VerticalNav customBreakpoint='200px'>
        <Menu>
          <SubMenu label='Dashboards'>
            <MenuItem>Analytics</MenuItem>
            <MenuItem>eCommerce</MenuItem>
          </SubMenu>
          <MenuItem>Calendar</MenuItem>
          <MenuItem>FAQ</MenuItem>
          <SubMenu label='Menu Level'>
            <MenuItem>Menu Level 2.1</MenuItem>
            <SubMenu label='Menu Level 2.2'>
              <MenuItem>Menu Level 3.1</MenuItem>
              <MenuItem>Menu Level 3.2</MenuItem>
            </SubMenu>
          </SubMenu>
          <MenuItem>Documentation</MenuItem>
        </Menu>
      </VerticalNav>
      <main className='p-4 flex-grow'>
        <FormControlLabel label='Toggle Menu' control={<Checkbox onChange={() => toggleVerticalNav(!isToggled)} />} />
      </main>
    </div>
  )
}

export default ToggleFunction
```

#### collapseVerticalNav

```typescript
'use client'

// MUI Imports
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'

// Component Imports
import VerticalNav, { Menu, MenuItem, SubMenu } from '@menu/vertical-menu'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

const CollapsedFunction = () => {
  // Hooks
  const { collapseVerticalNav, isCollapsed } = useVerticalNav()

  return (
    <div className='flex'>
      <VerticalNav customBreakpoint='200px'>
        <Menu>
          <SubMenu label='Dashboards'>
            <MenuItem>Analytics</MenuItem>
            <MenuItem>eCommerce</MenuItem>
          </SubMenu>
          <MenuItem>Calendar</MenuItem>
          <MenuItem>FAQ</MenuItem>
          <SubMenu label='Menu Level'>
            <MenuItem>Menu Level 2.1</MenuItem>
            <SubMenu label='Menu Level 2.2'>
              <MenuItem>Menu Level 3.1</MenuItem>
              <MenuItem>Menu Level 3.2</MenuItem>
            </SubMenu>
          </SubMenu>
          <MenuItem>Documentation</MenuItem>
        </Menu>
      </VerticalNav>
      <main className='p-4 flex-grow'>
        <FormControlLabel
          label={isCollapsed ? 'Expand Menu' : 'Collapse Menu'}
          control={<Checkbox onChange={() => collapseVerticalNav(!isCollapsed)} />}
        />
      </main>
    </div>
  )
}

export default CollapsedFunction
```

#### hoverVerticalNav

```typescript
'use client'

// MUI Imports
import Checkbox from '@mui/material/Checkbox'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'

// Component Imports
import VerticalNav, { Menu, MenuItem, SubMenu } from '@menu/vertical-menu'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

const HoveredFunction = () => {
  // Hooks
  const { hoverVerticalNav, collapseVerticalNav, isHovered, isCollapsed } = useVerticalNav()

  return (
    <div className='flex'>
      <VerticalNav customBreakpoint='200px'>
        <Menu>
          <SubMenu label='Dashboards'>
            <MenuItem>Analytics</MenuItem>
            <MenuItem>eCommerce</MenuItem>
          </SubMenu>
          <MenuItem>Calendar</MenuItem>
          <MenuItem>FAQ</MenuItem>
          <SubMenu label='Menu Level'>
            <MenuItem>Menu Level 2.1</MenuItem>
            <SubMenu label='Menu Level 2.2'>
              <MenuItem>Menu Level 3.1</MenuItem>
              <MenuItem>Menu Level 3.2</MenuItem>
            </SubMenu>
          </SubMenu>
          <MenuItem>Documentation</MenuItem>
        </Menu>
      </VerticalNav>
      <main className='p-4 flex-grow'>
        <div className='flex justify-between'>
          <FormControlLabel
            label='Menu Toggle'
            control={<Checkbox onChange={() => collapseVerticalNav(!isCollapsed)} />}
          />
          <Button onClick={() => hoverVerticalNav(!isHovered)}>Click here to toggle Hover</Button>
        </div>
      </main>
    </div>
  )
}

export default HoveredFunction
```

#### isScrollWithContent

```typescript
'use client'

// MUI Imports
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'

// Component Imports
import VerticalNav, { Menu, MenuItem, SubMenu } from '@menu/vertical-menu'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

const IsScrollWithContent = () => {
  // Hooks
  const { isScrollWithContent, updateVerticalNavState } = useVerticalNav()

  return (
    <div className='flex'>
      <VerticalNav customBreakpoint='200px' scrollWithContent={isScrollWithContent}>
        <Menu>
          <SubMenu label='Dashboards'>
            <MenuItem>Analytics</MenuItem>
            <MenuItem>eCommerce</MenuItem>
          </SubMenu>
          <MenuItem>Calendar</MenuItem>
          <MenuItem>FAQ</MenuItem>
          <SubMenu label='Menu Level'>
            <MenuItem>Menu Level 2.1</MenuItem>
            <SubMenu label='Menu Level 2.2'>
              <MenuItem>Menu Level 3.1</MenuItem>
              <MenuItem>Menu Level 3.2</MenuItem>
            </SubMenu>
          </SubMenu>
          <MenuItem>Documentation</MenuItem>
        </Menu>
      </VerticalNav>
      <main className='p-4 flex-grow'>
        <div className='flex justify-between'>
          <FormControlLabel
            label='Scroll With Content'
            control={
              <Checkbox onChange={() => updateVerticalNavState({ isScrollWithContent: !isScrollWithContent })} />
            }
          />
          <p>{`Status : ${isScrollWithContent}`}</p>
        </div>
        <p className='mt-4'>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Dignissimos ex culpa nihil fugit inventore corporis
          at! Magnam odio quidem dolore, accusamus dolorem iste nihil odit facilis? Porro laborum ipsam harum
          perferendis non, neque impedit illo sunt amet voluptatibus est voluptatem, error sapiente vel aut
          necessitatibus placeat totam. Nobis dolorum soluta accusamus vitae. Excepturi, autem repellat placeat
          explicabo dolore ut maxime! Facere ducimus incidunt molestiae, illum ipsa beatae atque vero, ipsam neque
          aliquid est quidem perspiciatis vitae cum labore nostrum dicta laudantium necessitatibus fugiat soluta!
          Recusandae cum laboriosam eum labore doloribus soluta perferendis repellat, deleniti esse aut. Nisi expedita
          soluta amet rerum tempora, id voluptatum recusandae repudiandae placeat. Adipisci temporibus tempora iure,
          dicta hic error cumque aut perferendis exercitationem! Debitis odio pariatur sint voluptate, adipisci deleniti
          doloremque reprehenderit ab, possimus id neque. Aliquam voluptatibus cumque voluptate at natus ducimus quam
          saepe deleniti a, animi laborum quidem vero tenetur temporibus nam dolorum ad magnam inventore, quod quaerat
          error dolorem odio hic aspernatur! Nostrum debitis repudiandae delectus, temporibus, commodi illo quaerat in
          maiores laboriosam libero maxime sit dicta consectetur natus nam itaque. Assumenda inventore perferendis
          atque, laborum quae harum culpa nam suscipit ducimus quia! Iure tempore explicabo autem? Possimus voluptas,
          voluptate exercitationem sed maxime animi, iste nesciunt magnam placeat obcaecati pariatur deleniti temporibus
          quae necessitatibus vel aliquam autem magni? Saepe fugit nobis libero nam ratione eos delectus consequatur
          facilis tempora doloribus doloremque vero debitis nisi explicabo omnis, commodi in, quasi voluptatibus
          excepturi deleniti? Quasi repellat repellendus sapiente sed illum iste consequuntur, maxime culpa, sint
          accusamus similique deserunt eius eum ab quibusdam? Magni nihil officiis modi vero? Fugiat consequuntur
          repellat exercitationem numquam nulla unde rerum iste tenetur molestias maxime iure modi illum, quos laborum
          facilis repellendus ut voluptatem ab, ipsum earum quo, aliquid deserunt quia minus! Maiores ex neque
          reiciendis nulla voluptates magni fugiat officia temporibus commodi, dignissimos quaerat perspiciatis quas
          quibusdam reprehenderit maxime quam omnis consequatur doloribus facere! Rem illo repellendus a animi non qui
          ab in error earum quisquam facere laboriosam, eligendi molestiae consequuntur. Minima, officiis iusto vitae ex
          praesentium aspernatur dolore quod eos doloremque soluta veniam. Sint voluptatem vel dolor. In, quisquam omnis
          dignissimos libero eveniet explicabo blanditiis dolores beatae? Velit quisquam nam obcaecati, fugit eligendi
          nemo amet sit, quas, deleniti iusto reprehenderit aperiam ea dicta reiciendis! Dicta voluptatibus perspiciatis
          nisi molestias quasi tempore omnis fuga sint deleniti cumque? Repellat excepturi, tenetur quam quas minus
          illo. Aspernatur impedit ut quis similique error, explicabo optio obcaecati illo commodi, delectus ipsam!
          Magni nobis quos placeat tempore suscipit nostrum aliquid fugit facilis laboriosam quasi itaque minima nihil
          eaque corrupti accusamus facere aspernatur, necessitatibus esse, harum soluta. Fugiat, sit laboriosam?
          Dignissimos praesentium minima repellendus molestiae, laboriosam labore in optio porro fugiat quo veritatis
          non, nobis mollitia qui illo. Possimus iste soluta ullam impedit reiciendis dolorem quam assumenda cupiditate.
          Accusamus, sapiente. Distinctio sapiente accusantium dolorum molestiae rerum eligendi, culpa assumenda,
          deserunt quod aliquid, consequatur labore possimus laudantium quas architecto. Suscipit deserunt accusantium
          eaque facere reprehenderit fugiat sint distinctio aperiam expedita asperiores harum, optio magni quasi veniam!
        </p>
      </main>
    </div>
  )
}

export default IsScrollWithContent
```

#### isBreakpointReached

```typescript
'use client'

// MUI Imports
import Button from '@mui/material/Button'

// Component Imports
import VerticalNav, { Menu, MenuItem, SubMenu } from '@menu/vertical-menu'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

const BreakPoint = () => {
  // Hooks
  const { isBreakpointReached, isToggled, toggleVerticalNav } = useVerticalNav()

  return (
    <div className='flex'>
      <VerticalNav breakpoint='md'>
        <Menu>
          <SubMenu label='Dashboards'>
            <MenuItem>Analytics</MenuItem>
            <MenuItem>eCommerce</MenuItem>
          </SubMenu>
          <MenuItem>Calendar</MenuItem>
          <MenuItem>FAQ</MenuItem>
          <SubMenu label='Menu Level'>
            <MenuItem>Menu Level 2.1</MenuItem>
            <SubMenu label='Menu Level 2.2'>
              <MenuItem>Menu Level 3.1</MenuItem>
              <MenuItem>Menu Level 3.2</MenuItem>
            </SubMenu>
          </SubMenu>
          <MenuItem>Documentation</MenuItem>
        </Menu>
      </VerticalNav>
      <main className='p-4 flex-grow'>
        {isBreakpointReached && (
          <Button onClick={() => toggleVerticalNav(isBreakpointReached ? !isToggled : true)}>Menu Toggle</Button>
        )}
      </main>
    </div>
  )
}

export default BreakPoint
```

## useHorizontalNav Hook

### Overview

The `useHorizontalNav()` hook handles horizontal navigation menu functionality, providing variables to customize menu behavior.

### Values

| Value | Type | Description |
|-------|------|-------------|
| `isBreakpointReached` | boolean | Whether breakpoint has been reached |
| `updateIsBreakpointReached` | (isBreakpointReached: boolean) => void | Update breakpoint reached value |

### Usage Examples

#### isBreakpointReached

```typescript
'use client'

// Component Imports
import NavToggle from '@components/layout/vertical/NavToggle'
import HorizontalNav, { Menu, MenuItem, SubMenu } from '@menu/horizontal-menu'
import VerticalNavContent from '../../menu-examples/horizontal-menu/VerticalNavContent'

// Hook Imports
import useHorizontalNav from '@menu/hooks/useHorizontalNav'

const IsBreakpointReached = () => {
  // Hooks
  const { isBreakpointReached } = useHorizontalNav()

  return (
    <div className='flex'>
      <HorizontalNav switchToVertical breakpoint='md' verticalNavContent={VerticalNavContent}>
        <Menu>
          <SubMenu label='Dashboards'>
            <MenuItem>Analytics</MenuItem>
            <MenuItem>eCommerce</MenuItem>
          </SubMenu>
          <MenuItem>Calendar</MenuItem>
          <MenuItem>FAQ</MenuItem>
          <SubMenu label='Menu Level'>
            <MenuItem>Menu Level 2.1</MenuItem>
            <SubMenu label='Menu Level 2.2'>
              <MenuItem>Menu Level 3.1</MenuItem>
              <MenuItem>Menu Level 3.2</MenuItem>
            </SubMenu>
          </SubMenu>
          <MenuItem>Documentation</MenuItem>
        </Menu>
      </HorizontalNav>
      <main className='p-4 flex-grow'>{isBreakpointReached && <NavToggle />}</main>
    </div>
  )
}

export default IsBreakpointReached
```

#### updateIsBreakpointReached

```typescript
'use client'

// React Imports
import { useEffect } from 'react'

// Hook Imports
import useHorizontalNav from '@menu/hooks/useHorizontalNav'
import useMediaQuery from '@menu/hooks/useMediaQuery'

const UpdateIsBreakpointReached = () => {
  // Hooks
  const { isBreakpointReached, updateIsBreakpointReached } = useHorizontalNav()

  const isSmallerThan800 = useMediaQuery('800px')

  // Set the breakpointReached value in the state
  useEffect(() => {
    updateIsBreakpointReached(isSmallerThan800)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSmallerThan800])

  return (
    <main className='p-4 flex-grow'>
      <p>
        {isBreakpointReached ? 'Example screen size is smaller than 800px' : 'Example screen size is larger than 800px'}
      </p>
    </main>
  )
}

export default UpdateIsBreakpointReached
```

## useMediaQuery Hook

### Overview

The `useMediaQuery()` hook determines if the current viewport matches a given media query.

### Usage Example

```typescript
'use client'

// Hook Imports
import useMediaQuery from '@menu/hooks/useMediaQuery'

const MediaQuery = () => {
  const isSmallerThan800 = useMediaQuery('800px')

  return (
    <main className='p-4 flex-grow'>
      <p>
        {isSmallerThan800 ? 'Example screen size is smaller than 800px' : 'Example screen size is larger than 800px'}
      </p>
    </main>
  )
}

export default MediaQuery
```

## useSettings Hook

### Overview

The `useSettings()` hook allows access to app settings, enabling modification and page-specific updates.

### Values

| Value | Type | Description |
|-------|------|-------------|
| `settings` | Settings | App settings object |
| `isSettingsChanged` | boolean | Whether initial settings changed |
| `updateSettings` | (settings: Partial<Settings>, options?: UpdateSettingsOptions) => void | Update app settings |
| `resetSettings` | () => void | Reset to initial settings |
| `updatePageSettings` | (settings: Partial<Settings>) => () => void | Update page-specific settings |

```typescript
export type Settings = {
  mode?: Mode
  skin?: Skin
  semiDark?: boolean
  layout?: Layout
  navbarContentWidth?: LayoutComponentWidth
  contentWidth?: LayoutComponentWidth
  footerContentWidth?: LayoutComponentWidth
  primaryColor?: string
}

type UpdateSettingsOptions = {
  updateCookie?: boolean  // Default: true
}
```

### Usage Examples

#### Mode Setting

```typescript
'use client'

// Type Imports
import type { Settings } from '@core/contexts/settingsContext'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

const SettingsMode = () => {
  // Hooks
  const { settings, updateSettings } = useSettings()

  const handleChange = (field: keyof Settings, value: Settings[keyof Settings]) => {
    updateSettings({
      [field]: value
    })
  }

  return (
    <div className='flex justify-between'>
      <form>
        <p>Mode:</p>
        <input
          type='radio'
          id='dark'
          name='mode'
          value='dark'
          checked={settings.mode === 'dark'}
          onChange={() => handleChange('mode', 'dark')}
        />
        <label htmlFor='dark'>Dark</label>
        <input
          type='radio'
          id='light'
          name='mode'
          value='light'
          checked={settings.mode === 'light'}
          onChange={() => handleChange('mode', 'light')}
        />
        <label htmlFor='light'>Light</label>
        <input
          type='radio'
          id='system'
          name='mode'
          value='system'
          checked={settings.mode === 'system'}
          onChange={() => handleChange('mode', 'system')}
        />
        <label htmlFor='system'>System</label>
      </form>
      <p>value:{settings.mode}</p>
    </div>
  )
}

export default SettingsMode
```

#### Skin Setting

```typescript
'use client'

// Type Imports
import type { Settings } from '@core/contexts/settingsContext'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

const SettingsSkin = () => {
  // Hooks
  const { settings, updateSettings } = useSettings()

  const handleChange = (field: keyof Settings, value: Settings[keyof Settings]) => {
    updateSettings({
      [field]: value
    })
  }

  return (
    <div className='flex justify-between'>
      <form>
        <p>Skin:</p>
        <input
          type='radio'
          id='default'
          name='skin'
          value='default'
          checked={settings.skin === 'default'}
          onChange={() => handleChange('skin', 'default')}
        />
        <label htmlFor='default'>Default</label>
        <input
          type='radio'
          id='border'
          name='skin'
          value='bordered'
          checked={settings.skin === 'bordered'}
          onChange={() => handleChange('skin', 'bordered')}
        />
        <label htmlFor='border'>Border</label>
      </form>
      <p>value:{settings.skin}</p>
    </div>
  )
}

export default SettingsSkin
```

#### SemiDark Setting

```typescript
'use client'

// Type Imports
import type { Settings } from '@core/contexts/settingsContext'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

const SettingsSemiDark = () => {
  // Hooks
  const { settings, updateSettings } = useSettings()

  const handleChange = (field: keyof Settings, value: Settings[keyof Settings]) => {
    updateSettings({
      [field]: value
    })
  }

  return (
    <div className='flex justify-between'>
      <form>
        <input
          type='checkbox'
          id='semiDark'
          name='semiDark'
          checked={settings.semiDark}
          onChange={() => handleChange('semiDark', !settings.semiDark)}
        />
        <label id='semiDark'>Semi Dark</label>
      </form>
      <p>Value:{settings.semiDark?.toString()}</p>
    </div>
  )
}

export default SettingsSemiDark
```

#### Layout Setting

```typescript
'use client'

// Type Imports
import type { Settings } from '@core/contexts/settingsContext'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

const SettingsLayout = () => {
  // Hooks
  const { settings, updateSettings } = useSettings()

  const handleChange = (field: keyof Settings, value: Settings[keyof Settings]) => {
    updateSettings({
      [field]: value
    })
  }

  return (
    <div className='flex justify-between'>
      <form>
        <p>Layout:</p>
        <input
          type='radio'
          id='vertical'
          name='layout'
          value='vertical'
          checked={settings.layout === 'vertical'}
          onChange={() => handleChange('layout', 'vertical')}
        />
        <label htmlFor='vertical'>Vertical</label>
        <input
          type='radio'
          id='collapsed'
          name='layout'
          value='collapsed'
          checked={settings.layout === 'collapsed'}
          onChange={() => handleChange('layout', 'collapsed')}
        />
        <label htmlFor='collapsed'>Collapsed</label>
        <input
          type='radio'
          id='horizontal'
          name='layout'
          value='horizontal'
          checked={settings.layout === 'horizontal'}
          onChange={() => handleChange('layout', 'horizontal')}
        />
        <label htmlFor='horizontal'>Horizontal</label>
      </form>
      <p>Value:{settings.layout}</p>
    </div>
  )
}

export default SettingsLayout
```

#### Content Width Settings

```typescript
'use client'

// Type Imports
import type { Settings } from '@core/contexts/settingsContext'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

const SettingsContentWidth = () => {
  // Hooks
  const { settings, updateSettings } = useSettings()

  const handleChange = (field: keyof Settings, value: Settings[keyof Settings]) => {
    updateSettings({
      [field]: value
    })
  }

  return (
    <div className='flex justify-between'>
      <form>
        <p>Content:</p>
        <input
          type='radio'
          id='compact'
          name='content'
          value='compact'
          checked={settings.contentWidth === 'compact'}
          onChange={() => handleChange('contentWidth', 'compact')}
        />
        <label htmlFor='compact'>Compact</label>
        <input
          type='radio'
          id='wide'
          name='content'
          value='wide'
          checked={settings.contentWidth === 'wide'}
          onChange={() => handleChange('contentWidth', 'wide')}
        />
        <label htmlFor='wide'>Wide</label>
      </form>
      <p>Value:{settings.contentWidth}</p>
    </div>
  )
}

export default SettingsContentWidth
```

#### Primary Color Setting

```typescript
'use client'

// Type Imports
import type { Settings } from '@core/contexts/settingsContext'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

const SettingsPrimaryColor = () => {
  // Hooks
  const { settings, updateSettings } = useSettings()

  const handleChange = (field: keyof Settings, value: Settings[keyof Settings]) => {
    updateSettings({
      [field]: value
    })
  }

  return (
    <main className='p-4 flex-grow'>
      <div className='flex flex-col gap-4'>
        <p>Change the primary color from below input</p>
        <input
          type='color'
          value={settings.primaryColor}
          onChange={event => handleChange('primaryColor', event.target.value)}
        />
        <p>Primary Color: {settings.primaryColor}</p>
      </div>
    </main>
  )
}

export default SettingsPrimaryColor
```

#### Change/Reset Settings

```typescript
'use client'

// Type Imports
import type { Settings } from '@core/contexts/settingsContext'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

const SettingsChanged = () => {
  // Hooks
  const { settings, updateSettings, isSettingsChanged, resetSettings } = useSettings()

  const handleChange = (field: keyof Settings, value: Settings[keyof Settings]) => {
    updateSettings({
      [field]: value
    })
  }

  return (
    <main className='p-4 flex-grow'>
      <div className='flex justify-between'>
        <form>
          <p>Mode:</p>
          <input
            type='radio'
            id='dark'
            name='mode'
            value='dark'
            checked={settings.mode === 'dark'}
            onChange={() => handleChange('mode', 'dark')}
          />
          <label htmlFor='dark'>Dark</label>
          <input
            type='radio'
            id='light'
            name='mode'
            value='light'
            checked={settings.mode === 'light'}
            onChange={() => handleChange('mode', 'light')}
          />
          <label htmlFor='light'>Light</label>
          <input
            type='radio'
            id='system'
            name='mode'
            value='system'
            checked={settings.mode === 'system'}
            onChange={() => handleChange('mode', 'system')}
          />
          <label htmlFor='system'>System</label>
        </form>
        <p>{isSettingsChanged && 'value:' + settings.mode}</p>
      </div>
      {isSettingsChanged && <button onClick={resetSettings}>Reset</button>}
    </main>
  )
}

export default SettingsChanged
```

#### updatePageSettings

**Note:** Page-specific settings may cause server/client class mismatch with M

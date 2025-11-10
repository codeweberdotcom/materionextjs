### Materio UI Consistency Audit (MUI Alignment)

This document lists UI elements and libraries that bypass or are inconsistent with MUI’s design system in the project. For each category, affected files are enumerated and MUI‑aligned alternatives are suggested.

---

### 1) Notifications — react-toastify
- Containers/styles:
  - `src/libs/styles/AppReactToastify.tsx`
  - `src/app/[lang]/layout.tsx` — global import `react-toastify/dist/ReactToastify.css`
- `toast` usage (detected samples):
  - `src/components/dialogs/edit-user-info/index.tsx`
  - `src/components/dialogs/role-dialog/index.tsx`
  - `src/views/apps/references/cities/CitiesListTable.tsx`
  - `src/views/apps/references/countries/CountriesListTable.tsx`
  - `src/views/apps/references/currencies/CurrenciesListTable.tsx`
  - `src/views/apps/references/districts/DistrictsListTable.tsx`
  - `src/views/apps/references/languages/LanguagesListTable.tsx`
  - `src/views/apps/references/states/StatesListTable.tsx`
  - `src/views/apps/references/translations/TranslationsListTable.tsx`
  - `src/views/apps/roles/RoleCards.tsx`
  - `src/views/apps/roles/RolesTable.tsx`
  - `src/views/apps/settings/smtp/index.tsx`
  - `src/views/apps/user/list/AddUserDrawer.tsx`
  - `src/views/apps/user/list/UserListTable.tsx`
  - `src/views/apps/user/view/user-left-overview/UserDetails.tsx`
  - `src/views/forms/form-validation/FormValidationAsyncSubmit.tsx`
  - `src/views/forms/form-validation/FormValidationBasic.tsx`
  - `src/views/forms/form-validation/FormValidationSchema.tsx`
  - `src/views/forms/form-wizard/StepperAlternativeLabel.tsx`
  - `src/views/forms/form-wizard/StepperLinearWithValidation.tsx`
  - `src/views/forms/form-wizard/StepperVerticalWithNumbers.tsx`
  - `src/views/forms/form-wizard/StepperVerticalWithoutNumbers.tsx`
  - `src/views/pages/account-settings/account/AccountDetails.tsx`
- Why inconsistent: Separate notification system; styling/theme not controlled by MUI.
- Recommendation: Replace with `@mui/material` `Snackbar` + `Alert`, expose a `useSnackbar()` helper for a consistent API.

---

### 2) Custom scrollbars — react-perfect-scrollbar
- Imports:
  - `src/@core/components/customizer/index.tsx`
  - `src/@menu/components/horizontal-menu/SubMenuContent.tsx`
  - `src/@menu/components/vertical-menu/SubMenuContent.tsx`
  - `src/components/layout/horizontal/VerticalNavContent.tsx`
  - `src/components/layout/shared/NotificationsDropdown.tsx`
  - `src/components/layout/shared/ShortcutsDropdown.tsx`
  - `src/components/layout/vertical/ClientVerticalMenu.tsx`
  - `src/components/layout/vertical/VerticalMenu.tsx`
  - `src/views/apps/calendar/AddEventSidebar.tsx`
  - `src/views/apps/chat/ChatLog.tsx`
  - `src/views/apps/chat/SidebarLeft.tsx`
  - `src/views/apps/chat/UserProfileLeft.tsx`
  - `src/views/apps/chat/UserProfileRight.tsx`
  - `src/views/apps/ecommerce/customers/list/AddCustomerDrawer.tsx`
  - `src/views/apps/email/MailContentList.tsx`
  - `src/views/apps/email/MailDetails.tsx`
  - `src/views/apps/email/SidebarLeft.tsx`
  - `src/views/apps/logistics/fleet/FleetSidebar.tsx`
  - `src/views/apps/notifications/NotificationDetails.tsx`
  - `src/views/apps/notifications/NotificationsList.tsx`
  - `src/views/apps/notifications/SidebarLeft.tsx`
- Global CSS imports:
  - `src/app/[lang]/layout.tsx` — `react-perfect-scrollbar/dist/css/styles.css`
  - `src/app/front-pages/layout.tsx` — same
- Why inconsistent: External CSS and behavior not aligned with MUI’s theme and a11y.
- Recommendation: Prefer native scroll in MUI containers (`Box`, `Paper` with `overflow: 'auto'`). If absolutely needed, encapsulate a custom scroll lib inside MUI and theme it; avoid global CSS.

---

### 3) Bootstrap Icons
- File:
  - `src/views/apps/calendar/Calendar.tsx` — `import 'bootstrap-icons/font/bootstrap-icons.css'`
- Why inconsistent: Icon set outside MUI; colors/sizing not bound to MUI tokens.
- Recommendation: Use `@mui/icons-material` or `SvgIcon` with custom SVGs.

---

### 4) Radix UI (Dialog Typography)
- File:
  - `src/components/layout/shared/search/index.tsx` — `import { Title, Description } from '@radix-ui/react-dialog'`
- Why inconsistent: Typography and slots differ from MUI dialog structure.
- Recommendation: Migrate to MUI `Dialog` + `DialogTitle` + `DialogContentText`.

---

### 5) Date pickers — react-datepicker
- Files:
  - `src/libs/styles/AppReactDatepicker.tsx`
  - Internal import of `react-datepicker/dist/react-datepicker.css`
- Why inconsistent: Standalone widget and CSS; limited MUI theme integration.
- Recommendation: Switch to `@mui/x-date-pickers` (`DatePicker`, `DateTimePicker`, `TimePicker`).

---

### 6) Dropzone — react-dropzone
- File:
  - `src/views/apps/ecommerce/products/add/ProductImage.tsx`
- Why inconsistent: Visual styling outside MUI system.
- Recommendation: Keep `react-dropzone` for behavior but render UI with MUI (`Paper`, `Box`, `Button`, `Typography`), including focus/hover states.

---

### 7) Skeletons — react-loading-skeleton
- Files (+ related CSS imports):
  - `src/components/layout/vertical/NavbarContent.tsx`
  - `src/views/apps/chat/ChatLog.tsx`
  - `src/views/apps/chat/SidebarLeft.tsx`
  - `src/views/apps/notifications/NotificationsList.tsx`
  - `src/views/apps/references/cities/CitiesListTable.tsx`
  - `src/views/apps/references/countries/CountriesListTable.tsx`
  - `src/views/apps/references/currencies/CurrenciesListTable.tsx`
  - `src/views/apps/references/districts/DistrictsListTable.tsx`
  - `src/views/apps/references/languages/languagesListTable.tsx`
  - `src/views/apps/references/states/StatesListTable.tsx`
  - `src/views/apps/references/translations/TranslationsListTable.tsx`
  - `src/views/apps/roles/RoleCards.tsx`
  - `src/views/apps/roles/RolesTable.tsx`
  - `src/views/apps/settings/email-templates/index.tsx`
  - `src/views/apps/settings/smtp/index.tsx`
  - `src/views/apps/user/list/UserListCards.tsx`
  - `src/views/apps/user/list/UserListTable.tsx`
  - `src/views/pages/admin/testing/index.tsx`
- Why inconsistent: MUI provides `Skeleton` with theme integration.
- Recommendation: Replace with `@mui/material/Skeleton`.

---

### 8) Slider/Carousel — keen-slider
- Files:
  - `src/views/front-pages/landing-page/CustomerReviews.tsx` — `useKeenSlider`
  - `src/libs/styles/AppKeenSlider.ts` — CSS import `keen-slider/keen-slider.min.css`
- Why inconsistent: External CSS and behavior.
- Recommendation: Prefer a MUI-based composition (e.g., `react-swipeable-views` + MUI) or fully theme the existing slider within MUI containers.

---

### 9) Command palette — cmdk
- Files:
  - `src/components/layout/shared/search/index.tsx` — `CommandDialog`, `CommandList`, etc.
  - `src/components/layout/shared/search/styles.css` — attribute-based CSS `[cmdk-*]`
- Why inconsistent: UI structure and styles outside MUI.
- Recommendation: Implement via MUI `Dialog` + `Autocomplete`/`List` or keep `cmdk` but render items with MUI components and unify typography.

---

### 10) Positioning — @floating-ui/react
- Files:
  - `src/@menu/components/horizontal-menu/Menu.tsx` — `FloatingTree`
  - `src/@menu/components/horizontal-menu/MenuItem.tsx` — `useFloatingTree`
  - `src/@menu/components/horizontal-menu/SubMenu.tsx` — floating-ui imports
  - `src/@menu/components/vertical-menu/Menu.tsx` — `FloatingTree`
  - `src/@menu/components/vertical-menu/SubMenu.tsx` — floating-ui imports
  - `src/components/layout/front-pages/DropdownMenu.tsx` — floating-ui imports
- Why inconsistent: MUI has `Popper`, `Menu`, `Popover`, `Tooltip` with theme integration.
- Recommendation: Prefer MUI positioning components where possible.

---

### 11) Calendar — FullCalendar
- File:
  - `src/views/apps/calendar/Calendar.tsx` — `@fullcalendar/react` and plugins
- Why inconsistent: Fully external widget with own styles.
- Recommendation: Keep as domain-specific control but wrap in MUI (`Card`, `Paper`, `Tabs`) and align fonts/colors with theme.

---

### 12) Charts — Recharts / ApexCharts
- Recharts:
  - Page: `src/app/[lang]/(dashboard)/(private)/charts/recharts/page.tsx`
  - Components: `src/views/charts/recharts/RechartsAreaChart.tsx`, `RechartsBarChart.tsx`, `RechartsLineChart.tsx`, `RechartsPieChart.tsx`, `RechartsRadarChart.tsx`, `RechartsScatterChart.tsx`
  - Styles: `src/libs/styles/AppRecharts.ts`
  - Wrapper: `src/libs/Recharts.tsx`
- ApexCharts:
  - Page: `src/app/[lang]/(dashboard)/(private)/charts/apex-charts/page.tsx`
  - Wrapper: `src/libs/ApexCharts.tsx`
  - Styles: `src/libs/styles/AppReactApexCharts.tsx`
- Why inconsistent: External charting libraries; ensure all external UI is themed via MUI wrappers.
- Recommendation: Continue wrapping in MUI; pull colors/spacing from `theme.palette` and `theme.spacing`.

---

### 13) Rich text editor — TipTap
- Detected via dependencies `@tiptap/*` (exact files not enumerated here).
- Why inconsistent: Toolbar/buttons should match MUI design.
- Recommendation: Build toolbars with MUI (`Toolbar`, `IconButton`, `ToggleButtonGroup`).

---

### 14) Emoji picker — emoji-mart
- File:
  - `src/views/apps/chat/SendMsgForm.tsx` — `@emoji-mart/react`, `@emoji-mart/data`
- Why inconsistent: External widget look & feel.
- Recommendation: Open in MUI `Popover`/`Dialog`; use MUI buttons/typography around it.

---

### 15) Maps — react-map-gl / mapbox-gl
- File:
  - `src/views/apps/logistics/fleet/FleetMap.tsx` — `react-map-gl`
- Why inconsistent: Map controls/containers outside MUI styling.
- Recommendation: Wrap map inside MUI containers and use MUI controls where possible (e.g., `Fab`, `Tooltip`).

---

### 16) Video — react-player
- File:
  - `src/libs/ReactPlayer.tsx` — dynamic import `react-player`
- Why inconsistent: Controls and layout outside MUI.
- Recommendation: Use MUI for surrounding layout and any custom controls.

---

### 17) Tailwind CSS mixed with MUI
- Detected via dependencies `tailwindcss`, `tailwindcss-logical` and utility classes in markup.
- Why inconsistent: Dual design systems can cause spacing/typography/color clashes.
- Recommendation: Limit Tailwind to layout utilities only or migrate styles to MUI `sx`/`styled`.

---

### Enforcement & Next Steps
- ESLint import restrictions:
  - Disallow: `react-toastify`, `react-perfect-scrollbar`, `bootstrap-icons`, `@radix-ui/*`, `react-loading-skeleton`, `@floating-ui/react` (unless justified).
  - Allow with wrapper requirement: `@fullcalendar/*`, `recharts`, `react-apexcharts`, `react-map-gl`, `@tiptap/*`, `emoji-mart`, `react-dropzone`, `react-player`.
- Stylelint: block global CSS from third-party libs (except MUI baseline).
- Migration order (suggested):
  1) Replace `react-toastify` → MUI `Snackbar`/`Alert`.
  2) Remove `react-perfect-scrollbar` → native scroll in MUI containers.
  3) Replace `react-loading-skeleton` → MUI `Skeleton`.
  4) Migrate `react-datepicker` → MUI X Date Pickers.
  5) Remove `bootstrap-icons` → MUI Icons.
  6) Replace Radix dialog typography → MUI `Dialog`.

If you want, I can generate a per-file migration checklist with estimates and create enforcement ESLint rules in a separate PR.

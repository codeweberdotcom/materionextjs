---
name: page
description: Create a new dashboard page with i18n translations, menu registration, and role permissions. Use when adding new pages, views, or sections to the admin panel. Activates for "add page", "create page", "new section".
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Create Dashboard Page

Generate a new page in the admin panel with i18n support, menu registration, and role-based access control.

## Usage

`/page <page-name>` — e.g., `/page tariffs`, `/page invoices`

## Argument: $ARGUMENTS

## Steps

1. **Ask the user** (if not clear from argument):
   - Page name (e.g., `tariffs`)
   - **Menu section** — which block to add MenuItem to (see Available Menu Sections below)
   - Icon (Remix Icon class, e.g., `ri-price-tag-3-line`)
   - Page type: list (table), form, dashboard, or custom
   - **Permission module** name (e.g., `tariffManagement`) — used in `checkPermission(user, 'MODULE', 'action')`
   - **Permission actions** needed (default: `['read', 'create', 'update', 'delete']`)
   - **Minimum role** required (default: any authenticated user with permission)

2. **Create all files** listed below.

3. **Add translations** to all 4 dictionaries.

4. **Register in both menus** (vertical + horizontal) — in the section the user chose.

5. **Add permission checks** — server-side in page, client-side for action buttons.

6. **Verify** — run `pnpm lint` on new files.

## Available Menu Sections

### VerticalMenu (`MenuSection` blocks):

| # | Section | Label key | Contains |
|---|---------|-----------|----------|
| 1 | **Dashboards** | `navigation.dashboards` | CRM, Analytics, eCommerce, Academy, Logistics |
| 2 | **Front Pages** | `navigation.frontPages` | Landing, Pricing, Payment, Checkout, Help Center |
| 3 | **Communications** | `navigation.communications` | Chat, Notifications |
| 4 | **Accounts** | `navigation.accounts` | My Accounts, Tariffs, Managers, Transfers, Create |
| 5 | **Admin & Settings** | `navigation.adminAndSettings` | User Settings (SubMenu), References (SubMenu), SMTP, Email Templates, SMS, Telegram, Notifications (SubMenu), External Services |
| 6 | **Monitoring** | `navigation.monitoring` | Dashboard, Metrics, Error Tracking, App Insights, Testing, Cron |
| 7 | **Media** | `navigation.media` | Library, Settings, Sync, Watermarks, Licenses |
| 8 | **Blocking** | `navigation.blocking` | Rate Limits, Rate Limit Events, Blocks, Events Journal |
| 9 | **Apps & Pages** | `navigation.appsPages` | eCommerce (SubMenu), Academy (SubMenu), Logistics (SubMenu), Email, Chat, Calendar, Kanban, Invoice (SubMenu), User (SubMenu), Roles & Permissions (SubMenu), Pages (SubMenu), Auth Pages (SubMenu), Wizards, Dialogs, Widgets |
| 10 | **Forms & Tables** | `navigation.formsAndTables` | Form Layouts, Validation, Wizard, React Table |
| 11 | **Charts & Misc** | `navigation.chartsMisc` | Apex Charts, Recharts, Foundation, Components, Menu Examples, Docs |

### HorizontalMenu (`SubMenu` blocks):

| # | Section | Label key |
|---|---------|-----------|
| 1 | **Dashboards** | `navigation.dashboards` |
| 2 | **Communications** | `navigation.communications` |
| 3 | **Accounts** | `navigation.accounts` |
| 4 | **Admin & Settings** | `navigation.adminAndSettings` |
| 5 | **Monitoring** | `navigation.monitoring` |
| 6 | **Media** | `navigation.media` |
| 7 | **Blocking** | `navigation.blocking` |
| 8 | **Apps** | `navigation.apps` |
| 9 | **Forms & Tables** | `navigation.formsAndTables` |
| 10 | **Charts** | `navigation.charts` |
| 11 | **Others** | `navigation.others` |

**Note:** Vertical and Horizontal menus have slightly different structure. Ask the user which section in EACH menu, or use the same logical section in both.

## Files to Create

### 1. Page Component (with Permission Check)

**Path:** `src/app/[lang]/(dashboard)/(private)/<page-name>/page.tsx`

```typescript
'use client'

// React Imports
import { useState, useEffect } from 'react'

// Next Imports
import { useParams, useRouter } from 'next/navigation'

// MUI Imports
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'

// Hook Imports
import { usePermissions } from '@/hooks/usePermissions'

// Type Imports
import type { Locale } from '@configs/i18n'

const PageName = () => {
  const { lang } = useParams()
  const router = useRouter()
  const { checkPermission, isSuperadmin, isLoading: permLoading } = usePermissions()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any[]>([])

  // Permission checks
  const canRead = isSuperadmin || checkPermission('PERMISSION_MODULE', 'read')
  const canCreate = isSuperadmin || checkPermission('PERMISSION_MODULE', 'create')
  const canUpdate = isSuperadmin || checkPermission('PERMISSION_MODULE', 'update')
  const canDelete = isSuperadmin || checkPermission('PERMISSION_MODULE', 'delete')

  useEffect(() => {
    // Redirect if no read permission
    if (!permLoading && !canRead) {
      router.push(`/${lang}/pages/misc/401-not-authorized`)

      return
    }

    const fetchData = async () => {
      try {
        const response = await fetch('/api/admin/MODULE')

        if (!response.ok) throw new Error('Failed to fetch')

        const result = await response.json()

        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error occurred')
      } finally {
        setLoading(false)
      }
    }

    if (canRead) {
      fetchData()
    }
  }, [permLoading, canRead])

  if (permLoading || loading) {
    return (
      <Box className='flex justify-center items-center min-h-[400px]'>
        <CircularProgress />
      </Box>
    )
  }

  if (!canRead) {
    return null
  }

  return (
    <Box className='flex flex-col gap-6'>
      <Box className='flex items-center justify-between'>
        <Typography variant='h4'>Page Title</Typography>
        {canCreate && (
          <Button
            variant='contained'
            startIcon={<i className='ri-add-line' />}
          >
            Create
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity='error' onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Content here — use canUpdate/canDelete for edit/delete buttons */}
    </Box>
  )
}

export default PageName
```

### 2. Translations (all 4 dictionaries)

Add to `src/data/dictionaries/en.json`, `ru.json`, `fr.json`, `ar.json`:

```json
{
  "navigation": {
    "pageName": "Page Name"
  },
  "pageName": {
    "title": "Page Title",
    "create": "Create",
    "edit": "Edit",
    "delete": "Delete",
    "noData": "No data found",
    "confirmDelete": "Are you sure you want to delete?",
    "deleteSuccess": "Successfully deleted",
    "createSuccess": "Successfully created",
    "updateSuccess": "Successfully updated",
    "permissionDenied": "You do not have permission to perform this action"
  }
}
```

**Important:** Add keys to ALL 4 dictionaries with translated values:
- `en.json` — English
- `ru.json` — Russian
- `fr.json` — French
- `ar.json` — Arabic

### 3. Vertical Menu Registration

**File:** `src/components/layout/vertical/VerticalMenu.tsx`

Add inside the **MenuSection/SubMenu** the user specified:

```tsx
<MenuItem href={`/${locale}/page-name`} icon={<i className='ri-icon-name' />}>
  {dictionary['navigation'].pageName}
</MenuItem>
```

### 4. Horizontal Menu Registration

**File:** `src/components/layout/horizontal/HorizontalMenu.tsx`

Add matching `<MenuItem>` in the corresponding **SubMenu** section.

## Permission Patterns

### Client-side (in page/view components):

```typescript
import { usePermissions } from '@/hooks/usePermissions'

const { checkPermission, isSuperadmin } = usePermissions()

// Check specific permission
const canRead = isSuperadmin || checkPermission('moduleName', 'read')
const canCreate = isSuperadmin || checkPermission('moduleName', 'create')
const canUpdate = isSuperadmin || checkPermission('moduleName', 'update')
const canDelete = isSuperadmin || checkPermission('moduleName', 'delete')

// Conditional rendering
{canCreate && <Button>Create</Button>}
{canDelete && row.original.role?.toLowerCase() !== 'superadmin' && (
  <IconButton><i className='ri-delete-bin-line' /></IconButton>
)}
```

### Server-side (in API routes — see /api skill):

```typescript
const { user } = await requireAuth(request)

if (!isSuperadmin(currentUser) && !checkPermission(currentUser, 'moduleName', 'read')) {
  return NextResponse.json({ message: 'Permission denied' }, { status: 403 })
}
```

### Standard permission modules (existing in seed.ts):

| Module | Used by |
|--------|---------|
| `userManagement` | User CRUD |
| `roleManagement` | Role management |
| `countryManagement` | Countries reference |
| `currencyManagement` | Currencies reference |
| `stateManagement` | States reference |
| `cityManagement` | Cities reference |
| `districtManagement` | Districts reference |
| `languageManagement` | Languages reference |
| `translationManagement` | Translations |
| `emailTemplatesManagement` | Email templates |
| `smtpManagement` | SMTP settings |
| `notificationScenarios` | Notification scenarios |
| `contentManagement` | Content CRUD |
| `mediaManagement` | Media files |

**New modules** should follow `camelCaseManagement` naming convention.

### Adding permission to seed.ts (optional)

If the new module needs default role assignments, add to `prisma/seed.ts` under the ADMIN role permissions:

```typescript
{
  // ... existing permissions
  newModuleManagement: ['create', 'read', 'update', 'delete']
}
```

Then run `pnpm migrate` or `npx prisma db seed` to apply.

## Import Organization Order

Always follow this order:

```typescript
// React Imports
// Next Imports
// MUI Imports
// Third-party Imports
// Type Imports
// Component Imports
// Hook Imports
// Util Imports
// Style Imports
```

## Page Conventions

- Use `'use client'` for interactive pages
- Icons: Remix Icons via `<i className='ri-icon-name' />`
- Locale from params: `const { lang } = useParams()`
- Dynamic href: `` `/${lang}/page-name` ``
- MUI components for all UI elements
- Tailwind utilities for layout (`flex`, `gap-6`, etc.)
- Loading state with `CircularProgress`
- Error state with `Alert`
- Empty state with centered icon + message
- **Always check permissions** before rendering CRUD actions
- **Redirect to 401** if user lacks read permission

## Checklist

- [ ] Page component created in `src/app/[lang]/(dashboard)/(private)/`
- [ ] Permission module name chosen (e.g., `newModuleManagement`)
- [ ] Permission checks added (`canRead`, `canCreate`, `canUpdate`, `canDelete`)
- [ ] Redirect to 401 if no read permission
- [ ] Create/Edit/Delete buttons wrapped in permission checks
- [ ] Translations added to all 4 dictionaries (en, ru, fr, ar)
- [ ] Navigation key added to `navigation` section of dictionaries
- [ ] MenuItem added to VerticalMenu.tsx (in correct section)
- [ ] MenuItem added to HorizontalMenu.tsx (in correct section)
- [ ] Permission module added to seed.ts (if needed for default roles)
- [ ] `pnpm lint` passes on new files
- [ ] Dev server restarted to pick up new route

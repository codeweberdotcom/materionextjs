# Internationalization (i18n)

The template supports both Right-to-Left (RTL) languages like Arabic and Left-to-Right (LTR) languages like English, automatically switching layouts based on the selected language.

## Adding i18n to Starter Kit

**Note**: This guide is for adding i18n to the starter-kit version. Full-version already includes i18n.

### 1. Install Dependencies

```bash
# Required packages for i18n
pnpm install @formatjs/intl-localematcher @types/negotiator negotiator
```

### 2. Restructure App Directory

1. Create `[lang]` folder in `src/app`
2. Move all content from `src/app` to `src/app/[lang]` (except `api`, `favicon.ico`, `globals.css`)
3. Update import paths in moved files

### 3. Add Required Files

Copy these files from full-version:

- `src/configs/i18n.ts`
- `src/utils/i18n.ts`
- `src/hocs/TranslationWrapper.tsx`
- `src/components/LangRedirect.tsx`
- `src/utils/getDictionary.ts`

### 4. Create Language Dictionaries

Create `src/data/dictionaries/` folder with JSON files for each language:

```javascript
// src/data/dictionaries/en.json
{
  "navigation": {
    "home": "Home",
    "about": "About"
  }
}

// src/data/dictionaries/fr.json
{
  "navigation": {
    "home": "Accueil",
    "about": "À propos"
  }
}
```

### 5. Update Layout Files

**`src/app/[lang]/layout.tsx`**:

```typescript
+ import { i18n } from '@configs/i18n'
+ import { headers } from 'next/headers'
+ import type { Locale } from '@configs/i18n'

- { children }: ChildrenType
+ props: ChildrenType & { params: Promise<{ lang: Locale }> }

+ const params = await props.params
+ const { children } = props

+ const headersList = await headers()

- const direction = 'ltr'
+ const direction = i18n.langDirection[params.lang]

- lang='en'
+ lang={params.lang}
```

Wrap HTML with TranslationWrapper:

```typescript
<TranslationWrapper headersList={headersList} lang={params.lang}>
  <html lang={params.lang} dir={direction}>
    {/* ... */}
  </html>
</TranslationWrapper>
```

**`src/app/[lang]/(dashboard)/layout.tsx`**:

```typescript
+ import { getDictionary } from '@/utils/getDictionary'

+ const dictionary = await getDictionary(params.lang)

// Pass dictionary to components
<Navigation dictionary={dictionary} />
<Header dictionary={dictionary} />
```

### 6. Update Navigation Components

**`src/components/layout/vertical/Navigation.tsx`**:

```typescript
+ import type { getDictionary } from '@/utils/getDictionary'

type Props = {
  // ... existing props
+ dictionary: Awaited<ReturnType<typeof getDictionary>>
}

// In component:
+ const { dictionary } = props

// Pass to VerticalMenu
<VerticalMenu dictionary={dictionary} />
```

**`src/components/layout/vertical/VerticalMenu.tsx`**:

```typescript
+ import { useParams } from 'next/navigation'

+ const params = useParams()
+ const { lang: locale } = params

// Update menu items
<MenuItem href={`/${locale}/home`} icon={<i className='ri-home-smile-line' />}>
  {dictionary['navigation'].home}
</MenuItem>
```

### 7. Update Horizontal Layout Components

Apply similar changes to:
- `src/components/layout/horizontal/Header.tsx`
- `src/components/layout/horizontal/Navigation.tsx`
- `src/components/layout/horizontal/HorizontalMenu.tsx`

### 8. Add Language Dropdown (Optional)

Copy `src/components/layout/shared/LanguageDropdown.tsx` from full-version and add to:

- `src/components/layout/vertical/NavbarContent.tsx`
- `src/components/layout/horizontal/NavbarContent.tsx`

### 9. Update Next.js Configuration

Add redirects to `next.config.mjs`:

```javascript
async redirects() {
  return [
    {
      source: '/',
      destination: '/en', // or your default language
      permanent: true,
    },
  ]
}
```

## Adding a New Language

Follow these steps to add a new language to your project:

### Step 1: Create Locale File

Create a JSON file for the new language in `src/data/dictionaries/`:

```javascript
// src/data/dictionaries/de.json
{
  "navigation": {
    "home": "Heim",
    "about": "Zirka"
  }
}
```

### Step 2: Update Configuration

Modify `src/configs/i18n.ts` to include the new language:

```typescript
export const i18n = {
  locales: ['en', 'de'], // Add 'de' for German
  langDirection: {
    en: 'ltr',
    de: 'ltr' // Add direction for German
  }
} as const
```

### Step 3: Add Dictionary Import

Update `src/utils/getDictionary.ts` to import the new locale:

```typescript
const dictionaries = {
  en: () => import('@/data/dictionaries/en.json').then(module => module.default),
  de: () => import('@/data/dictionaries/de.json').then(module => module.default) // Add German import
}
```

### Step 4: Update Redirects

Update redirects in `next.config.mjs`:

```javascript
redirects: async () => {
  return [
    {
      source: '/:lang(en|de)', // Include new language code
      destination: '/:lang/dashboards/crm',
      permanent: false
    },
    {
      source: '/((?!(?:en|de)\\b)):path', // Include new language code
      destination: '/en/:path',
      permanent: false
    }
  ]
}
```

### Step 5: Clear Cache

After completing the steps above:

1. Delete the `.next` folder
2. Clear browser cache or use Guest Mode for testing

```bash
rm -rf .next
npm run dev
```

## Changing Default Language

Follow these steps to change the default language in your project:

### Step 1: Update defaultLocale

Modify the `defaultLocale` in `src/configs/i18n.ts`:

```typescript
export const i18n = {
  defaultLocale: 'de', // Set German as the default language
  locales: ['en', 'de'],
  langDirection: {
    en: 'ltr',
    de: 'ltr'
  }
} as const
```

### Step 2: Update Redirects

Adjust the redirects in `next.config.mjs`:

```javascript
redirects: async () => {
  return [
    {
      source: '/',
      destination: '/de/dashboards/crm', // Redirect to German home page
      permanent: false
    },
    {
      source: '/:lang(en|de)',
      destination: '/:lang/dashboards/crm',
      permanent: false
    },
    {
      source: '/((?!(?:en|de)\\b)):path',
      destination: '/de/:path', // Fallback to German for unknown paths
      permanent: true,
      locale: false
    }
  ]
}
```

### Step 3: Clear Browser Cache

After completing the steps above:

1. Delete the `.next` folder
2. Clear browser cache or use Guest Mode for testing

```bash
rm -rf .next
npm run dev
```

**Note**: Test thoroughly to verify that all routes and translations work as expected.

## Removing a Language

Follow these steps to remove a language from your project:

### Step 1: Remove Locale File

Navigate to `src/data/dictionaries/` and delete the JSON file of the language you want to remove (e.g., `de.json`).

### Step 2: Update Configuration

In `src/configs/i18n.ts`, remove the language from the `locales` array and delete its entry from the `langDirection` object:

```typescript
export const i18n = {
  locales: ['en'], // Removed 'de'
  langDirection: {
    en: 'ltr' // Removed 'de' entry
  }
} as const
```

### Step 3: Additional Modifications

**Update GetDictionary** (`src/utils/getDictionary.ts`):
Remove the import statement for the language you're removing:

```typescript
const dictionaries = {
  en: () => import('@/data/dictionaries/en.json').then(module => module.default)
  // Removed: de: () => import('@/data/dictionaries/de.json').then(module => module.default)
}
```

**Update Redirects** (`next.config.mjs`):
Remove the language from redirect patterns:

```javascript
redirects: async () => {
  return [
    {
      source: '/:lang(en)', // Removed 'de' from pattern
      destination: '/:lang/dashboards/crm',
      permanent: false
    },
    {
      source: '/((?!(?:en)\\b)):path', // Removed 'de' from pattern
      destination: '/en/:path',
      permanent: false
    }
  ]
}
```

### Step 4: Clear Browser Cache

After completing the steps above:

1. Delete the `.next` folder
2. Clear browser cache or use Guest Mode for testing

```bash
rm -rf .next
npm run dev
```

## Troubleshooting

If you encounter type errors after adding i18n:

1. Refresh/reopen your editor
2. Delete the `.next` folder
3. Restart the development server

```bash
rm -rf .next
npm run dev
```

## Right-to-Left (RTL) Support

RTL (Right-to-Left) refers to the writing and reading direction in certain languages like Arabic, Hebrew, and Persian. Unlike LTR (Left-to-Right) languages like English, RTL languages require different text alignment and layout considerations.

### Overview

The template provides automatic RTL support that activates based on language settings. RTL formatting is applied when an RTL language is selected, while LTR formatting is used for languages like English.

### Implementing RTL

#### Case 1: RTL with i18n (Recommended)

RTL support is automatically tied to language settings. The template includes RTL support for Arabic:

```typescript
// src/configs/i18n.ts
export const i18n = {
  locales: ['en', 'ar'],
  langDirection: {
    en: 'ltr', // Left-to-Right
    ar: 'rtl' // Right-to-Left
  }
} as const
```

When Arabic (`ar`) is selected, the interface automatically switches to RTL layout.

#### Case 2: RTL without i18n

If you don't want to use i18n but still need RTL support, replace this code throughout the project:

```typescript
// Replace in all layout and component files
- const direction = 'ltr'
+ const direction = 'rtl'
```

### RTL Behavior

When RTL is enabled, Material-UI automatically handles:
- Text direction and alignment
- Component layouts (Drawer, Menu, Dialog positioning)
- Icon rotations and mirroring
- Margin/padding adjustments
- Flexbox direction changes

### Custom RTL Styling

For custom RTL-specific styles:

```typescript
import { useTheme } from '@mui/material/styles'

function MyComponent() {
  const theme = useTheme()

  return (
    <Box
      sx={{
        textAlign: theme.direction === 'rtl' ? 'right' : 'left',
        // Additional RTL-specific styles
      }}
    >
      Content
    </Box>
  )
}
```

### Supported RTL Languages

The template comes pre-configured with RTL support for:
- Arabic (`ar`)
- Hebrew (`he`) - can be added following the language addition guide
- Persian/Farsi (`fa`) - can be added following the language addition guide

### Testing RTL

To test RTL functionality:

1. Add an RTL language (like Arabic) following the language addition guide
2. Switch to the RTL language in the language selector
3. Verify that:
   - Text flows from right to left
   - Navigation and menus position correctly
   - Icons and UI elements are properly mirrored
   - Forms and inputs work as expected

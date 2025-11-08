# Configuration Guide

This document covers various configuration options available in the Materio MUI Next.js Admin Template.

## 🏠 Home Page URL Configuration

The home page URL determines where users are redirected when they visit the root URL of your website.

### Setting the Home Page URL

1. **Update Theme Configuration** (`src/configs/themeConfig.ts`):

```typescript
export type Config = {
  // ... other config options
  homePageUrl: string
  // ... other config options
}

const themeConfig: Config = {
  // ... other config
  homePageUrl: '/dashboards/crm', // Change this to your desired home page
  // ... other config
}
```

2. **Update Next.js Configuration** (`next.config.mjs`):

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... other config
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboards/crm', // Match the homePageUrl
        permanent: true,
      },
    ]
  },
  // ... other config
}

export default nextConfig
```

### Available Home Page Options

- `/dashboards/crm` - CRM Dashboard
- `/dashboards/analytics` - Analytics Dashboard
- `/dashboards/ecommerce` - E-commerce Dashboard
- `/apps/user/list` - User Management
- `/apps/roles` - Role Management

## 🌐 Internationalization (i18n)

The template supports both Right-to-Left (RTL) languages like Arabic and Left-to-Right (LTR) languages like English, automatically switching layouts based on the selected language.

### Adding i18n to Starter Kit

**Note**: This guide is for adding i18n to the starter-kit version. Full-version already includes i18n.

#### 1. Install Dependencies

```bash
# Required packages for i18n
pnpm install @formatjs/intl-localematcher @types/negotiator negotiator
```

#### 2. Restructure App Directory

1. Create `[lang]` folder in `src/app`
2. Move all content from `src/app` to `src/app/[lang]` (except `api`, `favicon.ico`, `globals.css`)
3. Update import paths in moved files

#### 3. Add Required Files

Copy these files from full-version:

- `src/configs/i18n.ts`
- `src/utils/i18n.ts`
- `src/hocs/TranslationWrapper.tsx`
- `src/components/LangRedirect.tsx`
- `src/utils/getDictionary.ts`

#### 4. Create Language Dictionaries

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

#### 5. Update Layout Files

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

#### 6. Update Navigation Components

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

#### 7. Update Horizontal Layout Components

Apply similar changes to:
- `src/components/layout/horizontal/Header.tsx`
- `src/components/layout/horizontal/Navigation.tsx`
- `src/components/layout/horizontal/HorizontalMenu.tsx`

#### 8. Add Language Dropdown (Optional)

Copy `src/components/layout/shared/LanguageDropdown.tsx` from full-version and add to:

- `src/components/layout/vertical/NavbarContent.tsx`
- `src/components/layout/horizontal/NavbarContent.tsx`

#### 9. Update Next.js Configuration

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

### Adding a New Language

Follow these steps to add a new language to your project:

#### Step 1: Create Locale File

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

#### Step 2: Update Configuration

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

#### Step 3: Add Dictionary Import

Update `src/utils/getDictionary.ts` to import the new locale:

```typescript
const dictionaries = {
  en: () => import('@/data/dictionaries/en.json').then(module => module.default),
  de: () => import('@/data/dictionaries/de.json').then(module => module.default) // Add German import
}
```

#### Step 4: Update Redirects

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

#### Step 5: Clear Cache

After completing the steps above:

1. Delete the `.next` folder
2. Clear browser cache or use Guest Mode for testing

```bash
rm -rf .next
npm run dev
```

### Changing Default Language

Follow these steps to change the default language in your project:

#### Step 1: Update defaultLocale

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

#### Step 2: Update Redirects

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

#### Step 3: Clear Browser Cache

After completing the steps above:

1. Delete the `.next` folder
2. Clear browser cache or use Guest Mode for testing

```bash
rm -rf .next
npm run dev
```

**Note**: Test thoroughly to verify that all routes and translations work as expected.

### Removing a Language

Follow these steps to remove a language from your project:

#### Step 1: Remove Locale File

Navigate to `src/data/dictionaries/` and delete the JSON file of the language you want to remove (e.g., `de.json`).

#### Step 2: Update Configuration

In `src/configs/i18n.ts`, remove the language from the `locales` array and delete its entry from the `langDirection` object:

```typescript
export const i18n = {
  locales: ['en'], // Removed 'de'
  langDirection: {
    en: 'ltr' // Removed 'de' entry
  }
} as const
```

#### Step 3: Additional Modifications

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

#### Step 4: Clear Browser Cache

After completing the steps above:

1. Delete the `.next` folder
2. Clear browser cache or use Guest Mode for testing

```bash
rm -rf .next
npm run dev
```

### Troubleshooting

If you encounter type errors after adding i18n:

1. Refresh/reopen your editor
2. Delete the `.next` folder
3. Restart the development server

```bash
rm -rf .next
npm run dev
```

## ↔️ Right-to-Left (RTL) Support

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

## 🎨 Theming

### Overview

Theming is the most important aspect of any template. You can easily customize the theme of our template by changing colors, typography, spacing, and much more.

The template uses Material-UI's `createTheme` utility function and a custom `ThemeProvider` built on top of `CustomThemeProvider` that supports CSS variables. This allows for dynamic theme customization.

**Important Notes:**
- To customize colors, typography, spacing, or component styling, modify `src/components/theme/mergedTheme.ts`
- Avoid altering theme settings within the `@core` folder unless directed by support
- For creating a custom theme from scratch, see the "Creating Your Own Theme" section

### Common Customization Steps

All theme customizations follow these common steps:

1. **Update Theme Imports** (`src/components/theme/index.tsx`):

```typescript
// Replace the import
- import defaultCoreTheme from '@core/theme'
+ import mergedTheme from './mergedTheme'
```

2. **Update Theme Usage**:

```typescript
// Replace in the CustomThemeProvider
- const coreTheme = deepmerge(defaultCoreTheme(..), ...)
+ const coreTheme = deepmerge(mergedTheme(..), ...)
```

### Theme Structure

```typescript
// src/configs/theme.ts
import { createTheme } from '@mui/material/styles'

export const createCustomTheme = (config: ThemeConfig) => {
  return createTheme({
    // Theme configuration
    palette: {
      primary: {
        main: config.primaryColor,
      },
      // ... other palette options
    },
    typography: {
      fontFamily: config.fontFamily,
      // ... other typography options
    },
    // ... other theme options
  })
}
```

### Overriding Color Palette

#### How to Change Colors

**Note:** The instructions below will not change the primary color. For primary color changes, see "How to Change Primary Color".

To change template colors, modify `src/components/theme/mergedTheme.ts` and add color values to the `userTheme` object for both light and dark modes.

**Example - Changing Secondary Color:**

```typescript
const userTheme = {
  colorSchemes: {
    light: {
      palette: {
        secondary: {
          main: "#BF2761",
          light: "#FF9CF2",
          dark: "#80004E",
        },
        warning: {
         // ... other colors
        },
      },
    },
    dark: {
      palette: {
        secondary: {
          main: "#BF2761",
          light: "#FF9CF2",
          dark: "#80004E",
        },
        warning: {
         // ... other colors
        },
      },
    },
  },
} as Theme;
```

Then follow the common customization steps from the Overview section.

**Reference:** Check `src/@core/theme/colorSchemes.ts` for available colors and custom colors.

#### How to Change Primary Color

To change the primary color, modify `primaryColorConfig` in `src/configs/primaryColorConfig.ts`:

```typescript
const primaryColorConfig = [
  {
    name: 'primary-1',
    light: '#23FFD9',
    main: '#2196F3',
    dark: '#0D47A1',
  }
];
```

**Note:** Clear local storage or cookies after changing primary color and refresh the page.

#### How to Change Custom Colors

Custom colors are defined in `src/@core/theme/colorSchemes.ts`. To override them:

```typescript
colorSchemes: {
  light: {
    palette: {
      secondary: {
       // ...
      },
      customColors: {
        bodyBg: '#F8F8F1'
      }
    }
  },
  dark: {
    palette: {
      secondary: {
       // ...
      },
      customColors: {
        bodyBg: '#1E1E1E'
      }
    }
  }
}
```

Then follow the common customization steps.

#### How to Add Custom Color

To add a new custom color (e.g., `bodyColor`):

1. **Add Type Definition** (`src/components/theme/types.ts`):

```typescript
// Palette
interface Palette {
  // ...
  customColors: {
    // ...
    // New custom color
    bodyColor: string
  }
}
interface PaletteOptions {
  // ...
  customColors?: {
    // ...
    // New custom color
    bodyColor?: string
  }
}
```

2. **Add Color Values** (`src/components/theme/mergedTheme.ts`):

```typescript
colorSchemes: {
  light: {
    palette: {
      // ...
      customColors: {
        bodyColor: '#1E1E1E'
      }
    }
  },
  dark: {
    palette: {
      // ...
      customColors: {
        bodyColor: '#F8F8F1'
      }
    }
  }
}
```

Then follow the common customization steps.

### Typography

#### How to Override Typography

##### How to Change Font

The template uses Inter font by default. To change to Montserrat:

1. **Import Font** (`src/components/theme/mergedTheme.ts`):

```typescript
// Next Imports
import { Montserrat } from "next/font/google";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});
```

2. **Apply Font Family**:

```typescript
const userTheme = {
    // ...
  typography: {
    fontFamily: montserrat.style.fontFamily
  }
} as Theme;
```

Then follow the common customization steps.

##### Use Multiple Fonts

```typescript
const userTheme = {
   // ...
   typography: {
   // Only h1 will use Montserrat font, while other components will use Inter font,
     h1: {
       fontFamily: montserrat.style.fontFamily,
       fontWeight: 700,
       fontSize: '3.5rem',
       lineHeight: 1.375
     },
   }
} as Theme;
```

**Reference:** Check template typography in `src/@core/theme/typography.ts` and [MUI Typography Customization](https://mui.com/material-ui/customization/typography).

### Shadows

#### How to Override Shadows

The template uses `customShadows` throughout. Reference `src/@core/theme/customShadows.ts` and `src/@core/theme/shadows.ts` for available shadows.

##### How to Override Custom Shadows

Modify `src/components/theme/mergedTheme.ts`:

```typescript
const userTheme = {
     // ...
  customShadows: {
    xs: `0px 5px 15px rgb(var(--mui-mainColorChannels-${mode}Shadow) / ${mode === 'light' ? 0.5 : 0.6})`
  },
} as Theme;
```

Then follow the common customization steps.

### Breakpoints

#### How to Override Breakpoints

**Warning:** Breakpoints must be changed in both `tailwind.config.js` and `src/components/theme/mergedTheme.ts` to keep them in sync.

##### How to Change MUI Breakpoints

Modify `src/components/theme/mergedTheme.ts`:

```typescript
const userTheme = {
    // ...
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
      2xl: 2560,
    },
  },
} as Theme;
```

Then follow the common customization steps.

##### How to Change Tailwind Breakpoints

Update `tailwind.config.js`:

```javascript
theme: {
    // ...
    screens: {
      'sm': '600px',
      'md': '960px',
      'lg': '1280px',
      'xl': '1920px',
      '2xl': '2560px',
    },
}
```

**Reference:** [MUI Breakpoints Customization](https://mui.com/material-ui/customization/breakpoints)

### Component Styling

#### How to Override Component Styling

The theme's `components` key allows customizing components without wrapping them. You can change styles, default props, and more.

Modify `src/components/theme/mergedTheme.ts`:

```typescript
const userTheme = {
  // ...
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'uppercase'
        },
      },
    },
  },
} as Theme;
```

Then follow the common customization steps.

**Reference:** [MUI Theme Components](https://mui.com/material-ui/customization/theme-components/)

### Creating Your Own Theme

**Heads Up!** For optimal experience, we recommend using the default theme. Creating a custom theme is complex and may cause runtime errors since the entire template is tightly integrated with existing theme settings.

If you still want to create a custom theme, be aware that it may alter the intended appearance and you may need to fix issues independently.

#### Steps to Create Custom Theme

1. **Create User Theme File** (`src/components/theme/userTheme.ts`):

```typescript
const userTheme = () => {
  return {
    // Write your custom theme object here.
    colorSchemes: {
      // ...
    },
    mainColorChannels: {
      // ...
    },
    customShadows: {
      // ...
    }
  } as Theme
}
```

2. **Update Theme Imports** (`src/components/theme/index.tsx`):

```typescript
// Replace import
- import defaultCoreTheme from '@core/theme'
+ import userTheme from './userTheme'
```

3. **Update Theme Usage**:

```typescript
// Replace in CustomThemeProvider
- const coreTheme = deepmerge(defaultCoreTheme(), ...)
+ const coreTheme = deepmerge(userTheme(), ...)
```

## 🔌 Next.js API Routes

### Utilizing Next.js API Routes in Our Template

#### Introduction

Next.js API routes provide an easy way to build APIs within your Next.js application. These routes allow you to create server-side logic and API endpoints directly inside your app. For detailed information on API routes, refer to the [Next.js documentation](https://nextjs.org/docs/api-routes/introduction).

**Note:** If you are not using multiple languages in your app, you can skip the `[lang]` folder in the `src/app/[lang]/**/**` path.

#### Steps to Create an API Route

##### Setting Up the Location
API routes are located in the `src/app/api` folder. To create a new API route, create a new file within this directory.

##### Managing the Data
Data for API routes is located in the `src/fake-db` folder by default. You can use your own database and API endpoints. Refer to how you can [use your own database and API endpoints](docs/database.md) and how you can [remove the fake-db](docs/setup.md).

##### Configuring the Routing
Routes and API endpoints are managed in the `src/app/[lang]/` folder. You are encouraged to develop your API endpoints within this area.

##### Creating an Example API Route

1. **Data File**: Create at `src/fake-db/**/example/example.tsx`

```typescript
import type { ExampleType } from '@/types/**/exampleTypes'

export const db: ExampleType[] = [
  {
    userId: 1,
    id: 1,
    title: 'delectus aut autem',
    completed: false
  }
  // ...
]
```

2. **Data Type**: Define in `src/types/**/exampleTypes.tsx`

```typescript
export type ExampleType = {
  userId: number
  id: number
  title: string
  completed: boolean
}
```

3. **API Routes**: Create at `src/app/api/**/example/routes.ts`

```typescript
// Next Imports
import { NextResponse } from 'next/server'

// Data Imports
import { db } from '@/fake-db/**/example'

export async function GET() {
  return NextResponse.json(db)
}
```

4. **API Endpoints**: Define in `src/app/[lang]/**/**/example/page.tsx`

```typescript
import type { ExampleType } from '@/types/**/exampleTypes'

const getExampleData = async () => {
  // API_URL variable is defined in .env file
  const res = await fetch(`${process.env.API_URL}/**/example`)

  if (!res.ok) {
    throw new Error('Failed to fetch data')
  }

  return res.json()
}

const ComponentName = async () => {
  // Vars
  const data: ExampleType[] = await getExampleData()

  return (
    <div>
      <h1>ComponentName</h1>
      {data.map(item => (
        <div key={item.id}>
          <div>{item.title}</div>
          <div>{item.completed}</div>
        </div>
      ))}
    </div>
  )
}

export default ComponentName
```

##### Finalizing Your API Route

After completing these steps, your data is ready to be manipulated as required. Your new API route will be accessible at `http://localhost:3000/**/**/example`.

**That's it!** You have successfully created your API route. 🥳🎉

## 📱 Apps & Pages Setup

### How to Setup Pages in Your Project

#### Overview

This documentation provides a detailed guide on developing pages within our template, focusing on structure, API integration, database management, and styling. We'll use the FAQ page as a practical example.

**Warning:** When adding new pages that require dependencies not included in our package, install the necessary packages. Refer to all dependencies [here](docs/dependencies.md).

#### Server File and API Integration

##### Location and Structure

Path: Server files are located at `src/app/[lang]/(dashboard)/(private)/pages` (with i18n) or `src/app/(dashboard)/(private)/pages` (without i18n).

Example: FAQ page server file at `src/app/[lang]/(dashboard)/(private)/pages/faq/page.tsx`.

##### API Call Implementation

```typescript
const getFaqData = async () => {
  const res = await fetch(`${process.env.API_URL}/pages/faq`); // Your API URL
  if (!res.ok) {
    throw new Error('Failed to fetch faqData');
  }
  return res.json();
};

const FAQPage = async () => {
  const data = await getFaqData();
  return <FAQ data={data} />;
};

export default FAQPage
```

#### Creating APIs

##### API File Location

Path: Page APIs are created in `src/app/api/pages`.

##### Routing and Functionality

Refer to [Next.js routing conventions](https://nextjs.org/docs/app/building-your-application/routing).

Example: FAQ API at `src/app/api/pages/faq/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/fake-db/pages/faq';

export async function GET() {
  return NextResponse.json(db);
}
```

#### Using Fake Databases

##### Storing Fake Data

Path: Fake databases at `src/fake-db/pages`.

Example: FAQ data at `src/fake-db/pages/faq/index.ts`:

```typescript
import type { FaqType } from '@/types/pages/faqTypes';

export const db: FaqType[] = [
  // ...FAQ data...
];
```

For real databases, refer to [Using Real APIs](docs/database.md).

#### Component and Style Management

##### Component Location

Path: Page components at `src/views/pages`.

##### Styling Approach

Use Tailwind classes for styling. Create `styles.module.css` only when Tailwind is insufficient.

Example: FAQ styles at `src/views/pages/faq`.

### How to Setup Apps in Your Project

#### Overview

This guide covers developing applications within our template, using the Invoice app as an example.

**Warning:** Install required dependencies for new apps. Refer to dependencies [here](docs/dependencies.md).

#### Server File and API Integration

##### Location and Structure

Path: App server files at `src/app/[lang]/(dashboard)/(private)/apps` (with i18n) or `src/app/(dashboard)/(private)/apps` (without i18n).

Example: Invoice app at `src/app/[lang]/(dashboard)/(private)/apps/invoice/preview/[id]/page.tsx`.

##### API Call Implementation

```typescript
const getData = async () => {
  const res = await fetch(`${process.env.API_URL}/apps/invoice`) // Your API URL
  if (!res.ok) {
    throw new Error('Failed to fetch invoice data');
  }
  return res.json();
};

const PreviewPage = async (props: { params: Promise<{ id: string }> }) => {
  const params = await props.params;

  const data = await getData();
  const filteredData = data.filter((invoice: InvoiceType) => invoice.id === params.id)[0];

  if (!filteredData) {
    redirect('/not-found');
  }

  return <Preview invoiceData={filteredData} id={params.id} />;
};

export default PreviewPage;
```

#### Creating APIs

##### API File Location

Path: App APIs at `src/app/api/apps`.

Refer to [Next.js Routing](https://nextjs.org/docs/app/building-your-application/routing).

Example: Invoice API at `src/app/api/apps/invoice/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/fake-db/apps/invoice';

export async function GET() {
  return NextResponse.json(db);
}
```

#### Using Fake Databases

##### Storing Fake Data

Path: App fake databases at `src/fake-db/apps`.

Example: Invoice data at `src/fake-db/apps/invoice/index.ts`:

```typescript
import type { InvoiceType } from '@/types/apps/invoiceTypes';

export const db: InvoiceType[] = [
  // ...Invoice data...
];
```

For real databases, refer to [Using Real APIs](docs/database.md).

#### Component and Style Management

##### Component Location

Path: App components at `src/views/apps`.

Example: Invoice components at `src/views/apps/invoice`.

##### Styling Approach

Use Tailwind classes. Create `styles.module.css` only when needed.

Example: Invoice styles at `src/views/apps/invoice/preview`.

By following this structure, developers can seamlessly integrate apps and pages into our template, ensuring consistency and quality.

## 🎨 Layout Types

### Overview

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

## 📐 Vertical Layout Components

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

## 📏 Horizontal Layout Components

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

## 🏷️ Layout Classes

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

## 🍽️ Menu Styling

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

## 🏷️ Menu Classes

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

## 📋 Before/After Menu Content

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

## 🎯 Icons

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

## ⚙️ Customizer

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

## ⚙️ Theme Configurations

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

## 🔧 Settings Context

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

## 🔐 Authentication with NextAuth.js

### Overview

Welcome to modern authentication with NextAuth.js! This guide introduces password-less authentication and how NextAuth.js helps achieve authentication goals.

### Why NextAuth.js?

Our authentication philosophy centers on password-less authentication for enhanced security and user experience. NextAuth.js provides the robust features and flexibility needed for this vision.

### Getting Started

Authentication is implemented using NextAuth.js for secure user authentication.

**Demonstrated Methods:**

- **Credentials Provider**: Traditional username/password authentication
- **Google Provider + Prisma Adapter**: Google account sign-in with Prisma data management

### What's Next?

Explore comprehensive guides for setting up both authentication methods. Whether you prefer Credentials Provider or Google Provider with Prisma Adapter, detailed instructions are available.

Adapt these methods to your application's authentication needs.

**Happy authenticating!** 🛡️🔐

### Auth Other than NextAuth.js

If you don't want to use NextAuth.js:

- Start with the starter-kit
- Follow the [Remove Authentication from full-version](docs/setup.md) guide
- Implement custom authentication logic
- Consider alternatives like Auth0, Firebase, Amazon Cognito, Supabase

## 🔑 Credentials Provider Using NextAuth.js

### Overview

Welcome to seamless authentication with NextAuth.js Credentials Provider! This guide walks through implementation step-by-step.

### Prerequisites

Basic understanding of NextAuth.js required. Refer to [NextAuth.js documentation](https://next-auth.js.org/) for refresher.

### Initialize NextAuth.js

Next.js 13.2+ uses Route Handlers for REST-like requests in App Router.

**Route Handler** (`src/app/api/auth/[...nextauth]/route.ts`):

```typescript
// Third-party Imports
import NextAuth from 'next-auth'

// Lib Imports
import { authOptions } from '@/libs/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```

NextAuth.js detects Route Handler initialization and returns appropriate handlers.

### auth.ts file

Authentication logic implemented in `src/libs/auth.ts`. Customize according to project needs.

**Note:** All options explained below. Refer to [NextAuth documentation](https://next-auth.js.org/configuration/options) for complete list.

### Providers

Using `CredentialsProvider` for username/password authentication. Multiple providers can be configured.

**Options:**

- **`name`**: Display name on sign-in form ('Sign in with...')
- **`type`**: Provider type ('credentials')
- **`credentials`**: Define required credentials (username/password)
- **`authorize`**: Callback for credential validation. Return user object or null/false.

**Caution:** Make API call to login endpoint. Remove sensitive data from responses.

Refer to [NextAuth providers documentation](https://next-auth.js.org/configuration/providers) for more options.

### secret

Random string for hashing tokens and generating keys. Set via `NEXTAUTH_SECRET` environment variable.

Generate secret at [NextAuth documentation](https://next-auth.js.org/configuration/options#secret).

### session

- **`strategy`**: Session storage method ('jwt' or 'database')
- **`maxAge`**: Session idle timeout in seconds

Refer to [NextAuth session documentation](https://next-auth.js.org/configuration/options#session).

### pages

Custom URLs for sign-in, sign-out, and error pages.

Refer to [NextAuth pages documentation](https://next-auth.js.org/configuration/options#pages).

### callbacks

Asynchronous functions controlling authentication actions.

#### jwt()

Called when JWT created/updated. Add custom parameters here for session access.

#### session()

Called when session checked. Forward token data to client.

Refer to [NextAuth callbacks documentation](https://next-auth.js.org/configuration/options#callbacks).

### Login Form & API

#### Login Form

Use `signIn` function from `next-auth/client`. Calls login API and returns user data.

Refer to `src/views/Login.tsx` for implementation.

#### Login API

Create login API for credential authentication.

Refer to `src/app/api/login/route.ts` for implementation.

### Extending NextAuth Types for Custom User Fields

For custom user fields like `role`, extend NextAuth types.

**Create `next-auth.d.ts`**:

```typescript
import 'next-auth/jwt'
import { DefaultSession } from 'next-auth'

declare module 'next-auth/jwt' {
  type JWT = {
    role: string
  }
}

declare module 'next-auth' {
  type Session = {
    user: {
      role: string
    } & DefaultSession['user']
  }

  type User = {
    role: string
  }
}
```

**Update `src/libs/auth.ts` callbacks**:

```typescript
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.name = user.name
      token.role = user.role
    }
    return token
  },
  async session({ session, token }) {
    if (session.user) {
      session.user.name = token.name
      session.user.role = token.role
    }
    return session
  }
}
```

**Usage**:

```typescript
import { useSession } from 'next-auth/react'

const { data: session } = useSession()
const userRole = session?.user?.role || 'defaultRole'
```

**Info:** NextAuth customization (session strategy, expiration, pages, callbacks) varies by implementation and is not covered by support.

## 🔐 NextAuth with Google Provider and Prisma Adapter

### Overview

Welcome to seamless authentication with NextAuth.js Google Provider and Prisma Adapter! This guide provides step-by-step implementation.

### Prerequisites

Basic understanding of NextAuth.js, Google Cloud, and Prisma required. Refer to documentation: [NextAuth.js](https://next-auth.js.org/), [Google Cloud](https://cloud.google.com/), [Prisma](https://www.prisma.io/).

### Google Cloud Setup

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Select/create project
3. Create OAuth 2.0 credentials
4. Set authorized redirect URIs:
   - Production: `https://{YOUR_DOMAIN}/api/auth/callback/google`
   - Development: `http://localhost:3000/api/auth/callback/google`
5. Save `CLIENT_ID` and `CLIENT_SECRET` in `.env`:

```env
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_GOES_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_GOES_HERE
```

### Prisma Adapter Setup

**Caution:** Remove `@db.Text` from `prisma/schema.prisma` if using SQLite.

Follow [NextAuth PrismaAdapter documentation](https://next-auth.js.org/adapters/prisma).

**package.json configuration:**
```json
"prisma": {
  "schema": "./src/prisma/schema.prisma"
}
```

**Schema configuration** (`src/prisma/schema.prisma`):
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

**Environment** (`.env`):
```env
DATABASE_URL=file:./dev.db
```

Modify schema as needed, then run:

```bash
npx prisma generate
pnpm migrate
```

View database with:
```bash
npx prisma studio
```

### Initialize NextAuth.js

Using Route Handlers in Next.js 13.2+ App Router.

**Route Handler** (`src/app/api/auth/[...nextauth]/route.ts`):

```typescript
// Third-party Imports
import NextAuth from 'next-auth'

// Lib Imports
import { authOptions } from '@/libs/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```

### auth.ts file

Authentication logic in `src/libs/auth.ts`. Customize per project needs.

### providers

Using `GoogleProvider` for Google sign-in. Multiple providers supported.

**Options:**
- `clientId`: Google Cloud project client ID
- `clientSecret`: Google Cloud project client secret

Refer to [NextAuth providers documentation](https://next-auth.js.org/configuration/providers).

### secret

Random string for tokens/keys. Set via `NEXTAUTH_SECRET` environment variable.

### session

- **`strategy`**: Session storage ('jwt' or 'database')
- **`maxAge`**: Idle timeout in seconds

### pages

Custom authentication page URLs.

### callbacks

Control authentication actions.

#### jwt()

Called on JWT creation/update. Add custom parameters.

#### session()

Called on session check. Forward token data to client.

### Login Form

Use `signIn` from `next-auth/react`:

```typescript
'use client'

// Third-party Imports
import { signIn } from 'next-auth/react'

const Login = () => {
  return (
    <button onClick={() => signIn('google')}>Login with Google</button>
  )
}

export default Login
```

### Extending NextAuth Types for Custom User Fields

For custom fields like `role`, extend NextAuth types.

**Create `next-auth.d.ts`**:

```typescript
import 'next-auth/jwt'
import { DefaultSession } from 'next-auth'

declare module 'next-auth/jwt' {
  type JWT = {
    role: string
  }
}

declare module 'next-auth' {
  type Session = {
    user: {
      role: string
    } & DefaultSession['user']
  }

  type User = {
    role: string
  }
}
```

**Update `src/libs/auth.ts` callbacks**:

```typescript
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.name = user.name
      token.role = user.role
    }
    return token
  },
  async session({ session, token }) {
    if (session.user) {
      session.user.name = token.name
      session.user.role = token.role
    }
    return session
  }
}
```

**Usage**:

```typescript
import { useSession } from 'next-auth/react'

const { data: session } = useSession()
const userRole = session?.user?.role || 'defaultRole'
```

**Info:** NextAuth customization varies by implementation.

### Useful Links

- [Prisma (SQLite) with Next.js video](https://www.youtube.com/watch?v=KoDtEc8c-iA)
- [NextAuth with PrismaAdapter (Planetscale) video](https://www.youtube.com/watch?v=7Za4DtcSgOA)
- [NextAuth with CredentialProvider article](https://next-auth.js.org/configuration/providers/credentials)

## 🔒 Securing Page

In Next.js applications, securing routes based on authentication status is essential. This covers three route types: Public, Private, and Guest-only.

### Public Routes or Shared Routes

Public routes are accessible to all users, authenticated or not. By default, all pages in `src/app` are public.

**Example:**
```typescript
// src/app/about/page.tsx
export default function About() {
  return <h1>About Page - Accessible to everyone</h1>
}
```

Routes under `(blank-layout-pages)` are protected with `GuestOnlyRoute`. Other routes work as shared routes without `AuthGuard` or `GuestOnlyRoute`.

For shared routes with dashboard layout, create `layout.tsx` under `src/app/(dashboard)/(shared-dashboard)`, copy from `src/app/(dashboard)/(private)`, and remove `AuthGuard`.

### Private Routes

Private routes restrict access to authenticated users only. All pages within `src/app/[lang]/(dashboard)/(private)` (with i18n) or `src/app/(dashboard)/(private)` (without i18n) are private.

**Example:**
```typescript
// src/app/[lang]/(dashboard)/(private)/profile/page.tsx
export default function Profile() {
  return <h1>Profile Page - Accessible to authenticated users only</h1>
}
```

Private routes use `AuthGuard` HOC from `src/hocs` to wrap layouts.

### Guest Routes

Guest-only routes (Login, Registration, Forgot Password) are accessible only to unauthenticated users.

All pages within `src/app/[lang]/(blank-layout-pages)/(guest-only)` (with i18n) or `src/app/(blank-layout-pages)/(guest-only)` (without i18n) are guest-only.

**Example:**
```typescript
// src/app/[lang]/(blank-layout-pages)/(guest-only)/login/page.tsx
export default function Login() {
  return <h1>Login Page - Accessible to unauthenticated users only</h1>
}
```

Guest routes use `GuestGuard` HOC from `src/hocs` to wrap layouts.

This ensures secure public, private, and guest-only routes for enhanced security and user experience.

## 🗑️ Remove Authentication from full-version

**Warning:** Only for those using the full-version.

### Overview

This guide walks through removing authentication partly or completely from the full-version.

### Remove Credentials Provider from the full-version

1. **Remove CredentialProvider** from `src/libs/auth.ts`
2. **Remove** `src/app/api/login` folder
3. **Update** `handleSubmit` in `src/views/Login.tsx`:

```typescript
const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault()
}
```

4. **Remove** unused hooks and imports from `src/views/Login.tsx`

### Remove Google Provider from the full-version

1. **Remove GoogleProvider** and PrismaAdapter from `src/libs/auth.ts`:

```typescript
// Remove these imports
- import { PrismaAdapter } from '@auth/prisma-adapter'
- import { PrismaClient } from '@prisma/client'
- import type { Adapter } from 'next-auth/adapters'

// Remove these lines
- const prisma = new PrismaClient()
- adapter: PrismaAdapter(prisma) as Adapter,
```

2. **Remove** `src/prisma` folder
3. **Remove** Google sign-in button from `src/views/Login.tsx`:

```typescript
// Remove this button
<button className='block' onClick={() => signIn('google')}>
  Login with google
</button>
```

4. **Remove** environment variables from `.env`:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `DATABASE_URL`

5. **Update** `package.json` scripts:

```json
"scripts": {
  "postinstall": "npm run build:icons"
},
// Remove prisma config
```

6. **Remove dependencies**:
```bash
pnpm remove @auth/prisma-adapter @prisma/client prisma dotenv-cli
```

### Remove Authentication completely from the full-version

1. **Remove** files & folders:
   - `src/app/api/auth`
   - `src/app/api/login`
   - `src/libs/auth.ts`
   - `src/contexts/nextAuthProvider.tsx`
   - `src/prisma`
   - `src/hocs/AuthGuard.tsx`
   - `src/hocs/GuestOnlyRoute.tsx`
   - `src/components/AuthRedirect.tsx`

2. **Remove** signOut & useSession from `src/components/layout/shared/UserDropdown.tsx`

3. **Remove** signIn from `src/views/Login.tsx`

4. **Remove** NextAuthProvider from `src/components/Providers.tsx`

5. **Remove** `src/app/[lang]/(blank-layout-pages)/(guest-only)/layout.tsx`

6. **Move** files from `(guest-only)` to `(blank-layout-pages)` and remove empty directory

7. **Move** files from `(private)` to `(dashboard)` and remove empty directory

8. **Remove** environment variables:
   - `NEXTAUTH_BASEPATH`
   - `NEXTAUTH_URL`
   - `NEXTAUTH_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `DATABASE_URL`

9. **Update** `package.json`:

```json
"scripts": {
  "postinstall": "npm run build:icons"
},
// Remove prisma config
```

10. **Remove dependencies**:
```bash
pnpm remove @auth/prisma-adapter @prisma/client next-auth prisma dotenv-cli
```

## ➕ Add Authentication to Starter-kit

**Warning:** Only for those using the starter-kit.

### Overview

This guide walks through adding authentication partly or completely to your starter-kit using NextAuth.js.

### With NextAuth

#### Prerequisites

1. **Add dependency**:
```bash
pnpm install next-auth
```

2. **Add environment variables** from full-version's `.env`:
   - `BASEPATH`
   - `NEXTAUTH_BASEPATH`
   - `NEXTAUTH_URL`
   - `NEXTAUTH_SECRET`
   - `API_URL`
   - `NEXT_PUBLIC_API_URL`

3. **Copy files** from full-version:
   - `src/app/api/auth/[...nextauth]/route.ts`
   - `src/contexts/nextAuthProvider.tsx`

4. **Add NextAuthProvider** to `src/components/Providers.tsx` (from full-version)

#### Folder Structure Changes

1. **Create** `(private)` folder inside `(dashboard)` and move all dashboard content there
2. **Create** `(guest-only)` folder inside `(blank-layout-pages)` and move login/register folders there

Refer to [Securing Page guide](#securing-page) for route details.

#### Additional File Copying

**Copy files** from full-version:
- `src/hocs/AuthGuard.tsx`
- `src/components/AuthRedirect.tsx`
- `src/hocs/GuestOnlyRoute.tsx`
- `(blank-layout-pages)/(guest-only)/layout.tsx`

**Add AuthGuard** to `(dashboard)/(private)/layout.tsx` (from full-version)

#### Adjustments for Projects Without i18n

**AuthGuard.tsx**: Remove `Locale` and related code

**AuthRedirect.tsx**:
- Remove `lang` from function and related code
- Replace `getLocalizedUrl('/your-url', lang)` with `'/your-url'`

**GuestOnlyRoute.tsx**: Remove `lang` and replace `getLocalizedUrl` as above

**(guest-only)/layout.tsx**: Remove `lang` and related code

### Add Credentials Provider

For email/password authentication:

1. **Copy** `src/app/api/login` folder from full-version
2. **Copy** `src/libs/auth.ts` (remove GoogleProvider code if not needed)
3. **Copy** `src/views/Login.tsx` (remove Google sign-in code if not needed)

**Note:** Remove i18n code from `Login.tsx` if not using internationalization

### Add Google Provider with Prisma Adapter

For Google authentication:

1. **Add dependencies**:
```bash
pnpm install @auth/prisma-adapter @prisma/client prisma dotenv-cli
```

2. **Update package.json**:
```json
"scripts": {
  "migrate": "dotenv -e .env -- npx prisma migrate dev",
  "postinstall": "prisma generate && npm run build:icons"
},
"prisma": {
  "schema": "./src/prisma/schema.prisma"
}
```

3. **Add environment variables**:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `DATABASE_URL`

4. **Copy files**:
   - `src/libs/auth.ts` (remove CredentialsProvider if not needed)
   - `src/views/Login.tsx` (remove email/password code if not needed)
   - `src/prisma/schema.prisma`

5. **Run commands**:
```bash
pnpm migrate
npx prisma generate
```

**Note:** Remove i18n/validation code from `Login.tsx` if not needed

### Signing Out

Copy `signOut` import and usage from full-version's `src/components/layout/shared/UserDropdown.tsx`

### Adding User's Name and Email to User Dropdown

Copy `useSession` import and usage from full-version's `src/components/layout/shared/UserDropdown.tsx`

### Without NextAuth

Alternative authentication approaches:
- [Custom Auth Video](https://www.youtube.com/watch?v=DJvM2lSPn6w)
- [Next.js Auth Guide](https://nextjs.org/learn/dashboard-app/adding-authentication)

## 🏷️ Logo

### Customizing the Logo

Customize the logo to reflect your brand identity. The logo component is at `src/components/layout/shared/Logo.tsx`.

#### Steps:

1. **Locate the Logo component**: Navigate to `src/components/layout/shared/Logo.tsx`

2. **Prepare your logo**: Use SVG format for best scalability, or PNG/JPG for images

3. **Update the Logo Component**: Replace the existing SVG with your new logo:

```typescript
// Replace this SVG with your new logo
<svg ...>
  ...
</svg>
```

Or use an image:

```typescript
<img src="/path/to/your/logo.png" alt="Logo" />
```

4. **Customize Logo Text**: Update `templateName` in `src/configs/themeConfig.ts` or modify `LogoText`:

```typescript
<LogoText
  ...
>
  Your Company Name
</LogoText>
```

#### Logo Variations

You can create various logo combinations:

- **SVG Only**: Just the SVG element
- **Image Only**: Just the image element
- **Text Only**: Just the text element
- **SVG + Text**: SVG with accompanying text
- **Image + Text**: Image with accompanying text

Modify the SVG, text, or image elements according to your branding needs.

## 🔧 useVerticalNav Hook

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

## 📱 useHorizontalNav Hook

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

## 📐 useMediaQuery Hook

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

## ⚙️ useSettings Hook

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

**Note:** Page-specific settings may cause server/client class mismatch with MUI themes. Use CSS variables instead of theme object (e.g., `'var(--mui-palette-primary-main)'` instead of `theme.palette.primary.main`).

```typescript
'use client'

// React Imports
import { useEffect } from 'react'

// Component Imports
import { useSettings } from '@core/hooks/useSettings'

const YourComponent = () => {
  // Hooks
  const { updatePageSettings } = useSettings()

  useEffect(() => {
    return updatePageSettings({
      mode: 'dark'
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <h1>Hello World</h1>
}

export default YourComponent
```
```
```
```

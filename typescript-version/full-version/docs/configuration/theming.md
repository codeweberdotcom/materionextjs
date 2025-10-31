# Theming

## Overview

Theming is the most important aspect of any template. You can easily customize the theme of our template by changing colors, typography, spacing, and much more.

The template uses Material-UI's `createTheme` utility function and a custom `ThemeProvider` built on top of `CustomThemeProvider` that supports CSS variables. This allows for dynamic theme customization.

**Important Notes:**
- To customize colors, typography, spacing, or component styling, modify `src/components/theme/mergedTheme.ts`
- Avoid altering theme settings within the `@core` folder unless directed by support
- For creating a custom theme from scratch, see the "Creating Your Own Theme" section

## Common Customization Steps

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
// + const coreTheme = deepmerge(mergedTheme(..), ...)
```

## Theme Structure

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

## Overriding Color Palette

### How to Change Colors

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
} as Theme
```

Then follow the common customization steps from the Overview section.

**Reference:** Check `src/@core/theme/colorSchemes.ts` for available colors and custom colors.

### How to Change Primary Color

To change the primary color, modify `primaryColorConfig` in `src/configs/primaryColorConfig.ts`:

```typescript
const primaryColorConfig = [
  {
    name: 'primary-1',
    light: '#23FFD9',
    main: '#2196F3',
    dark: '#0D47A1',
  }
]
```

**Note:** Clear local storage or cookies after changing primary color and refresh the page.

### How to Change Custom Colors

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

### How to Add Custom Color

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

## Typography

### How to Override Typography

#### How to Change Font

The template uses Inter font by default. To change to Montserrat:

1. **Import Font** (`src/components/theme/mergedTheme.ts`):

```typescript
// Next Imports
import { Montserrat } from "next/font/google"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
})
```

2. **Apply Font Family**:

```typescript
const userTheme = {
    // ...
  typography: {
    fontFamily: montserrat.style.fontFamily
  }
} as Theme
```

Then follow the common customization steps.

#### Use Multiple Fonts

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
} as Theme
```

**Reference:** Check template typography in `src/@core/theme/typography.ts` and [MUI Typography Customization](https://mui.com/material-ui/customization/typography).

## Shadows

### How to Override Shadows

The template uses `customShadows` throughout. Reference `src/@core/theme/customShadows.ts` and `src/@core/theme/shadows.ts` for available shadows.

#### How to Override Custom Shadows

Modify `src/components/theme/mergedTheme.ts`:

```typescript
const userTheme = {
     // ...
   customShadows: {
     xs: `0px 5px 15px rgb(var(--mui-mainColorChannels-${mode}Shadow) / ${mode === 'light' ? 0.5 : 0.6})`
   },
} as Theme
```

Then follow the common customization steps.

## Breakpoints

### How to Override Breakpoints

**Warning:** Breakpoints must be changed in both `tailwind.config.js` and `src/components/theme/mergedTheme.ts` to keep them in sync.

#### How to Change MUI Breakpoints

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
} as Theme
```

Then follow the common customization steps.

#### How to Change Tailwind Breakpoints

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

## Component Styling

### How to Override Component Styling

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
} as Theme
```

Then follow the common customization steps.

**Reference:** [MUI Theme Components](https://mui.com/material-ui/customization/theme-components/)

## Creating Your Own Theme

**Heads Up!** For optimal experience, we recommend using the default theme. Creating a custom theme is complex and may cause runtime errors since the entire template is tightly integrated with existing theme settings.

If you still want to create a custom theme, be aware that it may alter the intended appearance and you may need to fix issues independently.

### Steps to Create Custom Theme

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
// + const coreTheme = deepmerge(userTheme(), ...)

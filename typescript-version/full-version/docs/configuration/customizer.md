# Customizer

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

## Logo

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

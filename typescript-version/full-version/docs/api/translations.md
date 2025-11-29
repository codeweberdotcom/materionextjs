# Translations System API Documentation

## 📋 Overview

The translations system provides comprehensive internationalization (i18n) support with dynamic dictionary loading, context-based translation management, and multi-language support. It uses JSON-based dictionaries with server-side rendering compatibility and client-side context management.

## 🏗️ Architecture

### Components
- **TranslationContext**: React context for dictionary state management
- **Dictionary Loading**: Dynamic JSON imports for different locales
- **Language Configuration**: Centralized language settings
- **Server-side Rendering**: Compatible with Next.js SSR
- **Type Safety**: TypeScript integration for translation keys

### Key Files
- `src/contexts/TranslationContext.tsx` - Main translation context provider
- `src/utils/getDictionary.ts` - Server-side dictionary loading utility
- `src/data/languages.json` - Supported languages configuration
- `src/data/dictionaries/` - Language-specific translation files
- `@configs/i18n.ts` - i18n configuration

## 🔌 Translation System Structure

### Language Configuration
```json
// languages.json
[
  {
    "code": "en",
    "name": "En"
  },
  {
    "code": "ru",
    "name": "Ru"
  },
  {
    "code": "fr",
    "name": "Fr"
  },
  {
    "code": "ar",
    "name": "Ar"
  }
]
```

### Dictionary Structure
```json
// dictionaries/en.json
{
  "navigation": {
    "dashboard": "Dashboard",
    "users": "Users",
    "settings": "Settings"
  },
  "forms": {
    "email": "Email",
    "password": "Password",
    "submit": "Submit"
  },
  "messages": {
    "welcome": "Welcome to our platform!",
    "error": "An error occurred"
  }
}
```

## 📡 Core Functions

### useTranslation Hook
Main hook for accessing translations in React components. **Throws an error** if used outside of `TranslationProvider`.

```typescript
const dictionary = useTranslation()

// Access translations
const dashboardTitle = dictionary?.navigation?.dashboard
const welcomeMessage = dictionary?.messages?.welcome
```

### useTranslationSafe Hook
Safe version that returns `null` instead of throwing when used outside of `TranslationProvider`. Use this in shared components that may render both inside and outside the provider.

```typescript
import { useTranslationSafe } from '@/contexts/TranslationContext'

const ModeDropdown = () => {
  const dictionary = useTranslationSafe()
  
  // Fallback labels when provider is not available
  const label = dictionary?.navigation?.light ?? 'Light'
  
  return <span>{label}</span>
}
```

**When to use which hook:**

| Hook | Use case | Behavior without provider |
|------|----------|---------------------------|
| `useTranslation` | Components inside dashboard/private routes | Throws error |
| `useTranslationSafe` | Shared components (headers, mode switchers) | Returns `null` |

### getDictionary Utility
Server-side function for loading dictionaries.

```typescript
import { getDictionary } from '@/utils/getDictionary'

export async function getServerSideProps({ locale }) {
  const dictionary = await getDictionary(locale)

  return {
    props: {
      dictionary
    }
  }
}
```

### TranslationProvider
Context provider for client-side translation state.

```typescript
import { TranslationProvider } from '@/contexts/TranslationContext'

export default function App({ Component, pageProps }) {
  return (
    <TranslationProvider dictionary={pageProps.dictionary}>
      <Component {...pageProps} />
    </TranslationProvider>
  )
}
```

## 🎯 Core Features

### 1. Dynamic Dictionary Loading
- **Server-side**: JSON imports for SSR compatibility
- **Client-side**: Context-based state management
- **Caching**: Automatic caching of loaded dictionaries
- **Fallback**: Graceful fallback to default language

### 2. Multi-language Support
- **Supported Languages**: English, Russian, French, Arabic
- **Language Switching**: Runtime language changes
- **RTL Support**: Right-to-left language support (Arabic)
- **Locale Detection**: Automatic locale detection

### 3. Translation Keys Structure
- **Nested Objects**: Hierarchical key organization
- **Dot Notation**: Access via `dictionary.section.key`
- **Optional Chaining**: Safe access with `?.` operator
- **Type Safety**: TypeScript support for translation keys

### 4. Context Integration
- **React Context**: Centralized translation state
- **Provider Pattern**: Wrap application with TranslationProvider
- **Hook-based Access**: useTranslation hook for component access
- **SSR Compatible**: Works with Next.js server-side rendering

## 🗄️ Dictionary Management

### File-based Storage
```
src/data/
├── languages.json          # Language configuration
└── dictionaries/
    ├── en.json            # English translations
    ├── ru.json            # Russian translations
    ├── fr.json            # French translations
    └── ar.json            # Arabic translations
```

### Dictionary Format
```json
{
  "section": {
    "subsection": {
      "key": "Translation value",
      "keyWithVariable": "Hello {{name}}!",
      "keyWithMultipleVars": "Welcome {{name}} to {{company}}"
    }
  }
}
```

### Language File Example (ru.json excerpt)
```json
{
  "navigation": {
    "dashboard": "Панель управления",
    "users": "Пользователи",
    "settings": "Настройки",
    "chat": "Чат",
    "logout": "Выйти"
  },
  "forms": {
    "email": "Электронная почта",
    "password": "Пароль",
    "firstName": "Имя",
    "lastName": "Фамилия",
    "submit": "Отправить"
  }
}
```

## 🔧 Usage Examples

### Basic Translation Access
```typescript
import { useTranslation } from '@/contexts/TranslationContext'

export default function Dashboard() {
  const dictionary = useTranslation()

  return (
    <div>
      <h1>{dictionary?.navigation?.dashboard}</h1>
      <p>{dictionary?.messages?.welcome}</p>
    </div>
  )
}
```

### Conditional Translations
```typescript
export default function UserStatus({ isActive }) {
  const dictionary = useTranslation()

  return (
    <span>
      {isActive
        ? dictionary?.navigation?.active
        : dictionary?.navigation?.inactive
      }
    </span>
  )
}
```

### Translations with Variables
```typescript
export default function WelcomeMessage({ userName, company }) {
  const dictionary = useTranslation()

  // For simple string interpolation, use template literals
  const message = dictionary?.messages?.welcomeUser
    ?.replace('{{name}}', userName)
    ?.replace('{{company}}', company)

  return <p>{message}</p>
}
```

### Server-side Translation Loading
```typescript
// pages/index.tsx
import { getDictionary } from '@/utils/getDictionary'

export async function getServerSideProps({ locale }) {
  const dictionary = await getDictionary(locale)

  return {
    props: {
      dictionary,
      locale
    }
  }
}

export default function Home({ dictionary }) {
  return (
    <TranslationProvider dictionary={dictionary}>
      <Dashboard />
    </TranslationProvider>
  )
}
```

### Language Switching
```typescript
import { useRouter } from 'next/router'

export default function LanguageSwitcher() {
  const router = useRouter()
  const { locale } = router

  const switchLanguage = (newLocale) => {
    router.push(router.pathname, router.asPath, { locale: newLocale })
  }

  return (
    <select
      value={locale}
      onChange={(e) => switchLanguage(e.target.value)}
    >
      <option value="en">English</option>
      <option value="ru">Русский</option>
      <option value="fr">Français</option>
      <option value="ar">العربية</option>
    </select>
  )
}
```

## 🛡️ Error Handling

### Missing Translations
```typescript
export default function SafeTranslation({ key, fallback = 'Translation missing' }) {
  const dictionary = useTranslation()

  // Safe access with fallback
  const translation = key.split('.').reduce((obj, k) => obj?.[k], dictionary) || fallback

  return <span>{translation}</span>
}
```

### Loading States
```typescript
export default function TranslationWrapper({ children }) {
  const dictionary = useTranslation()

  if (!dictionary) {
    return <div>Loading translations...</div>
  }

  return children
}
```

## 🚀 Advanced Usage

### Custom Translation Hook
```typescript
export const useTranslate = () => {
  const dictionary = useTranslation()

  const t = (key, variables = {}) => {
    const keys = key.split('.')
    let translation = keys.reduce((obj, k) => obj?.[k], dictionary)

    if (!translation) return key

    // Replace variables
    Object.entries(variables).forEach(([varKey, value]) => {
      translation = translation.replace(new RegExp(`{{${varKey}}}`, 'g'), value)
    })

    return translation
  }

  return t
}

// Usage
export default function Component() {
  const t = useTranslate()

  return (
    <div>
      <h1>{t('navigation.dashboard')}</h1>
      <p>{t('messages.welcomeUser', { name: 'John', company: 'ACME' })}</p>
    </div>
  )
}
```

### Translation Validation
```typescript
export const validateTranslations = (dictionary) => {
  const requiredKeys = [
    'navigation.dashboard',
    'forms.email',
    'messages.error'
  ]

  const missingKeys = requiredKeys.filter(key => {
    const keys = key.split('.')
    return !keys.reduce((obj, k) => obj?.[k], dictionary)
  })

  return {
    isValid: missingKeys.length === 0,
    missingKeys
  }
}
```

### Bulk Translation Loading
```typescript
export const loadAllDictionaries = async () => {
  const languages = ['en', 'ru', 'fr', 'ar']
  const dictionaries = {}

  for (const lang of languages) {
    dictionaries[lang] = await getDictionary(lang)
  }

  return dictionaries
}
```

## 🔍 Troubleshooting

### Common Issues

1. **Translation not showing**
   - Check if TranslationProvider wraps the component
   - Verify dictionary is loaded correctly
   - Check key path is correct

2. **Server-side rendering issues**
   - Ensure getDictionary is called in getServerSideProps
   - Check locale parameter is passed correctly
   - Verify dictionary files exist

3. **Language switching not working**
   - Check Next.js i18n configuration
   - Verify locale is supported in languages.json
   - Ensure dictionary file exists for the locale

4. **Missing translations**
   - Add missing keys to dictionary files
   - Check for typos in key names
   - Use fallback values for missing translations

### Debug Commands
```typescript
// Check current dictionary
console.log('Dictionary:', dictionary)

// Check specific translation
console.log('Translation:', dictionary?.navigation?.dashboard)

// Check if provider is working
const context = useContext(TranslationContext)
console.log('Context:', context)
```

## 🤖 AI Agent Integration Guide

### Core Workflow for AI Agents

1. **Translation Access**
   ```typescript
   // Get translation hook
   const dictionary = useTranslation()

   // Access nested translations
   const title = dictionary?.navigation?.dashboard
   const message = dictionary?.messages?.welcome
   ```

2. **Dynamic Translation Loading**
   ```typescript
   // Server-side loading
   const dictionary = await getDictionary(locale)

   // Client-side context
   <TranslationProvider dictionary={dictionary}>
     <App />
   </TranslationProvider>
   ```

3. **Translation Management**
   ```typescript
   // Add new translation keys
   const newTranslations = {
     navigation: {
       ...dictionary.navigation,
       newFeature: 'New Feature'
     }
   }

   // Update dictionary files
   await updateDictionaryFile(locale, newTranslations)
   ```

### Error Handling for AI Agents

- **Missing Dictionary**: Check TranslationProvider is properly configured
- **Undefined Keys**: Use optional chaining and fallback values
- **Locale Not Found**: Verify locale is in supported languages list
- **SSR Mismatch**: Ensure server and client dictionaries match

### Best Practices

- **Consistent Key Structure**: Use hierarchical keys (section.subsection.key)
- **Fallback Values**: Always provide fallback for missing translations
- **Type Safety**: Use TypeScript interfaces for dictionary structure
- **Performance**: Cache dictionaries and avoid unnecessary re-renders
- **Internationalization**: Consider cultural context for translations

## 🔢 Pluralization (Множественные формы)

Система поддерживает pluralization для языков с комплексными правилами склонения (русский, арабский, польский).

### Хук useTranslate

```typescript
import { useTranslate } from '@/hooks/useTranslate'

const { t } = useTranslate()

// Простой перевод
t('navigation.dashboard') // → "Панель управления"

// С переменными
t('messages.welcome', { name: 'Иван' }) // → "Привет, Иван!"

// С plural forms (для русского)
t('navigation.totalUsersCount', { count: 1 })  // → "Всего 1 пользователь"
t('navigation.totalUsersCount', { count: 3 })  // → "Всего 3 пользователя"
t('navigation.totalUsersCount', { count: 5 })  // → "Всего 5 пользователей"
```

### Структура plural forms

**В JSON файлах:**
```json
{
  "totalUsersCount": {
    "one": "Всего {{count}} пользователь",
    "few": "Всего {{count}} пользователя",
    "many": "Всего {{count}} пользователей"
  }
}
```

**В БД (поле value):**
```json
"{\"one\":\"{{count}} пользователь\",\"few\":\"{{count}} пользователя\",\"many\":\"{{count}} пользователей\"}"
```

### Правила для русского языка

| Число | Форма | Пример |
|-------|-------|--------|
| 1, 21, 31 | one | 1 пользователь |
| 2, 3, 4, 22, 23 | few | 2 пользователя |
| 0, 5-20, 25-30 | many | 5 пользователей |

### Файлы

- `src/utils/translations/pluralization.ts` — утилиты pluralization
- `src/hooks/useTranslate.ts` — хук с поддержкой plural forms
- `src/utils/translations/export-helper.ts` — импорт/экспорт plural forms

---

## 🔗 Связанные документы

- [Отчёт: Pluralization](../reports/testing/report-translations-pluralization-2025-01-24.md)
- [References API](./references.md)

---

*This documentation is designed for AI agents to understand and maintain the translation system functionality.*
# References System API Documentation

## 📋 Overview

The References system provides comprehensive reference data management for countries, states, cities, districts, currencies, languages, and translations. It supports hierarchical relationships between geographic entities and provides full CRUD operations with role-based access control.

## 🏗️ Architecture

### Components
- **Reference Data Management**: Hierarchical geographic data (Country → State → City → District)
- **Multi-entity Support**: Countries, states, cities, districts, currencies, languages
- **Translation Management**: Multi-language translation keys and values
- **Permission System**: Role-based access control for all operations
- **Database Integration**: Prisma ORM with PostgreSQL/SQLite

### Key Files
- `src/app/api/admin/references/` - All reference data API endpoints
- `src/prisma/schema.prisma` - Database schema for reference entities
- `src/types/` - TypeScript interfaces for reference data
- `src/views/apps/references/` - Admin UI components

## 📡 API Endpoints

### Countries

#### GET `/api/admin/references/countries`
Get all active countries with their states.

**Permissions Required:** None (for reading reference data)

**Response:**
```json
[
  {
    "id": "country-id",
    "name": "United States",
    "code": "US",
    "isActive": true,
    "states": [
      {
        "id": "state-id",
        "name": "California",
        "code": "CA",
        "countryId": "country-id"
      }
    ]
  }
]
```

#### POST `/api/admin/references/countries`
Create new country.

**Permissions Required:** `countryManagement.create`

**Request Body:**
```json
{
  "name": "New Country",
  "code": "NC",
  "states": ["state-id-1", "state-id-2"],
  "isActive": true
}
```

#### PUT `/api/admin/references/countries/{id}`
Update country.

**Permissions Required:** `countryManagement.update`

**Request Body:**
```json
{
  "name": "Updated Country",
  "code": "UC",
  "states": ["state-id-1"],
  "isActive": true
}
```

#### PATCH `/api/admin/references/countries/{id}`
Toggle country active status.

**Permissions Required:** `countryManagement.update`

#### DELETE `/api/admin/references/countries/{id}`
Delete country.

**Permissions Required:** `countryManagement.delete`

### States

#### GET `/api/admin/references/states`
Get all active states with country information.

#### POST `/api/admin/references/states`
Create new state.

**Permissions Required:** `stateManagement.create`

#### PUT `/api/admin/references/states/{id}`
Update state.

**Permissions Required:** `stateManagement.update`

#### PATCH `/api/admin/references/states/{id}`
Toggle state active status.

**Permissions Required:** `stateManagement.update`

#### DELETE `/api/admin/references/states/{id}`
Delete state.

**Permissions Required:** `stateManagement.delete`

### Cities

#### GET `/api/admin/references/cities`
Get all active cities with state and country information.

#### POST `/api/admin/references/cities`
Create new city.

**Permissions Required:** `cityManagement.create`

#### PUT `/api/admin/references/cities/{id}`
Update city.

**Permissions Required:** `cityManagement.update`

#### PATCH `/api/admin/references/cities/{id}`
Toggle city active status.

**Permissions Required:** `cityManagement.update`

#### DELETE `/api/admin/references/cities/{id}`
Delete city.

**Permissions Required:** `cityManagement.delete`

### Districts

#### GET `/api/admin/references/districts`
Get all active districts with city, state and country information.

#### POST `/api/admin/references/districts`
Create new district.

**Permissions Required:** `districtManagement.create`

#### PUT `/api/admin/references/districts/{id}`
Update district.

**Permissions Required:** `districtManagement.update`

#### PATCH `/api/admin/references/districts/{id}`
Toggle district active status.

**Permissions Required:** `districtManagement.update`

#### DELETE `/api/admin/references/districts/{id}`
Delete district.

**Permissions Required:** `districtManagement.delete`

### Currencies

#### GET `/api/admin/references/currencies`
Get all active currencies.

#### POST `/api/admin/references/currencies`
Create new currency.

**Permissions Required:** `currencyManagement.create`

#### PUT `/api/admin/references/currencies/{id}`
Update currency.

**Permissions Required:** `currencyManagement.update`

#### PATCH `/api/admin/references/currencies/{id}`
Toggle currency active status.

**Permissions Required:** `currencyManagement.update`

#### DELETE `/api/admin/references/currencies/{id}`
Delete currency.

**Permissions Required:** `currencyManagement.delete`

### Languages

#### GET `/api/admin/references/languages`
Get all active languages.

#### POST `/api/admin/references/languages`
Create new language.

**Permissions Required:** `languageManagement.create`

#### PUT `/api/admin/references/languages/{id}`
Update language.

**Permissions Required:** `languageManagement.update`

#### PATCH `/api/admin/references/languages/{id}`
Toggle language active status.

**Permissions Required:** `languageManagement.update`

#### DELETE `/api/admin/references/languages/{id}`
Delete language.

**Permissions Required:** `languageManagement.delete`

### Translations

#### GET `/api/admin/references/translations`
Get all translations with pagination and filtering.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10)
- `namespace` (string): Filter by namespace
- `key` (string): Filter by translation key
- `locale` (string): Filter by locale

#### POST `/api/admin/references/translations`
Create new translation.

**Permissions Required:** `translationManagement.create`

**Request Body:**
```json
{
  "key": "navigation.dashboard",
  "namespace": "common",
  "translations": {
    "en": "Dashboard",
    "ru": "Панель управления",
    "fr": "Tableau de bord"
  }
}
```

#### PUT `/api/admin/references/translations/{id}`
Update translation.

**Permissions Required:** `translationManagement.update`

#### DELETE `/api/admin/references/translations/{id}`
Delete translation.

**Permissions Required:** `translationManagement.delete`

#### GET `/api/admin/references/translations/export`
Export all translations as JSON.

#### POST `/api/admin/references/translations/import`
Import translations from JSON.

**Permissions Required:** `translationManagement.create`

## 🗄️ Database Schema

### Geographic Hierarchy
```prisma
model Country {
  id        String   @id @default(cuid())
  name      String   @unique
  code      String   @unique
  isActive  Boolean  @default(true)
  states    State[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model State {
  id        String   @id @default(cuid())
  name      String
  code      String
  countryId String?
  country   Country? @relation(fields: [countryId], references: [id])
  cities    City[]
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([name, countryId])
}

model City {
  id        String   @id @default(cuid())
  name      String
  code      String
  stateId   String?
  state     State?   @relation(fields: [stateId], references: [id])
  districts District[]
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([name, stateId])
}

model District {
  id        String   @id @default(cuid())
  name      String
  code      String
  cityId    String?
  city      City?    @relation(fields: [cityId], references: [id])
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([name, cityId])
}
```

### Reference Data
```prisma
model Currency {
  id        String   @id @default(cuid())
  name      String   @unique
  code      String   @unique
  symbol    String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Language {
  id        String   @id @default(cuid())
  name      String   @unique
  code      String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Translation System
```prisma
model Translation {
  id         String   @id @default(cuid())
  key        String
  namespace  String?
  en         String?
  ru         String?
  fr         String?
  ar         String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([key, namespace])
}
```

## 🎯 Core Features

### 1. Hierarchical Geographic Data
- **Country → State → City → District**: Complete geographic hierarchy
- **Relationships**: Automatic relationship management between entities
- **Validation**: Ensures data integrity across hierarchy levels

### 2. Reference Data Management
- **CRUD Operations**: Full create, read, update, delete for all entities
- **Status Management**: Active/inactive status for all reference data
- **Unique Constraints**: Prevents duplicate entries within same parent

### 3. Translation Management
- **Multi-language Support**: Support for multiple locales
- **Namespace Organization**: Group translations by feature/module
- **Import/Export**: Bulk operations for translation management

### 4. Permission System
- **Role-based Access**: Different permissions for different operations
- **Granular Control**: Separate permissions for each entity type
- **Audit Trail**: All operations are logged with user information

## 🔧 Permission System

### Permission Categories
- `countryManagement`: Countries CRUD operations
- `stateManagement`: States CRUD operations
- `cityManagement`: Cities CRUD operations
- `districtManagement`: Districts CRUD operations
- `currencyManagement`: Currencies CRUD operations
- `languageManagement`: Languages CRUD operations
- `translationManagement`: Translations CRUD operations

### Permission Actions
- `create`: Create new entities
- `read`: Read/view entities
- `update`: Update existing entities
- `delete`: Delete entities

## 🚀 Usage Examples

### Geographic Data Management
```typescript
// Create country with states
const newCountry = await fetch('/api/admin/references/countries', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'United States',
    code: 'US',
    states: [], // Can be populated later
    isActive: true
  })
})

// Get all countries with states
const countries = await fetch('/api/admin/references/countries')
const data = await countries.json()

// Update country
await fetch(`/api/admin/references/countries/${countryId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Updated Country Name',
    code: 'UCN',
    isActive: true
  })
})
```

### Translation Management
```typescript
// Create new translation
await fetch('/api/admin/references/translations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    key: 'navigation.settings',
    namespace: 'common',
    translations: {
      en: 'Settings',
      ru: 'Настройки',
      fr: 'Paramètres'
    }
  })
})

// Get translations with filtering
const translations = await fetch('/api/admin/references/translations?page=1&limit=20&namespace=common')

// Export all translations
const exportData = await fetch('/api/admin/references/translations/export')
const translationsJson = await exportData.json()
```

### Bulk Operations
```typescript
// Import translations from JSON
await fetch('/api/admin/references/translations/import', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(translationsData)
})

// Bulk status updates
const countryIds = ['id1', 'id2', 'id3']
for (const id of countryIds) {
  await fetch(`/api/admin/references/countries/${id}`, {
    method: 'PATCH'
  })
}
```

## 🤖 AI Agent Integration Guide

### Core Workflow for AI Agents

1. **Geographic Data Management**
   ```typescript
   // Load geographic hierarchy
   const countries = await fetch('/api/admin/references/countries')
   const countriesData = await countries.json()

   // Create complete geographic structure
   const createGeographicStructure = async (data) => {
     // Create country first
     const country = await createCountry(data.country)

     // Create states for the country
     for (const stateData of data.states) {
       const state = await createState({ ...stateData, countryId: country.id })

       // Create cities for each state
       for (const cityData of stateData.cities) {
         const city = await createCity({ ...cityData, stateId: state.id })

         // Create districts for each city
         for (const districtData of cityData.districts) {
           await createDistrict({ ...districtData, cityId: city.id })
         }
       }
     }
   }
   ```

2. **Reference Data Operations**
   ```typescript
   // Bulk create reference data
   const createReferenceData = async (type, data) => {
     const endpoint = `/api/admin/references/${type}`

     for (const item of data) {
       await fetch(endpoint, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(item)
       })
     }
   }

   // Update reference data
   const updateReferenceData = async (type, id, updates) => {
     await fetch(`/api/admin/references/${type}/${id}`, {
       method: 'PUT',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(updates)
     })
   }
   ```

3. **Translation Workflow**
   ```typescript
   // Manage translations
   const manageTranslations = async () => {
     // Export current translations
     const current = await fetch('/api/admin/references/translations/export')
     const translations = await current.json()

     // Add new translations
     const newTranslations = {
       'navigation.newFeature': {
         en: 'New Feature',
         ru: 'Новая функция',
         fr: 'Nouvelle fonctionnalité'
       }
     }

     // Import updated translations
     await fetch('/api/admin/references/translations/import', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ ...translations, ...newTranslations })
     })
   }
   ```

### Error Handling for AI Agents

- **403 Forbidden**: Check user permissions for the operation
- **404 Not Found**: Entity doesn't exist
- **400 Bad Request**: Invalid data or missing required fields
- **409 Conflict**: Unique constraint violation (duplicate entries)
- **500 Internal Error**: Database or server errors

### Best Practices

- **Batch Operations**: Use bulk operations for large datasets
- **Validation**: Always validate data before API calls
- **Relationships**: Maintain proper hierarchical relationships
- **Caching**: Cache reference data for performance
- **Backup**: Export translations regularly for backup

### Advanced Use Cases

```typescript
// Geographic data validation
const validateGeographicData = (data) => {
  const errors = []

  // Check country has valid code
  if (!data.country.code.match(/^[A-Z]{2}$/)) {
    errors.push('Invalid country code format')
  }

  // Check states belong to correct country
  data.states.forEach(state => {
    if (state.countryId !== data.country.id) {
      errors.push(`State ${state.name} has incorrect country reference`)
    }
  })

  return errors
}

// Translation completeness check
const checkTranslationCompleteness = async () => {
  const translations = await fetch('/api/admin/references/translations')
  const data = await translations.json()

  const locales = ['en', 'ru', 'fr', 'ar']
  const incomplete = []

  data.translations.forEach(translation => {
    const missingLocales = locales.filter(locale => !translation[locale])
    if (missingLocales.length > 0) {
      incomplete.push({
        key: translation.key,
        missing: missingLocales
      })
    }
  })

  return incomplete
}
```

---

*This documentation is designed for AI agents to understand and maintain the references system functionality.*

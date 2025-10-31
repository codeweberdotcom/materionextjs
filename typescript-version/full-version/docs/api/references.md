# References API

## 📍 Geographic Data (References)

### Countries

**GET `/api/admin/references/countries`** - Get all countries
**POST `/api/admin/references/countries`** - Create country
**GET `/api/admin/references/countries/[id]`** - Get country by ID
**PUT `/api/admin/references/countries/[id]`** - Update country
**DELETE `/api/admin/references/countries/[id]`** - Delete country

### States

**GET `/api/admin/references/states`** - Get all states
**POST `/api/admin/references/states`** - Create state
**GET `/api/admin/references/states/[id]`** - Get state by ID
**PUT `/api/admin/references/states/[id]`** - Update state
**DELETE `/api/admin/references/states/[id]`** - Delete state

### Cities

**GET `/api/admin/references/cities`** - Get all cities
**POST `/api/admin/references/cities`** - Create city
**GET `/api/admin/references/cities/[id]`** - Get city by ID
**PUT `/api/admin/references/cities/[id]`** - Update city
**DELETE `/api/admin/references/cities/[id]`** - Delete city

### Districts

**GET `/api/admin/references/districts`** - Get all districts
**POST `/api/admin/references/districts`** - Create district
**GET `/api/admin/references/districts/[id]`** - Get district by ID
**PUT `/api/admin/references/districts/[id]`** - Update district
**DELETE `/api/admin/references/districts/[id]`** - Delete district

### Languages

**GET `/api/admin/references/languages`** - Get all languages
**POST `/api/admin/references/languages`** - Create language
**GET `/api/admin/references/languages/[id]`** - Get language by ID
**PUT `/api/admin/references/languages/[id]`** - Update language
**DELETE `/api/admin/references/languages/[id]`** - Delete language

### Currencies

**GET `/api/admin/references/currencies`** - Get all currencies
**POST `/api/admin/references/currencies`** - Create currency
**GET `/api/admin/references/currencies/[id]`** - Get currency by ID
**PUT `/api/admin/references/currencies/[id]`** - Update currency
**DELETE `/api/admin/references/currencies/[id]`** - Delete currency

## 📚 Content & Translations

### GET `/api/admin/references/translations`
Get all translations.

**Response:**
```json
[
  {
    "id": "translation-id",
    "key": "navigation.dashboard",
    "language": "en",
    "value": "Dashboard",
    "namespace": "navigation"
  }
]
```

### POST `/api/admin/references/translations`
Create translation.

**Request Body:**
```json
{
  "key": "buttons.save",
  "language": "en",
  "value": "Save",
  "namespace": "common"
}
```

### POST `/api/admin/references/translations/import`
Import translations from file.

**Request Body:** FormData with translation file.

### GET `/api/admin/references/translations/export`
Export translations.

**Query Parameters:**
- `language`: Filter by language
- `namespace`: Filter by namespace

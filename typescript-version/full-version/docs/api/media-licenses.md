# Media Licenses API

Модуль управления лицензиями медиафайлов.

## 📋 Обзор

| Функция | Описание |
|---------|----------|
| License CRUD | Создание, редактирование, удаление лицензий |
| License Items | Привязка лицензий к медиафайлам |
| Documents | Загрузка документов лицензий (PDF, JPG) |

---

## 🔗 Endpoints

### Licenses

| Method | Endpoint | Описание |
|--------|----------|----------|
| `GET` | `/api/admin/media/licenses` | Список лицензий |
| `POST` | `/api/admin/media/licenses` | Создать лицензию |
| `GET` | `/api/admin/media/licenses/[id]` | Получить лицензию |
| `PUT` | `/api/admin/media/licenses/[id]` | Обновить лицензию |
| `DELETE` | `/api/admin/media/licenses/[id]` | Удалить лицензию |

### License Items

| Method | Endpoint | Описание |
|--------|----------|----------|
| `GET` | `/api/admin/media/licenses/[id]/items` | Медиа под лицензией |
| `POST` | `/api/admin/media/licenses/[id]/items` | Добавить медиа |
| `DELETE` | `/api/admin/media/licenses/[id]/items/[itemId]` | Удалить привязку |

---

## 📝 Типы лицензий

| Type | Описание |
|------|----------|
| `royalty_free` | Роялти-фри |
| `rights_managed` | Управляемые права |
| `creative_commons` | Creative Commons |
| `editorial` | Редакционная |
| `exclusive` | Эксклюзивная |
| `custom` | Кастомная |

---

## 💾 Модель данных

### MediaLicense

```prisma
model MediaLicense {
  id           String   @id @default(cuid())
  name         String
  type         String   // royalty_free, rights_managed, etc.
  description  String?
  provider     String?  // Shutterstock, Getty, etc.
  licenseCode  String?  // Код лицензии у провайдера
  purchaseDate DateTime?
  expiryDate   DateTime?
  cost         Float?
  currency     String?  @default("USD")
  documentUrl  String?  // URL документа лицензии
  metadata     String?  // JSON с доп. данными
  
  items        MediaLicenseItem[]
  
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model MediaLicenseItem {
  id        String   @id @default(cuid())
  licenseId String
  mediaId   String
  
  license   MediaLicense @relation(...)
  media     Media        @relation(...)
  
  createdAt DateTime @default(now())
}
```

---

## 📤 Примеры использования

### Создание лицензии

```typescript
// POST /api/admin/media/licenses
{
  "name": "Shutterstock Standard",
  "type": "royalty_free",
  "provider": "Shutterstock",
  "licenseCode": "SS-123456",
  "purchaseDate": "2024-01-15",
  "cost": 49.99,
  "currency": "USD"
}
```

### Привязка медиа к лицензии

```typescript
// POST /api/admin/media/licenses/[id]/items
{
  "mediaIds": ["media-1", "media-2", "media-3"]
}
```

### Загрузка документа лицензии

```typescript
// POST /api/admin/media/licenses/[id]/document
const formData = new FormData()
formData.append('document', pdfFile)

// Response
{
  "documentUrl": "/uploads/licenses/license-doc-abc123.pdf"
}
```

---

## 🔍 Фильтрация

```typescript
// GET /api/admin/media/licenses?type=royalty_free&provider=Shutterstock
{
  "licenses": [...],
  "total": 15,
  "page": 1,
  "limit": 20
}
```

---

## 🗂️ Структура файлов

```
src/services/media/
├── licenses/
│   ├── MediaLicenseService.ts   # CRUD лицензий
│   └── types.ts                 # Типы
└── ...

src/app/api/admin/media/licenses/
├── route.ts                     # GET, POST
└── [id]/
    ├── route.ts                 # GET, PUT, DELETE
    ├── items/
    │   └── route.ts             # Items CRUD
    └── document/
        └── route.ts             # Document upload
```

---

## 🔗 Связанная документация

- [Media API](./media.md)
- [Storage API](./storage.md)



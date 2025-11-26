# UI/UX Паттерны и компоненты

**Дата создания:** 2025-11-26  
**Обновлено:** 2025-11-26  
**Статус:** 🔄 Активный документ

Этот документ содержит образцы UI/UX элементов, которые являются стандартом для всего проекта.

---

## 📚 Содержание

1. [Изображения](#изображения)
2. [Модальные окна](#модальные-окна)
3. [Формы](#формы)
4. [Таблицы и сетки](#таблицы-и-сетки)
5. [Кнопки и действия](#кнопки-и-действия)
6. [Навигация](#навигация)
7. [Уведомления](#уведомления)
8. [Загрузка и состояния](#загрузка-и-состояния)
9. [Чекбоксы и выбор](#чекбоксы-и-выбор)

---

## 🖼️ Изображения

### ImageWithLightbox — Изображение с увеличением

**Компонент:** `src/components/ImageWithLightbox.tsx`

**Поведение:**
- При наведении — затемнение (35% чёрный) + белый плюс (+)
- При клике — полноэкранный Lightbox на тёмном фоне (90% чёрный)
- Кнопка закрытия (✕) в правом верхнем углу

**Использование:**

```tsx
import ImageWithLightbox from '@/components/ImageWithLightbox'

<ImageWithLightbox
  src="/uploads/avatars/photo.jpg"
  alt="Описание фото"
  width={300}
  height={200}
  objectFit="cover"
  borderRadius={8}
/>
```

**Props:**

| Prop | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `src` | `string` | — | URL изображения (обязательный) |
| `alt` | `string` | — | Альтернативный текст (обязательный) |
| `width` | `number \| string` | `'100%'` | Ширина контейнера |
| `height` | `number \| string` | `200` | Высота контейнера |
| `objectFit` | `'cover' \| 'contain' \| ...` | `'cover'` | CSS object-fit |
| `borderRadius` | `number \| string` | `1` | Скругление углов |

**Стили hover overlay:**

```tsx
// Overlay при наведении
{
  bgcolor: 'rgba(0,0,0,0.35)',
  opacity: 0,
  transition: 'opacity 0.2s ease-in-out',
  '&:hover': { opacity: 1 },
}

// Иконка плюса — белая, компактная, без подложки
<i 
  className="ri-add-line" 
  style={{ 
    fontSize: 24, 
    color: 'white',
    fontWeight: 600,  // Толще для видимости
    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
  }} 
/>
```

**Важно:** Используем `ri-add-line` (не `ri-add-fill` и не `ri-zoom-in-line`).

**Применять для:**
- Превью изображений в медиатеке
- Фотографии товаров
- Аватары пользователей (при необходимости увеличения)
- Любые изображения, которые нужно просмотреть в полном размере

---

### Боковая панель деталей (MediaDetailSidebar)

**Файл:** `src/views/admin/media/MediaDetailSidebar.tsx`

Drawer с адаптивной шириной в стиле WordPress:

```tsx
<Drawer
  anchor="right"
  open={open}
  onClose={onClose}
  PaperProps={{
    sx: {
      width: { xs: '100%', sm: 500, md: 700, lg: 900 },
      maxWidth: '100%',
    },
  }}
>
```

**Структура содержимого:**

| Секция | Компоненты |
|--------|------------|
| **Заголовок** | Название, кнопка закрытия |
| **Изображение** | Превью с overlay + Lightbox |
| **Колонки** | Инфо файла (слева) + SEO-поля (справа) |
| **Доступные размеры** | Оригинал + варианты с: Chip (имя), разрешение, иконка глаза (Lightbox), копирование URL |
| **Автор** | uploadedUser.name, uploadedUser.email |
| **Действия** | Сохранить, Скачать, На S3 (если local_only), Удалить |

**Доступные размеры изображения:**

```tsx
<div className='flex flex-col gap-2'>
  {Object.entries(urls).map(([name, url]) => (
    <div key={name} className='flex items-center gap-2'>
      <Chip label={name === 'original' ? 'Оригинал' : name} size='small' />
      <Typography variant='body2' sx={{ flexGrow: 1 }}>
        {width}×{height}
      </Typography>
      <IconButton size='small' onClick={() => openLightbox(url)}>
        <i className='ri-eye-line' />
      </IconButton>
      <IconButton size='small' onClick={() => copyUrl(url)}>
        <i className='ri-file-copy-line' />
      </IconButton>
    </div>
  ))}
</div>
```

---

## 🔲 Модальные окна

### Подтверждение удаления

Вместо браузерного `confirm()` использовать MUI `Dialog` с едиными отступами:

```tsx
<Dialog 
  open={deleteConfirmOpen} 
  onClose={() => setDeleteConfirmOpen(false)}
  maxWidth="xs"
  fullWidth
>
  <DialogTitle sx={{ px: 6, pt: 5, pb: 2 }}>
    Подтверждение удаления
  </DialogTitle>
  <DialogContent sx={{ px: 6, py: 2 }}>
    <Typography>Вы уверены, что хотите удалить этот элемент?</Typography>
  </DialogContent>
  <DialogActions sx={{ px: 6, pb: 5, pt: 2, gap: 2 }}>
    <Button fullWidth onClick={() => setDeleteConfirmOpen(false)}>
      Отмена
    </Button>
    <Button fullWidth color="error" variant="contained" onClick={handleDelete}>
      Удалить
    </Button>
  </DialogActions>
</Dialog>
```

**Стандарт отступов:**
- `px: 6` (24px) — горизонтальные
- `pt: 5` (20px) — верхний для заголовка
- `pb: 5` (20px) — нижний для кнопок
- `gap: 2` (8px) — между кнопками

### Lightbox для изображений

```tsx
<Dialog
  open={lightboxOpen}
  onClose={() => setLightboxOpen(false)}
  maxWidth={false}
  TransitionComponent={Fade}
  PaperProps={{
    sx: {
      bgcolor: 'transparent',
      boxShadow: 'none',
      maxWidth: '95vw',
      maxHeight: '95vh',
    },
  }}
  sx={{
    '& .MuiBackdrop-root': {
      bgcolor: 'rgba(0, 0, 0, 0.9)',
    },
  }}
>
  {/* Контент */}
</Dialog>
```

---

## 📝 Формы

### Поля только для чтения

```tsx
<TextField
  fullWidth
  size="small"
  value={readOnlyValue}
  InputProps={{ 
    readOnly: true,
    sx: { 
      bgcolor: 'action.disabledBackground',
      '& input': { cursor: 'default' }
    }
  }}
/>
```

### SEO-поля для медиа

Стандартный набор полей:
- **Alt текст** — описание для SEO и скринридеров
- **Заголовок (Title)** — заголовок изображения
- **Подпись (Caption)** — подпись под изображением (textarea)
- **Описание** — подробное описание (textarea)

---

## 📊 Таблицы

### Skeleton загрузки для таблиц

```tsx
{loading ? (
  [...Array(5)].map((_, idx) => (
    <TableRow key={idx}>
      <TableCell><Skeleton width={80} /></TableCell>
      <TableCell><Skeleton width={120} /></TableCell>
      {/* ... */}
    </TableRow>
  ))
) : (
  // Данные
)}
```

### Галерея изображений (CSS Grid)

Для равной ширины колонок использовать CSS Grid вместо MUI `ImageList`:

```tsx
<Box
  sx={{
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)', // 6 равных колонок
    gap: 2, // 16px
  }}
>
  {items.map((item) => (
    <Box 
      key={item.id} 
      sx={{ 
        minWidth: 0, // Важно! Позволяет контенту сжиматься
        overflow: 'hidden',
      }}
    >
      <img 
        src={item.url} 
        alt={item.alt} 
        style={{ width: '100%', height: 164, objectFit: 'cover' }}
      />
      <Typography noWrap sx={{ textOverflow: 'ellipsis' }}>
        {item.filename}
      </Typography>
    </Box>
  ))}
</Box>
```

**Важно:** `minWidth: 0` позволяет длинным именам файлов обрезаться вместо растягивания колонки.

### Режимы отображения (Grid/List toggle)

```tsx
<ToggleButtonGroup
  value={viewMode}
  exclusive
  onChange={(_, newMode) => newMode && setViewMode(newMode)}
  size="small"
  sx={{ height: 38 }} // Выравнивание по высоте с кнопками
>
  <ToggleButton value="grid" aria-label="grid view">
    <i className="ri-grid-fill" />
  </ToggleButton>
  <ToggleButton value="list" aria-label="list view">
    <i className="ri-list-check" />
  </ToggleButton>
</ToggleButtonGroup>
```

---

## 📤 Drag & Drop загрузка

### Множественная загрузка с react-dropzone

**Файл:** `src/views/admin/media/MediaLibrary.tsx`

```tsx
import { useDropzone } from 'react-dropzone'

// Конфигурация
const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
  onDrop,
  accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.svg'] },
  maxSize: 15 * 1024 * 1024, // 15MB
  multiple: true,
})

// Зона загрузки
<Box
  {...getRootProps()}
  sx={{
    border: '2px dashed',
    borderColor: isDragAccept ? 'success.main' : isDragReject ? 'error.main' : 'divider',
    borderRadius: 2,
    p: 4,
    textAlign: 'center',
    cursor: 'pointer',
    '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
  }}
>
  <input {...getInputProps()} />
  <Typography>Перетащите файлы сюда</Typography>
</Box>
```

### Прогресс загрузки с XMLHttpRequest

```tsx
interface UploadFile {
  file: File
  id: string
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  preview?: string
}

const uploadSingleFile = async (uploadFile: UploadFile) => {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', uploadFile.file)

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100)
        // Update progress state
      }
    })

    xhr.addEventListener('load', () => resolve(xhr.status < 300))
    xhr.open('POST', '/api/admin/media')
    xhr.send(formData)
  })
}
```

### Превью файлов перед загрузкой

```tsx
const preview = file.type.startsWith('image/') 
  ? URL.createObjectURL(file) 
  : undefined

// Очистка при удалении
URL.revokeObjectURL(preview)
```

---

## 🔘 Кнопки и действия

### Отступы между кнопками

Единый стандарт — `gap: 2` (8px):

```tsx
// В DialogActions
<DialogActions sx={{ px: 6, pb: 5, pt: 2, gap: 2 }}>
  <Button fullWidth onClick={onClose}>Отмена</Button>
  <Button fullWidth variant="contained" color="error">Удалить</Button>
</DialogActions>

// В группах кнопок
<Box sx={{ display: 'flex', gap: 2 }}>
  <Button>Действие 1</Button>
  <Button>Действие 2</Button>
</Box>
```

### Кнопка с индикатором загрузки

Текст остаётся видимым, спиннер как `startIcon`:

```tsx
<Button
  variant="contained"
  disabled={loading}
  startIcon={
    loading 
      ? <CircularProgress size={20} color="inherit" /> 
      : <i className="ri-upload-2-line" />
  }
>
  {loading ? 'Загрузка...' : 'Загрузить'}
</Button>
```

### Адаптивная сетка кнопок

Для мобильной адаптации — Grid с `gridTemplateColumns`:

```tsx
<Grid container sx={{ gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, display: 'grid', gap: 2 }}>
  <Button fullWidth>Сохранить</Button>
  <Button fullWidth>Скачать</Button>
  <Button fullWidth>На S3</Button>
  <Button fullWidth color="error">Удалить</Button>
</Grid>
```

---

## ☑️ Чекбоксы и выбор

### Чекбокс для тёмного/светлого фона

Чтобы чекбокс был виден и на белом, и на чёрном фоне — используем белую рамку с тенью:

```tsx
<Checkbox
  sx={{
    // Белая рамка с тенью — видна на любом фоне
    '& svg': {
      filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.8)) drop-shadow(0 0 2px rgba(255,255,255,0.8))',
    },
    '& svg path[stroke]': {
      stroke: 'rgba(255,255,255,0.95) !important',
    },
    // При выборе — стандартный цвет
    '&.Mui-checked': {
      color: 'primary.main',
    },
    '&.Mui-checked svg path[stroke]': {
      stroke: 'currentColor !important',
    },
  }}
/>
```

---

## 🔄 Загрузка и состояния

### Индикатор сканирования/синхронизации

```tsx
{isSyncing && (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
    <CircularProgress size={16} />
    <Typography variant="body2" color="primary">
      Сканирование...
    </Typography>
  </Box>
)}
```

### Skeleton для карточек

```tsx
<Skeleton variant="rectangular" height={200} sx={{ mb: 2, borderRadius: 1 }} />
<Skeleton width="60%" sx={{ mb: 1 }} />
<Skeleton width="40%" />
```

---

## 🎨 Цветовая палитра

### Статусы хранения медиа

| Статус | Цвет | Значение |
|--------|------|----------|
| `synced` | `success` (зелёный) | Синхронизировано |
| `local_only` | `warning` (жёлтый) | Только локально |
| `s3_only` | `info` (синий) | Только S3 |

### Типы лицензий

| Тип | Цвет |
|-----|------|
| `royalty_free` | `success` |
| `rights_managed` | `warning` |
| `creative_commons` | `info` |
| `editorial` | `error` |
| `exclusive` | `warning` |

---

## 📁 Структура компонентов

```
src/components/
├── ImageWithLightbox.tsx    # Изображение с Lightbox
└── ...

src/views/admin/media/
├── MediaLibrary.tsx         # Медиатека (список)
├── MediaDetailSidebar.tsx   # Боковая панель деталей
├── MediaLicenses.tsx        # Список лицензий
├── MediaLicenseForm.tsx     # Форма лицензии
└── ...
```

---

## ✅ Чек-лист для новых компонентов

- [ ] Использовать MUI компоненты
- [ ] Skeleton для состояния загрузки
- [ ] Диалог подтверждения вместо `confirm()`
- [ ] Консистентные цвета статусов
- [ ] Hover-эффекты для интерактивных элементов
- [ ] Lightbox для увеличения изображений
- [ ] Toast уведомления (react-toastify)

---

*Документ обновляется по мере добавления новых паттернов.*


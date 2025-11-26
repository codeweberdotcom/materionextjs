/**
 * Страница медиатеки
 */

import MediaLibrary from '@/views/admin/media/MediaLibrary'

export const metadata = {
  title: 'Медиатека',
  description: 'Управление медиа файлами'
}

export default function MediaPage() {
  return <MediaLibrary />
}



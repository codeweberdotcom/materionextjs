/**
 * Страница водяных знаков
 */

import MediaWatermarks from '@/views/admin/media/MediaWatermarks'

export const metadata = {
  title: 'Водяные знаки',
  description: 'Управление водяными знаками'
}

export default function MediaWatermarksPage() {
  return <MediaWatermarks />
}


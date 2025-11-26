/**
 * Страница создания/редактирования лицензии
 */

import MediaLicenseForm from '@/views/admin/media/MediaLicenseForm'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function MediaLicenseEditPage({ params }: PageProps) {
  const { id } = await params

  return <MediaLicenseForm licenseId={id} />
}


// Page Imports
import NotificationsWrapper from '@/views/apps/notifications'

type PageProps = {
  params: Promise< {
    type: string
    status?: string
  }>
}

const NotificationsTypePage = async ({ params }: PageProps) => {
  const { type, status } = await params
  return <NotificationsWrapper type={type} status={status} />
}

export default NotificationsTypePage
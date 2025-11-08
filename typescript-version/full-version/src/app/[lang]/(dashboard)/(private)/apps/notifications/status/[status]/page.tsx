// Page Imports
import NotificationsWrapper from '@/views/apps/notifications'

type PageProps = {
  params: Promise<{
    status: string
    type?: string
  }>
}

const NotificationsStatusPage = async ({ params }: PageProps) => {
  const { status, type } = await params
  return <NotificationsWrapper status={status} type={type} />
}

export default NotificationsStatusPage
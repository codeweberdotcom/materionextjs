// Page Imports
import NotificationsWrapper from '@/views/apps/notifications'
import { toNotificationStatusFilter, toNotificationTypeFilter } from '@/types/apps/notificationTypes'

type PageProps = {
  params: Promise<{
    type: string
    status?: string
  }>
}

const NotificationsTypePage = async ({ params }: PageProps) => {
  const { type, status } = await params

  return (
    <NotificationsWrapper type={toNotificationTypeFilter(type)} status={toNotificationStatusFilter(status)} />
  )
}

export default NotificationsTypePage

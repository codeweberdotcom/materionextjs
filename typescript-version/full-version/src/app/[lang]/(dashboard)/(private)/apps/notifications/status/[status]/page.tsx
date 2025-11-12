// Page Imports
import NotificationsWrapper from '@/views/apps/notifications'
import { toNotificationStatusFilter, toNotificationTypeFilter } from '@/types/apps/notificationTypes'

type PageProps = {
  params: Promise<{
    status: string
    type?: string
  }>
}

const NotificationsStatusPage = async ({ params }: PageProps) => {
  const { status, type } = await params

  return (
    <NotificationsWrapper status={toNotificationStatusFilter(status)} type={toNotificationTypeFilter(type)} />
  )
}

export default NotificationsStatusPage

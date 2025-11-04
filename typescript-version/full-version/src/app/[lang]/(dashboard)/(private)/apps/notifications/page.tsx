// Page Imports
import NotificationsWrapper from '@/views/apps/notifications'

// Util Imports
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/libs/auth'
import { checkPermission } from '@/utils/permissions'

const NotificationsPage = async () => {
  // Check permissions
  const session = await getServerSession(authOptions)
  if (!session?.user || !checkPermission(session.user as any, 'notifications', 'read')) {
    redirect('/not-authorized')
  }

  return <NotificationsWrapper />
}

export default NotificationsPage
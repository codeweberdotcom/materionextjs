// Page Imports
import NotificationsWrapper from '@/views/apps/notifications'

// Util Imports
import { requireAuth } from '@/utils/auth/auth'
import { redirect } from 'next/navigation'

import { checkPermission } from '@/utils/permissions/permissions'

const NotificationsPage = async () => {
  // Check permissions
  const { user } = await requireAuth()
  if (!user || !checkPermission(user, 'notifications', 'read')) {
    redirect('/not-authorized')
  }

  return <NotificationsWrapper />
}

export default NotificationsPage

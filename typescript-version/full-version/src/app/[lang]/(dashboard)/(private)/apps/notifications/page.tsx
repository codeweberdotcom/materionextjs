// Page Imports
import { redirect } from 'next/navigation'

import NotificationsWrapper from '@/views/apps/notifications'

// Util Imports
import { requireAuth } from '@/utils/auth/auth'

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

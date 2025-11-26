// Component Imports
import DocumentsVerification from '@views/apps/user/documents-verification'

// Utils Imports
import { requireAuth } from '@/utils/auth/auth'
import { redirect } from 'next/navigation'
import { checkPermission, isSuperadmin } from '@/utils/permissions/permissions'

const DocumentsVerificationPage = async () => {
  // Check permissions on server side
  const { user } = await requireAuth()

  if (!user) {
    redirect('/login')
  }

  if (!isSuperadmin(user) && !checkPermission(user, 'userManagement', 'read')) {
    redirect('/not-authorized')
  }

  return <DocumentsVerification />
}

export default DocumentsVerificationPage





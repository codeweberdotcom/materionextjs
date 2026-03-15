// Component Imports
import { redirect } from 'next/navigation'

import DocumentsVerification from '@views/apps/user/documents-verification'

// Utils Imports
import { requireAuth } from '@/utils/auth/auth'
import { checkPermission, isSuperadmin } from '@/utils/permissions/permissions'

interface PageProps {
  params: Promise<{ lang: string }>
}

const DocumentsVerificationPage = async ({ params }: PageProps) => {
  const { lang } = await params

  // Check permissions on server side
  const { user } = await requireAuth()

  if (!user) {
    redirect('/login')
  }

  if (!isSuperadmin(user) && !checkPermission(user, 'userManagement', 'read')) {
    redirect(`/${lang}/pages/misc/401-not-authorized`)
  }

  return <DocumentsVerification />
}

export default DocumentsVerificationPage






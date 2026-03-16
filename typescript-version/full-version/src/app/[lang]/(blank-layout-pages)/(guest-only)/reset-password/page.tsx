// Next Imports
import type { Metadata } from 'next'

// Component Imports
import ResetPassword from '@views/ResetPassword'

// Server Action Imports
import { getServerMode } from '@core/utils/serverHelpers'

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Set a new password for your account'
}

interface PageProps {
  searchParams: Promise<{ token?: string; email?: string }>
}

const ResetPasswordPage = async ({ searchParams }: PageProps) => {
  const mode = await getServerMode()
  const params = await searchParams
  const token = params.token || ''
  const email = params.email || ''

  return <ResetPassword mode={mode} token={token} email={email} />
}

export default ResetPasswordPage

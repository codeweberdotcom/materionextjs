// Component Imports
import VerifyEmail from '@views/pages/auth/VerifyEmail'

// Server Action Imports
import { getServerMode } from '@core/utils/serverHelpers'

const VerifyEmailPage = async () => {
  // Vars
  const mode = await getServerMode()

  return <VerifyEmail mode={mode} />
}

export default VerifyEmailPage


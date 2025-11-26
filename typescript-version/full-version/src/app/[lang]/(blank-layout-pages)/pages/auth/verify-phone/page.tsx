// Component Imports
import VerifyPhone from '@views/pages/auth/VerifyPhone'

// Server Action Imports
import { getServerMode } from '@core/utils/serverHelpers'

const VerifyPhonePage = async () => {
  // Vars
  const mode = await getServerMode()

  return <VerifyPhone mode={mode} />
}

export default VerifyPhonePage


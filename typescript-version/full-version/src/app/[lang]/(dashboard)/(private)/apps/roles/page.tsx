// Next Imports
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

// Component Imports
import Roles from '@views/apps/roles'

// Data Imports
import { getUserData } from '@/app/server/actions'

// Config Imports
import { authOptions } from '@/libs/auth'

// Util Imports
import { checkPermission, isSuperadmin } from '@/utils/permissions'

/**
 * ! If you need data using an API call, uncomment the below API code, update the `process.env.API_URL` variable in the
 * ! `.env` file found at root of your project and also update the API endpoints like `/apps/user-list` in below example.
 * ! Also, remove the above server action import and the action itself from the `src/app/server/actions.ts` file to clean up unused code
 * ! because we've used the server action for getting our static data.
 */

/* const getUserData = async () => {
  // Vars
  const res = await fetch(`${process.env.API_URL}/apps/user-list`)

  if (!res.ok) {
    throw new Error('Failed to fetch userData')
  }

  return res.json()
} */

const RolesApp = async () => {
  // Check permissions on server side
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  // If user is superadmin, allow access
  if (!isSuperadmin(session.user as any) && !checkPermission(session.user as any, 'roleManagement', 'read')) {
    redirect('/not-authorized')
  }

  // Vars
  const data = await getUserData()

  return <Roles userData={data} />
}

export default RolesApp

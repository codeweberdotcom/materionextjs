// Component Imports
import UserList from '@views/apps/user/list'

// Data Imports
import { getUserData } from '@/app/server/actions'

// Util Imports
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/libs/auth'
import { checkPermission } from '@/utils/permissions'

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

const UserListApp = async () => {
  // Check permissions
  const session = await getServerSession(authOptions)
  if (!session?.user || !checkPermission(session.user as any, 'userManagement', 'read')) {
    redirect('/not-authorized')
  }

  // Vars
  const data = await getUserData()

  return <UserList userData={data} />
}

export default UserListApp

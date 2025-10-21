/**
 * ! The server actions below are used to fetch the static data from the fake-db. If you're using an ORM
 * ! (Object-Relational Mapping) or a database, you can swap the code below with your own database queries.
 */

'use server'

// Data Imports
import { db as eCommerceData } from '@/fake-db/apps/ecommerce'
import { db as academyData } from '@/fake-db/apps/academy'
import { db as vehicleData } from '@/fake-db/apps/logistics'
import { db as invoiceData } from '@/fake-db/apps/invoice'
import { db as permissionData } from '@/fake-db/apps/permissions'
import { db as profileData } from '@/fake-db/pages/userProfile'
import { db as faqData } from '@/fake-db/pages/faq'
import { db as pricingData } from '@/fake-db/pages/pricing'
import { db as statisticsData } from '@/fake-db/pages/widgetExamples'

// Database Imports
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'

// Type Imports
import type { UsersType } from '@/types/apps/userTypes'

// Initialize Prisma client
import { prisma } from '@/libs/prisma'

export const getEcommerceData = async () => {
  return eCommerceData
}

export const getAcademyData = async () => {
  return academyData
}

export const getLogisticsData = async () => {
  return vehicleData
}

export const getInvoiceData = async () => {
  return invoiceData
}

export const getUserData = async (): Promise<UsersType[]> => {
  try {
    const users = await prisma.user.findMany({
      include: {
        role: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform the data to match the expected UsersType format
    return users.map((user: any) => {
      // Map database roles to expected UI roles
      let uiRole = 'subscriber' // default fallback
      switch (user.role?.name) {
        case 'admin':
          uiRole = 'admin'
          break
        case 'moderator':
          uiRole = 'maintainer'
          break
        case 'user':
          uiRole = 'subscriber'
          break
        default:
          uiRole = 'subscriber'
      }

      return {
        id: user.id, // Keep the original database ID as string
        fullName: user.name || 'Unknown User',
        company: 'N/A',
        role: uiRole,
        username: user.email.split('@')[0],
        country: 'N/A',
        contact: 'N/A',
        email: user.email,
        currentPlan: 'basic',
        status: 'active',
        avatar: user.image || '',
        avatarColor: 'primary' as const
      }
    })
  } catch (error) {
    console.error('Error fetching users:', error instanceof Error ? error.message : String(error))
    return []
  }
}

export const getUserById = async (id: string) => {
  try {
    // First check if id is a valid format
    if (!id || id.trim() === '') {
      console.error('Invalid user ID provided:', id)
      return null
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        role: true
      }
    })

    if (!user) {
      console.error('User not found with ID:', id)
      return null
    }

    // Map database roles to expected UI roles
    let uiRole = 'subscriber' // default fallback
    switch (user.role?.name) {
      case 'admin':
        uiRole = 'admin'
        break
      case 'moderator':
        uiRole = 'maintainer'
        break
      case 'user':
        uiRole = 'subscriber'
        break
      default:
        uiRole = 'subscriber'
    }

    return {
      id: user.id, // Keep the original database ID as string
      fullName: user.name || 'Unknown User',
      company: 'N/A',
      role: uiRole,
      username: user.email.split('@')[0],
      country: 'N/A',
      contact: 'N/A',
      email: user.email,
      currentPlan: 'basic',
      status: 'active',
      avatar: user.image || '',
      avatarColor: 'primary' as const
    }
  } catch (error) {
    console.error('Error fetching user by ID:', error instanceof Error ? error.message : String(error))
    return null
  }
}

export const getPermissionsData = async () => {
  return permissionData
}

export const getProfileData = async () => {
  try {
    // Get current session to identify the logged-in user
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      console.error('No authenticated user found')
      return profileData // Return fake data as fallback
    }

    // Find the current user in the database
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        role: true
      }
    })

    if (!currentUser) {
      console.error('User not found in database:', session.user.email)
      return profileData // Return fake data as fallback
    }

    // Map database roles to expected UI roles
    let uiRole = 'subscriber' // default fallback
    switch (currentUser.role?.name) {
      case 'admin':
        uiRole = 'admin'
        break
      case 'moderator':
        uiRole = 'maintainer'
        break
      case 'user':
        uiRole = 'subscriber'
        break
      default:
        uiRole = 'subscriber'
    }

    // Create user profile data with the expected structure
    const userProfileData = {
      about: [
        { property: 'Full Name', value: currentUser.name || 'Unknown User', icon: 'ri-user-3-line' },
        { property: 'Status', value: 'active', icon: 'ri-check-line' },
        { property: 'Role', value: uiRole, icon: 'ri-star-line' },
        { property: 'Country', value: 'N/A', icon: 'ri-flag-line' },
        { property: 'Language', value: 'English', icon: 'ri-translate-2' }
      ],
      contacts: [
        { property: 'Contact', value: 'N/A', icon: 'ri-phone-line' },
        { property: 'Email', value: currentUser.email, icon: 'ri-mail-open-line' }
      ],
      teams: [
        { property: 'Development Team', value: '(1 Member)' }
      ],
      overview: [
        { property: 'Task Compiled', value: '0', icon: 'ri-check-line' },
        { property: 'Connections', value: '1', icon: 'ri-user-3-line' },
        { property: 'Projects Compiled', value: '0', icon: 'ri-function-line' }
      ],
      connections: profileData.users.profile.connections,
      teamsTech: profileData.users.profile.teamsTech,
      projectTable: profileData.users.profile.projectTable
    }

    // Return the complete profile data structure
    return {
      users: {
        profile: userProfileData,
        teams: profileData.users.teams,
        projects: profileData.users.projects,
        connections: profileData.users.connections
      },
      profileHeader: {
        fullName: currentUser.name || 'Unknown User',
        location: 'N/A',
        joiningDate: new Date(currentUser.createdAt).toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }),
        designation: uiRole,
        profileImg: currentUser.image || '/images/avatars/1.png',
        designationIcon: 'ri-user-3-line',
        coverImg: '/images/pages/profile-banner.png'
      }
    }
  } catch (error) {
    console.error('Error fetching profile data:', error instanceof Error ? error.message : String(error))
    return profileData // Return fake data as fallback
  }
}

export const getFaqData = async () => {
  return faqData
}

export const getPricingData = async () => {
  return pricingData
}

export const getStatisticsData = async () => {
  return statisticsData
}

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
import { PrismaClient } from '@prisma/client'

// Type Imports
import type { UsersType } from '@/types/apps/userTypes'

const prisma = new PrismaClient()

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
    return users.map((user) => {
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
        avatar: '',
        avatarColor: 'primary' as const
      }
    })
  } catch (error) {
    console.error('Error fetching users:', error)
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
      avatar: '',
      avatarColor: 'primary' as const
    }
  } catch (error) {
    console.error('Error fetching user by ID:', error)
    return null
  }
}

export const getPermissionsData = async () => {
  return permissionData
}

export const getProfileData = async () => {
  return profileData
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

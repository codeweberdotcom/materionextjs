import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// POST - Create a new role (admin only)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // All authenticated users can view roles

    const body = await request.json()
    const { name, description, permissions } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { message: 'Role name is required' },
        { status: 400 }
      )
    }

    // Create the role
    const newRole = await prisma.role.create({
      data: {
        name,
        description,
        permissions: JSON.stringify(permissions || {})
      }
    })

    return NextResponse.json(newRole)
  } catch (error) {
    console.error('Error creating role:', error)
    if ((error as any).code === 'P2002' && (error as any).meta?.target?.includes('name')) {
      return NextResponse.json(
        { message: 'Role name already exists' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Get all roles (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // All authenticated users can create roles

    const baseRoles = ['superadmin', 'admin', 'manager', 'editor', 'moderator', 'seo', 'marketolog', 'support', 'subscriber', 'user']

    const roles = await prisma.role.findMany({
      orderBy: [
        {
          name: 'asc'
        }
      ]
    })

    // Sort roles: base roles first in the order they appear in baseRoles, then others alphabetically
    const sortedRoles = roles.sort((a, b) => {
      const aIndex = baseRoles.indexOf(a.name.toLowerCase())
      const bIndex = baseRoles.indexOf(b.name.toLowerCase())

      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex
      }
      if (aIndex !== -1 && bIndex === -1) return -1
      if (bIndex !== -1 && aIndex === -1) return 1
      return a.name.localeCompare(b.name)
    })

    // Parse permissions in new format
    const rolesWithParsedPermissions = roles.map(role => {
      console.log(`Role: ${role.name}, Permissions: ${role.permissions}`)
      if (!role.permissions) return { ...role, permissions: {} }
      try {
        const parsed = JSON.parse(role.permissions)
        // Handle legacy format: "all" means all permissions
        if (role.permissions === 'all') {
          return { ...role, permissions: 'all' }
        }
        // Handle legacy format: simple string like "read"
        if (typeof parsed === 'string') {
          return { ...role, permissions: parsed }
        }
        // New format: object like { "Users": ["Read", "Write"] }
        return { ...role, permissions: parsed }
      } catch {
        // Legacy format: "all" means all permissions
        return { ...role, permissions: role.permissions === 'all' ? 'all' : {} }
      }
    })

    return NextResponse.json(rolesWithParsedPermissions)
  } catch (error) {
    console.error('Error fetching roles:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// PUT - Update a role (admin only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { role: true }
    })

    if (!currentUser || currentUser.role?.name !== 'admin') {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params

    const body = await request.json()
    const { name, description, permissions } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { message: 'Role name is required' },
        { status: 400 }
      )
    }

    // Update the role
    const updatedRole = await prisma.role.update({
      where: { id },
      data: {
        name,
        description,
        permissions: JSON.stringify(permissions || [])
      }
    })

    return NextResponse.json(updatedRole)
  } catch (error) {
    console.error('Error updating role:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Get a single role (admin only)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { role: true }
    })

    if (!currentUser || currentUser.role?.name !== 'admin') {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params

    const role = await prisma.role.findUnique({
      where: { id }
    })

    if (!role) {
      return NextResponse.json(
        { message: 'Role not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(role)
  } catch (error) {
    console.error('Error fetching role:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a role (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { role: true }
    })

    if (!currentUser || currentUser.role?.name !== 'admin') {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params

    // Check if role is base role
    const baseRoles = ['admin', 'editor', 'moderator', 'seo', 'support', 'user']
    const role = await prisma.role.findUnique({
      where: { id },
      include: { users: true }
    })

    if (!role) {
      return NextResponse.json(
        { message: 'Role not found' },
        { status: 404 }
      )
    }

    if (baseRoles.includes(role.name.toLowerCase())) {
      return NextResponse.json(
        { message: 'Cannot delete base role' },
        { status: 400 }
      )
    }

    // Check if role has users
    if (role.users.length > 0) {
      return NextResponse.json(
        {
          message: 'Role has users assigned',
          users: role.users.map(user => ({ id: user.id, fullName: user.name, email: user.email }))
        },
        { status: 400 }
      )
    }

    // Delete the role
    await prisma.role.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Role deleted successfully' })
  } catch (error) {
    console.error('Error deleting role:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
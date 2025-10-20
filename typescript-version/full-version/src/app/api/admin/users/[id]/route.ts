import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// PUT - Update user information (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin or if they're editing their own data
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { role: true }
    })

    if (!currentUser) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    const userId = params.id

    // Allow admins to edit any user, or users to edit their own data
    const isAdmin = currentUser.role?.name === 'admin'
    const isEditingOwnData = currentUser.id === userId

    if (!isAdmin && !isEditingOwnData) {
      return NextResponse.json(
        { message: 'Access denied' },
        { status: 403 }
      )
    }
    const body = await request.json()
    const { fullName, email, role, company, contact, country, firstName, lastName } = body

    // Handle both fullName and separate firstName/lastName
    const nameToUpdate = fullName || (firstName && lastName ? `${firstName} ${lastName}`.trim() : undefined)

    // Find the user to update
    const userToUpdate = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!userToUpdate) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Map UI role to database role
    let dbRoleId = userToUpdate.roleId
    if (role) {
      const dbRole = await prisma.role.findUnique({
        where: { name: role }
      })
      if (dbRole) {
        dbRoleId = dbRole.id
      }
    }

    // Update user data
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: nameToUpdate,
        email: email,
        roleId: dbRoleId
      },
      include: {
        role: true
      }
    })

    // Map database roles to expected UI roles
    let uiRole = 'subscriber'
    switch (updatedUser.role?.name) {
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

    return NextResponse.json({
      id: updatedUser.id,
      fullName: updatedUser.name || 'Unknown User',
      email: updatedUser.email,
      role: uiRole,
      company: 'N/A',
      contact: 'N/A',
      username: updatedUser.email.split('@')[0],
      country: 'N/A',
      currentPlan: 'basic',
      status: 'active',
      avatar: updatedUser.image || '',
      avatarColor: 'primary'
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete user (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = params.id

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

    // Prevent admin from deleting themselves
    if (currentUser.id === userId) {
      return NextResponse.json(
        { message: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Find the user to delete
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!userToDelete) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Delete the user
    await prisma.user.delete({
      where: { id: userId }
    })

    return NextResponse.json({
      message: 'User deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
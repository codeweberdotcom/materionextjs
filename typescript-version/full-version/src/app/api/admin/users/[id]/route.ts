import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { PrismaClient } from '@prisma/client'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

const prisma = new PrismaClient()

// PUT - Update user information (admin only)
export async function PUT(
  request: NextRequest,
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

    const { id: userId } = await params

    // Allow admins to edit any user, or users to edit their own data
    const isAdmin = currentUser.role?.name === 'admin'
    const isEditingOwnData = currentUser.id === userId

    if (!isAdmin && !isEditingOwnData) {
      return NextResponse.json(
        { message: 'Access denied' },
        { status: 403 }
      )
    }
    const contentType = request.headers.get('content-type') || ''
    let body: any = {}

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      body = {
        fullName: formData.get('fullName') as string,
        email: formData.get('email') as string,
        role: formData.get('role') as string,
        company: formData.get('company') as string,
        contact: formData.get('contact') as string,
        country: formData.get('country') as string,
        avatar: formData.get('avatar') as File | null
      }
    } else {
      body = await request.json()
    }

    const { fullName, email, role, company, contact, country, firstName, lastName, avatar: newAvatar } = body

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

    // Use role name directly
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
    const updateData: any = {
      name: nameToUpdate,
      email: email,
      roleId: dbRoleId,
      country: body.country
    }

    if (newAvatar && newAvatar instanceof File) {
      // Ensure uploads directory exists
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true })
      }

      // Generate unique filename
      const fileExtension = path.extname(newAvatar.name) || '.jpg'
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${fileExtension}`
      const filePath = path.join(uploadsDir, fileName)

      // Save the file
      const bytes = await newAvatar.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)

      // Set the relative path for the database
      updateData.image = `/uploads/avatars/${fileName}`
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        role: true
      }
    })

    // Use database role name directly
    const uiRole = updatedUser.role?.name || 'subscriber'

    return NextResponse.json({
      id: updatedUser.id,
      fullName: updatedUser.name || 'Unknown User',
      email: updatedUser.email,
      role: uiRole,
      company: 'N/A',
      contact: 'N/A',
      username: updatedUser.email.split('@')[0],
      country: updatedUser.country,
      currentPlan: 'basic',
      status: (updatedUser.isActive ?? true) ? 'active' : 'inactive',
      isActive: updatedUser.isActive ?? true,
      avatar: updatedUser.image || '',
      avatarColor: 'primary'
    })
  } catch (error) {
    if (error) {
      console.error('Error updating user:', error)
    } else {
      console.error('Error updating user: Unknown error')
    }
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Toggle user active status (admin only)
export async function PATCH(
  request: NextRequest,
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

    const { id: userId } = await params

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

    // Find the user to toggle
    const userToToggle = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        role: {
          select: {
            name: true
          }
        }
      }
    })

    if (!userToToggle) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Prevent admin from deactivating themselves
    if (currentUser.id === userId) {
      return NextResponse.json(
        { message: 'Cannot deactivate your own account' },
        { status: 400 }
      )
    }

    // Toggle the isActive status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: !userToToggle.isActive },
      include: { role: true }
    })

    // If deactivating the user, delete their sessions
    if (!updatedUser.isActive) {
      await prisma.session.deleteMany({
        where: { userId: userId }
      })
    }

    // Use database role name directly
    const uiRole = updatedUser.role?.name || 'subscriber'

    return NextResponse.json({
      id: updatedUser.id,
      fullName: updatedUser.name || 'Unknown User',
      email: updatedUser.email,
      role: uiRole,
      company: 'N/A',
      contact: 'N/A',
      username: updatedUser.email.split('@')[0],
      country: updatedUser.country,
      currentPlan: 'basic',
      status: (updatedUser.isActive ?? true) ? 'active' : 'inactive',
      isActive: updatedUser.isActive ?? true,
      avatar: updatedUser.image || '',
      avatarColor: 'primary'
    })
  } catch (error) {
    console.error('Error toggling user status:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete user (admin only)
export async function DELETE(
  request: NextRequest,
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

    const { id: userId } = await params

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
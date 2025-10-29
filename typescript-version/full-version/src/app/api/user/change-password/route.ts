import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

import { authOptions } from '@/libs/auth'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { currentPassword, newPassword, confirmPassword } = body

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { message: 'All fields are required' },
        { status: 400 }
      )
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { message: 'New password and confirm password do not match' },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { message: 'New password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Find the current user
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.password)

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { message: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10)

    // Update user password
    await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        password: hashedNewPassword
      }
    })

    return NextResponse.json({
      message: 'Password changed successfully'
    })
  } catch (error) {
    console.error('Error changing password:', error instanceof Error ? error.message : String(error))
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
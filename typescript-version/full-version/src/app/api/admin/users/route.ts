import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { PrismaClient } from '@prisma/client'
import { writeFile } from 'fs/promises'
import path from 'path'

const prisma = new PrismaClient()

// POST - Create new user (admin only)
export async function POST(request: NextRequest) {
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

    const formData = await request.formData()
    const fullName = formData.get('fullName') as string
    const username = formData.get('username') as string
    const email = formData.get('email') as string
    const role = formData.get('role') as string
    const plan = formData.get('plan') as string
    const status = formData.get('status') as string
    const company = formData.get('company') as string
    const country = formData.get('country') as string
    const contact = formData.get('contact') as string
    const avatar = formData.get('avatar') as File | null

    // Find the role by name
    const dbRole = await prisma.role.findUnique({
      where: { name: role }
    })

    if (!dbRole) {
      return NextResponse.json(
        { message: 'Invalid role' },
        { status: 400 }
      )
    }

    // Map status to isActive
    const isActive = status === 'active'

    // Create the user
    let imagePath = null
    if (avatar) {
      // Save the file to public/images/avatars
      const bytes = await avatar.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const avatarPath = path.join(process.cwd(), 'public', 'images', 'avatars', avatar.name)
      await writeFile(avatarPath, buffer)
      imagePath = `/images/avatars/${avatar.name}`
    }

    const newUser = await prisma.user.create({
      data: {
        name: fullName,
        email: email,
        password: 'password123', // Default password, should be hashed or handled properly
        roleId: dbRole.id,
        country: country,
        isActive: isActive,
        image: imagePath
      },
      include: {
        role: true
      }
    })

    // Transform to match UsersType format
    const transformedUser = {
      id: newUser.id,
      fullName: newUser.name || 'Unknown User',
      company: 'N/A',
      role: newUser.role?.name || 'subscriber',
      username: newUser.email.split('@')[0],
      country: newUser.country,
      contact: 'N/A',
      email: newUser.email,
      currentPlan: 'basic',
      status: (newUser.isActive ?? true) ? 'active' : 'inactive',
      isActive: newUser.isActive ?? true,
      avatar: newUser.image || '',
      avatarColor: 'primary' as const
    }

    return NextResponse.json(transformedUser)
  } catch (error) {
    console.error('Error creating user:', error || 'Unknown error')
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Get all users (admin only)
export async function GET() {
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

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: {
          select: {
            name: true
          }
        },
        country: true,
        image: true,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform the data to match the expected UsersType format
    const transformedUsers = users.map((user) => {
      return {
        id: user.id,
        fullName: user.name || 'Unknown User',
        company: 'N/A',
        role: user.role?.name || 'subscriber',
        username: user.email.split('@')[0],
        country: user.country,
        contact: 'N/A',
        email: user.email,
        currentPlan: 'basic',
        status: (user.isActive ?? true) ? 'active' : 'inactive',
        isActive: user.isActive ?? true,
        avatar: user.image || '',
        avatarColor: 'primary' as const
      }
    })

    return NextResponse.json(transformedUsers)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
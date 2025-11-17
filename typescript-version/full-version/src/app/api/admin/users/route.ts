import { writeFile } from 'fs/promises'

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'

import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'
import { checkPermission } from '@/utils/permissions/permissions'
import { getOnlineUsers } from '@/lib/sockets/namespaces/chat'

// Кеш для пользователей (простая in-memory кеш)
let usersCache: any[] | null = null
let usersCacheTimestamp: number = 0
const USERS_CACHE_DURATION = 30 * 1000 // 30 секунд для тестирования

// POST - Create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check permission for creating users
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || !checkPermission(currentUser, 'Users', 'Create')) {
      return NextResponse.json(
        { message: 'Permission denied: Create Users required' },
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

    // Очищаем кеш после создания нового пользователя
    usersCache = null
    usersCacheTimestamp = 0

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
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const clearCache = url.searchParams.get('clearCache')

    // Если запрос на очистку кеша
    if (clearCache === 'true') {
      usersCache = null
      usersCacheTimestamp = 0
      return NextResponse.json({ message: 'Cache cleared' })
    }

    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check permission for reading users
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || !checkPermission(currentUser, 'userManagement', 'read')) {
      return NextResponse.json(
        { message: 'Permission denied: Read Users required' },
        { status: 403 }
      )
    }

    // Проверяем кеш
    const now = Date.now()
    if (usersCache && (now - usersCacheTimestamp) < USERS_CACHE_DURATION) {
      return NextResponse.json(usersCache)
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
        isActive: true,
        lastSeen: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Получаем статусы онлайн пользователей
    const { getOnlineUsers } = await import('@/lib/sockets/namespaces/chat')
    const userStatuses = await getOnlineUsers()

    // Transform the data to match the expected UsersType format
    const transformedUsers = users.map((user: any) => {
      const userStatus = userStatuses[user.id] || { isOnline: false, lastSeen: undefined }

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
        avatarColor: 'primary' as const,
        isOnline: userStatus.isOnline,
        lastSeen: userStatus.lastSeen
      }
    })

    // Сохраняем в кеш
    usersCache = transformedUsers
    usersCacheTimestamp = now
    return NextResponse.json(transformedUsers)
  } catch (error) {
    console.error('Error fetching users:', error)

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}



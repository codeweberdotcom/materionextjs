import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth'

import { prisma } from '@/libs/prisma'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get notifications for the current user (exclude archived)
    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        status: {
          not: 'archived' // Don't show archived notifications in dropdown
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limit to 50 most recent notifications
    })

    // Transform to match the expected format
    const transformedNotifications = notifications.map(notification => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type as any,
      status: notification.status as any,
      createdAt: notification.createdAt.toISOString(),
      updatedAt: notification.updatedAt.toISOString(),
      userId: notification.userId,
      subtitle: notification.message, // For backward compatibility with dropdown
      time: new Date(notification.createdAt).toLocaleString(), // For backward compatibility with dropdown
      read: notification.status === 'read', // For backward compatibility with dropdown
      avatarImage: notification.avatarImage || undefined,
      avatarIcon: notification.avatarIcon || undefined,
      avatarText: notification.avatarText || undefined,
      avatarColor: notification.avatarColor as any || undefined,
      avatarSkin: notification.avatarSkin as any || undefined,
    }))

    return NextResponse.json({
      notifications: transformedNotifications,
      total: notifications.length,
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, message, type, avatarImage, avatarIcon, avatarText, avatarColor, avatarSkin } = body

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 })
    }

    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        title,
        message,
        type: type || 'system',
        status: 'unread',
        avatarImage,
        avatarIcon,
        avatarText,
        avatarColor,
        avatarSkin,
      },
    })

    // Emit real-time notification via WebSocket
    // This would be handled by the WebSocket server

    return NextResponse.json({
      notification: {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type as any,
        status: notification.status as any,
        createdAt: notification.createdAt.toISOString(),
        updatedAt: notification.updatedAt.toISOString(),
        userId: notification.userId,
        subtitle: notification.message, // For backward compatibility with dropdown
        time: new Date(notification.createdAt).toLocaleString(), // For backward compatibility with dropdown
        read: notification.status === 'read', // For backward compatibility with dropdown
        avatarImage: notification.avatarImage || undefined,
        avatarIcon: notification.avatarIcon || undefined,
        avatarText: notification.avatarText || undefined,
        avatarColor: notification.avatarColor as any || undefined,
        avatarSkin: notification.avatarSkin as any || undefined,
      },
    })
  } catch (error) {
    console.error('Error creating notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
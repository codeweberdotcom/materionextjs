
import { writeFile, mkdir } from 'fs/promises'

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'

import { existsSync } from 'fs'

import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'
import { avatarFileSchema, formatZodError } from '@/lib/validations/user-schemas'

// POST - Upload avatar for current user
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('avatar') as File

    if (!file || file.size === 0) {
      return NextResponse.json(
        { message: 'No file provided' },
        { status: 400 }
      )
    }

    // Валидация файла через Zod
    const validationResult = avatarFileSchema.safeParse(file)
    if (!validationResult.success) {
      return NextResponse.json(
        { message: formatZodError(validationResult.error) },
        { status: 400 }
      )
    }

    // Persist file to disk for consistent storage
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const extension = path.extname(file.name) || '.jpg'
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`
    const absolutePath = path.join(uploadsDir, fileName)

    await writeFile(absolutePath, buffer)
    const relativePath = `/uploads/avatars/${fileName}`

    // Find the current user
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email }
    })

    if (!currentUser) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Update user avatar
    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        image: relativePath
      },
      include: {
        role: true
      }
    })

    return NextResponse.json({
      message: 'Avatar uploaded successfully',
      avatarUrl: relativePath
    })
  } catch (error) {
    console.error('Error uploading avatar:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { image: null }
    })

    return NextResponse.json({
      message: 'Avatar removed'
    })
  } catch (error) {
    console.error('Error removing avatar:', error)

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}



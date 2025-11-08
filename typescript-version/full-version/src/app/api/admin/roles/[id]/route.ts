
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRole } from '@/utils/permissions/permissions'

import { PrismaClient } from '@prisma/client'


import { checkPermission, isSuperadmin } from '@/utils/permissions/permissions'

const prisma = new PrismaClient()

// PUT - Update a role (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check permission for editing roles (skip for superadmin)
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || (!isSuperadmin(currentUser) && !checkPermission(currentUser, 'roleManagement', 'update'))) {
      return NextResponse.json(
        { message: 'Permission denied: Edit Roles required' },
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

    // All role properties can be updated
    const updateData: any = {
      name,
      description,
      permissions: JSON.stringify(permissions || {})
    }

    // Update the role
    const updatedRole = await prisma.role.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(updatedRole)
  } catch (error) {
    console.error('Error updating role:', error)

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

// GET - Get a single role (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check permission for reading roles (skip for superadmin)
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || (!isSuperadmin(currentUser) && !checkPermission(currentUser, 'roleManagement', 'read'))) {
      return NextResponse.json(
        { message: 'Permission denied: Read Roles required' },
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check permission for deleting roles (skip for superadmin)
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || (!isSuperadmin(currentUser) && !checkPermission(currentUser, 'roleManagement', 'delete'))) {
      return NextResponse.json(
        { message: 'Permission denied: Delete Roles required' },
        { status: 403 }
      )
    }

    const { id } = await params

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

    // Define protected roles that cannot be deleted
    const protectedRoles = ['superadmin', 'subscriber', 'admin', 'user', 'moderator', 'seo', 'editor', 'marketolog', 'support', 'manager']

    // Check if role is protected
    if (protectedRoles.includes(role.name.toLowerCase())) {
      return NextResponse.json(
        { message: 'This role cannot be deleted as it is a system role' },
        { status: 403 }
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

    // Очищаем кеш после удаления роли
    // Используем простой HTTP запрос для очистки кеша
    try {
      await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/roles?clearCache=true`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    } catch (e) {
      // Игнорируем ошибки очистки кеша
    }

    return NextResponse.json({ message: 'Role deleted successfully' })
  } catch (error) {
    console.error('Error deleting role:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

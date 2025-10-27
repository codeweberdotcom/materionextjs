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

    // All authenticated users can delete roles

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

    // All authenticated users can update roles

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

    // All authenticated users can view individual roles

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
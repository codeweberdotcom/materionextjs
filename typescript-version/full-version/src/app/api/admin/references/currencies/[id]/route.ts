import { NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { withApiHandler } from '@/lib/api'

// PATCH - Toggle currency status (admin only)
export const PATCH = withApiHandler({
  handler: async ({ user, params }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const currencyId = params.id

    const currentCurrency = await prisma.currency.findUnique({ where: { id: currencyId } })

    if (!currentCurrency) {
      return NextResponse.json(
        { message: 'Currency not found' },
        { status: 404 }
      )
    }

    const updatedCurrency = await prisma.currency.update({
      where: { id: currencyId },
      data: { isActive: !currentCurrency.isActive }
    })

    return NextResponse.json(updatedCurrency)
  }
})

// PUT - Update currency (admin only)
export const PUT = withApiHandler({
  handler: async ({ user, request, params }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const currencyId = params.id
    const body = await request.json()
    const { name, code, symbol, isActive } = body

    if (!name || !code || !symbol) {
      return NextResponse.json(
        { message: 'Name, code, and symbol are required' },
        { status: 400 }
      )
    }

    try {
      const updatedCurrency = await prisma.currency.update({
        where: { id: currencyId },
        data: { name, code, symbol, isActive }
      })

      return NextResponse.json(updatedCurrency)
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { message: 'Currency not found' },
          { status: 404 }
        )
      }

      throw error
    }
  }
})

// DELETE - Delete currency (admin only)
export const DELETE = withApiHandler({
  handler: async ({ user, params }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const currencyId = params.id

    try {
      const deletedCurrency = await prisma.currency.delete({ where: { id: currencyId } })

      return NextResponse.json({
        message: 'Currency deleted successfully',
        deletedCurrency
      })
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { message: 'Currency not found' },
          { status: 404 }
        )
      }

      throw error
    }
  }
})

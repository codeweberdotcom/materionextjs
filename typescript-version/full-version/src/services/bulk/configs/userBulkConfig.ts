/**
 * Конфигурация bulk операций для пользователей
 */

import { prisma } from '@/libs/prisma'
import type { BulkOperationConfig, BulkOperationContext } from '../types'
import type { Prisma } from '@prisma/client'

/**
 * Конфигурация для bulk активации пользователей
 */
export const userBulkActivateConfig: BulkOperationConfig = {
  modelName: 'user',
  idField: 'id',
  
  options: {
    permissionModule: 'userManagement',
    permissionAction: 'update',
    
    filterIds: async (ids: string[], context: BulkOperationContext) => {
      // Получаем пользователей с их ролями
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          role: { select: { name: true } }
        }
      })
      
      // Исключаем superadmin
      return users
        .filter(u => u.role?.code !== 'SUPERADMIN')
        .map(u => u.id)
    },
    
    eventConfig: {
      source: 'user_management',
      module: 'users',
      type: 'user_management.bulk_activate',
      successType: 'user_management.bulk_status_change_success',
      getMessage: (count) => `Bulk activate completed: ${count} users`
    },
    
    cacheClearUrl: '/api/admin/users'
  },
  
  getRecords: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        role: { select: { name: true } }
      }
    })
  },
  
  updateOperation: async (ids: string[], data: Record<string, unknown>, tx: Prisma.TransactionClient) => {
    return tx.user.updateMany({
      where: { id: { in: ids } },
      data: { isActive: true }
    })
  }
}

/**
 * Конфигурация для bulk деактивации пользователей
 */
export const userBulkDeactivateConfig: BulkOperationConfig = {
  modelName: 'user',
  idField: 'id',
  
  options: {
    permissionModule: 'userManagement',
    permissionAction: 'update',
    
    filterIds: async (ids: string[], context: BulkOperationContext) => {
      // Получаем пользователей с их ролями
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          role: { select: { name: true } }
        }
      })
      
      // Исключаем superadmin и текущего пользователя
      return users
        .filter(u => {
          if (u.role?.code === 'SUPERADMIN') return false
          if (u.id === context.currentUser.id) return false
          return true
        })
        .map(u => u.id)
    },
    
    beforeOperation: async (tx: Prisma.TransactionClient, ids: string[], context: BulkOperationContext) => {
      // Удаляем сессии при деактивации
      await tx.session.deleteMany({
        where: { userId: { in: ids } }
      })
    },
    
    eventConfig: {
      source: 'user_management',
      module: 'users',
      type: 'user_management.bulk_deactivate',
      successType: 'user_management.bulk_status_change_success',
      getMessage: (count) => `Bulk deactivate completed: ${count} users`
    },
    
    cacheClearUrl: '/api/admin/users'
  },
  
  getRecords: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        role: { select: { name: true } }
      }
    })
  },
  
  updateOperation: async (ids: string[], data: Record<string, unknown>, tx: Prisma.TransactionClient) => {
    return tx.user.updateMany({
      where: { id: { in: ids } },
      data: { isActive: false }
    })
  }
}

/**
 * Конфигурация для bulk удаления пользователей
 */
export const userBulkDeleteConfig: BulkOperationConfig = {
  modelName: 'user',
  idField: 'id',
  
  options: {
    permissionModule: 'userManagement',
    permissionAction: 'delete',
    
    filterIds: async (ids: string[], context: BulkOperationContext) => {
      // Получаем пользователей с их ролями
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          role: { select: { name: true } }
        }
      })
      
      // Исключаем superadmin и текущего пользователя
      return users
        .filter(u => {
          if (u.role?.code === 'SUPERADMIN') return false
          if (u.id === context.currentUser.id) return false
          return true
        })
        .map(u => u.id)
    },
    
    eventConfig: {
      source: 'user_management',
      module: 'users',
      type: 'user_management.bulk_delete',
      successType: 'user_management.bulk_delete_success',
      getMessage: (count) => `Bulk delete completed: ${count} users`
    },
    
    cacheClearUrl: '/api/admin/users'
  },
  
  getRecords: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        role: { select: { name: true } }
      }
    })
  },
  
  deleteOperation: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.user.deleteMany({
      where: { id: { in: ids } }
    })
  }
}


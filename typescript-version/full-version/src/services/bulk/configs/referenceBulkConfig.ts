/**
 * Конфигурация bulk операций для справочников (Country, State, City, District)
 */

import { prisma } from '@/libs/prisma'
import type { BulkOperationConfig } from '../types'
import type { Prisma } from '@prisma/client'

// ==================== COUNTRY ====================

export const countryBulkActivateConfig: BulkOperationConfig = {
  modelName: 'country',
  idField: 'id',
  options: {
    permissionModule: 'countryManagement',
    permissionAction: 'update',
    eventConfig: {
      source: 'references',
      module: 'countries',
      type: 'references.bulk_activate',
      successType: 'references.bulk_activate_success',
      getMessage: (count) => `Bulk activate completed: ${count} countries`
    }
  },
  getRecords: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.country.findMany({ where: { id: { in: ids } }, select: { id: true } })
  },
  updateOperation: async (ids: string[], _data: Record<string, unknown>, tx: Prisma.TransactionClient) => {
    return tx.country.updateMany({ where: { id: { in: ids } }, data: { isActive: true } })
  }
}

export const countryBulkDeactivateConfig: BulkOperationConfig = {
  modelName: 'country',
  idField: 'id',
  options: {
    permissionModule: 'countryManagement',
    permissionAction: 'update',
    eventConfig: {
      source: 'references',
      module: 'countries',
      type: 'references.bulk_deactivate',
      successType: 'references.bulk_deactivate_success',
      getMessage: (count) => `Bulk deactivate completed: ${count} countries`
    }
  },
  getRecords: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.country.findMany({ where: { id: { in: ids } }, select: { id: true } })
  },
  updateOperation: async (ids: string[], _data: Record<string, unknown>, tx: Prisma.TransactionClient) => {
    return tx.country.updateMany({ where: { id: { in: ids } }, data: { isActive: false } })
  }
}

export const countryBulkDeleteConfig: BulkOperationConfig = {
  modelName: 'country',
  idField: 'id',
  options: {
    permissionModule: 'countryManagement',
    permissionAction: 'delete',
    eventConfig: {
      source: 'references',
      module: 'countries',
      type: 'references.bulk_delete',
      successType: 'references.bulk_delete_success',
      getMessage: (count) => `Bulk delete completed: ${count} countries`
    }
  },
  getRecords: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.country.findMany({ where: { id: { in: ids } }, select: { id: true } })
  },
  deleteOperation: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.country.deleteMany({ where: { id: { in: ids } } })
  }
}

// ==================== STATE ====================

export const stateBulkActivateConfig: BulkOperationConfig = {
  modelName: 'state',
  idField: 'id',
  options: {
    permissionModule: 'stateManagement',
    permissionAction: 'update',
    eventConfig: {
      source: 'references',
      module: 'states',
      type: 'references.bulk_activate',
      successType: 'references.bulk_activate_success',
      getMessage: (count) => `Bulk activate completed: ${count} states`
    }
  },
  getRecords: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.state.findMany({ where: { id: { in: ids } }, select: { id: true } })
  },
  updateOperation: async (ids: string[], _data: Record<string, unknown>, tx: Prisma.TransactionClient) => {
    return tx.state.updateMany({ where: { id: { in: ids } }, data: { isActive: true } })
  }
}

export const stateBulkDeactivateConfig: BulkOperationConfig = {
  modelName: 'state',
  idField: 'id',
  options: {
    permissionModule: 'stateManagement',
    permissionAction: 'update',
    eventConfig: {
      source: 'references',
      module: 'states',
      type: 'references.bulk_deactivate',
      successType: 'references.bulk_deactivate_success',
      getMessage: (count) => `Bulk deactivate completed: ${count} states`
    }
  },
  getRecords: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.state.findMany({ where: { id: { in: ids } }, select: { id: true } })
  },
  updateOperation: async (ids: string[], _data: Record<string, unknown>, tx: Prisma.TransactionClient) => {
    return tx.state.updateMany({ where: { id: { in: ids } }, data: { isActive: false } })
  }
}

export const stateBulkDeleteConfig: BulkOperationConfig = {
  modelName: 'state',
  idField: 'id',
  options: {
    permissionModule: 'stateManagement',
    permissionAction: 'delete',
    eventConfig: {
      source: 'references',
      module: 'states',
      type: 'references.bulk_delete',
      successType: 'references.bulk_delete_success',
      getMessage: (count) => `Bulk delete completed: ${count} states`
    }
  },
  getRecords: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.state.findMany({ where: { id: { in: ids } }, select: { id: true } })
  },
  deleteOperation: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.state.deleteMany({ where: { id: { in: ids } } })
  }
}

// ==================== CITY ====================

export const cityBulkActivateConfig: BulkOperationConfig = {
  modelName: 'city',
  idField: 'id',
  options: {
    permissionModule: 'cityManagement',
    permissionAction: 'update',
    eventConfig: {
      source: 'references',
      module: 'cities',
      type: 'references.bulk_activate',
      successType: 'references.bulk_activate_success',
      getMessage: (count) => `Bulk activate completed: ${count} cities`
    }
  },
  getRecords: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.city.findMany({ where: { id: { in: ids } }, select: { id: true } })
  },
  updateOperation: async (ids: string[], _data: Record<string, unknown>, tx: Prisma.TransactionClient) => {
    return tx.city.updateMany({ where: { id: { in: ids } }, data: { isActive: true } })
  }
}

export const cityBulkDeactivateConfig: BulkOperationConfig = {
  modelName: 'city',
  idField: 'id',
  options: {
    permissionModule: 'cityManagement',
    permissionAction: 'update',
    eventConfig: {
      source: 'references',
      module: 'cities',
      type: 'references.bulk_deactivate',
      successType: 'references.bulk_deactivate_success',
      getMessage: (count) => `Bulk deactivate completed: ${count} cities`
    }
  },
  getRecords: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.city.findMany({ where: { id: { in: ids } }, select: { id: true } })
  },
  updateOperation: async (ids: string[], _data: Record<string, unknown>, tx: Prisma.TransactionClient) => {
    return tx.city.updateMany({ where: { id: { in: ids } }, data: { isActive: false } })
  }
}

export const cityBulkDeleteConfig: BulkOperationConfig = {
  modelName: 'city',
  idField: 'id',
  options: {
    permissionModule: 'cityManagement',
    permissionAction: 'delete',
    eventConfig: {
      source: 'references',
      module: 'cities',
      type: 'references.bulk_delete',
      successType: 'references.bulk_delete_success',
      getMessage: (count) => `Bulk delete completed: ${count} cities`
    }
  },
  getRecords: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.city.findMany({ where: { id: { in: ids } }, select: { id: true } })
  },
  deleteOperation: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.city.deleteMany({ where: { id: { in: ids } } })
  }
}

// ==================== DISTRICT ====================

export const districtBulkActivateConfig: BulkOperationConfig = {
  modelName: 'district',
  idField: 'id',
  options: {
    permissionModule: 'districtManagement',
    permissionAction: 'update',
    eventConfig: {
      source: 'references',
      module: 'districts',
      type: 'references.bulk_activate',
      successType: 'references.bulk_activate_success',
      getMessage: (count) => `Bulk activate completed: ${count} districts`
    }
  },
  getRecords: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.district.findMany({ where: { id: { in: ids } }, select: { id: true } })
  },
  updateOperation: async (ids: string[], _data: Record<string, unknown>, tx: Prisma.TransactionClient) => {
    return tx.district.updateMany({ where: { id: { in: ids } }, data: { isActive: true } })
  }
}

export const districtBulkDeactivateConfig: BulkOperationConfig = {
  modelName: 'district',
  idField: 'id',
  options: {
    permissionModule: 'districtManagement',
    permissionAction: 'update',
    eventConfig: {
      source: 'references',
      module: 'districts',
      type: 'references.bulk_deactivate',
      successType: 'references.bulk_deactivate_success',
      getMessage: (count) => `Bulk deactivate completed: ${count} districts`
    }
  },
  getRecords: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.district.findMany({ where: { id: { in: ids } }, select: { id: true } })
  },
  updateOperation: async (ids: string[], _data: Record<string, unknown>, tx: Prisma.TransactionClient) => {
    return tx.district.updateMany({ where: { id: { in: ids } }, data: { isActive: false } })
  }
}

export const districtBulkDeleteConfig: BulkOperationConfig = {
  modelName: 'district',
  idField: 'id',
  options: {
    permissionModule: 'districtManagement',
    permissionAction: 'delete',
    eventConfig: {
      source: 'references',
      module: 'districts',
      type: 'references.bulk_delete',
      successType: 'references.bulk_delete_success',
      getMessage: (count) => `Bulk delete completed: ${count} districts`
    }
  },
  getRecords: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.district.findMany({ where: { id: { in: ids } }, select: { id: true } })
  },
  deleteOperation: async (ids: string[], tx: Prisma.TransactionClient) => {
    return tx.district.deleteMany({ where: { id: { in: ids } } })
  }
}

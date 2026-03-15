/**
 * Конфигурация bulk операций для справочников (Country, State, City, District)
 * Использует фабричную функцию для устранения дублирования
 */

import type { BulkOperationConfig } from '../types'
import type { Prisma } from '@prisma/client'

interface ReferenceBulkConfigs {
  activate: BulkOperationConfig
  deactivate: BulkOperationConfig
  delete: BulkOperationConfig
}

/**
 * Фабрика для создания 3 bulk-конфигов (activate/deactivate/delete) для любого справочника
 */
function createReferenceBulkConfigs(
  modelName: string,
  permissionModule: string,
  modulePlural: string,
  prismaDelegate: (tx: Prisma.TransactionClient) => {
    findMany: (args: { where: { id: { in: string[] } }; select: { id: true } }) => Promise<Array<{ id: string }>>
    updateMany: (args: { where: { id: { in: string[] } }; data: { isActive: boolean } }) => Promise<{ count: number }>
    deleteMany: (args: { where: { id: { in: string[] } } }) => Promise<{ count: number }>
  }
): ReferenceBulkConfigs {
  const baseOptions = (action: string, permissionAction: string) => ({
    permissionModule,
    permissionAction,
    eventConfig: {
      source: 'references',
      module: modulePlural,
      type: `references.bulk_${action}`,
      successType: `references.bulk_${action}_success`,
      getMessage: (count: number) => `Bulk ${action} completed: ${count} ${modulePlural}`
    }
  })

  return {
    activate: {
      modelName,
      idField: 'id',
      options: baseOptions('activate', 'update'),
      getRecords: async (ids: string[], tx: Prisma.TransactionClient) => {
        return prismaDelegate(tx).findMany({ where: { id: { in: ids } }, select: { id: true } })
      },
      updateOperation: async (ids: string[], _data: Record<string, unknown>, tx: Prisma.TransactionClient) => {
        return prismaDelegate(tx).updateMany({ where: { id: { in: ids } }, data: { isActive: true } })
      }
    },
    deactivate: {
      modelName,
      idField: 'id',
      options: baseOptions('deactivate', 'update'),
      getRecords: async (ids: string[], tx: Prisma.TransactionClient) => {
        return prismaDelegate(tx).findMany({ where: { id: { in: ids } }, select: { id: true } })
      },
      updateOperation: async (ids: string[], _data: Record<string, unknown>, tx: Prisma.TransactionClient) => {
        return prismaDelegate(tx).updateMany({ where: { id: { in: ids } }, data: { isActive: false } })
      }
    },
    delete: {
      modelName,
      idField: 'id',
      options: baseOptions('delete', 'delete'),
      getRecords: async (ids: string[], tx: Prisma.TransactionClient) => {
        return prismaDelegate(tx).findMany({ where: { id: { in: ids } }, select: { id: true } })
      },
      deleteOperation: async (ids: string[], tx: Prisma.TransactionClient) => {
        return prismaDelegate(tx).deleteMany({ where: { id: { in: ids } } })
      }
    }
  }
}

// Конфиги для всех справочников
const countryConfigs = createReferenceBulkConfigs('country', 'countryManagement', 'countries', (tx) => tx.country)
const stateConfigs = createReferenceBulkConfigs('state', 'stateManagement', 'states', (tx) => tx.state)
const cityConfigs = createReferenceBulkConfigs('city', 'cityManagement', 'cities', (tx) => tx.city)
const districtConfigs = createReferenceBulkConfigs('district', 'districtManagement', 'districts', (tx) => tx.district)

// Именованные экспорты для обратной совместимости с route-файлами
export const countryBulkActivateConfig = countryConfigs.activate
export const countryBulkDeactivateConfig = countryConfigs.deactivate
export const countryBulkDeleteConfig = countryConfigs.delete

export const stateBulkActivateConfig = stateConfigs.activate
export const stateBulkDeactivateConfig = stateConfigs.deactivate
export const stateBulkDeleteConfig = stateConfigs.delete

export const cityBulkActivateConfig = cityConfigs.activate
export const cityBulkDeactivateConfig = cityConfigs.deactivate
export const cityBulkDeleteConfig = cityConfigs.delete

export const districtBulkActivateConfig = districtConfigs.activate
export const districtBulkDeactivateConfig = districtConfigs.deactivate
export const districtBulkDeleteConfig = districtConfigs.delete

// Реестр конфигов по entity name (для динамического route)
export const referenceBulkConfigRegistry: Record<string, ReferenceBulkConfigs> = {
  countries: countryConfigs,
  states: stateConfigs,
  cities: cityConfigs,
  districts: districtConfigs
}

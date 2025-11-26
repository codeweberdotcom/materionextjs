/**
 * Storage Module Exports
 * 
 * @module services/media/storage
 */

export * from './types'
export { LocalAdapter } from './LocalAdapter'
export { S3Adapter } from './S3Adapter'
export { StorageService, getStorageService, resetStorageService } from './StorageService'



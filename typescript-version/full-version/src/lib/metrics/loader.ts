type ImportExportMetrics = typeof import('./import-export')

let metricsModulePromise: Promise<ImportExportMetrics> | null = null

/**
 * Lazily loads the server-only import/export metrics module.
 * Returns null on the client to prevent bundling Prometheus dependencies.
 */
export const loadImportExportMetrics = async (): Promise<ImportExportMetrics | null> => {
  if (typeof window !== 'undefined') {
    return null
  }

  if (!metricsModulePromise) {
    metricsModulePromise = import('./import-export')
  }

  return metricsModulePromise
}








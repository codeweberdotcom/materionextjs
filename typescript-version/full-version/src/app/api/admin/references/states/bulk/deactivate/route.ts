import type { NextRequest } from 'next/server'

import { handleBulkOperation } from '../../../_bulk-handler'
import { stateBulkDeactivateConfig } from '@/services/bulk/configs/referenceBulkConfig'

export async function POST(request: NextRequest) {
  return handleBulkOperation(request, stateBulkDeactivateConfig, 'update', 'deactivated states')
}

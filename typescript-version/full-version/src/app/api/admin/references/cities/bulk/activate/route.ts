import type { NextRequest } from 'next/server'

import { handleBulkOperation } from '../../../_bulk-handler'
import { cityBulkActivateConfig } from '@/services/bulk/configs/referenceBulkConfig'

export async function POST(request: NextRequest) {
  return handleBulkOperation(request, cityBulkActivateConfig, 'update', 'activated cities')
}

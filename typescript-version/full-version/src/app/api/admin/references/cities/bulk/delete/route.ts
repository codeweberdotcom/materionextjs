import type { NextRequest } from 'next/server'

import { handleBulkOperation } from '../../../_bulk-handler'
import { cityBulkDeleteConfig } from '@/services/bulk/configs/referenceBulkConfig'

export async function POST(request: NextRequest) {
  return handleBulkOperation(request, cityBulkDeleteConfig, 'delete', 'deleted cities')
}

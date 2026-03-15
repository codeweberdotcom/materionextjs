import type { NextRequest } from 'next/server'

import { handleBulkOperation } from '../../../_bulk-handler'
import { districtBulkDeleteConfig } from '@/services/bulk/configs/referenceBulkConfig'

export async function POST(request: NextRequest) {
  return handleBulkOperation(request, districtBulkDeleteConfig, 'delete', 'deleted districts')
}

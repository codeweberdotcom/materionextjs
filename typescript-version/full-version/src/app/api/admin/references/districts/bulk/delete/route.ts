import type { NextRequest } from 'next/server'

import { handleBulkDelete } from '../../../_bulk-handler'
import { districtBulkDeleteConfig } from '@/services/bulk/configs/referenceBulkConfig'

export async function POST(request: NextRequest) {
  return handleBulkDelete(request, districtBulkDeleteConfig, 'deleted districts')
}

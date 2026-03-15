import type { NextRequest } from 'next/server'

import { handleBulkDelete } from '../../../_bulk-handler'
import { cityBulkDeleteConfig } from '@/services/bulk/configs/referenceBulkConfig'

export async function POST(request: NextRequest) {
  return handleBulkDelete(request, cityBulkDeleteConfig, 'deleted cities')
}

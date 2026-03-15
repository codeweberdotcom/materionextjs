import type { NextRequest } from 'next/server'

import { handleBulkDelete } from '../../../_bulk-handler'
import { stateBulkDeleteConfig } from '@/services/bulk/configs/referenceBulkConfig'

export async function POST(request: NextRequest) {
  return handleBulkDelete(request, stateBulkDeleteConfig, 'deleted states')
}

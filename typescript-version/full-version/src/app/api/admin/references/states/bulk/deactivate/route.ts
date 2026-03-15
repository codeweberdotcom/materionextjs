import type { NextRequest } from 'next/server'

import { handleBulkUpdate } from '../../../_bulk-handler'
import { stateBulkDeactivateConfig } from '@/services/bulk/configs/referenceBulkConfig'

export async function POST(request: NextRequest) {
  return handleBulkUpdate(request, stateBulkDeactivateConfig, 'deactivated states')
}

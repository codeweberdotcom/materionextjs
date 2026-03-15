import type { NextRequest } from 'next/server'

import { handleBulkUpdate } from '../../../_bulk-handler'
import { stateBulkActivateConfig } from '@/services/bulk/configs/referenceBulkConfig'

export async function POST(request: NextRequest) {
  return handleBulkUpdate(request, stateBulkActivateConfig, 'activated states')
}

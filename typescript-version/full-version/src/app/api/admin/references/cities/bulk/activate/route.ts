import type { NextRequest } from 'next/server'

import { handleBulkUpdate } from '../../../_bulk-handler'
import { cityBulkActivateConfig } from '@/services/bulk/configs/referenceBulkConfig'

export async function POST(request: NextRequest) {
  return handleBulkUpdate(request, cityBulkActivateConfig, 'activated cities')
}

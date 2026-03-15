import type { NextRequest } from 'next/server'

import { handleBulkOperation } from '../../../_bulk-handler'
import { countryBulkDeleteConfig } from '@/services/bulk/configs/referenceBulkConfig'

export async function POST(request: NextRequest) {
  return handleBulkOperation(request, countryBulkDeleteConfig, 'delete', 'deleted countries')
}

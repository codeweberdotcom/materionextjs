import type { NextRequest } from 'next/server'

import { handleBulkDelete } from '../../../_bulk-handler'
import { countryBulkDeleteConfig } from '@/services/bulk/configs/referenceBulkConfig'

export async function POST(request: NextRequest) {
  return handleBulkDelete(request, countryBulkDeleteConfig, 'deleted countries')
}

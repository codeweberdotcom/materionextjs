import { z } from 'zod'

// Схема для bulk операций над справочниками
export const bulkReferenceOperationSchema = z.object({
  ids: z
    .array(z.string().min(1, 'ID cannot be empty'))
    .min(1, 'At least one ID is required')
    .max(1000, 'Cannot process more than 1000 records at once')
})

export type BulkReferenceOperationInput = z.infer<typeof bulkReferenceOperationSchema>

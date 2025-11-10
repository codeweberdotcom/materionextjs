export type NotificationMetadata = Record<string, any>

const isObjectLike = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null

export const parseNotificationMetadata = (raw: unknown): NotificationMetadata => {
  if (raw === undefined || raw === null || raw === '') return {}

  if (isObjectLike(raw)) {
    return raw
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)

      if (isObjectLike(parsed)) {
        return parsed
      }

      return { value: parsed }
    } catch {
      return { value: raw }
    }
  }

  return { value: raw }
}

export const serializeNotificationMetadata = (metadata: unknown): string => {
  if (metadata === undefined || metadata === null || metadata === '') {
    return '{}'
  }

  if (typeof metadata === 'string') {
    try {
      JSON.parse(metadata)

      return metadata
    } catch {
      return JSON.stringify({ value: metadata })
    }
  }

  if (isObjectLike(metadata) || Array.isArray(metadata)) {
    try {
      return JSON.stringify(metadata)
    } catch {
      return '{}'
    }
  }

  return JSON.stringify({ value: metadata })
}

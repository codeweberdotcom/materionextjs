const fallback = '[unsupported message]'

export const normalizeMessageContent = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object') {
    const candidate =
      (value as { message?: unknown }).message ??
      (value as { text?: unknown }).text ??
      (value as { content?: unknown }).content

    if (typeof candidate === 'string') {
      return candidate
    }

    try {
      return JSON.stringify(value)
    } catch {
      return fallback
    }
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return value === undefined || value === null ? '' : fallback
}

export type TranslationErrorCode =
  | 'TRANSLATION_UNAUTHORIZED'
  | 'TRANSLATION_PERMISSION_DENIED'
  | 'TRANSLATION_KEY_REQUIRED'
  | 'TRANSLATION_LANGUAGE_REQUIRED'
  | 'TRANSLATION_VALUE_REQUIRED'
  | 'TRANSLATION_INVALID_JSON'
  | 'TRANSLATION_ALREADY_EXISTS'
  | 'TRANSLATION_NOT_FOUND'
  | 'TRANSLATION_IMPORT_FAILED'
  | 'TRANSLATION_EXPORT_FAILED'
  | 'TRANSLATION_INTERNAL_ERROR'

export const buildTranslationError = (
  code: TranslationErrorCode,
  message: string,
  details?: Record<string, unknown>
) => ({
  error: {
    code,
    message,
    ...(details ? { details } : {})
  }
})






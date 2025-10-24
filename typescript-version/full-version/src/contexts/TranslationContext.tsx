'use client'

// React Imports
import { createContext, useContext, ReactNode } from 'react'

// Type Imports
import type { Locale } from '@configs/i18n'

type Dictionary = Awaited<ReturnType<typeof import('@/utils/getDictionary').getDictionary>>

const TranslationContext = createContext<Dictionary | null>(null)

export const TranslationProvider = ({ children, dictionary }: { children: ReactNode; dictionary: Dictionary }) => {
  return <TranslationContext.Provider value={dictionary}>{children}</TranslationContext.Provider>
}

export const useTranslation = () => {
  const context = useContext(TranslationContext)
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider')
  }
  return context
}
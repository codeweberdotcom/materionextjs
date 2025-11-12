'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type ProfileData = {
  firstName: string
  lastName: string
  email: string
  organization: string
  phoneNumber: string
  address: string
  state: string
  zipCode: string
  country: string
  language: string
  currency: string
  avatar: string
}

const defaultProfile: ProfileData = {
  firstName: '',
  lastName: '',
  email: '',
  organization: '',
  phoneNumber: '',
  address: '',
  state: '',
  zipCode: '',
  country: '',
  language: 'en',
  currency: 'USD',
  avatar: '/images/avatars/1.png'
}

type ProfileContextState = {
  data: ProfileData
  loading: boolean
  error?: string
  refresh: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextState | undefined>(undefined)

const fetchProfile = async (): Promise<ProfileData> => {
  const response = await fetch('/api/user/profile')

  if (!response.ok) {
    throw new Error('Failed to load profile')
  }

  const user = await response.json()
  const [firstName = '', ...rest] = (user.fullName ?? '').split(' ')

  return {
    firstName,
    lastName: rest.join(' '),
    email: user.email ?? '',
    organization: user.company ?? '',
    phoneNumber: user.contact ?? '',
    address: '',
    state: '',
    zipCode: '',
    country: user.country ?? '',
    language: user.language ?? 'en',
    currency: user.currency ?? 'USD',
    avatar: user.avatar || '/images/avatars/1.png'
  }
}

export const ProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState<ProfileData>(defaultProfile)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const load = async () => {
    setLoading(true)
    setError(undefined)

    try {
      const profile = await fetchProfile()

      setData(profile)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // we only want to run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({ data, loading, error, refresh: load }),
    [data, loading, error]
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export const useProfile = () => {
  const context = useContext(ProfileContext)

  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider')
  }

  return context
}

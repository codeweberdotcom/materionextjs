'use client'

// React Imports
import { useState, useEffect } from 'react'

// MUI Imports
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Link from 'next/link'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

interface VerificationBannerProps {
  emailVerified?: boolean
  phoneVerified?: boolean
  email?: string | null
  phone?: string | null
  onClose?: () => void
}

/**
 * Компонент для отображения предупреждений о необходимости верификации
 */
export function VerificationBanner({
  emailVerified = false,
  phoneVerified = false,
  email,
  phone,
  onClose
}: VerificationBannerProps) {
  const dictionary = useTranslation()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Проверяем, было ли предупреждение скрыто ранее
    const dismissedKey = `verification-banner-dismissed-${email || phone || 'default'}`
    const wasDismissed = localStorage.getItem(dismissedKey) === 'true'
    setDismissed(wasDismissed)
  }, [email, phone])

  const handleDismiss = () => {
    setDismissed(true)
    const dismissedKey = `verification-banner-dismissed-${email || phone || 'default'}`
    localStorage.setItem(dismissedKey, 'true')
    onClose?.()
  }

  // Не показываем, если все верифицировано или было скрыто
  if ((emailVerified && phoneVerified) || dismissed) {
    return null
  }

  // Показываем предупреждение о необходимости верификации email
  if (!emailVerified && email) {
    return (
      <Alert
        severity='warning'
        onClose={handleDismiss}
        sx={{ mb: 4 }}
        action={
          <Button
            color='inherit'
            size='small'
            component={Link}
            href='/verify-email'
          >
            Подтвердить email
          </Button>
        }
      >
        <AlertTitle>Требуется подтверждение email</AlertTitle>
        Для доступа к админ-панели необходимо подтвердить ваш email адрес.
        Проверьте почту и перейдите по ссылке из письма или запросите новое письмо.
      </Alert>
    )
  }

  // Показываем предупреждение о необходимости верификации телефона
  if (emailVerified && !phoneVerified && phone) {
    return (
      <Alert
        severity='info'
        onClose={handleDismiss}
        sx={{ mb: 4 }}
        action={
          <Button
            color='inherit'
            size='small'
            component={Link}
            href='/verify-phone'
          >
            Подтвердить телефон
          </Button>
        }
      >
        <AlertTitle>Требуется подтверждение телефона</AlertTitle>
        Для полного доступа к управлению необходимо подтвердить ваш номер телефона.
        Вы можете видеть админ-панель, но не можете создавать объявления, отправлять сообщения и выполнять другие действия.
      </Alert>
    )
  }

  // Показываем общее предупреждение, если нет ни email, ни телефона
  if (!emailVerified && !phoneVerified) {
    return (
      <Alert
        severity='warning'
        onClose={handleDismiss}
        sx={{ mb: 4 }}
      >
        <AlertTitle>Требуется верификация</AlertTitle>
        Для доступа к админ-панели необходимо подтвердить email или телефон.
      </Alert>
    )
  }

  return null
}

/**
 * Компонент для блокировки действий до верификации
 */
export function VerificationBlock({
  children,
  requiresFull = false,
  emailVerified = false,
  phoneVerified = false
}: {
  children: React.ReactNode
  requiresFull?: boolean
  emailVerified?: boolean
  phoneVerified?: boolean
}) {
  const canAccess = requiresFull
    ? emailVerified && phoneVerified
    : emailVerified || phoneVerified

  if (!canAccess) {
    return (
      <Box
        sx={{
          p: 3,
          textAlign: 'center',
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 1
        }}
      >
        <Alert severity='warning' sx={{ mb: 2 }}>
          {requiresFull
            ? 'Для выполнения этого действия необходимо подтвердить email и телефон'
            : 'Для выполнения этого действия необходимо подтвердить email или телефон'}
        </Alert>
      </Box>
    )
  }

  return <>{children}</>
}







'use client'

// React Imports
import { useState, useEffect } from 'react'

// Next Imports
import Link from 'next/link'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'

interface VerificationStatusProps {
  emailVerified?: boolean
  phoneVerified?: boolean
  email?: string | null
  phone?: string | null
  documentsVerified?: boolean
  showActions?: boolean
  compact?: boolean
  locale?: string
}

/**
 * Компонент для отображения статуса верификации пользователя
 * Показывает текущий уровень верификации и действия для завершения верификации
 */
export function VerificationStatus({
  emailVerified = false,
  phoneVerified = false,
  email,
  phone,
  documentsVerified = false,
  showActions = true,
  compact = false,
  locale = 'ru'
}: VerificationStatusProps) {
  // Calculate verification level
  const getVerificationLevel = () => {
    if (documentsVerified && emailVerified && phoneVerified) {
      return { level: 'DOCUMENTS_VERIFIED', label: 'Полная верификация', color: 'success' as const, progress: 100 }
    }
    if (emailVerified && phoneVerified) {
      return { level: 'FULL', label: 'Полный доступ', color: 'success' as const, progress: 75 }
    }
    if (emailVerified) {
      return { level: 'EMAIL_ONLY', label: 'Просмотр админки', color: 'warning' as const, progress: 50 }
    }
    if (phoneVerified) {
      return { level: 'PHONE_ONLY', label: 'Частичный доступ', color: 'warning' as const, progress: 50 }
    }
    return { level: 'NONE', label: 'Не верифицирован', color: 'error' as const, progress: 0 }
  }

  const verificationLevel = getVerificationLevel()

  // Compact version for profile sidebar
  if (compact) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant='body2' color='textSecondary'>
            Верификация:
          </Typography>
          <Chip
            label={verificationLevel.label}
            color={verificationLevel.color}
            size='small'
          />
        </Box>
        <LinearProgress
          variant='determinate'
          value={verificationLevel.progress}
          color={verificationLevel.color}
          sx={{ height: 6, borderRadius: 3 }}
        />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title={emailVerified ? 'Email подтвержден' : 'Email не подтвержден'}>
            <Chip
              icon={<i className={emailVerified ? 'ri-mail-check-line' : 'ri-mail-close-line'} />}
              label='Email'
              size='small'
              color={emailVerified ? 'success' : 'default'}
              variant={emailVerified ? 'filled' : 'outlined'}
            />
          </Tooltip>
          <Tooltip title={phoneVerified ? 'Телефон подтвержден' : 'Телефон не подтвержден'}>
            <Chip
              icon={<i className={phoneVerified ? 'ri-phone-line' : 'ri-phone-line'} />}
              label='Телефон'
              size='small'
              color={phoneVerified ? 'success' : 'default'}
              variant={phoneVerified ? 'filled' : 'outlined'}
            />
          </Tooltip>
        </Box>
      </Box>
    )
  }

  return (
    <Card>
      <CardContent>
        <Typography variant='h6' gutterBottom>
          Статус верификации
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant='body2' color='textSecondary'>
              Уровень доступа
            </Typography>
            <Chip
              label={verificationLevel.label}
              color={verificationLevel.color}
              size='small'
            />
          </Box>
          <LinearProgress
            variant='determinate'
            value={verificationLevel.progress}
            color={verificationLevel.color}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Email verification status */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <i className={`ri-mail-line ${emailVerified ? 'text-success' : 'text-secondary'}`} />
            <Box>
              <Typography variant='body2'>
                Email
              </Typography>
              {email && (
                <Typography variant='caption' color='textSecondary'>
                  {email}
                </Typography>
              )}
            </Box>
          </Box>
          {emailVerified ? (
            <Chip label='Подтвержден' color='success' size='small' variant='outlined' />
          ) : (
            showActions && email ? (
              <Button
                component={Link}
                href={`/${locale}/pages/auth/verify-email`}
                size='small'
                variant='outlined'
              >
                Подтвердить
              </Button>
            ) : (
              <Chip label='Не подтвержден' color='default' size='small' variant='outlined' />
            )
          )}
        </Box>

        {/* Phone verification status */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <i className={`ri-phone-line ${phoneVerified ? 'text-success' : 'text-secondary'}`} />
            <Box>
              <Typography variant='body2'>
                Телефон
              </Typography>
              {phone && (
                <Typography variant='caption' color='textSecondary'>
                  {phone}
                </Typography>
              )}
            </Box>
          </Box>
          {phoneVerified ? (
            <Chip label='Подтвержден' color='success' size='small' variant='outlined' />
          ) : (
            showActions && phone ? (
              <Button
                component={Link}
                href={`/${locale}/pages/auth/verify-phone`}
                size='small'
                variant='outlined'
              >
                Подтвердить
              </Button>
            ) : (
              <Chip label='Не подтвержден' color='default' size='small' variant='outlined' />
            )
          )}
        </Box>

        {/* Documents verification status (if applicable) */}
        {documentsVerified !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <i className={`ri-file-text-line ${documentsVerified ? 'text-success' : 'text-secondary'}`} />
              <Typography variant='body2'>
                Документы
              </Typography>
            </Box>
            {documentsVerified ? (
              <Chip label='Подтверждены' color='success' size='small' variant='outlined' />
            ) : (
              <Chip label='На проверке' color='warning' size='small' variant='outlined' />
            )}
          </Box>
        )}

        {/* Actions hint */}
        {showActions && (!emailVerified || !phoneVerified) && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2 }}>
              <Typography variant='body2' color='textSecondary'>
                {!emailVerified && !phoneVerified && (
                  'Для доступа к функционалу необходимо подтвердить email или телефон.'
                )}
                {emailVerified && !phoneVerified && (
                  'Для полного доступа и управления необходимо подтвердить телефон.'
                )}
                {!emailVerified && phoneVerified && (
                  'Для полного доступа и управления необходимо подтвердить email.'
                )}
              </Typography>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default VerificationStatus







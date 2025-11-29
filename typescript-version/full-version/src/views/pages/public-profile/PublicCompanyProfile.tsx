'use client'

/**
 * Публичный профиль компании (аккаунта)
 * На основе шаблона MUI user-profile
 */

import { useState } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid2'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardMedia from '@mui/material/CardMedia'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'

// Types
interface OwnerData {
  id: string
  name: string | null
  username: string | null
  avatar: string | null
}

interface CompanyData {
  id: string
  name: string
  slug: string
  type: string
  description: string | null
  createdAt: string
  owner: OwnerData
}

interface Props {
  data: CompanyData
  lang: string
}

// Форматирование даты создания
function formatCreateDate(dateStr: string, lang: string): string {
  const date = new Date(dateStr)
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long' }
  const locale = lang === 'ru' ? 'ru-RU' : 'en-US'
  return date.toLocaleDateString(locale, options)
}

// Цвета и иконки для типов аккаунтов
const accountTypeConfig: Record<string, { icon: string; color: 'primary' | 'secondary' | 'success' | 'warning' }> = {
  LISTING: { icon: 'ri-price-tag-3-line', color: 'primary' },
  COMPANY: { icon: 'ri-building-2-line', color: 'success' },
  NETWORK: { icon: 'ri-organization-chart', color: 'warning' }
}

const accountTypeLabels: Record<string, Record<string, string>> = {
  LISTING: { en: 'Listings Account', ru: 'Аккаунт объявлений' },
  COMPANY: { en: 'Company Account', ru: 'Аккаунт компании' },
  NETWORK: { en: 'Network Account', ru: 'Аккаунт сети' }
}

export default function PublicCompanyProfile({ data, lang }: Props) {
  const [imageError, setImageError] = useState(false)

  const defaultCoverImg = '/images/pages/profile-banner.png'
  const typeConfig = accountTypeConfig[data.type] || accountTypeConfig.COMPANY

  return (
    <Grid container spacing={6}>
      {/* Company Header */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardMedia 
            image={defaultCoverImg} 
            className='bs-[250px]'
            sx={{
              backgroundPosition: 'center',
              backgroundSize: 'cover'
            }}
          />
          <CardContent className='flex gap-6 justify-center flex-col items-center md:items-end md:flex-row !pt-0 md:justify-start'>
            <div className='flex rounded-bs-md mbs-[-45px] border-[5px] border-backgroundPaper bg-backgroundPaper'>
              <Avatar
                sx={{ 
                  width: 120, 
                  height: 120, 
                  fontSize: '3rem',
                  bgcolor: `${typeConfig.color}.main`
                }}
              >
                <i className={`${typeConfig.icon} text-4xl`} />
              </Avatar>
            </div>
            <div className='flex is-full flex-wrap justify-center flex-col items-center sm:flex-row sm:justify-between sm:items-end gap-5'>
              <div className='flex flex-col items-center sm:items-start gap-2'>
                <div className='flex items-center gap-3'>
                  <Typography variant='h4'>{data.name}</Typography>
                  <Chip
                    label={accountTypeLabels[data.type]?.[lang] || data.type}
                    color={typeConfig.color}
                    variant='tonal'
                    size='small'
                  />
                </div>
                <div className='flex flex-wrap gap-6 justify-center sm:justify-normal'>
                  <div className='flex items-center gap-2'>
                    <i className='ri-links-line text-textSecondary' />
                    <Typography className='font-medium' color='text.secondary'>
                      /{data.slug}
                    </Typography>
                  </div>
                  <div className='flex items-center gap-2'>
                    <i className='ri-calendar-line text-textSecondary' />
                    <Typography className='font-medium'>
                      {lang === 'ru' ? 'Создано: ' : 'Created: '}
                      {formatCreateDate(data.createdAt, lang)}
                    </Typography>
                  </div>
                </div>
              </div>
              <Button variant='contained' className='flex gap-2'>
                <i className='ri-mail-line text-base' />
                <span>{lang === 'ru' ? 'Связаться' : 'Contact'}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Info Cards */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant='h6' className='mb-4'>
              {lang === 'ru' ? 'О компании' : 'About'}
            </Typography>
            <div className='flex flex-col gap-4'>
              <div className='flex items-center gap-2'>
                <i className={`${typeConfig.icon} text-textSecondary`} />
                <Typography>{data.name}</Typography>
              </div>
              <div className='flex items-center gap-2'>
                <i className='ri-links-line text-textSecondary' />
                <Typography color='text.secondary'>/{data.slug}</Typography>
              </div>
              <div className='flex items-center gap-2'>
                <i className='ri-building-line text-textSecondary' />
                <Typography>
                  {accountTypeLabels[data.type]?.[lang] || data.type}
                </Typography>
              </div>
            </div>

            <Divider className='my-4' />

            {/* Owner Info */}
            <Typography variant='h6' className='mb-4'>
              {lang === 'ru' ? 'Владелец' : 'Owner'}
            </Typography>
            <Box 
              className='flex items-center gap-3 p-3 rounded hover:bg-actionHover cursor-pointer'
              component='a'
              href={data.owner.username ? `/${lang}/user/${data.owner.username}` : '#'}
            >
              {data.owner.avatar && !imageError ? (
                <Avatar 
                  src={data.owner.avatar} 
                  alt={data.owner.name || 'Owner'}
                  onError={() => setImageError(true)}
                />
              ) : (
                <Avatar>
                  {(data.owner.name || 'U').charAt(0).toUpperCase()}
                </Avatar>
              )}
              <div>
                <Typography fontWeight={600}>{data.owner.name || 'User'}</Typography>
                {data.owner.username && (
                  <Typography variant='body2' color='text.secondary'>
                    @{data.owner.username}
                  </Typography>
                )}
              </div>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Description & Content */}
      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardContent>
            <Typography variant='h6' className='mb-4'>
              {lang === 'ru' ? 'Описание' : 'Description'}
            </Typography>

            {data.description ? (
              <Typography color='text.secondary' className='whitespace-pre-wrap'>
                {data.description}
              </Typography>
            ) : (
              <Box className='text-center py-8'>
                <i className='ri-file-text-line text-4xl text-textSecondary mb-2' />
                <Typography color='text.secondary'>
                  {lang === 'ru' ? 'Описание не добавлено' : 'No description added'}
                </Typography>
              </Box>
            )}

            <Divider className='my-6' />

            {/* Placeholder for future content (listings, products, etc.) */}
            <Typography variant='h6' className='mb-4'>
              {lang === 'ru' ? 'Объявления' : 'Listings'}
            </Typography>
            <Box className='text-center py-8 border-2 border-dashed rounded'>
              <i className='ri-price-tag-3-line text-4xl text-textSecondary mb-2' />
              <Typography color='text.secondary'>
                {lang === 'ru' ? 'Объявления появятся здесь' : 'Listings will appear here'}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}


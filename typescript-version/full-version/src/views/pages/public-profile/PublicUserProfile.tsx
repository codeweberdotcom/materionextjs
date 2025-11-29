'use client'

/**
 * Публичный профиль пользователя
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
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'

// Types
interface AccountData {
  id: string
  name: string
  slug: string | null
  type: string
  description: string | null
}

interface ProfileData {
  id: string
  name: string
  username: string
  avatar: string | null
  country: string
  joinedAt: string
  accounts: AccountData[]
}

interface Props {
  data: ProfileData
  lang: string
}

// Форматирование даты регистрации
function formatJoinDate(dateStr: string, lang: string): string {
  const date = new Date(dateStr)
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long' }
  const locale = lang === 'ru' ? 'ru-RU' : 'en-US'
  return date.toLocaleDateString(locale, options)
}

// Иконки для типов аккаунтов
const accountTypeIcons: Record<string, string> = {
  LISTING: 'ri-price-tag-3-line',
  COMPANY: 'ri-building-2-line',
  NETWORK: 'ri-organization-chart'
}

const accountTypeLabels: Record<string, Record<string, string>> = {
  LISTING: { en: 'Listings', ru: 'Объявления' },
  COMPANY: { en: 'Company', ru: 'Компания' },
  NETWORK: { en: 'Network', ru: 'Сеть' }
}

export default function PublicUserProfile({ data, lang }: Props) {
  const [imageError, setImageError] = useState(false)

  const defaultCoverImg = '/images/pages/profile-banner.png'
  const defaultAvatar = '/images/avatars/1.png'

  return (
    <Grid container spacing={6}>
      {/* Profile Header */}
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
              {data.avatar && !imageError ? (
                <img 
                  height={120} 
                  width={120} 
                  src={data.avatar} 
                  className='rounded object-cover' 
                  alt={data.name}
                  onError={() => setImageError(true)}
                />
              ) : (
                <Avatar
                  sx={{ width: 120, height: 120, fontSize: '3rem' }}
                >
                  {data.name.charAt(0).toUpperCase()}
                </Avatar>
              )}
            </div>
            <div className='flex is-full flex-wrap justify-center flex-col items-center sm:flex-row sm:justify-between sm:items-end gap-5'>
              <div className='flex flex-col items-center sm:items-start gap-2'>
                <Typography variant='h4'>{data.name}</Typography>
                <div className='flex flex-wrap gap-6 justify-center sm:justify-normal'>
                  <div className='flex items-center gap-2'>
                    <i className='ri-at-line text-textSecondary' />
                    <Typography className='font-medium' color='text.secondary'>
                      {data.username}
                    </Typography>
                  </div>
                  <div className='flex items-center gap-2'>
                    <i className='ri-map-pin-2-line text-textSecondary' />
                    <Typography className='font-medium'>
                      {data.country === 'russia' ? (lang === 'ru' ? 'Россия' : 'Russia') : data.country}
                    </Typography>
                  </div>
                  <div className='flex items-center gap-2'>
                    <i className='ri-calendar-line text-textSecondary' />
                    <Typography className='font-medium'>
                      {lang === 'ru' ? 'Регистрация: ' : 'Joined: '}
                      {formatJoinDate(data.joinedAt, lang)}
                    </Typography>
                  </div>
                </div>
              </div>
              <Button variant='contained' className='flex gap-2'>
                <i className='ri-mail-line text-base' />
                <span>{lang === 'ru' ? 'Написать' : 'Contact'}</span>
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
              {lang === 'ru' ? 'Информация' : 'About'}
            </Typography>
            <div className='flex flex-col gap-4'>
              <div className='flex items-center gap-2'>
                <i className='ri-user-line text-textSecondary' />
                <Typography>{data.name}</Typography>
              </div>
              <div className='flex items-center gap-2'>
                <i className='ri-at-line text-textSecondary' />
                <Typography color='text.secondary'>@{data.username}</Typography>
              </div>
              <div className='flex items-center gap-2'>
                <i className='ri-global-line text-textSecondary' />
                <Typography>
                  {data.country === 'russia' ? (lang === 'ru' ? 'Россия' : 'Russia') : data.country}
                </Typography>
              </div>
            </div>

            <Divider className='my-4' />

            <Typography variant='h6' className='mb-4'>
              {lang === 'ru' ? 'Статистика' : 'Stats'}
            </Typography>
            <div className='flex flex-col gap-2'>
              <div className='flex justify-between'>
                <Typography color='text.secondary'>
                  {lang === 'ru' ? 'Аккаунтов' : 'Accounts'}
                </Typography>
                <Typography fontWeight={600}>{data.accounts.length}</Typography>
              </div>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Accounts */}
      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardContent>
            <Typography variant='h6' className='mb-4'>
              {lang === 'ru' ? 'Аккаунты' : 'Accounts'}
            </Typography>

            {data.accounts.length === 0 ? (
              <Box className='text-center py-8'>
                <i className='ri-folder-line text-4xl text-textSecondary mb-2' />
                <Typography color='text.secondary'>
                  {lang === 'ru' ? 'Нет активных аккаунтов' : 'No active accounts'}
                </Typography>
              </Box>
            ) : (
              <List>
                {data.accounts.map((account, index) => (
                  <Box key={account.id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      className='hover:bg-actionHover rounded cursor-pointer'
                      component='a'
                      href={`/${lang}/company/${account.slug || account.id}`}
                    >
                      <ListItemIcon>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <i className={accountTypeIcons[account.type] || 'ri-building-line'} />
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box className='flex items-center gap-2'>
                            <Typography fontWeight={600}>{account.name}</Typography>
                            <Chip
                              size='small'
                              label={accountTypeLabels[account.type]?.[lang] || account.type}
                              variant='tonal'
                              color='primary'
                            />
                          </Box>
                        }
                        secondary={account.description || (lang === 'ru' ? 'Нет описания' : 'No description')}
                      />
                      <i className='ri-arrow-right-s-line text-textSecondary' />
                    </ListItem>
                  </Box>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}


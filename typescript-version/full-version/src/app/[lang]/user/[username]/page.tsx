/**
 * Публичная страница профиля пользователя
 * URL: /user/[username]
 */

import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { prisma } from '@/libs/prisma'
import { slugService } from '@/services/slug'
import PublicUserProfile from '@/views/pages/public-profile/PublicUserProfile'

interface PageProps {
  params: Promise<{
    lang: string
    username: string
  }>
}

// Генерация метаданных для SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  
  const user = await prisma.user.findFirst({
    where: { username },
    select: {
      name: true,
      username: true,
      image: true
    }
  })

  if (!user) {
    return {
      title: 'User not found'
    }
  }

  const title = user.name ? `${user.name} (@${user.username})` : `@${user.username}`

  return {
    title,
    description: `Profile page of ${title}`,
    openGraph: {
      title,
      description: `Profile page of ${title}`,
      type: 'profile',
      ...(user.image && { images: [user.image] })
    },
    twitter: {
      card: 'summary',
      title,
      description: `Profile page of ${title}`,
      ...(user.image && { images: [user.image] })
    }
  }
}

export default async function PublicUserProfilePage({ params }: PageProps) {
  const { lang, username } = await params

  // Ищем пользователя по username
  const user = await prisma.user.findFirst({
    where: { username },
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      country: true,
      createdAt: true,
      // НЕ выводим приватные данные: email, phone, password
      ownedAccounts: {
        where: {
          status: 'active'
        },
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          description: true
        },
        take: 5
      }
    }
  })

  // Если пользователь не найден, проверяем историю slug для редиректа
  if (!user) {
    const redirectInfo = await slugService.findByOldSlug('user', username)
    
    if (redirectInfo) {
      // 301 редирект на новый username
      redirect(`/${lang}/user/${redirectInfo.currentSlug}`)
    }

    // Если нет ни пользователя, ни редиректа - 404
    notFound()
  }

  // Подготавливаем данные для компонента
  const profileData = {
    id: user.id,
    name: user.name || `@${user.username}`,
    username: user.username!,
    avatar: user.image,
    country: user.country,
    joinedAt: user.createdAt.toISOString(),
    accounts: user.ownedAccounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      slug: acc.slug,
      type: acc.type,
      description: acc.description
    }))
  }

  return <PublicUserProfile data={profileData} lang={lang} />
}


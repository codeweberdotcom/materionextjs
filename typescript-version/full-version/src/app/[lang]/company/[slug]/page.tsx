/**
 * Публичная страница компании (аккаунта)
 * URL: /company/[slug]
 */

import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { prisma } from '@/libs/prisma'
import { slugService } from '@/services/slug'
import PublicCompanyProfile from '@/views/pages/public-profile/PublicCompanyProfile'

interface PageProps {
  params: Promise<{
    lang: string
    slug: string
  }>
}

// Генерация метаданных для SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  
  const account = await prisma.userAccount.findFirst({
    where: { slug },
    select: {
      name: true,
      slug: true,
      description: true,
      type: true
    }
  })

  if (!account) {
    return {
      title: 'Company not found'
    }
  }

  const title = account.name
  const description = account.description || `Company profile of ${account.name}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website'
    },
    twitter: {
      card: 'summary',
      title,
      description
    }
  }
}

export default async function PublicCompanyProfilePage({ params }: PageProps) {
  const { lang, slug } = await params

  // Ищем аккаунт (компанию) по slug
  const account = await prisma.userAccount.findFirst({
    where: { 
      slug,
      status: 'active'
    },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      description: true,
      createdAt: true,
      owner: {
        select: {
          id: true,
          name: true,
          username: true,
          image: true
        }
      }
    }
  })

  // Если компания не найдена, проверяем историю slug для редиректа
  if (!account) {
    const redirectInfo = await slugService.findByOldSlug('account', slug)
    
    if (redirectInfo) {
      // 301 редирект на новый slug
      redirect(`/${lang}/company/${redirectInfo.currentSlug}`)
    }

    // Если нет ни компании, ни редиректа - 404
    notFound()
  }

  // Подготавливаем данные для компонента
  const companyData = {
    id: account.id,
    name: account.name,
    slug: account.slug!,
    type: account.type,
    description: account.description,
    createdAt: account.createdAt.toISOString(),
    owner: {
      id: account.owner.id,
      name: account.owner.name || `@${account.owner.username}`,
      username: account.owner.username,
      avatar: account.owner.image
    }
  }

  return <PublicCompanyProfile data={companyData} lang={lang} />
}


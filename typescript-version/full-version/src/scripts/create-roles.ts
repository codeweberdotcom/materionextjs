import { prisma } from '../libs/prisma'

async function createRoles() {
  const roles = [
    {
      name: 'Support',
      code: 'SUPPORT',
      description: 'Support role for handling user inquiries and technical support.',
      permissions: 'support, read'
    },
    {
      name: 'Editor',
      code: 'EDITOR',
      description: 'Editor role for content management and editing.',
      permissions: 'edit, read, write'
    },
    {
      name: 'SEO',
      code: 'SEO',
      description: 'SEO role for search engine optimization tasks.',
      permissions: 'seo, read, analyze'
    }
  ]

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role
    })
  }

  console.log('Roles created successfully')
}

createRoles()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

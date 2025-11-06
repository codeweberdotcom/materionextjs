import { prisma } from '@/libs/prisma'

async function main() {
  const userId = 'cmh3x6vag055t2slwxddfsawr'
  let adminRole = await prisma.role.findUnique({ where: { name: 'Admin' } })

  if (!adminRole) {
    console.log('Admin role not found, creating it...')
    adminRole = await prisma.role.create({
      data: {
        name: 'Admin',
        description: 'Administrator role with full permissions'
      }
    })
    console.log('Created Admin role:', adminRole.id)
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { roleId: adminRole.id }
  })

  console.log('Updated user role to Admin:', updatedUser.email)
}

main().catch(console.error).finally(() => prisma.$disconnect())

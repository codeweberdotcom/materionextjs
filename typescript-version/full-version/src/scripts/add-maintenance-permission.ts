import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface Permissions {
  [key: string]: string[]
}

async function addMaintenancePermission(): Promise<void> {
  console.log('Starting to add maintenance permission to roles...')

  // Get all roles
  const roles = await prisma.role.findMany()

  for (const role of roles) {
    try {
      let currentPermissions: Permissions = {}

      // Parse current permissions
      if (role.permissions) {
        try {
          const parsed = JSON.parse(role.permissions as string)

          if (typeof parsed === 'object' && parsed !== null) {
            currentPermissions = parsed as Permissions
          }
        } catch (error) {
          console.log(`Failed to parse permissions for role ${role.name}: ${role.permissions}`)
          continue
        }
      }

      // Add maintenance permission if not already present
      if (!currentPermissions['maintenance']) {
        currentPermissions['maintenance'] = ['read']
      } else if (!currentPermissions['maintenance'].includes('read')) {
        currentPermissions['maintenance'].push('read')
      }

      // Update role
      await prisma.role.update({
        where: { id: role.id },
        data: {
          permissions: JSON.stringify(currentPermissions)
        }
      })

      console.log(`✅ Updated role: ${role.name}`)
      console.log(`   Permissions: ${JSON.stringify(currentPermissions)}`)
    } catch (error) {
      console.error(`❌ Failed to update role ${role.name}:`, error)
    }
  }

  console.log('Maintenance permission addition completed!')
}

addMaintenancePermission()
  .catch((e: Error) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })










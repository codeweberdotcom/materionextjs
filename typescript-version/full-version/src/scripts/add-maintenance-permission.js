const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function addMaintenancePermission() {
  console.log('Starting to add maintenance permission to roles...')

  // Get all roles
  const roles = await prisma.role.findMany()

  for (const role of roles) {
    try {
      let currentPermissions = {}

      // Parse current permissions
      if (role.permissions) {
        try {
          const parsed = JSON.parse(role.permissions)
          if (typeof parsed === 'object' && parsed !== null) {
            currentPermissions = parsed
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
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Mapping from old permission format to new format
const permissionMapping: Record<string, { module: string, action: string }> = {
  // User Management
  'user-management-read': { module: 'Users', action: 'Read' },
  'user-management-write': { module: 'Users', action: 'Write' },
  'user-management-create': { module: 'Users', action: 'Create' },

  // Role Management
  'role-management-read': { module: 'Roles', action: 'Read' },
  'role-management-write': { module: 'Roles', action: 'Write' },
  'role-management-create': { module: 'Roles', action: 'Create' },

  // Content Management
  'content-management-read': { module: 'Content', action: 'Read' },
  'content-management-write': { module: 'Content', action: 'Write' },

  // Content Moderation
  'content-moderation-write': { module: 'Content Moderation', action: 'Write' },

  // Media Management
  'media-management-write': { module: 'Media', action: 'Write' },

  // Marketing
  'marketing-read': { module: 'Marketing', action: 'Read' },
  'marketing-write': { module: 'Marketing', action: 'Write' },

  // Analytics
  'analytics-read': { module: 'Analytics', action: 'Read' },

  // Support
  'support-read': { module: 'Support', action: 'Read' },
  'support-write': { module: 'Support', action: 'Write' },

  // Reports
  'reports-read': { module: 'Reports', action: 'Read' },

  // Team Management
  'team-management-write': { module: 'Team', action: 'Write' },

  // Profile
  'profile-read': { module: 'Profile', action: 'Read' },

  // Content (general)
  'content-read': { module: 'Content', action: 'Read' },

  // Country Management
  'country-management-read': { module: 'Countries', action: 'Read' },
  'country-management-write': { module: 'Countries', action: 'Write' },
  'country-management-create': { module: 'Countries', action: 'Create' },

  // Currency Management
  'currency-management-read': { module: 'Currencies', action: 'Read' },
  'currency-management-write': { module: 'Currencies', action: 'Write' },
  'currency-management-create': { module: 'Currencies', action: 'Create' },

  // State Management
  'state-management-read': { module: 'States', action: 'Read' },
  'state-management-write': { module: 'States', action: 'Write' },
  'state-management-create': { module: 'States', action: 'Create' },

  // City Management
  'city-management-read': { module: 'Cities', action: 'Read' },
  'city-management-write': { module: 'Cities', action: 'Write' },
  'city-management-create': { module: 'Cities', action: 'Create' },

  // District Management
  'district-management-read': { module: 'Districts', action: 'Read' },
  'district-management-write': { module: 'Districts', action: 'Write' },
  'district-management-create': { module: 'Districts', action: 'Create' },

  // Language Management
  'language-management-read': { module: 'Languages', action: 'Read' },
  'language-management-write': { module: 'Languages', action: 'Write' },
  'language-management-create': { module: 'Languages', action: 'Create' },

  // Translation Management
  'translation-management-read': { module: 'Translations', action: 'Read' },
  'translation-management-write': { module: 'Translations', action: 'Write' },
  'translation-management-create': { module: 'Translations', action: 'Create' },

  // Email Templates Management
  'email-templates-management-read': { module: 'Email Templates', action: 'Read' },
  'email-templates-management-write': { module: 'Email Templates', action: 'Write' },
  'email-templates-management-create': { module: 'Email Templates', action: 'Create' },

  // SMTP Management
  'smtp-management-read': { module: 'SMTP', action: 'Read' },
}

function convertPermissions(oldPermissions: string[]): Record<string, string[]> {
  const newPermissions: Record<string, string[]> = {}

  // Handle special cases
  if (oldPermissions.includes('all')) {
    // For 'all' permissions, give all permissions to all modules
    Object.values(permissionMapping).forEach(({ module, action }) => {
      if (!newPermissions[module]) {
        newPermissions[module] = []
      }
      if (!newPermissions[module].includes(action)) {
        newPermissions[module].push(action)
      }
    })
    return newPermissions
  }

  if (oldPermissions.includes('read')) {
    // For simple 'read' permission, give read access to basic modules
    newPermissions['Profile'] = ['Read']
    newPermissions['Content'] = ['Read']
    return newPermissions
  }

  // Convert each permission
  oldPermissions.forEach(permission => {
    const mapping = permissionMapping[permission]
    if (mapping) {
      if (!newPermissions[mapping.module]) {
        newPermissions[mapping.module] = []
      }
      if (!newPermissions[mapping.module].includes(mapping.action)) {
        newPermissions[mapping.module].push(mapping.action)
      }
    }
  })

  return newPermissions
}

async function migrateRoles() {
  console.log('Starting role migration...')

  // Get all roles
  const roles = await prisma.role.findMany()

  for (const role of roles) {
    try {
      let oldPermissions: string[] = []

      // Parse current permissions
      if (role.permissions === 'all') {
        oldPermissions = ['all']
      } else if (role.permissions === 'read') {
        oldPermissions = ['read']
      } else {
        try {
          oldPermissions = JSON.parse(role.permissions || '[]')
        } catch {
          console.log(`Failed to parse permissions for role ${role.name}: ${role.permissions}`)
          continue
        }
      }

      // Convert to new format
      const newPermissions = convertPermissions(oldPermissions)

      // Update role
      await prisma.role.update({
        where: { id: role.id },
        data: {
          permissions: JSON.stringify(newPermissions)
        }
      })

      console.log(`✅ Migrated role: ${role.name}`)
      console.log(`   Old: ${JSON.stringify(oldPermissions)}`)
      console.log(`   New: ${JSON.stringify(newPermissions)}`)
    } catch (error) {
      console.error(`❌ Failed to migrate role ${role.name}:`, error)
    }
  }

  console.log('Role migration completed!')
}

migrateRoles()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
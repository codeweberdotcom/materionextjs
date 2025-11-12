import type { VerticalMenuDataType } from '@/types/menuTypes'
import type { getDictionary } from '@/utils/formatting/getDictionary'
import type { UserWithRole } from '@/utils/permissions/permissions'

import { checkPermission, isSuperadmin } from '@/utils/permissions/permissions'
import {
  getMenuNavigationLabels,
  hasMenuChildren,
  type MenuNavigationLabels
} from './shared'

interface FilterMenuOptions {
  items: VerticalMenuDataType[]
  dictionary: Awaited<ReturnType<typeof getDictionary>>
  user: UserWithRole | null
}

export const filterMenuDataByPermissions = ({
  items,
  dictionary,
  user
}: FilterMenuOptions): VerticalMenuDataType[] => {
  if (!items.length || isSuperadmin(user)) {
    return items
  }

  const labels = getMenuNavigationLabels(dictionary)

  return items
    .map(item => filterMenuNode(item, labels, user))
    .filter((item): item is VerticalMenuDataType => Boolean(item))
}

const filterMenuNode = (
  item: VerticalMenuDataType,
  labels: MenuNavigationLabels,
  user: UserWithRole | null
): VerticalMenuDataType | null => {
  if (!hasMenuChildren(item)) {
    return item
  }

  const childItems = item.children
    .map(child => filterMenuNode(child, labels, user))
    .filter((child): child is VerticalMenuDataType => Boolean(child))

  const permissionScopedChildren = applyPermissionRules(item, childItems, labels, user)

  if (!permissionScopedChildren.length) {
    return null
  }

  return {
    ...item,
    children: permissionScopedChildren
  }
}

const applyPermissionRules = (
  item: VerticalMenuDataType,
  children: VerticalMenuDataType[],
  labels: MenuNavigationLabels,
  user: UserWithRole | null
): VerticalMenuDataType[] => {
  if (!hasMenuChildren(item) || typeof item.label !== 'string') {
    return children
  }

  if (item.label === labels.userSettings) {
    return children.filter(child => filterUserSettingsChild(child, user, labels))
  }

  if (item.label === labels.adminAndSettings) {
    return children.filter(child => filterAdminSectionChild(child, user, labels))
  }

  return children
}

const filterUserSettingsChild = (
  child: VerticalMenuDataType,
  user: UserWithRole | null,
  labels: MenuNavigationLabels
): boolean => {
  if (typeof child.label !== 'string') {
    return true
  }

  if (child.label === labels.userList) {
    return checkPermission(user, 'userManagement', 'read')
  }

  if (child.label === labels.roles) {
    return checkPermission(user, 'roleManagement', 'read')
  }

  if (child.label === labels.permissions) {
    return checkPermission(user, 'permissionsManagement', 'read')
  }

  return true
}

const filterAdminSectionChild = (
  child: VerticalMenuDataType,
  user: UserWithRole | null,
  labels: MenuNavigationLabels
): boolean => {
  if (typeof child.label !== 'string') {
    return true
  }

  if (child.label === labels.smtpSettings) {
    return checkPermission(user, 'smtpManagement', 'read')
  }

  if (child.label === labels.emailTemplates) {
    return checkPermission(user, 'emailTemplatesManagement', 'read')
  }

  if (child.label === labels.rateLimitManagement) {
    return checkPermission(user, 'rateLimitManagement', 'read')
  }

  return true
}

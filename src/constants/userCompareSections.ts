import type { PermissionCategory } from '../types/permissions';

export interface CompareSection {
  category: PermissionCategory;
  title: string;
}

export const USER_MEMBERSHIP_SECTIONS: CompareSection[] = [
  { category: 'permissionSetGroup', title: 'Permission Set Group Assignments' },
  { category: 'group', title: 'Public Groups' },
  { category: 'queue', title: 'Queues' },
];

export const USER_ASSIGNMENT_SECTIONS: CompareSection[] = [
  { category: 'permissionSet', title: 'Permission Sets' },
  { category: 'permissionSetGroup', title: 'Permission Set Group Assignments' },
  { category: 'managedPackage', title: 'Managed Package Assignments' },
  { category: 'group', title: 'Public Groups' },
  { category: 'queue', title: 'Queues' },
];

export const USER_COMPARE_SECTIONS: CompareSection[] = [
  { category: 'userAttribute', title: 'User Attributes' },
  ...USER_MEMBERSHIP_SECTIONS,
];

export const PSG_COMPARE_SECTIONS: CompareSection[] = [
  { category: 'groupMember', title: 'Included Permission Sets' },
];

export const CATEGORY_LABELS: Record<PermissionCategory, string> = {
  userAttribute: 'User Attributes',
  permissionSet: 'Permission Sets',
  permissionSetGroup: 'Permission Set Group Assignments',
  managedPackage: 'Managed Package Assignments',
  group: 'Public Groups',
  queue: 'Queues',
  permissionSetLicense: 'Permission Set Licenses',
  assignment: 'Assignments',
  groupMembership: 'Group Memberships',
  object: 'Object Permissions',
  field: 'Field Permissions',
  system: 'System Permissions',
  tab: 'Tab Settings',
  setup: 'Setup Access',
  groupMember: 'Group Members',
};

import { SalesforceClient } from '../api/salesforceClient';
import { OBJECT_CRUD_FIELDS, SYSTEM_PERMISSION_LABELS } from '../constants/systemPermissions';
import type {
  NamedEntity,
  NormalizedPermission,
  PermissionBundle,
  PermissionCategory,
  PermissionSource,
  UserAssignmentGroups,
} from '../types/permissions';

interface PermissionSetRecord {
  Id: string;
  Name: string;
  Label: string;
  IsOwnedByProfile: boolean;
  ProfileId?: string;
  Type?: string;
  [key: string]: unknown;
}

interface ObjectPermissionRecord {
  SobjectType: string;
  PermissionsRead: boolean;
  PermissionsCreate: boolean;
  PermissionsEdit: boolean;
  PermissionsDelete: boolean;
  PermissionsViewAllRecords: boolean;
  PermissionsModifyAllRecords: boolean;
}

interface FieldPermissionRecord {
  SobjectType: string;
  Field: string;
  PermissionsRead: boolean;
  PermissionsEdit: boolean;
}

interface SetupEntityRecord {
  SetupEntityId: string;
  SetupEntityType: string;
}

const SETUP_ENTITY_TYPE_LABELS: Record<string, string> = {
  ApexClass: 'Apex Class',
  ApexPage: 'Apex Page',
  ApexComponent: 'Apex Component',
};

const SETUP_ENTITY_RESOLVERS: Record<string, { objectName: string; tooling: boolean }> = {
  ApexClass: { objectName: 'ApexClass', tooling: true },
  ApexPage: { objectName: 'ApexPage', tooling: true },
  ApexComponent: { objectName: 'ApexComponent', tooling: true },
};

const setupEntityNameCache = new Map<string, string>();

interface TabSettingRecord {
  Name: string;
  Visibility: string;
}

interface PsgMemberRecord {
  PermissionSetGroupId: string;
  PermissionSetGroup: {
    Id: string;
    DeveloperName: string;
    MasterLabel: string;
  };
}

interface PermissionSetGroupAssignmentRecord {
  PermissionSetGroupId: string;
  PermissionSetGroup: {
    Id: string;
    DeveloperName: string;
    MasterLabel: string;
  };
}

interface PsgComponentRecord {
  PermissionSetGroupId: string;
  PermissionSetId: string;
  PermissionSet: { Id: string; Name: string; Label: string };
}

interface GroupMemberRecord {
  GroupId: string;
  Group: {
    Id: string;
    Name: string;
    DeveloperName?: string;
    Type: string;
  };
}

const GROUP_TYPE_LABELS: Record<string, string> = {
  Regular: 'Public Group',
  Queue: 'Queue',
  Role: 'Role',
  RoleAndSubordinates: 'Role and Subordinates',
  RoleAndSubordinatesInternal: 'Role and Subordinates (Internal)',
  Organization: 'Organization',
  AllCustomerPortal: 'Customer Portal',
  Manager: 'Manager Group',
  ManagerAndSubordinatesInternal: 'Manager and Subordinates (Internal)',
  PortalRole: 'Portal Role',
  PortalRoleAndSubordinates: 'Portal Role and Subordinates',
  Partner: 'Partner',
  Team: 'Team',
  Territory: 'Territory',
  TerritoryAndSubordinates: 'Territory and Subordinates',
};

function uniqueById(items: NamedEntity[]): NamedEntity[] {
  const map = new Map<string, NamedEntity>();
  items.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isUnsupportedFeatureError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    /is not supported/i.test(message) ||
    /INVALID_TYPE/i.test(message) ||
    /NOT_SUPPORTED/i.test(message) ||
    /sObject type '/i.test(message)
  );
}

function recordWarning(warnings: string[], feature: string, error: unknown): void {
  if (isUnsupportedFeatureError(error)) {
    warnings.push(`${feature} are not available in this org.`);
    return;
  }

  warnings.push(`Could not load ${feature}: ${getErrorMessage(error)}`);
}

async function runOptionalLoad<T>(
  warnings: string[],
  feature: string,
  loader: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    recordWarning(warnings, feature, error);
    return fallback;
  }
}

function formatObjectPerms(record: ObjectPermissionRecord): string {
  const parts = OBJECT_CRUD_FIELDS
    .filter(({ field }) => record[field as keyof ObjectPermissionRecord])
    .map(({ label }) => label);
  return parts.length ? parts.join(', ') : 'None';
}

function formatFieldPerms(record: FieldPermissionRecord): string {
  const parts: string[] = [];
  if (record.PermissionsRead) parts.push('Read');
  if (record.PermissionsEdit) parts.push('Edit');
  return parts.length ? parts.join(', ') : 'None';
}

function addPermission(
  map: Map<string, NormalizedPermission>,
  permission: Omit<NormalizedPermission, 'sources'> & { source: PermissionSource },
): void {
  const existing = map.get(permission.key);
  if (existing) {
    if (permission.granted) {
      existing.granted = true;
      existing.value = permission.value;
    }
    const sourceExists = existing.sources.some(
      (s) => s.sourceId === permission.source.sourceId,
    );
    if (!sourceExists) {
      existing.sources.push(permission.source);
    }
    return;
  }

  map.set(permission.key, {
    ...permission,
    sources: [permission.source],
  });
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function humanizePermissionField(field: string): string {
  return field
    .replace(/^Permissions/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

function formatUserFieldValue(value: unknown): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (value == null || value === '') return 'None';
  return String(value);
}

function getUserFieldValue(
  record: Record<string, unknown>,
  field: UserAttributeField,
): string {
  if (field.path.includes('.')) {
    const relatedValue = getUserFieldValueByPath(record, field.path);
    if (relatedValue !== 'None') {
      return relatedValue;
    }
    return formatUserFieldValue(record[field.name]);
  }

  return formatUserFieldValue(record[field.name]);
}

function getUserFieldValueByPath(record: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let current: unknown = record;

  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return 'None';
    }
    current = (current as Record<string, unknown>)[part];
  }

  return formatUserFieldValue(current);
}

interface UserAttributeField {
  name: string;
  label: string;
  path: string;
  selectParts: string[];
}

const NON_QUERYABLE_USER_FIELD_TYPES = new Set([
  'address',
  'location',
  'base64',
]);

let cachedUserAttributeFields: UserAttributeField[] | null = null;

async function getUserAttributeFields(
  client: SalesforceClient,
): Promise<UserAttributeField[]> {
  if (cachedUserAttributeFields) {
    return cachedUserAttributeFields;
  }

  const describe = await client.describe('User');
  cachedUserAttributeFields = (describe.fields ?? [])
    .filter((field) => !NON_QUERYABLE_USER_FIELD_TYPES.has(field.type))
    .map((field) => {
      if (field.type === 'reference' && field.relationshipName) {
        return {
          name: field.name,
          label: field.label ?? field.name,
          path: `${field.relationshipName}.Name`,
          selectParts: [field.name, `${field.relationshipName}.Name`],
        };
      }

      return {
        name: field.name,
        label: field.label ?? field.name,
        path: field.name,
        selectParts: [field.name],
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return cachedUserAttributeFields;
}

function mergeUserRecords(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): void {
  Object.entries(source).forEach(([key, value]) => {
    if (key === 'attributes') {
      return;
    }

    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      mergeUserRecords(
        target[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
      return;
    }

    target[key] = value;
  });
}

async function queryUserSelectParts(
  client: SalesforceClient,
  userId: string,
  selectParts: string[],
): Promise<Record<string, unknown>> {
  if (selectParts.length === 0) {
    return {};
  }

  try {
    const [record] = await client.query<Record<string, unknown>>(
      `SELECT ${selectParts.join(', ')} FROM User WHERE Id = '${userId}'`,
    );
    return record ?? {};
  } catch (error) {
    if (selectParts.length === 1) {
      return {};
    }

    const midpoint = Math.ceil(selectParts.length / 2);
    const left = await queryUserSelectParts(
      client,
      userId,
      selectParts.slice(0, midpoint),
    );
    const right = await queryUserSelectParts(
      client,
      userId,
      selectParts.slice(midpoint),
    );

    mergeUserRecords(left, right);
    return left;
  }
}

function userSource(userId: string, userName: string): PermissionSource {
  return {
    sourceType: 'user',
    sourceId: userId,
    sourceName: userName,
  };
}

function addUserAssignment(
  map: Map<string, NormalizedPermission>,
  category: PermissionCategory,
  id: string,
  label: string,
  source: PermissionSource,
): void {
  addPermission(map, {
    category,
    key: `${category}:${id}`,
    label,
    value: 'Assigned',
    granted: true,
    source,
  });
}

function emptyAssignmentGroups(): UserAssignmentGroups {
  return {
    permissionSets: [],
    permissionSetGroups: [],
    managedPackages: [],
    groups: [],
    queues: [],
  };
}

function mergeAssignmentGroups(
  target: UserAssignmentGroups,
  source: UserAssignmentGroups,
): UserAssignmentGroups {
  return {
    permissionSets: uniqueById([...target.permissionSets, ...source.permissionSets]),
    permissionSetGroups: uniqueById([
      ...target.permissionSetGroups,
      ...source.permissionSetGroups,
    ]),
    managedPackages: uniqueById([...target.managedPackages, ...source.managedPackages]),
    groups: uniqueById([...target.groups, ...source.groups]),
    queues: uniqueById([...target.queues, ...source.queues]),
  };
}

function flattenAssignmentGroups(groups: UserAssignmentGroups): NamedEntity[] {
  return uniqueById([
    ...groups.permissionSets,
    ...groups.permissionSetGroups,
    ...groups.managedPackages,
    ...groups.groups,
    ...groups.queues,
  ]);
}

let cachedPermissionFields: { name: string; label: string }[] | null = null;

async function getQueryablePermissionFields(
  client: SalesforceClient,
): Promise<{ name: string; label: string }[]> {
  if (cachedPermissionFields) {
    return cachedPermissionFields;
  }

  const describe = await client.describe('PermissionSet');

  cachedPermissionFields = (describe.fields ?? [])
    .filter(
      (field) =>
        field.name.startsWith('Permissions') &&
        (field.type === 'boolean' || field.type === 'checkbox'),
    )
    .map((field) => ({
      name: field.name,
      label:
        SYSTEM_PERMISSION_LABELS.get(field.name) ??
        field.label ??
        humanizePermissionField(field.name),
    }));

  return cachedPermissionFields;
}

async function loadSystemPermissions(
  client: SalesforceClient,
  permissionSetId: string,
  source: PermissionSource,
  map: Map<string, NormalizedPermission>,
): Promise<void> {
  const permissionFields = await getQueryablePermissionFields(client);

  for (const chunk of chunkArray(permissionFields, 75)) {
    const selectFields = ['Id', ...chunk.map((field) => field.name)].join(', ');
    const [ps] = await client.query<PermissionSetRecord>(
      `SELECT ${selectFields} FROM PermissionSet WHERE Id = '${permissionSetId}'`,
    );

    if (!ps) {
      continue;
    }

    chunk.forEach(({ name, label }) => {
      if (ps[name]) {
        addPermission(map, {
          category: 'system',
          key: `system:${name}`,
          label,
          value: 'Enabled',
          granted: true,
          source,
        });
      }
    });
  }
}

function formatSetupEntityLabel(
  record: SetupEntityRecord,
  nameMap: Map<string, string>,
): string {
  const typeLabel =
    SETUP_ENTITY_TYPE_LABELS[record.SetupEntityType] ?? record.SetupEntityType;
  const entityName = nameMap.get(record.SetupEntityId) ?? record.SetupEntityId;
  return `${typeLabel}: ${entityName}`;
}

async function resolveSetupEntityNames(
  client: SalesforceClient,
  records: SetupEntityRecord[],
): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  const idsByType = new Map<string, string[]>();

  records.forEach((record) => {
    if (setupEntityNameCache.has(record.SetupEntityId)) {
      nameMap.set(record.SetupEntityId, setupEntityNameCache.get(record.SetupEntityId)!);
      return;
    }

    if (!SETUP_ENTITY_RESOLVERS[record.SetupEntityType]) {
      return;
    }

    const existing = idsByType.get(record.SetupEntityType) ?? [];
    existing.push(record.SetupEntityId);
    idsByType.set(record.SetupEntityType, existing);
  });

  for (const [entityType, ids] of idsByType) {
    const resolver = SETUP_ENTITY_RESOLVERS[entityType];
    if (!resolver) {
      continue;
    }

    const uniqueIds = Array.from(new Set(ids));

    for (const chunk of chunkArray(uniqueIds, 200)) {
      const inClause = chunk.map((id) => `'${id}'`).join(',');
      const query = `SELECT Id, Name FROM ${resolver.objectName} WHERE Id IN (${inClause})`;
      const results = resolver.tooling
        ? await client.toolingQuery<{ Id: string; Name: string }>(query)
        : await client.query<{ Id: string; Name: string }>(query);

      results.forEach((result) => {
        nameMap.set(result.Id, result.Name);
        setupEntityNameCache.set(result.Id, result.Name);
      });
    }
  }

  return nameMap;
}

async function fetchPermissionSetData(
  client: SalesforceClient,
  permissionSetId: string,
  source: PermissionSource,
  map: Map<string, NormalizedPermission>,
): Promise<void> {
  await loadSystemPermissions(client, permissionSetId, source, map);

  const objectPerms = await client.query<ObjectPermissionRecord>(
    `SELECT SobjectType, PermissionsRead, PermissionsCreate, PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords FROM ObjectPermissions WHERE ParentId = '${permissionSetId}'`,
  );

  objectPerms.forEach((op) => {
    const value = formatObjectPerms(op);
    if (value !== 'None') {
      addPermission(map, {
        category: 'object',
        key: `object:${op.SobjectType}`,
        label: op.SobjectType,
        value,
        granted: true,
        source,
      });
    }
  });

  const fieldPerms = await client.query<FieldPermissionRecord>(
    `SELECT SobjectType, Field, PermissionsRead, PermissionsEdit FROM FieldPermissions WHERE ParentId = '${permissionSetId}'`,
  );

  fieldPerms.forEach((fp) => {
    const value = formatFieldPerms(fp);
    if (value !== 'None') {
      const fieldName = fp.Field.includes('.') ? fp.Field.split('.')[1] : fp.Field;
      addPermission(map, {
        category: 'field',
        key: `field:${fp.SobjectType}.${fieldName}`,
        label: `${fp.SobjectType}.${fieldName}`,
        value,
        granted: true,
        source,
      });
    }
  });

  const setupAccess = await client.query<SetupEntityRecord>(
    `SELECT SetupEntityId, SetupEntityType FROM SetupEntityAccess WHERE ParentId = '${permissionSetId}'`,
  );

  const setupEntityNames = await resolveSetupEntityNames(client, setupAccess);

  setupAccess.forEach((sa) => {
    addPermission(map, {
      category: 'setup',
      key: `setup:${sa.SetupEntityType}:${sa.SetupEntityId}`,
      label: formatSetupEntityLabel(sa, setupEntityNames),
      value: 'Enabled',
      granted: true,
      source,
    });
  });

  const tabSettings = await client.query<TabSettingRecord>(
    `SELECT Name, Visibility FROM PermissionSetTabSetting WHERE ParentId = '${permissionSetId}'`,
  );

  tabSettings.forEach((tab) => {
    if (tab.Visibility !== 'None') {
      addPermission(map, {
        category: 'tab',
        key: `tab:${tab.Name}`,
        label: tab.Name,
        value: tab.Visibility,
        granted: tab.Visibility !== 'None',
        source,
      });
    }
  });
}

async function queryPermissionSetGroupAssignments(
  client: SalesforceClient,
  userId: string,
): Promise<NamedEntity[]> {
  try {
    const fromAssignments = await client.query<PermissionSetGroupAssignmentRecord>(
      `SELECT PermissionSetGroupId, PermissionSetGroup.Id, PermissionSetGroup.DeveloperName, PermissionSetGroup.MasterLabel FROM PermissionSetAssignment WHERE AssigneeId = '${userId}' AND PermissionSetGroupId != null`,
    );

    if (fromAssignments.length > 0) {
      return fromAssignments.map((record) => ({
        id: record.PermissionSetGroup?.Id || record.PermissionSetGroupId,
        name: record.PermissionSetGroup?.DeveloperName || record.PermissionSetGroupId,
        label:
          record.PermissionSetGroup?.MasterLabel ||
          record.PermissionSetGroup?.DeveloperName ||
          record.PermissionSetGroupId,
        type: 'Permission Set Group',
      }));
    }
  } catch {
    // Fall back to PermissionSetGroupMember in orgs where that object exists.
  }

  try {
    const fromMembers = await client.query<PsgMemberRecord>(
      `SELECT PermissionSetGroupId, PermissionSetGroup.Id, PermissionSetGroup.DeveloperName, PermissionSetGroup.MasterLabel FROM PermissionSetGroupMember WHERE AssigneeId = '${userId}'`,
    );

    return fromMembers.map((record) => ({
      id: record.PermissionSetGroup.Id,
      name: record.PermissionSetGroup.DeveloperName,
      label:
        record.PermissionSetGroup.MasterLabel ||
        record.PermissionSetGroup.DeveloperName,
      type: 'Permission Set Group',
    }));
  } catch {
    return [];
  }
}

async function loadPermissionSetGroupAssignments(
  client: SalesforceClient,
  userId: string,
  map: Map<string, NormalizedPermission>,
  source: PermissionSource,
): Promise<UserAssignmentGroups> {
  const groups = emptyAssignmentGroups();
  const assignments = await queryPermissionSetGroupAssignments(client, userId);

  uniqueById(assignments).forEach((item) => {
    groups.permissionSetGroups.push(item);
    addUserAssignment(
      map,
      'permissionSetGroup',
      item.id,
      item.label || item.name,
      source,
    );
  });

  return groups;
}

async function loadUserAttributes(
  client: SalesforceClient,
  userId: string,
  userName: string,
  map: Map<string, NormalizedPermission>,
  warnings: string[],
): Promise<void> {
  const attributeFields = await getUserAttributeFields(client);
  const selectParts = Array.from(
    new Set(attributeFields.flatMap((field) => field.selectParts)),
  );
  const user: Record<string, unknown> = {};

  for (const chunk of chunkArray(selectParts, 75)) {
    const chunkRecord = await queryUserSelectParts(client, userId, chunk);
    mergeUserRecords(user, chunkRecord);
  }

  if (Object.keys(user).length === 0) {
    recordWarning(warnings, 'User attributes', new Error('No User fields could be loaded'));
    return;
  }

  const source = userSource(userId, userName);

  attributeFields.forEach((field) => {
    addPermission(map, {
      category: 'userAttribute',
      key: `userAttribute:${field.name}`,
      label: field.label,
      value: getUserFieldValue(user, field),
      granted: true,
      source,
    });
  });
}

async function loadUserGroupMemberships(
  client: SalesforceClient,
  userId: string,
  userName: string,
  map: Map<string, NormalizedPermission>,
): Promise<UserAssignmentGroups> {
  const members = await client.query<GroupMemberRecord>(
    `SELECT GroupId, Group.Id, Group.Name, Group.DeveloperName, Group.Type FROM GroupMember WHERE UserOrGroupId = '${userId}' ORDER BY Group.Type, Group.Name`,
  );

  const source = userSource(userId, userName);
  const groups = emptyAssignmentGroups();

  members.forEach((member) => {
    const label = member.Group.Name || member.Group.DeveloperName || member.GroupId;
    const item: NamedEntity = {
      id: member.GroupId,
      name: member.Group.DeveloperName || member.Group.Name,
      label,
      type: GROUP_TYPE_LABELS[member.Group.Type] ?? member.Group.Type,
    };

    if (member.Group.Type === 'Queue') {
      groups.queues.push(item);
      addUserAssignment(map, 'queue', member.GroupId, label, source);
      return;
    }

    if (member.Group.Type === 'Regular') {
      groups.groups.push(item);
      addUserAssignment(map, 'group', member.GroupId, label, source);
    }
  });

  return groups;
}

export async function listUsers(client: SalesforceClient): Promise<NamedEntity[]> {
  const users = await client.query<{ Id: string; Name: string; Username: string }>(
    `SELECT Id, Name, Username FROM User WHERE IsActive = true ORDER BY Name LIMIT 2000`,
  );
  return users.map((u) => ({
    id: u.Id,
    name: u.Name,
    label: u.Username,
  }));
}

export async function listProfiles(client: SalesforceClient): Promise<NamedEntity[]> {
  const profiles = await client.query<{ Id: string; Name: string }>(
    `SELECT Id, Name FROM Profile ORDER BY Name`,
  );
  return profiles.map((p) => ({ id: p.Id, name: p.Name, label: p.Name }));
}

export async function listPermissionSets(
  client: SalesforceClient,
): Promise<NamedEntity[]> {
  const sets = await client.query<PermissionSetRecord>(
    `SELECT Id, Name, Label FROM PermissionSet WHERE IsOwnedByProfile = false AND Type = 'Regular' ORDER BY Label`,
  );
  return sets.map((s) => ({
    id: s.Id,
    name: s.Name,
    label: s.Label,
  }));
}

export async function listPermissionSetGroups(
  client: SalesforceClient,
): Promise<NamedEntity[]> {
  const groups = await client.query<{
    Id: string;
    DeveloperName: string;
    MasterLabel: string;
  }>(`SELECT Id, DeveloperName, MasterLabel FROM PermissionSetGroup ORDER BY MasterLabel`);

  return groups.map((g) => ({
    id: g.Id,
    name: g.DeveloperName,
    label: g.MasterLabel,
  }));
}

export async function loadUserPermissions(
  client: SalesforceClient,
  userId: string,
  userName: string,
): Promise<PermissionBundle> {
  const warnings: string[] = [];
  const map = new Map<string, NormalizedPermission>();
  const source = userSource(userId, userName);

  await loadUserAttributes(client, userId, userName, map, warnings);

  const attributeCount = Array.from(map.values()).filter(
    (permission) => permission.category === 'userAttribute',
  ).length;
  if (attributeCount === 0) {
    warnings.push('No user attributes could be loaded.');
  }

  const psgAssignments = await loadPermissionSetGroupAssignments(
    client,
    userId,
    map,
    source,
  );

  const groupMemberships = await runOptionalLoad(
    warnings,
    'Public groups and queues',
    () => loadUserGroupMemberships(client, userId, userName, map),
    emptyAssignmentGroups(),
  );

  const mergedAssignmentGroups = mergeAssignmentGroups(
    psgAssignments,
    groupMemberships,
  );

  return {
    entityId: userId,
    entityName: userName,
    entityType: 'user',
    permissions: Array.from(map.values()).sort((a, b) =>
      a.category.localeCompare(b.category) || a.label.localeCompare(b.label),
    ),
    assignments: flattenAssignmentGroups(mergedAssignmentGroups),
    assignmentGroups: mergedAssignmentGroups,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export async function loadProfilePermissions(
  client: SalesforceClient,
  profileId: string,
  profileName: string,
): Promise<PermissionBundle> {
  const [profilePs] = await client.query<PermissionSetRecord>(
    `SELECT Id, Name, Label FROM PermissionSet WHERE IsOwnedByProfile = true AND ProfileId = '${profileId}'`,
  );

  if (!profilePs) {
    throw new Error('Profile permission set not found');
  }

  const map = new Map<string, NormalizedPermission>();
  const source: PermissionSource = {
    sourceType: 'profile',
    sourceId: profilePs.Id,
    sourceName: profileName,
  };

  await fetchPermissionSetData(client, profilePs.Id, source, map);

  return {
    entityId: profileId,
    entityName: profileName,
    entityType: 'profile',
    permissions: Array.from(map.values()).sort((a, b) =>
      a.category.localeCompare(b.category) || a.label.localeCompare(b.label),
    ),
  };
}

export async function loadPermissionSetPermissions(
  client: SalesforceClient,
  permissionSetId: string,
  permissionSetName: string,
): Promise<PermissionBundle> {
  const map = new Map<string, NormalizedPermission>();
  const source: PermissionSource = {
    sourceType: 'permissionSet',
    sourceId: permissionSetId,
    sourceName: permissionSetName,
  };

  await fetchPermissionSetData(client, permissionSetId, source, map);

  return {
    entityId: permissionSetId,
    entityName: permissionSetName,
    entityType: 'permissionSet',
    permissions: Array.from(map.values()).sort((a, b) =>
      a.category.localeCompare(b.category) || a.label.localeCompare(b.label),
    ),
  };
}

export async function loadPermissionSetGroupPermissions(
  client: SalesforceClient,
  groupId: string,
  groupName: string,
): Promise<PermissionBundle> {
  const components = await client.query<PsgComponentRecord>(
    `SELECT PermissionSetGroupId, PermissionSetId, PermissionSet.Id, PermissionSet.Name, PermissionSet.Label FROM PermissionSetGroupComponent WHERE PermissionSetGroupId = '${groupId}' ORDER BY PermissionSet.Label, PermissionSet.Name`,
  );

  const groupMembers: NamedEntity[] = components.map((c) => ({
    id: c.PermissionSet.Id,
    name: c.PermissionSet.Name,
    label: c.PermissionSet.Label || c.PermissionSet.Name,
    type: 'Permission Set',
  }));

  const map = new Map<string, NormalizedPermission>();
  const source: PermissionSource = {
    sourceType: 'permissionSetGroup',
    sourceId: groupId,
    sourceName: groupName,
  };

  groupMembers.forEach((member) => {
    addPermission(map, {
      category: 'groupMember',
      key: `member:${member.id}`,
      label: member.label || member.name,
      value: 'Included',
      granted: true,
      source,
    });
  });

  return {
    entityId: groupId,
    entityName: groupName,
    entityType: 'permissionSetGroup',
    permissions: Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label)),
    groupMembers,
  };
}

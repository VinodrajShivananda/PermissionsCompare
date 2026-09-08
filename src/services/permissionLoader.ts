import { SalesforceClient } from '../api/salesforceClient';
import { OBJECT_CRUD_FIELDS, SYSTEM_PERMISSION_LABELS } from '../constants/systemPermissions';
import type {
  NamedEntity,
  NormalizedPermission,
  PermissionBundle,
  PermissionSource,
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

interface UserRecord {
  Id: string;
  Name: string;
  Username: string;
  ProfileId: string;
  Profile: { Name: string };
}

interface AssignmentRecord {
  PermissionSetId: string;
  PermissionSet: { Id: string; Name: string; Label: string };
}

interface PsgMemberRecord {
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

function uniqueById(items: NamedEntity[]): NamedEntity[] {
  const map = new Map<string, NamedEntity>();
  items.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
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

async function resolvePermissionSetsForUser(
  client: SalesforceClient,
  userId: string,
): Promise<{ sources: PermissionSource[]; assignments: NamedEntity[] }> {
  const [user] = await client.query<UserRecord>(
    `SELECT Id, Name, Username, ProfileId, Profile.Name FROM User WHERE Id = '${userId}'`,
  );

  if (!user) {
    throw new Error('User not found');
  }

  const sources: PermissionSource[] = [];
  const assignments: NamedEntity[] = [];

  const [profilePs] = await client.query<PermissionSetRecord>(
    `SELECT Id, Name, Label FROM PermissionSet WHERE IsOwnedByProfile = true AND ProfileId = '${user.ProfileId}'`,
  );

  if (profilePs) {
    sources.push({
      sourceType: 'profile',
      sourceId: profilePs.Id,
      sourceName: user.Profile.Name,
    });
    assignments.push({
      id: profilePs.Id,
      name: user.Profile.Name,
      label: user.Profile.Name,
      type: 'Profile',
    });
  }

  const psAssignments = await client.query<AssignmentRecord>(
    `SELECT PermissionSetId, PermissionSet.Id, PermissionSet.Name, PermissionSet.Label FROM PermissionSetAssignment WHERE AssigneeId = '${userId}' AND PermissionSet.IsOwnedByProfile = false`,
  );

  psAssignments.forEach((a) => {
    sources.push({
      sourceType: 'permissionSet',
      sourceId: a.PermissionSet.Id,
      sourceName: a.PermissionSet.Label || a.PermissionSet.Name,
    });
    assignments.push({
      id: a.PermissionSet.Id,
      name: a.PermissionSet.Name,
      label: a.PermissionSet.Label,
      type: 'Permission Set',
    });
  });

  const psgMembers = await client.query<PsgMemberRecord>(
    `SELECT PermissionSetGroupId, PermissionSetGroup.Id, PermissionSetGroup.DeveloperName, PermissionSetGroup.MasterLabel FROM PermissionSetGroupMember WHERE AssigneeId = '${userId}'`,
  );

  for (const member of psgMembers) {
    const psgName =
      member.PermissionSetGroup.MasterLabel ||
      member.PermissionSetGroup.DeveloperName;
    assignments.push({
      id: member.PermissionSetGroup.Id,
      name: member.PermissionSetGroup.DeveloperName,
      label: psgName,
      type: 'Permission Set Group',
    });

    const components = await client.query<PsgComponentRecord>(
      `SELECT PermissionSetGroupId, PermissionSetId, PermissionSet.Id, PermissionSet.Name, PermissionSet.Label FROM PermissionSetGroupComponent WHERE PermissionSetGroupId = '${member.PermissionSetGroupId}'`,
    );

    components.forEach((c) => {
      sources.push({
        sourceType: 'permissionSetGroup',
        sourceId: c.PermissionSet.Id,
        sourceName: `${psgName} → ${c.PermissionSet.Label || c.PermissionSet.Name}`,
      });
    });
  }

  return { sources, assignments: uniqueById(assignments) };
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
  const { sources, assignments } = await resolvePermissionSetsForUser(client, userId);
  const map = new Map<string, NormalizedPermission>();

  for (const source of sources) {
    await fetchPermissionSetData(client, source.sourceId, source, map);
  }

  return {
    entityId: userId,
    entityName: userName,
    entityType: 'user',
    permissions: Array.from(map.values()).sort((a, b) =>
      a.category.localeCompare(b.category) || a.label.localeCompare(b.label),
    ),
    assignments,
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
    `SELECT PermissionSetGroupId, PermissionSetId, PermissionSet.Id, PermissionSet.Name, PermissionSet.Label FROM PermissionSetGroupComponent WHERE PermissionSetGroupId = '${groupId}'`,
  );

  const groupMembers: NamedEntity[] = components.map((c) => ({
    id: c.PermissionSet.Id,
    name: c.PermissionSet.Name,
    label: c.PermissionSet.Label,
    type: 'Permission Set',
  }));

  const map = new Map<string, NormalizedPermission>();

  for (const component of components) {
    const source: PermissionSource = {
      sourceType: 'permissionSetGroup',
      sourceId: component.PermissionSet.Id,
      sourceName: `${groupName} → ${component.PermissionSet.Label || component.PermissionSet.Name}`,
    };
    await fetchPermissionSetData(client, component.PermissionSet.Id, source, map);
  }

  groupMembers.forEach((member) => {
    addPermission(map, {
      category: 'groupMember',
      key: `member:${member.id}`,
      label: member.label || member.name,
      value: 'Included',
      granted: true,
      source: {
        sourceType: 'permissionSetGroup',
        sourceId: groupId,
        sourceName: groupName,
      },
    });
  });

  return {
    entityId: groupId,
    entityName: groupName,
    entityType: 'permissionSetGroup',
    permissions: Array.from(map.values()).sort((a, b) =>
      a.category.localeCompare(b.category) || a.label.localeCompare(b.label),
    ),
    groupMembers,
  };
}

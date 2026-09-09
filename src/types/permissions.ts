export type PermissionCategory =
  | 'object'
  | 'field'
  | 'system'
  | 'tab'
  | 'setup'
  | 'assignment'
  | 'groupMember'
  | 'userAttribute'
  | 'groupMembership'
  | 'permissionSet'
  | 'permissionSetGroup'
  | 'managedPackage'
  | 'group'
  | 'queue'
  | 'permissionSetLicense';

export type DiffStatus = 'same' | 'onlyA' | 'onlyB' | 'different';

export interface SalesforceSession {
  id: string;
  accessToken: string;
  instanceUrl: string;
  identityUrl?: string;
  userId: string;
  orgId: string;
  username: string;
  displayName: string;
  orgName: string;
  isSandbox: boolean;
  authorizedAt: string;
  lastUsedAt: string;
}

export interface NamedEntity {
  id: string;
  name: string;
  label?: string;
  type?: string;
}

export interface PermissionSource {
  sourceType: 'profile' | 'permissionSet' | 'permissionSetGroup' | 'user';
  sourceId: string;
  sourceName: string;
}

export interface NormalizedPermission {
  category: PermissionCategory;
  key: string;
  label: string;
  value: string;
  granted: boolean;
  sources: PermissionSource[];
}

export interface UserAssignmentGroups {
  permissionSets: NamedEntity[];
  permissionSetGroups: NamedEntity[];
  managedPackages: NamedEntity[];
  groups: NamedEntity[];
  queues: NamedEntity[];
}

export interface PermissionBundle {
  entityId: string;
  entityName: string;
  entityType: 'user' | 'profile' | 'permissionSet' | 'permissionSetGroup';
  permissions: NormalizedPermission[];
  assignments?: NamedEntity[];
  assignmentGroups?: UserAssignmentGroups;
  groupMembers?: NamedEntity[];
  warnings?: string[];
}

export interface PermissionDiff {
  category: PermissionCategory;
  key: string;
  label: string;
  status: DiffStatus;
  valueA: string;
  valueB: string;
  sourcesA: string[];
  sourcesB: string[];
}

export interface CompareResult {
  entityA: { id: string; name: string };
  entityB: { id: string; name: string };
  diffs: PermissionDiff[];
  summary: {
    total: number;
    same: number;
    onlyA: number;
    onlyB: number;
    different: number;
  };
}

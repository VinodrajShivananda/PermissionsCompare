import type {
  CompareResult,
  NormalizedPermission,
  PermissionBundle,
  PermissionDiff,
  DiffStatus,
  PermissionCategory,
} from '../types/permissions';

function sourceLabels(permission?: NormalizedPermission): string[] {
  if (!permission) return [];
  return permission.sources.map((s) => s.sourceName);
}

function determineStatus(values: string[]): DiffStatus {
  const uniqueValues = new Set(values);
  return uniqueValues.size <= 1 ? 'same' : 'mixed';
}

export function formatDiffStatus(status: DiffStatus): string {
  switch (status) {
    case 'same':
      return 'Same';
    case 'mixed':
      return 'Mixed';
    default:
      return status;
  }
}

export function compareBundles(
  bundles: PermissionBundle[],
  options?: { includeSameCategories?: PermissionCategory[] },
): CompareResult {
  const entities = bundles.map((bundle) => ({
    id: bundle.entityId,
    name: bundle.entityName,
  }));
  const maps = bundles.map(
    (bundle) => new Map(bundle.permissions.map((permission) => [permission.key, permission])),
  );
  const allKeys = new Set<string>();
  maps.forEach((map) => {
    map.forEach((_, key) => allKeys.add(key));
  });

  const diffs: PermissionDiff[] = [];

  allKeys.forEach((key) => {
    const perms = maps.map((map) => map.get(key));
    const reference = perms.find((perm) => perm !== undefined);
    if (!reference) {
      return;
    }

    const values: Record<string, string> = {};
    const sources: Record<string, string[]> = {};

    bundles.forEach((bundle, index) => {
      const perm = maps[index].get(key);
      values[bundle.entityId] = perm?.value ?? '—';
      sources[bundle.entityId] = sourceLabels(perm);
    });

    const status = determineStatus(Object.values(values));

    if (
      status === 'same' &&
      !options?.includeSameCategories?.includes(reference.category)
    ) {
      return;
    }

    diffs.push({
      category: reference.category,
      key,
      label: reference.label,
      status,
      values,
      sources,
    });
  });

  diffs.sort(
    (a, b) =>
      a.category.localeCompare(b.category) ||
      a.label.localeCompare(b.label),
  );

  const summary = {
    total: diffs.filter((diff) => diff.status === 'mixed').length,
    same: diffs.filter((diff) => diff.status === 'same').length,
    mixed: diffs.filter((diff) => diff.status === 'mixed').length,
  };

  return {
    entities,
    diffs,
    summary,
  };
}

export function exportDiffsToCsv(result: CompareResult): string {
  const headers = [
    'Category',
    'Permission',
    'Status',
    ...result.entities.map((entity) => entity.name),
  ];

  const rows = result.diffs.map((diff) => [
    diff.category,
    diff.label,
    formatDiffStatus(diff.status),
    ...result.entities.map((entity) => diff.values[entity.id] ?? '—'),
  ]);

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

  return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
}

import type {
  CompareResult,
  NormalizedPermission,
  PermissionBundle,
  PermissionDiff,
  DiffStatus,
} from '../types/permissions';

function sourceLabels(permission?: NormalizedPermission): string[] {
  if (!permission) return [];
  return permission.sources.map((s) => s.sourceName);
}

function determineStatus(
  permA?: NormalizedPermission,
  permB?: NormalizedPermission,
): DiffStatus {
  if (!permA && permB) return 'onlyB';
  if (permA && !permB) return 'onlyA';
  if (!permA && !permB) return 'same';

  if (permA!.granted === permB!.granted && permA!.value === permB!.value) {
    return 'same';
  }

  return 'different';
}

export function formatDiffStatus(
  status: DiffStatus,
  entityAName: string,
  entityBName: string,
): string {
  switch (status) {
    case 'onlyA':
      return entityAName;
    case 'onlyB':
      return entityBName;
    case 'different':
      return 'Different';
    case 'same':
      return 'Same';
    default:
      return status;
  }
}

export function compareBundles(
  bundleA: PermissionBundle,
  bundleB: PermissionBundle,
): CompareResult {
  const mapA = new Map(bundleA.permissions.map((p) => [p.key, p]));
  const mapB = new Map(bundleB.permissions.map((p) => [p.key, p]));
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);

  const diffs: PermissionDiff[] = [];

  allKeys.forEach((key) => {
    const permA = mapA.get(key);
    const permB = mapB.get(key);
    const status = determineStatus(permA, permB);

    if (status === 'same') return;

    const reference = permA ?? permB!;

    diffs.push({
      category: reference.category,
      key,
      label: reference.label,
      status,
      valueA: permA?.value ?? '—',
      valueB: permB?.value ?? '—',
      sourcesA: sourceLabels(permA),
      sourcesB: sourceLabels(permB),
    });
  });

  diffs.sort(
    (a, b) =>
      a.category.localeCompare(b.category) ||
      a.label.localeCompare(b.label),
  );

  const summary = {
    total: diffs.length,
    same: 0,
    onlyA: diffs.filter((d) => d.status === 'onlyA').length,
    onlyB: diffs.filter((d) => d.status === 'onlyB').length,
    different: diffs.filter((d) => d.status === 'different').length,
  };

  return {
    entityA: { id: bundleA.entityId, name: bundleA.entityName },
    entityB: { id: bundleB.entityId, name: bundleB.entityName },
    diffs,
    summary,
  };
}

export function exportDiffsToCsv(result: CompareResult): string {
  const headers = [
    'Category',
    'Permission',
    'Status',
    `${result.entityA.name} Value`,
    `${result.entityB.name} Value`,
  ];

  const rows = result.diffs.map((d) => [
    d.category,
    d.label,
    formatDiffStatus(d.status, result.entityA.name, result.entityB.name),
    d.valueA,
    d.valueB,
  ]);

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

  return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
}

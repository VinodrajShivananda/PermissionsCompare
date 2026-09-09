import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import type { CompareResult, PermissionCategory, DiffStatus, PermissionDiff } from '../types/permissions';
import { exportDiffsToCsv, formatDiffStatus } from '../services/compareService';
import { CATEGORY_LABELS } from '../constants/userCompareSections';
import type { CompareSection } from '../constants/userCompareSections';

const DEFAULT_CATEGORIES: PermissionCategory[] = [
  'userAttribute',
  'permissionSet',
  'permissionSetGroup',
  'managedPackage',
  'group',
  'queue',
  'permissionSetLicense',
  'assignment',
  'groupMembership',
  'object',
  'field',
  'system',
  'tab',
  'setup',
  'groupMember',
];

const STATUS_OPTIONS: DiffStatus[] = ['onlyA', 'onlyB', 'different', 'same'];

interface DiffTableProps {
  result: CompareResult;
  sections?: CompareSection[];
  alwaysShowEmptySections?: boolean;
}

function filterDiffs(
  diffs: PermissionDiff[],
  search: string,
  categoryFilter: PermissionCategory | 'all',
  statusFilter: DiffStatus | 'all',
): PermissionDiff[] {
  return diffs.filter((diff) => {
    const matchesSearch =
      !search ||
      diff.label.toLowerCase().includes(search.toLowerCase()) ||
      diff.key.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      categoryFilter === 'all' || diff.category === categoryFilter;

    const matchesStatus =
      statusFilter === 'all' || diff.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });
}

function DiffTableBody({
  diffs,
  entityAName,
  entityBName,
  showCategory = false,
}: {
  diffs: PermissionDiff[];
  entityAName: string;
  entityBName: string;
  showCategory?: boolean;
}) {
  const formatStatus = (status: DiffStatus) =>
    formatDiffStatus(status, entityAName, entityBName);

  if (diffs.length === 0) {
    return <p className="no-results">No items found matching your filters.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {showCategory && <th>Category</th>}
            <th>Item</th>
            <th>Status</th>
            <th>{entityAName}</th>
            <th>{entityBName}</th>
          </tr>
        </thead>
        <tbody>
          {diffs.map((diff) => (
            <tr key={diff.key} className={`status-${diff.status}`}>
              {showCategory && (
                <td><span className="badge">{CATEGORY_LABELS[diff.category] ?? diff.category}</span></td>
              )}
              <td>{diff.label}</td>
              <td>
                <span className={`status-badge ${diff.status}`}>
                  {formatStatus(diff.status)}
                </span>
              </td>
              <td>{diff.valueA}</td>
              <td>{diff.valueB}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DiffTable({ result, sections, alwaysShowEmptySections }: DiffTableProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PermissionCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<DiffStatus | 'all'>('all');

  const categories = sections
    ? sections.map((section) => section.category)
    : DEFAULT_CATEGORIES;

  const filtered = useMemo(
    () => filterDiffs(result.diffs, search, categoryFilter, statusFilter),
    [result.diffs, search, categoryFilter, statusFilter],
  );

  const visibleSections = useMemo(() => {
    if (!sections) {
      return [];
    }

    if (categoryFilter === 'all') {
      return sections;
    }

    return sections.filter((section) => section.category === categoryFilter);
  }, [sections, categoryFilter]);

  const handleExport = () => {
    const csv = exportDiffsToCsv(result);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `permission-compare-${result.entityA.name}-vs-${result.entityB.name}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card diff-panel">
      <div className="results-header">
        <h2>Comparison Results ({result.summary.total} differences)</h2>
        <button type="button" className="btn-outline" onClick={handleExport}>
          <Download size={16} />
          Export CSV
        </button>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <span className="summary-value">{result.summary.total}</span>
          <span className="summary-label">Total Differences</span>
        </div>
        <div className="summary-card only-a">
          <span className="summary-value">{result.summary.onlyA}</span>
          <span className="summary-label">Only {result.entityA.name}</span>
        </div>
        <div className="summary-card only-b">
          <span className="summary-value">{result.summary.onlyB}</span>
          <span className="summary-label">Only {result.entityB.name}</span>
        </div>
        <div className="summary-card different">
          <span className="summary-value">{result.summary.different}</span>
          <span className="summary-label">Different Values</span>
        </div>
      </div>

      <div className="diff-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as PermissionCategory | 'all')}
        >
          <option value="all">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat] ?? cat}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DiffStatus | 'all')}
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {formatDiffStatus(status, result.entityA.name, result.entityB.name)}
            </option>
          ))}
        </select>
      </div>

      {sections ? (
        <div className="diff-sections">
          {visibleSections.map((section) => {
            const sectionDiffs = filtered.filter(
              (diff) => diff.category === section.category,
            );
            const showEmptySection =
              categoryFilter !== 'all' || alwaysShowEmptySections;

            if (sectionDiffs.length === 0 && !showEmptySection) {
              return null;
            }

            return (
              <section key={section.category} className="diff-section">
                <h3>{section.title}</h3>
                {sectionDiffs.length === 0 ? (
                  <p className="hint">No items in this section.</p>
                ) : (
                  <DiffTableBody
                    diffs={sectionDiffs}
                    entityAName={result.entityA.name}
                    entityBName={result.entityB.name}
                  />
                )}
              </section>
            );
          })}
          {visibleSections.length === 0 && (
            <p className="no-results">No items found matching your filters.</p>
          )}
        </div>
      ) : (
        <DiffTableBody
          diffs={filtered}
          entityAName={result.entityA.name}
          entityBName={result.entityB.name}
          showCategory
        />
      )}
    </div>
  );
}

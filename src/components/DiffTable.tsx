import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import type { CompareResult, PermissionCategory, DiffStatus } from '../types/permissions';
import { exportDiffsToCsv, formatDiffStatus } from '../services/compareService';

const CATEGORIES: PermissionCategory[] = [
  'object',
  'field',
  'system',
  'tab',
  'setup',
  'assignment',
  'groupMember',
];

const STATUS_OPTIONS: DiffStatus[] = ['onlyA', 'onlyB', 'different'];

interface DiffTableProps {
  result: CompareResult;
}

export function DiffTable({ result }: DiffTableProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PermissionCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<DiffStatus | 'all'>('all');

  const formatStatus = (status: DiffStatus) =>
    formatDiffStatus(status, result.entityA.name, result.entityB.name);

  const filtered = useMemo(() => {
    return result.diffs.filter((diff) => {
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
  }, [result.diffs, search, categoryFilter, statusFilter]);

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
    <div className="diff-panel">
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
            placeholder="Search permissions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as PermissionCategory | 'all')}
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DiffStatus | 'all')}
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>{formatStatus(status)}</option>
          ))}
        </select>

        <button type="button" className="btn btn-secondary" onClick={handleExport}>
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state card">
          <p>No differences found matching your filters.</p>
        </div>
      ) : (
        <div className="table-wrapper card">
          <table className="diff-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Permission</th>
                <th>Status</th>
                <th>{result.entityA.name}</th>
                <th>{result.entityB.name}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((diff) => (
                <tr key={diff.key} className={`status-${diff.status}`}>
                  <td><span className="badge">{diff.category}</span></td>
                  <td>{diff.label}</td>
                  <td><span className={`status-badge ${diff.status}`}>{formatStatus(diff.status)}</span></td>
                  <td>{diff.valueA}</td>
                  <td>{diff.valueB}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

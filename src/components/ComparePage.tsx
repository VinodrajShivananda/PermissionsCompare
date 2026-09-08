import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSalesforce } from '../auth/SalesforceContext';
import { EntityPicker } from './EntityPicker';
import { DiffTable } from './DiffTable';
import { compareBundles } from '../services/compareService';
import type { NamedEntity, PermissionBundle, CompareResult } from '../types/permissions';

interface ComparePageProps {
  title: string;
  description: string;
  loadEntities: (client: import('../api/salesforceClient').SalesforceClient) => Promise<NamedEntity[]>;
  loadBundle: (
    client: import('../api/salesforceClient').SalesforceClient,
    entity: NamedEntity,
  ) => Promise<PermissionBundle>;
}

export function ComparePage({
  title,
  description,
  loadEntities,
  loadBundle,
}: ComparePageProps) {
  const { client } = useSalesforce();
  const [entities, setEntities] = useState<NamedEntity[]>([]);
  const [entityAId, setEntityAId] = useState('');
  const [entityBId, setEntityBId] = useState('');
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [meta, setMeta] = useState<{ assignmentsA?: NamedEntity[]; assignmentsB?: NamedEntity[]; groupMembersA?: NamedEntity[]; groupMembersB?: NamedEntity[] } | null>(null);

  useEffect(() => {
    if (!client) return;

    setLoadingEntities(true);
    setError(null);
    loadEntities(client)
      .then(setEntities)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingEntities(false));
  }, [client, loadEntities]);

  const handleCompare = async () => {
    if (!client || !entityAId || !entityBId) return;

    const entityA = entities.find((e) => e.id === entityAId);
    const entityB = entities.find((e) => e.id === entityBId);

    if (!entityA || !entityB) return;

    setComparing(true);
    setError(null);
    setResult(null);

    try {
      const [bundleA, bundleB] = await Promise.all([
        loadBundle(client, entityA),
        loadBundle(client, entityB),
      ]);

      setResult(compareBundles(bundleA, bundleB));
      setMeta({
        assignmentsA: bundleA.assignments,
        assignmentsB: bundleB.assignments,
        groupMembersA: bundleA.groupMembers,
        groupMembersB: bundleB.groupMembers,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setComparing(false);
    }
  };

  return (
    <div className="compare-page">
      <div className="page-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h2>Select Entities</h2>
        <p className="hint">Choose two items to compare their permissions.</p>

        {loadingEntities ? (
          <div className="loading-inline">
            <Loader2 className="spin" size={20} />
            Loading options...
          </div>
        ) : (
          <div className="compare-selectors">
            <EntityPicker
              label="Entity A"
              entities={entities}
              value={entityAId}
              onChange={setEntityAId}
              disabled={comparing}
            />
            <EntityPicker
              label="Entity B"
              entities={entities}
              value={entityBId}
              onChange={setEntityBId}
              disabled={comparing}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={handleCompare}
              disabled={!entityAId || !entityBId || comparing || entityAId === entityBId}
            >
              {comparing ? 'Comparing...' : 'Compare'}
            </button>
          </div>
        )}

        {entityAId && entityBId && entityAId === entityBId && (
          <p className="error-text">Select two different entities to compare.</p>
        )}
      </div>

      {meta && (meta.assignmentsA || meta.assignmentsB) && (
        <div className="assignments-grid">
          {meta.assignmentsA && (
            <div className="card">
              <h3>Assignments — {result?.entityA.name}</h3>
              <ul>
                {meta.assignmentsA.map((a) => (
                  <li key={a.id}><strong>{a.type}:</strong> {a.label || a.name}</li>
                ))}
              </ul>
            </div>
          )}
          {meta.assignmentsB && (
            <div className="card">
              <h3>Assignments — {result?.entityB.name}</h3>
              <ul>
                {meta.assignmentsB.map((a) => (
                  <li key={a.id}><strong>{a.type}:</strong> {a.label || a.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {meta && (meta.groupMembersA || meta.groupMembersB) && (
        <div className="assignments-grid">
          {meta.groupMembersA && (
            <div className="card">
              <h3>Group Members — {result?.entityA.name}</h3>
              <ul>
                {meta.groupMembersA.map((m) => (
                  <li key={m.id}>{m.label || m.name}</li>
                ))}
              </ul>
            </div>
          )}
          {meta.groupMembersB && (
            <div className="card">
              <h3>Group Members — {result?.entityB.name}</h3>
              <ul>
                {meta.groupMembersB.map((m) => (
                  <li key={m.id}>{m.label || m.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {result && <DiffTable result={result} />}
    </div>
  );
}

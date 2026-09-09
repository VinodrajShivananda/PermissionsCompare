import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSalesforce } from '../auth/SalesforceContext';
import { EntityPicker } from './EntityPicker';
import { DiffTable } from './DiffTable';
import { compareBundles } from '../services/compareService';
import type { NamedEntity, PermissionBundle, CompareResult } from '../types/permissions';
import type { CompareSection } from '../constants/userCompareSections';

interface ComparePageProps {
  title: string;
  description: string;
  loadEntities: (client: import('../api/salesforceClient').SalesforceClient) => Promise<NamedEntity[]>;
  loadBundle: (
    client: import('../api/salesforceClient').SalesforceClient,
    entity: NamedEntity,
  ) => Promise<PermissionBundle>;
  includeSameCategories?: import('../types/permissions').PermissionCategory[];
  compareSections?: CompareSection[];
  alwaysShowEmptySections?: boolean;
}

export function ComparePage({
  title,
  description,
  loadEntities,
  loadBundle,
  includeSameCategories,
  compareSections,
  alwaysShowEmptySections,
}: ComparePageProps) {
  const { client } = useSalesforce();
  const [entities, setEntities] = useState<NamedEntity[]>([]);
  const [entityAId, setEntityAId] = useState('');
  const [entityBId, setEntityBId] = useState('');
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

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
    setWarnings([]);

    try {
      const [bundleA, bundleB] = await Promise.all([
        loadBundle(client, entityA),
        loadBundle(client, entityB),
      ]);

      setResult(
        compareBundles(bundleA, bundleB, {
          includeSameCategories,
        }),
      );
      setWarnings(
        Array.from(
          new Set([...(bundleA.warnings ?? []), ...(bundleB.warnings ?? [])]),
        ),
      );
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

      {warnings.length > 0 && (
        <div className="warning-banner">
          <strong>Some data could not be loaded. Available assignments and differences are shown below.</strong>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

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

      {result && (
        <DiffTable
          result={result}
          sections={compareSections}
          alwaysShowEmptySections={alwaysShowEmptySections}
        />
      )}
    </div>
  );
}

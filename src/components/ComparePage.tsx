import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSalesforce } from '../auth/SalesforceContext';
import { MultiEntityPicker } from './MultiEntityPicker';
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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

  const canCompare = selectedIds.length >= 2;

  const handleCompare = async () => {
    if (!client || !canCompare) return;

    const selectedEntities = selectedIds
      .map((id) => entities.find((entity) => entity.id === id))
      .filter((entity): entity is NamedEntity => entity !== undefined);

    if (selectedEntities.length !== selectedIds.length) {
      return;
    }

    setComparing(true);
    setError(null);
    setResult(null);
    setWarnings([]);

    try {
      const bundles = await Promise.all(
        selectedEntities.map((entity) => loadBundle(client, entity)),
      );

      setResult(
        compareBundles(bundles, {
          includeSameCategories,
        }),
      );
      setWarnings(
        Array.from(
          new Set(bundles.flatMap((bundle) => bundle.warnings ?? [])),
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
        <p className="hint">Add two or more items to compare side by side.</p>

        {loadingEntities ? (
          <div className="loading-inline">
            <Loader2 className="spin" size={20} />
            Loading options...
          </div>
        ) : (
          <div className="compare-selectors">
            <MultiEntityPicker
              label="Items to compare"
              entities={entities}
              selectedIds={selectedIds}
              onChange={setSelectedIds}
              disabled={comparing}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={handleCompare}
              disabled={!canCompare || comparing}
            >
              {comparing ? 'Comparing...' : 'Compare'}
            </button>
          </div>
        )}

        {selectedIds.length === 1 && (
          <p className="error-text">Add at least one more item to compare.</p>
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

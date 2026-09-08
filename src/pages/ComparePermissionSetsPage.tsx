import { ComparePage } from '../components/ComparePage';
import {
  listPermissionSets,
  loadPermissionSetPermissions,
} from '../services/permissionLoader';

export function ComparePermissionSetsPage() {
  return (
    <ComparePage
      title="Compare Permission Sets"
      description="Compare permissions granted by two permission sets side by side."
      loadEntities={listPermissionSets}
      loadBundle={(client, entity) =>
        loadPermissionSetPermissions(client, entity.id, entity.label || entity.name)
      }
    />
  );
}

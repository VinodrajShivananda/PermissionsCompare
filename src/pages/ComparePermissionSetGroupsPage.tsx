import { ComparePage } from '../components/ComparePage';
import {
  listPermissionSetGroups,
  loadPermissionSetGroupPermissions,
} from '../services/permissionLoader';

export function ComparePermissionSetGroupsPage() {
  return (
    <ComparePage
      title="Compare Permission Set Groups"
      description="Compare member permission sets and combined permissions between two permission set groups."
      loadEntities={listPermissionSetGroups}
      loadBundle={(client, entity) =>
        loadPermissionSetGroupPermissions(client, entity.id, entity.label || entity.name)
      }
    />
  );
}

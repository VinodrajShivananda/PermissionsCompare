import { ComparePage } from '../components/ComparePage';
import { PSG_COMPARE_SECTIONS } from '../constants/userCompareSections';
import {
  listPermissionSetGroups,
  loadPermissionSetGroupPermissions,
} from '../services/permissionLoader';

export function ComparePermissionSetGroupsPage() {
  return (
    <ComparePage
      title="Compare Permission Set Groups"
      description="Compare which permission sets are included in each permission set group."
      loadEntities={listPermissionSetGroups}
      loadBundle={(client, entity) =>
        loadPermissionSetGroupPermissions(client, entity.id, entity.label || entity.name)
      }
      compareSections={PSG_COMPARE_SECTIONS}
      includeSameCategories={['groupMember']}
    />
  );
}

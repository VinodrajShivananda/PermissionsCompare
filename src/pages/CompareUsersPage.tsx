import { ComparePage } from '../components/ComparePage';
import { USER_COMPARE_SECTIONS } from '../constants/userCompareSections';
import {
  listUsers,
  loadUserPermissions,
} from '../services/permissionLoader';

export function CompareUsersPage() {
  return (
    <ComparePage
      title="Compare Users"
      description="Compare user attributes, permission set group assignments, public group memberships, and queue memberships."
      includeSameCategories={[
        'userAttribute',
        'permissionSetGroup',
        'group',
        'queue',
      ]}
      compareSections={USER_COMPARE_SECTIONS}
      alwaysShowEmptySections
      loadEntities={listUsers}
      loadBundle={(client, entity) =>
        loadUserPermissions(client, entity.id, entity.name)
      }
    />
  );
}

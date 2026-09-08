import { ComparePage } from '../components/ComparePage';
import {
  listUsers,
  loadUserPermissions,
} from '../services/permissionLoader';

export function CompareUsersPage() {
  return (
    <ComparePage
      title="Compare Users"
      description="Compare effective permissions for two users, including profile, permission sets, and permission set group assignments."
      loadEntities={listUsers}
      loadBundle={(client, entity) =>
        loadUserPermissions(client, entity.id, entity.name)
      }
    />
  );
}

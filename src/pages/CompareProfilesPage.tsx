import { ComparePage } from '../components/ComparePage';
import {
  listProfiles,
  loadProfilePermissions,
} from '../services/permissionLoader';

export function CompareProfilesPage() {
  return (
    <ComparePage
      title="Compare Profiles"
      description="Compare object, field, system, tab, and setup permissions between two Salesforce profiles."
      loadEntities={listProfiles}
      loadBundle={(client, entity) =>
        loadProfilePermissions(client, entity.id, entity.name)
      }
    />
  );
}

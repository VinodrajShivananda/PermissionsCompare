import type { NamedEntity } from '../types/permissions';

interface EntityPickerProps {
  label: string;
  entities: NamedEntity[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function EntityPicker({
  label,
  entities,
  value,
  onChange,
  disabled,
}: EntityPickerProps) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">Select…</option>
        {entities.map((entity) => (
          <option key={entity.id} value={entity.id}>
            {entity.label || entity.name}
          </option>
        ))}
      </select>
    </div>
  );
}

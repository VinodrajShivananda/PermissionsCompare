import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { NamedEntity } from '../types/permissions';

interface MultiEntityPickerProps {
  label: string;
  entities: NamedEntity[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function MultiEntityPicker({
  label,
  entities,
  selectedIds,
  onChange,
  disabled,
}: MultiEntityPickerProps) {
  const [pickId, setPickId] = useState('');

  const available = entities.filter((entity) => !selectedIds.includes(entity.id));
  const selected = selectedIds
    .map((id) => entities.find((entity) => entity.id === id))
    .filter((entity): entity is NamedEntity => entity !== undefined);

  const handleAdd = () => {
    if (!pickId || selectedIds.includes(pickId)) {
      return;
    }

    onChange([...selectedIds, pickId]);
    setPickId('');
  };

  const handleRemove = (id: string) => {
    onChange(selectedIds.filter((selectedId) => selectedId !== id));
  };

  return (
    <div className="multi-entity-picker form-group">
      <label>{label}</label>

      <div className="multi-entity-add">
        <select
          value={pickId}
          onChange={(event) => setPickId(event.target.value)}
          disabled={disabled || available.length === 0}
        >
          <option value="">
            {available.length === 0 ? 'All items selected' : 'Select to add…'}
          </option>
          {available.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.label || entity.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-outline"
          onClick={handleAdd}
          disabled={!pickId || disabled}
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      {selected.length > 0 && (
        <div className="selected-entities">
          {selected.map((entity) => (
            <span key={entity.id} className="entity-chip">
              {entity.label || entity.name}
              <button
                type="button"
                className="entity-chip-remove"
                onClick={() => handleRemove(entity.id)}
                disabled={disabled}
                aria-label={`Remove ${entity.label || entity.name}`}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

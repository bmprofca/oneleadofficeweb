import React from 'react';
import { getInitials } from '../../utils/initials';

/** Salesperson name with initials avatar; shows "Unassigned" when empty. */
export default function OwnerChip({ name }) {
  if (!name) return <span className="owner-chip is-empty">Unassigned</span>;
  return (
    <span className="owner-chip" title={`Assigned to ${name}`}>
      <span className="owner-chip-avatar" aria-hidden="true">
        {getInitials(name)}
      </span>
      <span className="owner-chip-name">{name}</span>
    </span>
  );
}

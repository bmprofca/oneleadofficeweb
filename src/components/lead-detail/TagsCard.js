import React, { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiTag } from 'react-icons/fi';
import api from '../../api/client';
import { TagChip } from '../crm/Badges';
import { useTags } from '../../hooks/useAppSettings';
import { apiError, TAG_COLORS } from '../../utils/crm';
import { SideCard } from './DealCard';

/** Lead tags: remove with ×, add from the workspace list or create a new one. */
export default function TagsCard({ lead, readOnly, onSaveTags }) {
  const { tags: allTags, refresh } = useTags();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [color, setColor] = useState('indigo');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const current = useMemo(() => lead.tags || [], [lead.tags]);
  const currentIds = useMemo(() => current.map((t) => t.id), [current]);

  const q = query.trim().toLowerCase();
  const available = allTags.filter((t) => !currentIds.includes(t.id) && (!q || t.name.toLowerCase().includes(q)));
  const exact = allTags.find((t) => t.name.toLowerCase() === q);

  const save = async (ids, msg) => {
    setBusy(true);
    const ok = await onSaveTags(ids, msg);
    setBusy(false);
    return ok;
  };

  const add = async (tag) => {
    const ok = await save([...currentIds, tag.id], `Tagged “${tag.name}”`);
    if (ok) {
      setQuery('');
      inputRef.current?.focus();
    }
  };

  const remove = (tag) => save(currentIds.filter((id) => id !== tag.id), `Removed “${tag.name}”`);

  const create = async () => {
    const name = query.trim();
    if (!name) return;
    setBusy(true);
    try {
      const { data } = await api.post('/tags', { name, color });
      const list = await refresh().catch(() => null);
      const id = data?.id ?? list?.find((t) => t.name.toLowerCase() === name.toLowerCase())?.id;
      setBusy(false);
      if (!id) {
        toast.error('Tag created, but it could not be attached — try adding it again');
        return;
      }
      const ok = await save([...currentIds, id], `Created and added “${name}”`);
      if (ok) setQuery('');
    } catch (err) {
      setBusy(false);
      toast.error(apiError(err, 'Could not create tag'));
    }
  };

  return (
    <SideCard
      title="Tags"
      icon={FiTag}
      action={
        !readOnly ? (
          <button
            type="button"
            className="btn ghost small ld-card-edit"
            onClick={() => {
              setOpen((o) => !o);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            aria-expanded={open}
          >
            <FiPlus size={12} />
            {open ? 'Done' : 'Add tag'}
          </button>
        ) : null
      }
    >
      {current.length ? (
        <div className="ld-tags">
          {current.map((t) => (
            <TagChip key={t.id} tag={t} onRemove={readOnly || busy ? undefined : remove} />
          ))}
        </div>
      ) : (
        <p className="ld-card-empty">No tags yet.</p>
      )}

      {open && !readOnly ? (
        <div className="ld-tag-picker">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (available[0] && (exact || available.length === 1)) add(exact && !currentIds.includes(exact.id) ? exact : available[0]);
                else if (!exact && q) create();
              }
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="Search or create a tag"
            maxLength={40}
            disabled={busy}
            aria-label="Search tags"
          />
          <div className="ld-tag-options">
            {available.slice(0, 30).map((t) => (
              <button key={t.id} type="button" className="ld-tag-option" onClick={() => add(t)} disabled={busy}>
                <span className={`tone-dot tone-${t.color || 'slate'}`} />
                <span>{t.name}</span>
                {t.lead_count != null ? <em>{t.lead_count}</em> : null}
              </button>
            ))}
            {!available.length && !q ? <p className="ld-card-empty">All tags are already on this lead.</p> : null}
          </div>
          {q && !exact ? (
            <div className="ld-tag-create">
              <div className="ld-color-row" role="radiogroup" aria-label="Tag colour">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={c}
                    title={c}
                    className={`ld-color-swatch tone-${c} ${color === c ? 'active' : ''}`}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
              <button type="button" className="btn small" onClick={create} disabled={busy}>
                <FiPlus size={12} />
                Create “{query.trim()}”
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </SideCard>
  );
}

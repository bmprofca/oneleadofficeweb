import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiAlertCircle,
  FiArrowDown,
  FiArrowUp,
  FiCheck,
  FiEdit2,
  FiPlus,
  FiShuffle,
  FiTag,
  FiTrash2,
  FiGlobe,
  FiUsers,
  FiXCircle,
} from 'react-icons/fi';
import api from '../api/client';
import ConfirmModal from '../components/ConfirmModal';
import RefreshButton from '../components/RefreshButton';
import { Skeleton } from '../components/Skeleton';
import Switch from '../components/crm/Switch';
import { EmptyState, TagChip } from '../components/crm/Badges';
import useAppSettings, { useTags } from '../hooks/useAppSettings';
import { apiError, formatNumber, sourceLabel, TAG_COLORS } from '../utils/crm';
import '../styles/settings.css';

let rowSeq = 0;
const toRows = (list = []) => list.map((value) => ({ key: `r${++rowSeq}`, value }));
const rowValues = (rows) => rows.map((r) => r.value.trim());
const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

function SettingsSection({ icon: Icon, title, description, dirty, saving, onSave, onDiscard, error, children, footer = true }) {
  return (
    <section className={`panel st-section ${dirty ? 'st-dirty' : ''}`}>
      <header className="st-section-head">
        <span className="st-section-icon">
          <Icon size={17} />
        </span>
        <div className="st-section-title">
          <h2>
            {title}
            {dirty ? (
              <span className="st-unsaved" role="status">
                <i /> Unsaved changes
              </span>
            ) : null}
          </h2>
          {description ? <p>{description}</p> : null}
        </div>
      </header>
      <div className="st-section-body">{children}</div>
      {footer ? (
        <footer className="st-section-foot">
          {error ? (
            <span className="st-foot-error">
              <FiAlertCircle size={13} /> {error}
            </span>
          ) : (
            <span />
          )}
          <div className="st-foot-actions">
            <button type="button" className="btn ghost" onClick={onDiscard} disabled={!dirty || saving}>
              Discard
            </button>
            <button type="button" className="btn primary" onClick={onSave} disabled={!dirty || saving || Boolean(error)}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </footer>
      ) : null}
    </section>
  );
}

/** Editable ordered list of strings: add, rename inline, remove, reorder. */
function ListEditor({ rows, onChange, placeholder, renderHint, addLabel }) {
  const [draft, setDraft] = useState('');
  const addRef = useRef(null);

  const update = (key, value) => onChange(rows.map((r) => (r.key === key ? { ...r, value } : r)));
  const remove = (key) => onChange(rows.filter((r) => r.key !== key));
  const move = (index, delta) => {
    const next = [...rows];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const add = (e) => {
    e.preventDefault();
    const value = draft.trim();
    if (!value) return;
    if (rows.some((r) => r.value.trim().toLowerCase() === value.toLowerCase())) {
      toast.error(`“${value}” is already in the list`);
      return;
    }
    onChange([...rows, ...toRows([value])]);
    setDraft('');
    addRef.current?.focus();
  };

  const counts = rows.reduce((acc, r) => {
    const k = r.value.trim().toLowerCase();
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="st-list">
      {rows.length === 0 ? <p className="st-list-empty">The list is empty. Add the first entry below.</p> : null}
      <ol className="st-list-rows">
        {rows.map((row, index) => {
          const trimmed = row.value.trim();
          const invalid = !trimmed || counts[trimmed.toLowerCase()] > 1;
          const hint = renderHint?.(trimmed);
          return (
            <li key={row.key} className={invalid ? 'st-row-invalid' : ''}>
              <span className="st-list-index">{index + 1}</span>
              <div className="st-list-input">
                <input
                  value={row.value}
                  onChange={(e) => update(row.key, e.target.value)}
                  aria-label={`Entry ${index + 1}`}
                  aria-invalid={invalid}
                  className={invalid ? 'invalid' : ''}
                />
                {invalid ? (
                  <small className="st-row-error">{trimmed ? 'Duplicate entry' : 'Cannot be empty'}</small>
                ) : hint ? (
                  <small className="st-row-hint">{hint}</small>
                ) : null}
              </div>
              <div className="st-list-actions">
                <button type="button" className="icon-btn" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up" title="Move up">
                  <FiArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                  aria-label="Move down"
                  title="Move down"
                >
                  <FiArrowDown size={14} />
                </button>
                <button type="button" className="icon-btn st-danger-icon" onClick={() => remove(row.key)} aria-label="Remove" title="Remove">
                  <FiTrash2 size={14} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <form className="st-list-add" onSubmit={add}>
        <input ref={addRef} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} maxLength={60} />
        <button type="submit" className="btn" disabled={!draft.trim()}>
          <FiPlus size={14} /> {addLabel}
        </button>
      </form>
    </div>
  );
}

function listError(rows) {
  const values = rowValues(rows);
  if (values.some((v) => !v)) return 'Fix empty entries before saving';
  if (new Set(values.map((v) => v.toLowerCase())).size !== values.length) return 'Remove duplicate entries before saving';
  return '';
}

function ColorPicker({ value, onChange }) {
  return (
    <div className="st-swatches" role="radiogroup" aria-label="Tag colour">
      {TAG_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          title={color}
          className={`st-swatch tone-${color} ${value === color ? 'active' : ''}`}
          onClick={() => onChange(color)}
        >
          {value === color ? <FiCheck size={11} /> : null}
        </button>
      ))}
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <section key={i} className="panel st-section">
          <Skeleton width={180} height={16} />
          <Skeleton width="60%" height={11} />
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            <Skeleton height={38} />
            <Skeleton height={38} />
            <Skeleton height={38} />
          </div>
        </section>
      ))}
    </>
  );
}

export default function Settings() {
  const { refresh: refreshSettings } = useAppSettings();
  const { refresh: refreshTags } = useTags();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [server, setServer] = useState(null);

  // Assignment
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoUsers, setAutoUsers] = useState([]);
  // Lists
  const [sources, setSources] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [saving, setSaving] = useState('');

  // Tags
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState({ name: '', color: 'indigo' });
  const [editing, setEditing] = useState(null);
  const [tagBusy, setTagBusy] = useState(false);
  const [deleteTag, setDeleteTag] = useState(null);

  const applyServer = useCallback((data) => {
    setServer(data);
    setAutoEnabled(Boolean(data.auto_assign_enabled));
    setAutoUsers((data.auto_assign_users || []).map((u) => ({ ...u, auto_assign: Boolean(u.auto_assign) })));
    setSources(toRows(data.lead_sources || []));
    setReasons(toRows(data.lost_reasons || []));
  }, []);

  const loadTags = useCallback(async () => {
    const { data } = await api.get('/tags');
    setTags(Array.isArray(data) ? data : []);
  }, []);

  const load = useCallback(async () => {
    try {
      const [{ data }] = await Promise.all([api.get('/settings'), loadTags()]);
      applyServer(data);
      setLoadError('');
    } catch (err) {
      const msg = apiError(err, 'Failed to load settings');
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [applyServer, loadTags]);

  useEffect(() => {
    load();
  }, [load]);

  // ----- dirty tracking -----
  const assignDirty = useMemo(() => {
    if (!server) return false;
    if (Boolean(server.auto_assign_enabled) !== autoEnabled) return true;
    const base = Object.fromEntries((server.auto_assign_users || []).map((u) => [u.id, Boolean(u.auto_assign)]));
    return autoUsers.some((u) => base[u.id] !== u.auto_assign);
  }, [server, autoEnabled, autoUsers]);

  const sourcesDirty = Boolean(server) && !sameList(rowValues(sources), server.lead_sources || []);
  const reasonsDirty = Boolean(server) && !sameList(rowValues(reasons), server.lost_reasons || []);
  const editingTag = editing ? tags.find((t) => t.id === editing.id) : null;
  const tagsDirty =
    Boolean(newTag.name.trim()) ||
    Boolean(editing && editingTag && (editing.name.trim() !== editingTag.name || editing.color !== editingTag.color));
  const anyDirty = assignDirty || sourcesDirty || reasonsDirty || tagsDirty;

  useEffect(() => {
    if (!anyDirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [anyDirty]);

  const save = async (section, payload, successMsg) => {
    setSaving(section);
    try {
      await api.put('/settings', payload);
      const { data } = await api.get('/settings');
      // Only reset the saved section; keep unsaved edits elsewhere.
      setServer(data);
      if (section === 'assign') {
        setAutoEnabled(Boolean(data.auto_assign_enabled));
        setAutoUsers((data.auto_assign_users || []).map((u) => ({ ...u, auto_assign: Boolean(u.auto_assign) })));
      }
      if (section === 'sources') setSources(toRows(data.lead_sources || []));
      if (section === 'reasons') setReasons(toRows(data.lost_reasons || []));
      refreshSettings();
      toast.success(successMsg);
    } catch (err) {
      toast.error(apiError(err, 'Failed to save settings'));
    } finally {
      setSaving('');
    }
  };

  const saveAssignment = () =>
    save(
      'assign',
      {
        auto_assign_enabled: autoEnabled,
        auto_assign_users: autoUsers.map((u) => ({ id: u.id, auto_assign: u.auto_assign })),
      },
      'Lead assignment saved'
    );

  const discardAssignment = () => {
    setAutoEnabled(Boolean(server?.auto_assign_enabled));
    setAutoUsers((server?.auto_assign_users || []).map((u) => ({ ...u, auto_assign: Boolean(u.auto_assign) })));
  };

  const poolCount = autoUsers.filter((u) => u.auto_assign).length;

  // ----- tags -----
  const afterTagChange = async () => {
    await loadTags();
    refreshTags().catch(() => {});
  };

  const createTag = async (e) => {
    e.preventDefault();
    const name = newTag.name.trim();
    if (!name) return;
    if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      toast.error('A tag with this name already exists');
      return;
    }
    setTagBusy(true);
    try {
      await api.post('/tags', { name, color: newTag.color });
      toast.success(`Tag “${name}” created`);
      setNewTag((prev) => ({ name: '', color: prev.color }));
      await afterTagChange();
    } catch (err) {
      toast.error(apiError(err, 'Failed to create tag'));
    } finally {
      setTagBusy(false);
    }
  };

  const saveTag = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) {
      toast.error('Tag name cannot be empty');
      return;
    }
    setTagBusy(true);
    try {
      await api.put(`/tags/${editing.id}`, { name, color: editing.color });
      toast.success('Tag updated');
      setEditing(null);
      await afterTagChange();
    } catch (err) {
      toast.error(apiError(err, 'Failed to update tag'));
    } finally {
      setTagBusy(false);
    }
  };

  const confirmDeleteTag = async () => {
    if (!deleteTag) return;
    setTagBusy(true);
    try {
      await api.delete(`/tags/${deleteTag.id}`);
      toast.success(`Tag “${deleteTag.name}” deleted`);
      if (editing?.id === deleteTag.id) setEditing(null);
      setDeleteTag(null);
      await afterTagChange();
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete tag'));
    } finally {
      setTagBusy(false);
    }
  };

  return (
    <div className="page st-page">
      <header className="page-header">
        <div>
          <span className="page-eyebrow">Workspace</span>
          <h1>Settings</h1>
          <p>Configure how leads are assigned and the lists your team picks from. Changes apply to everyone.</p>
        </div>
        <div className="page-header-actions">
          <RefreshButton
            onRefresh={async () => {
              if (anyDirty) {
                toast('Save or discard your changes first', { icon: '✋' });
                return;
              }
              await load();
            }}
          />
        </div>
      </header>

      {loading ? (
        <SettingsSkeleton />
      ) : loadError && !server ? (
        <section className="panel">
          <EmptyState
            icon={FiAlertCircle}
            title="Couldn't load settings"
            action={
              <button type="button" className="btn" onClick={load}>
                Try again
              </button>
            }
          >
            {loadError}
          </EmptyState>
        </section>
      ) : (
        <div className="st-sections">
          <SettingsSection
            icon={FiShuffle}
            title="Lead assignment"
            description="Automatically distribute new leads across your sales team."
            dirty={assignDirty}
            saving={saving === 'assign'}
            onSave={saveAssignment}
            onDiscard={discardAssignment}
          >
            <div className="st-master">
              <Switch checked={autoEnabled} onChange={setAutoEnabled} label="Auto-assign new leads (round-robin)" />
              <p className="st-help">
                When on, leads an admin creates without choosing an owner (and imports with auto-assign ticked) are
                handed out in turn to the people switched on below — each new lead goes to the next person in the
                rotation. Leads created by a
                sales user stay with them. Turning this off leaves new leads unassigned.
              </p>
            </div>

            <div className={`st-pool ${autoEnabled ? '' : 'st-pool-off'}`}>
              <div className="st-pool-head">
                <span>Rotation</span>
                <span className="count-chip">
                  {poolCount} of {autoUsers.length} in rotation
                </span>
              </div>
              {autoUsers.length === 0 ? (
                <EmptyState icon={FiUsers} title="No active sales users">
                  Add sales users from Users &amp; roles to include them in auto-assignment.
                </EmptyState>
              ) : (
                <ul className="st-user-list">
                  {autoUsers.map((u) => (
                    <li key={u.id}>
                      <span className="st-avatar" aria-hidden="true">
                        {(u.name || '?').trim().charAt(0).toUpperCase()}
                      </span>
                      <div className="st-user-meta">
                        <strong>{u.name}</strong>
                        <small>{u.phone || '—'}</small>
                      </div>
                      <Switch
                        checked={u.auto_assign}
                        onChange={(checked) =>
                          setAutoUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, auto_assign: checked } : x)))
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
              {autoEnabled && autoUsers.length > 0 && poolCount === 0 ? (
                <p className="st-warn">
                  <FiAlertCircle size={13} /> Nobody is in the rotation, so new leads will stay unassigned.
                </p>
              ) : null}
            </div>
          </SettingsSection>

          <div className="st-two">
            <SettingsSection
              icon={FiGlobe}
              title="Lead sources"
              description="Where leads come from. Shown in lead forms, filters and reports, in this order."
              dirty={sourcesDirty}
              saving={saving === 'sources'}
              error={listError(sources)}
              onSave={() => save('sources', { lead_sources: rowValues(sources) }, 'Lead sources saved')}
              onDiscard={() => setSources(toRows(server?.lead_sources || []))}
            >
              <ListEditor
                rows={sources}
                onChange={setSources}
                placeholder="e.g. facebook-ads"
                addLabel="Add source"
                renderHint={(v) => (v && sourceLabel(v) !== v ? `Shown as “${sourceLabel(v)}”` : '')}
              />
              <p className="st-help">Renaming or removing a source does not change leads that already use it.</p>
            </SettingsSection>

            <SettingsSection
              icon={FiXCircle}
              title="Lost reasons"
              description="Options offered when a lead is marked lost. Used in the lost-reasons report."
              dirty={reasonsDirty}
              saving={saving === 'reasons'}
              error={listError(reasons)}
              onSave={() => save('reasons', { lost_reasons: rowValues(reasons) }, 'Lost reasons saved')}
              onDiscard={() => setReasons(toRows(server?.lost_reasons || []))}
            >
              <ListEditor rows={reasons} onChange={setReasons} placeholder="e.g. Timing not right" addLabel="Add reason" />
              <p className="st-help">Existing lost leads keep the reason they were saved with.</p>
            </SettingsSection>
          </div>

          <SettingsSection
            icon={FiTag}
            title="Tags"
            description="Labels your team can attach to leads for quick filtering."
            dirty={tagsDirty}
            footer={false}
          >
            <form className="st-tag-create" onSubmit={createTag}>
              <div className="st-tag-create-row">
                <input
                  value={newTag.name}
                  onChange={(e) => setNewTag((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="New tag name"
                  maxLength={40}
                  aria-label="New tag name"
                />
                <span className="st-tag-preview">
                  <TagChip tag={{ name: newTag.name.trim() || 'Preview', color: newTag.color }} />
                </span>
                <button type="submit" className="btn primary" disabled={!newTag.name.trim() || tagBusy}>
                  <FiPlus size={14} /> Create tag
                </button>
              </div>
              <ColorPicker value={newTag.color} onChange={(color) => setNewTag((prev) => ({ ...prev, color }))} />
            </form>

            {tags.length === 0 ? (
              <EmptyState icon={FiTag} title="No tags yet">
                Create tags like “VIP” or “Follow up in Q1” to group leads.
              </EmptyState>
            ) : (
              <div className="table-wrap st-tag-table">
                <table>
                  <thead>
                    <tr>
                      <th>Tag</th>
                      <th className="st-num">Leads</th>
                      <th className="actions-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tags.map((tag) => {
                      const isEditing = editing?.id === tag.id;
                      return (
                        <tr key={tag.id} className={isEditing ? 'st-tag-editing' : ''}>
                          <td>
                            {isEditing ? (
                              <div className="st-tag-edit">
                                <input
                                  value={editing.name}
                                  autoFocus
                                  maxLength={40}
                                  aria-label="Tag name"
                                  onChange={(e) => setEditing((prev) => ({ ...prev, name: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveTag();
                                    if (e.key === 'Escape') setEditing(null);
                                  }}
                                />
                                <ColorPicker
                                  value={editing.color}
                                  onChange={(color) => setEditing((prev) => ({ ...prev, color }))}
                                />
                              </div>
                            ) : (
                              <TagChip tag={tag} />
                            )}
                          </td>
                          <td className="st-num">{formatNumber(tag.lead_count)}</td>
                          <td className="actions-col">
                            <div className="st-tag-actions">
                              {isEditing ? (
                                <>
                                  <button type="button" className="btn small ghost" onClick={() => setEditing(null)} disabled={tagBusy}>
                                    Cancel
                                  </button>
                                  <button type="button" className="btn small primary" onClick={saveTag} disabled={tagBusy || !editing.name.trim()}>
                                    Save
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="icon-btn"
                                    title="Rename or recolour"
                                    aria-label={`Edit ${tag.name}`}
                                    onClick={() => setEditing({ id: tag.id, name: tag.name, color: tag.color || 'slate' })}
                                  >
                                    <FiEdit2 size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-btn st-danger-icon"
                                    title="Delete tag"
                                    aria-label={`Delete ${tag.name}`}
                                    onClick={() => setDeleteTag(tag)}
                                  >
                                    <FiTrash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SettingsSection>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTag)}
        title="Delete tag"
        message={
          deleteTag
            ? Number(deleteTag.lead_count) > 0
              ? `Delete “${deleteTag.name}”? It will be removed from ${formatNumber(deleteTag.lead_count)} lead${
                  Number(deleteTag.lead_count) === 1 ? '' : 's'
                }. The leads themselves are not affected.`
              : `Delete “${deleteTag.name}”? No leads use it.`
            : ''
        }
        confirmLabel="Delete tag"
        loading={tagBusy}
        onConfirm={confirmDeleteTag}
        onClose={() => !tagBusy && setDeleteTag(null)}
      />
    </div>
  );
}

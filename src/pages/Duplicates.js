import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiAlertCircle, FiCheckCircle, FiEyeOff, FiGitMerge, FiPhone, FiRotateCcw } from 'react-icons/fi';
import api from '../api/client';
import Checkbox from '../components/Checkbox';
import Modal from '../components/Modal';
import RefreshButton from '../components/RefreshButton';
import { Skeleton } from '../components/Skeleton';
import { EmptyState, StageBadge, TagList } from '../components/crm/Badges';
import useAppSettings from '../hooks/useAppSettings';
import { apiError, formatCurrency, sourceLabel } from '../utils/crm';
import { formatDateTime, parseAppDate } from '../utils/format';
import '../styles/duplicates.css';

const SKIP_KEY = 'onelead_dup_skipped';

function readSkipped() {
  try {
    const raw = sessionStorage.getItem(SKIP_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function writeSkipped(set) {
  try {
    sessionStorage.setItem(SKIP_KEY, JSON.stringify([...set]));
  } catch {
    /* storage unavailable — stays in memory */
  }
}

const COMPLETENESS_FIELDS = ['email', 'company', 'address', 'website', 'deal_value', 'expected_close_date', 'assigned_to', 'notes'];

const filled = (v) => v !== null && v !== undefined && v !== '';
const completeness = (lead) =>
  COMPLETENESS_FIELDS.filter((f) => filled(lead[f])).length + ((lead.tags || []).length ? 1 : 0);
const createdTime = (lead) => parseAppDate(lead.created_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
const groupKey = (g) => `${g.match_type}:${g.match_value}`;

/** Default record to keep: the most complete lead, oldest first on ties. */
function pickDefaultKeep(leads) {
  return [...leads].sort((a, b) => completeness(b) - completeness(a) || createdTime(a) - createdTime(b))[0]?.id;
}

const dateOnly = (v) => formatDateTime(v, { day: 'numeric', month: 'short', year: 'numeric' });

function LeadCard({ lead, isKeep, isMerge, isOldest, isMostComplete, onKeep, onToggleMerge, radioName, currency }) {
  return (
    <article className={`dp-lead ${isKeep ? 'dp-keep' : ''} ${!isKeep && isMerge ? 'dp-merge' : ''} ${!isKeep && !isMerge ? 'dp-ignored' : ''}`}>
      <div className="dp-lead-top">
        <label className="dp-radio">
          <input type="radio" name={radioName} checked={isKeep} onChange={onKeep} />
          <span>{isKeep ? 'Keeping' : 'Keep this'}</span>
        </label>
        {isKeep ? (
          <span className="dp-role dp-role-keep">Primary</span>
        ) : (
          <span className="dp-merge-toggle">
            <Checkbox checked={isMerge} onChange={onToggleMerge} ariaLabel={`Merge ${lead.name}`} />
            <span>Merge</span>
          </span>
        )}
      </div>

      <div className="dp-lead-head">
        <Link to={`/leads/${encodeURIComponent(lead.id)}`} className="dp-lead-name">
          {lead.name || 'Unnamed lead'}
        </Link>
        <div className="dp-lead-badges">
          <StageBadge status={lead.status} />
          {isOldest ? <span className="dp-hint-chip">Oldest</span> : null}
          {isMostComplete ? <span className="dp-hint-chip">Most complete</span> : null}
        </div>
      </div>

      <dl className="dp-fields">
        <div>
          <dt>Product</dt>
          <dd>{lead.product_name || '—'}</dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{lead.assigned_name || <span className="crm-muted">Unassigned</span>}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{dateOnly(lead.created_at)}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{lead.email || <span className="crm-muted">—</span>}</dd>
        </div>
        <div>
          <dt>Deal value</dt>
          <dd>{lead.deal_value != null ? formatCurrency(lead.deal_value, { currency }) : <span className="crm-muted">—</span>}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{sourceLabel(lead.source)}</dd>
        </div>
        {lead.company ? (
          <div>
            <dt>Company</dt>
            <dd>{lead.company}</dd>
          </div>
        ) : null}
        <div>
          <dt>Tags</dt>
          <dd>{(lead.tags || []).length ? <TagList tags={lead.tags} max={4} /> : <span className="crm-muted">—</span>}</dd>
        </div>
      </dl>
    </article>
  );
}

function GroupSkeleton() {
  return (
    <section className="panel dp-group">
      <Skeleton width={200} height={16} />
      <div className="dp-leads">
        {[0, 1].map((i) => (
          <div key={i} className="dp-lead">
            <Skeleton width="60%" height={14} />
            <Skeleton width="40%" height={10} />
            <Skeleton height={120} radius={10} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Duplicates() {
  const { settings } = useAppSettings();
  const currency = settings.currency || 'INR';
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [choices, setChoices] = useState({});
  const [skipped, setSkipped] = useState(readSkipped);
  const [confirm, setConfirm] = useState(null);
  const [merging, setMerging] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/leads/duplicates');
      const list = data?.groups || [];
      setGroups(list);
      setChoices((prev) => {
        const next = {};
        list.forEach((g) => {
          const key = groupKey(g);
          const ids = g.leads.map((l) => l.id);
          const old = prev[key];
          // Keep the admin's choices if the group still has the same members.
          if (old && ids.includes(old.keep) && old.merge.every((id) => ids.includes(id))) {
            next[key] = old;
          } else {
            const keep = pickDefaultKeep(g.leads);
            next[key] = { keep, merge: ids.filter((id) => id !== keep) };
          }
        });
        return next;
      });
      setError('');
    } catch (err) {
      const msg = apiError(err, 'Failed to load duplicates');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => groups.filter((g) => !skipped.has(groupKey(g))), [groups, skipped]);
  const skippedCount = groups.length - visible.length;

  const setKeep = (key, leadId, allIds) =>
    setChoices((prev) => {
      const old = prev[key] || { merge: [] };
      // The previous primary becomes a merge candidate by default.
      const merge = new Set(old.merge);
      merge.delete(leadId);
      if (old.keep && old.keep !== leadId) merge.add(old.keep);
      return { ...prev, [key]: { keep: leadId, merge: allIds.filter((id) => merge.has(id)) } };
    });

  const toggleMerge = (key, leadId) =>
    setChoices((prev) => {
      const old = prev[key];
      const merge = old.merge.includes(leadId) ? old.merge.filter((id) => id !== leadId) : [...old.merge, leadId];
      return { ...prev, [key]: { ...old, merge } };
    });

  const skip = (key) => {
    setSkipped((prev) => {
      const next = new Set(prev);
      next.add(key);
      writeSkipped(next);
      return next;
    });
  };

  const restoreSkipped = () => {
    const empty = new Set();
    writeSkipped(empty);
    setSkipped(empty);
  };

  const doMerge = async () => {
    if (!confirm) return;
    setMerging(true);
    try {
      const { data } = await api.post('/leads/merge', {
        primary_id: confirm.primary.id,
        duplicate_ids: confirm.duplicates.map((l) => l.id),
      });
      toast.success(data?.message || 'Leads merged');
      setConfirm(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Merge failed'));
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="page dp-page">
      <header className="page-header">
        <div>
          <span className="page-eyebrow">Data quality</span>
          <h1>Duplicates</h1>
          <p>Leads that share the same phone number. Pick the record to keep and merge the rest into it.</p>
        </div>
        <div className="page-header-actions">
          {skippedCount > 0 ? (
            <button type="button" className="btn" onClick={restoreSkipped}>
              <FiRotateCcw size={14} /> Show {skippedCount} skipped
            </button>
          ) : null}
          <RefreshButton onRefresh={load} />
        </div>
      </header>

      {!loading && !error && groups.length > 0 ? (
        <div className="dp-summary">
          <span className="count-chip">
            {visible.length} group{visible.length === 1 ? '' : 's'}
          </span>
          <span>
            {visible.reduce((s, g) => s + g.leads.length, 0)} leads involved
            {skippedCount ? ` · ${skippedCount} skipped this session` : ''}
          </span>
        </div>
      ) : null}

      {loading ? (
        <>
          <GroupSkeleton />
          <GroupSkeleton />
        </>
      ) : error && !groups.length ? (
        <section className="panel">
          <EmptyState
            icon={FiAlertCircle}
            title="Couldn't load duplicates"
            action={
              <button type="button" className="btn" onClick={load}>
                Try again
              </button>
            }
          >
            {error}
          </EmptyState>
        </section>
      ) : visible.length === 0 ? (
        <section className="panel dp-empty">
          <EmptyState
            icon={FiCheckCircle}
            title={groups.length ? 'All remaining groups skipped' : 'No duplicates found'}
            action={
              skippedCount ? (
                <button type="button" className="btn" onClick={restoreSkipped}>
                  <FiRotateCcw size={14} /> Show {skippedCount} skipped group{skippedCount === 1 ? '' : 's'}
                </button>
              ) : null
            }
          >
            {groups.length
              ? 'You marked the remaining matches as not duplicates for this session.'
              : 'Every active lead has a unique phone number. New matches will show up here automatically.'}
          </EmptyState>
        </section>
      ) : (
        <div className="dp-groups">
          {visible.map((group) => {
            const key = groupKey(group);
            const choice = choices[key] || { keep: group.leads[0]?.id, merge: [] };
            const allIds = group.leads.map((l) => l.id);
            const primary = group.leads.find((l) => l.id === choice.keep);
            const dupes = group.leads.filter((l) => l.id !== choice.keep && choice.merge.includes(l.id));
            const oldestId = [...group.leads].sort((a, b) => createdTime(a) - createdTime(b))[0]?.id;
            const best = Math.max(...group.leads.map(completeness));
            const bestCount = group.leads.filter((l) => completeness(l) === best).length;
            return (
              <section key={key} className="panel dp-group">
                <header className="dp-group-head">
                  <div className="dp-match">
                    <span className="dp-match-icon">
                      <FiPhone size={15} />
                    </span>
                    <div>
                      <strong>{group.match_value}</strong>
                      <small>
                        {group.leads.length} leads share this {group.match_type === 'phone' ? 'phone number' : group.match_type}
                      </small>
                    </div>
                  </div>
                  <div className="dp-group-actions">
                    <button type="button" className="btn ghost" onClick={() => skip(key)} title="Hide this group for the rest of the session">
                      <FiEyeOff size={14} /> Not duplicates
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      disabled={!primary || dupes.length === 0}
                      onClick={() => setConfirm({ key, primary, duplicates: dupes })}
                    >
                      <FiGitMerge size={14} />
                      <span className="dp-merge-label">
                        Merge {dupes.length} into {primary?.name || '…'}
                      </span>
                    </button>
                  </div>
                </header>
                <div className="dp-leads">
                  {group.leads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      currency={currency}
                      radioName={`keep-${key}`}
                      isKeep={lead.id === choice.keep}
                      isMerge={choice.merge.includes(lead.id)}
                      isOldest={lead.id === oldestId}
                      isMostComplete={bestCount < group.leads.length && completeness(lead) === best}
                      onKeep={() => setKeep(key, lead.id, allIds)}
                      onToggleMerge={() => toggleMerge(key, lead.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(confirm)}
        title="Merge duplicate leads"
        size="sm"
        onClose={() => !merging && setConfirm(null)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setConfirm(null)} disabled={merging}>
              Cancel
            </button>
            <button type="button" className="btn primary" onClick={doMerge} disabled={merging}>
              <FiGitMerge size={14} />
              {merging ? 'Merging…' : `Merge ${confirm?.duplicates.length || 0}`}
            </button>
          </>
        }
      >
        {confirm ? (
          <div className="dp-confirm">
            <p>
              Merge {confirm.duplicates.length} lead{confirm.duplicates.length === 1 ? '' : 's'} into{' '}
              <strong>{confirm.primary.name}</strong>?
            </p>
            <ul className="dp-confirm-list">
              {confirm.duplicates.map((l) => (
                <li key={l.id}>
                  <span>{l.name}</span>
                  <small>
                    {l.assigned_name || 'Unassigned'} · {dateOnly(l.created_at)}
                  </small>
                </li>
              ))}
            </ul>
            <ul className="dp-confirm-points">
              <li>Reminders, appointments, activities, status history and tags move to the kept lead.</li>
              <li>Empty fields on the kept lead (email, company, deal value, owner…) are filled from the duplicates. Existing values are never overwritten.</li>
              <li>Duplicates are archived, not deleted — they can be restored later.</li>
            </ul>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

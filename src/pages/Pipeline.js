import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { FiColumns, FiLayers, FiSearch, FiTarget, FiTrendingUp, FiAward, FiX } from 'react-icons/fi';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import RefreshButton from '../components/RefreshButton';
import SearchableSelect from '../components/SearchableSelect';
import Switch from '../components/crm/Switch';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/crm/Badges';
import PipelineCard from '../components/pipeline/PipelineCard';
import LostReasonModal from '../components/pipeline/LostReasonModal';
import useAppSettings, { useTags } from '../hooks/useAppSettings';
import { loadProductsOptions, loadUsersOptions } from '../utils/apiSelect';
import { apiError, CLOSED_STAGES, formatCurrency, OPEN_STAGES, STAGE_HEX, STAGES, stageLabel } from '../utils/crm';
import '../styles/pipeline.css';

const TEMPERATURE_FILTERS = [
  { key: '', label: 'All' },
  { key: 'hot', label: 'Hot' },
  { key: 'warm', label: 'Warm' },
  { key: 'cold', label: 'Cold' },
];

const ALL_STAGE_KEYS = STAGES.map((s) => s.key);

/** Owner options with an "Unassigned" entry on top. */
async function loadOwnerOptions(args = {}) {
  const result = await loadUsersOptions(args);
  if ((args.page || 1) === 1 && !args.search) {
    return { ...result, items: [{ value: 'unassigned', label: 'Unassigned' }, ...result.items] };
  }
  return result;
}

function recomputeTotals(stages) {
  const open = stages.filter((s) => OPEN_STAGES.includes(s.status));
  return {
    open_count: open.reduce((n, s) => n + s.count, 0),
    open_value: open.reduce((n, s) => n + s.value, 0),
    weighted_value: open.reduce((n, s) => n + s.weighted_value, 0),
  };
}

/** Optimistically move a lead between stages on the local board. */
function applyMove(board, lead, to) {
  if (!board) return board;
  const from = lead.status;
  const amount = Number(lead.deal_value) || 0;
  const moved = {
    ...lead,
    status: to,
    stage_changed_at: new Date().toISOString(),
    temperature: CLOSED_STAGES.includes(to) ? null : lead.temperature,
  };
  const stages = board.stages.map((s) => {
    if (s.status === from) {
      const value = Math.max(0, s.value - amount);
      return {
        ...s,
        count: Math.max(0, s.count - 1),
        value,
        weighted_value: value * (Number(s.probability) || 0),
        leads: s.leads.filter((l) => l.id !== lead.id),
      };
    }
    if (s.status === to) {
      const value = s.value + amount;
      return {
        ...s,
        count: s.count + 1,
        value,
        weighted_value: value * (Number(s.probability) || 0),
        leads: [moved, ...s.leads],
      };
    }
    return s;
  });
  return { ...board, stages, totals: recomputeTotals(stages) };
}

function BoardSkeleton() {
  return (
    <div className="pl-board" aria-hidden="true">
      {STAGES.slice(0, 7).map((s) => (
        <section key={s.key} className="pl-column">
          <header className="pl-column-head">
            <Skeleton width="55%" height={14} />
            <Skeleton width="35%" height={11} />
          </header>
          <div className="pl-column-body">
            {Array.from({ length: s.key === 'new' ? 4 : 2 }).map((_, i) => (
              <div key={i} className="pl-card pl-card-skeleton">
                <Skeleton width="75%" height={13} />
                <Skeleton width="45%" height={10} />
                <Skeleton width="60%" height={12} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function Pipeline() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const { settings } = useAppSettings();
  const { tags } = useTags();

  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [productLabel, setProductLabel] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [ownerLabel, setOwnerLabel] = useState('');
  const [tagId, setTagId] = useState('');
  const [temperature, setTemperature] = useState('');
  const [showNotInterested, setShowNotInterested] = useState(false);

  const [dragging, setDragging] = useState(null);
  const [overStage, setOverStage] = useState(null);
  const [lostPrompt, setLostPrompt] = useState(null);
  const [savingLost, setSavingLost] = useState(false);

  const boardRef = useRef(null);
  const dragRef = useRef(null);
  const requestRef = useRef(0);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = useMemo(
    () => ({
      search: search || undefined,
      product_id: productId || undefined,
      assigned_to: isAdmin && ownerId ? ownerId : undefined,
      temperature: temperature || undefined,
      tag_id: tagId || undefined,
    }),
    [search, productId, ownerId, temperature, tagId, isAdmin]
  );

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const rid = ++requestRef.current;
      if (!silent) setLoading(true);
      try {
        const { data } = await api.get('/leads/pipeline', { params });
        if (rid !== requestRef.current) return false;
        setBoard(data);
        setLoadError('');
        return true;
      } catch (err) {
        if (rid !== requestRef.current) return false;
        const message = apiError(err, 'Failed to load pipeline');
        setLoadError(message);
        toast.error(message);
        return false;
      } finally {
        if (rid === requestRef.current) setLoading(false);
      }
    },
    [params]
  );

  useEffect(() => {
    load();
  }, [load]);

  const visibleStages = useMemo(
    () => STAGES.filter((s) => showNotInterested || s.key !== 'not_interested'),
    [showNotInterested]
  );

  const stageData = useMemo(() => {
    const map = {};
    (board?.stages || []).forEach((s) => {
      map[s.status] = s;
    });
    return map;
  }, [board]);

  const hasFilters = Boolean(search || productId || ownerId || tagId || temperature);

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setProductId('');
    setProductLabel('');
    setOwnerId('');
    setOwnerLabel('');
    setTagId('');
    setTemperature('');
  };

  /* ------------------------------------------------------------- moves */

  const commitMove = async (lead, to, extra, snapshot) => {
    try {
      await api.put(`/leads/${encodeURIComponent(lead.id)}`, { status: to, ...extra });
      const hidden = to === 'not_interested' && !showNotInterested;
      toast.success(`${lead.name} moved to ${stageLabel(to)}${hidden ? ' (column hidden)' : ''}`);
      return true;
    } catch (err) {
      setBoard(snapshot);
      toast.error(apiError(err, 'Could not move this lead'));
      return false;
    } finally {
      load({ silent: true });
    }
  };

  const moveLead = (lead, to) => {
    if (!lead || lead.status === to) return;
    const snapshot = boardRef.current;
    setBoard((prev) => applyMove(prev, lead, to));
    if (to === 'lost') {
      setLostPrompt({ lead, snapshot });
      return;
    }
    commitMove(lead, to, {}, snapshot);
  };

  const confirmLost = async (extra) => {
    if (!lostPrompt) return;
    setSavingLost(true);
    await commitMove(lostPrompt.lead, 'lost', extra, lostPrompt.snapshot);
    setSavingLost(false);
    setLostPrompt(null);
  };

  const cancelLost = () => {
    if (savingLost) return;
    if (lostPrompt?.snapshot) setBoard(lostPrompt.snapshot);
    setLostPrompt(null);
  };

  /* -------------------------------------------------------- drag & drop */

  const onDragStart = (e, lead) => {
    dragRef.current = lead;
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', String(lead.id));
    } catch {
      /* some browsers restrict dataTransfer types */
    }
    // Defer so the browser captures the drag image before the card dims.
    setTimeout(() => setDragging({ id: lead.id, status: lead.status }), 0);
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(null);
    setOverStage(null);
  };

  const onColumnDragOver = (e, key) => {
    const lead = dragRef.current;
    if (!lead || lead.status === key) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overStage !== key) setOverStage(key);
  };

  const onColumnDragLeave = (e, key) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setOverStage((cur) => (cur === key ? null : cur));
  };

  const onColumnDrop = (e, key) => {
    e.preventDefault();
    const lead = dragRef.current;
    endDrag();
    if (lead) moveLead(lead, key);
  };

  /* ------------------------------------------------------------ render */

  const totals = board?.totals || { open_count: 0, open_value: 0, weighted_value: 0 };
  const wonValue = stageData.won?.value || 0;
  const boardEmpty = board && visibleStages.every((s) => !(stageData[s.key]?.count > 0));

  const summary = [
    { label: 'Open deals', value: Number(totals.open_count || 0).toLocaleString('en-IN'), icon: FiLayers, tone: 'sky' },
    {
      label: 'Open pipeline value',
      value: formatCurrency(totals.open_value || 0, { compact: true }),
      title: formatCurrency(totals.open_value || 0),
      icon: FiTarget,
      tone: 'teal',
    },
    {
      label: 'Weighted forecast',
      value: formatCurrency(totals.weighted_value || 0, { compact: true }),
      title: `${formatCurrency(totals.weighted_value || 0)} — deal value × stage probability`,
      icon: FiTrendingUp,
      tone: 'amber',
    },
    {
      label: 'Won value',
      value: formatCurrency(wonValue, { compact: true }),
      title: formatCurrency(wonValue),
      icon: FiAward,
      tone: 'emerald',
    },
  ];

  return (
    <div className="page pl-page">
      <header className="page-header">
        <div>
          <span className="page-eyebrow">Sales</span>
          <h1>Pipeline</h1>
          <p>Drag deals between stages, or use a card's menu to move it.</p>
        </div>
        <div className="page-header-actions">
          <RefreshButton
            onRefresh={async () => {
              if (await load({ silent: true })) toast.success('Pipeline refreshed');
            }}
          />
        </div>
      </header>

      <section className="pl-summary" aria-label="Pipeline summary">
        {summary.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className={`stat-card stat-card-sm stat-tone-${item.tone}`} title={item.title}>
              <span className="stat-icon">
                <Icon size={16} />
              </span>
              <div className="stat-card-body">
                <span>{item.label}</span>
                {board ? <strong>{item.value}</strong> : <Skeleton width="50%" height={16} />}
              </div>
            </article>
          );
        })}
      </section>

      <section className="panel pl-panel">
        <div className={`pl-filters${isAdmin ? ' has-owner' : ''}`}>
          <div className="filter-search">
            <FiSearch size={15} />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, phone, company…"
              aria-label="Search deals"
            />
          </div>
          <SearchableSelect
            value={productId}
            valueLabel={productLabel}
            placeholder="All products"
            loadOptions={loadProductsOptions}
            onChange={(val, opt) => {
              setProductId(val ? String(val) : '');
              setProductLabel(opt?.label || '');
            }}
          />
          {isAdmin ? (
            <SearchableSelect
              value={ownerId}
              valueLabel={ownerLabel}
              placeholder="All owners"
              loadOptions={loadOwnerOptions}
              onChange={(val, opt) => {
                setOwnerId(val ? String(val) : '');
                setOwnerLabel(opt?.label || '');
              }}
            />
          ) : null}
          <SearchableSelect
            value={tagId}
            placeholder="All tags"
            options={tags.map((t) => ({ value: t.id, label: t.name }))}
            onChange={(val) => setTagId(val ? String(val) : '')}
          />
        </div>

        <div className="pl-toolbar">
          <div className="segmented" role="group" aria-label="Temperature">
            {TEMPERATURE_FILTERS.map((t) => (
              <button
                key={t.key || 'all'}
                type="button"
                className={temperature === t.key ? 'active' : ''}
                aria-pressed={temperature === t.key}
                onClick={() => setTemperature(t.key)}
              >
                {t.key ? <span className={`pl-temp-dot pl-temp-${t.key}`} aria-hidden="true" /> : null}
                {t.label}
              </button>
            ))}
          </div>
          <div className="pl-toolbar-right">
            {hasFilters ? (
              <button type="button" className="btn small ghost" onClick={clearFilters}>
                <FiX size={13} />
                Clear filters
              </button>
            ) : null}
            <Switch checked={showNotInterested} onChange={setShowNotInterested} label="Show not interested" />
          </div>
        </div>
      </section>

      {!board && loading ? (
        <BoardSkeleton />
      ) : !board ? (
        <section className="panel">
          <EmptyState
            icon={FiColumns}
            title="Couldn't load the pipeline"
            action={
              <button type="button" className="btn small" onClick={() => load()}>
                Try again
              </button>
            }
          >
            {loadError}
          </EmptyState>
        </section>
      ) : boardEmpty ? (
        <section className="panel">
          <EmptyState
            icon={FiColumns}
            title={hasFilters ? 'No deals match these filters' : 'Your pipeline is empty'}
            action={
              hasFilters ? (
                <button type="button" className="btn small" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : (
                <Link to="/leads" className="btn small primary">
                  Go to leads
                </Link>
              )
            }
          >
            {hasFilters
              ? 'Try a different search, product or temperature.'
              : 'Leads you add will show up here, grouped by stage.'}
          </EmptyState>
        </section>
      ) : (
        <div className={`pl-board${loading ? ' is-loading' : ''}${dragging ? ' is-dragging' : ''}`}>
          {visibleStages.map((stage) => {
            const data = stageData[stage.key] || { count: 0, value: 0, leads: [] };
            const leads = data.leads || [];
            const more = Math.max(0, data.count - leads.length);
            const canDrop = Boolean(dragging) && dragging.status !== stage.key;
            return (
              <section
                key={stage.key}
                className={`pl-column pl-stage-${stage.key}${canDrop ? ' can-drop' : ''}${
                  overStage === stage.key ? ' is-over' : ''
                }`}
                onDragOver={(e) => onColumnDragOver(e, stage.key)}
                onDragLeave={(e) => onColumnDragLeave(e, stage.key)}
                onDrop={(e) => onColumnDrop(e, stage.key)}
                style={{ '--pl-stage': STAGE_HEX[stage.key] }}
                aria-label={`${stage.label}: ${data.count} deals`}
              >
                <header className="pl-column-head">
                  <div className="pl-column-title">
                    <span className="pl-dot" aria-hidden="true" />
                    <h2>{stage.label}</h2>
                    <span className="count-chip">{data.count}</span>
                  </div>
                  <div className="pl-column-meta" title={formatCurrency(data.value || 0)}>
                    {formatCurrency(data.value || 0, { compact: true })}
                    {OPEN_STAGES.includes(stage.key) && data.probability != null ? (
                      <span> · {Math.round(Number(data.probability) * 100)}%</span>
                    ) : null}
                  </div>
                </header>
                <div className="pl-column-body">
                  {leads.length === 0 ? (
                    <div className="pl-column-empty">{canDrop ? 'Drop here' : 'No deals'}</div>
                  ) : (
                    leads.map((lead) => (
                      <PipelineCard
                        key={lead.id}
                        lead={lead}
                        stages={ALL_STAGE_KEYS}
                        dragging={dragging?.id === lead.id}
                        onDragStart={onDragStart}
                        onDragEnd={endDrag}
                        onMove={moveLead}
                      />
                    ))
                  )}
                  {more > 0 ? (
                    <Link to={`/leads?status=${stage.key}`} className="pl-column-more">
                      +{more.toLocaleString('en-IN')} more — view in list
                    </Link>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <LostReasonModal
        lead={lostPrompt?.lead || null}
        reasons={settings.lost_reasons || []}
        saving={savingLost}
        onConfirm={confirmLost}
        onCancel={cancelLost}
      />
    </div>
  );
}

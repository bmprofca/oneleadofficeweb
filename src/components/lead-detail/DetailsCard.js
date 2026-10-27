import React, { useMemo, useState } from 'react';
import { FiBox, FiExternalLink, FiMapPin, FiUser } from 'react-icons/fi';
import FormField from '../FormField';
import SearchableSelect from '../SearchableSelect';
import Switch from '../crm/Switch';
import { loadUsersOptions } from '../../utils/apiSelect';
import { formatRelative, phoneLink, sourceLabel } from '../../utils/crm';
import { formatDateTime } from '../../utils/format';
import { EditButton, SaveBar, SideCard } from './DealCard';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const websiteHref = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);
const isHttpUrl = (url) => /^https?:\/\/\S+$/i.test(String(url || '').trim());

/** Contact info + record details with inline edit. */
export default function DetailsCard({ lead, isAdmin, sources = [], readOnly, onSave }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [labels, setLabels] = useState({ product: '', owner: '' });
  const [errors, setErrors] = useState({});
  const [waSaving, setWaSaving] = useState(false);

  const sourceOptions = useMemo(() => {
    const list = [...sources];
    if (lead.source && !list.includes(lead.source)) list.push(lead.source);
    return list.map((s) => ({ value: s, label: sourceLabel(s) }));
  }, [sources, lead.source]);

  const startEdit = () => {
    setForm({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      company: lead.company || '',
      address: lead.address || '',
      website: lead.website || '',
      business_profile_url: lead.business_profile_url || '',
      maps_url: lead.maps_url || '',
      product_id: lead.product_id ? String(lead.product_id) : '',
      source: lead.source || '',
      assigned_to: lead.assigned_to ? String(lead.assigned_to) : '',
    });
    setLabels({ product: lead.product_name || '', owner: lead.assigned_name || '' });
    setErrors({});
    setEditing(true);
  };

  const field = (key) => ({
    value: form[key] ?? '',
    className: errors[key] ? 'invalid' : '',
    onChange: (e) => {
      const { value } = e.target;
      setForm((f) => ({ ...f, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    },
  });

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email';
    if (form.business_profile_url.trim() && !isHttpUrl(form.business_profile_url)) {
      next.business_profile_url = 'Enter a full link starting with https://';
    }
    if (form.maps_url.trim() && !isHttpUrl(form.maps_url)) next.maps_url = 'Enter a full link starting with https://';
    setErrors(next);
    if (Object.keys(next).length) return;

    const patch = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      company: form.company.trim(),
      address: form.address.trim(),
      website: form.website.trim(),
      business_profile_url: form.business_profile_url.trim(),
      maps_url: form.maps_url.trim(),
      source: form.source || null,
    };
    if (isAdmin && String(form.assigned_to || '') !== String(lead.assigned_to || '')) {
      patch.assigned_to = form.assigned_to ? Number(form.assigned_to) : null;
    }
    setSaving(true);
    const ok = await onSave(patch, 'Details saved', {
      ...(patch.assigned_to !== undefined ? { assigned_name: labels.owner || null } : {}),
    });
    setSaving(false);
    if (ok) setEditing(false);
  };

  const toggleWhatsapp = async (checked) => {
    setWaSaving(true);
    await onSave({ whatsapp_active: checked ? 1 : 0 }, checked ? 'WhatsApp opt-in enabled' : 'WhatsApp opt-in disabled');
    setWaSaving(false);
  };

  const links = phoneLink(lead.phone);

  return (
    <SideCard
      title="Contact & details"
      icon={FiUser}
      action={!editing && !readOnly ? <EditButton onClick={startEdit} /> : null}
    >
      {editing ? (
        <form className="ld-card-form" onSubmit={submit} noValidate>
          <FormField label="Name *" error={errors.name}>
            <input {...field('name')} autoFocus />
          </FormField>
          <FormField label="Phone">
            <input {...field('phone')} type="tel" inputMode="tel" />
          </FormField>
          <FormField label="Email" error={errors.email}>
            <input {...field('email')} type="email" inputMode="email" />
          </FormField>
          <FormField label="Company">
            <input {...field('company')} />
          </FormField>
          <FormField label="Address">
            <textarea rows="2" {...field('address')} />
          </FormField>
          <FormField label="Website">
            <input {...field('website')} inputMode="url" placeholder="example.com" />
          </FormField>
          <FormField label="Google Business Profile" error={errors.business_profile_url}>
            <input
              {...field('business_profile_url')}
              inputMode="url"
              placeholder="https://www.google.com/maps?cid=…"
            />
          </FormField>
          <FormField label="Google Maps link" error={errors.maps_url}>
            <input {...field('maps_url')} inputMode="url" placeholder="https://www.google.com/maps/place/…" />
          </FormField>
          <FormField label="Product">
            <div className="field-readonly" title="A lead's product can't be changed after it is created">
              <FiBox size={14} aria-hidden="true" />
              {lead.product_name || '—'}
              <small>Locked</small>
            </div>
          </FormField>
          <FormField label="Source">
            <SearchableSelect
              value={form.source}
              options={sourceOptions}
              placeholder="Select source"
              onChange={(val) => setForm((f) => ({ ...f, source: val || '' }))}
            />
          </FormField>
          {isAdmin ? (
            <FormField label="Owner">
              <SearchableSelect
                value={form.assigned_to}
                valueLabel={labels.owner}
                placeholder="Unassigned"
                loadOptions={loadUsersOptions}
                onChange={(val, opt) => {
                  setForm((f) => ({ ...f, assigned_to: val || '' }));
                  setLabels((l) => ({ ...l, owner: opt?.label || '' }));
                }}
              />
            </FormField>
          ) : null}
          <SaveBar saving={saving} onCancel={() => setEditing(false)} />
        </form>
      ) : (
        <dl className="kv-list ld-kv">
          <div>
            <dt>Phone</dt>
            <dd>{lead.phone && links ? <a className="ld-link" href={links.tel}>{lead.phone}</a> : lead.phone || '—'}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{lead.email ? <a className="ld-link" href={`mailto:${lead.email}`}>{lead.email}</a> : '—'}</dd>
          </div>
          <div>
            <dt>Company</dt>
            <dd>{lead.company || '—'}</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd className="ld-prewrap">{lead.address || '—'}</dd>
          </div>
          <div>
            <dt>Website</dt>
            <dd>
              {lead.website ? (
                <a className="ld-link" href={websiteHref(lead.website)} target="_blank" rel="noopener noreferrer">
                  {lead.website.replace(/^https?:\/\//i, '')} <FiExternalLink size={11} />
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt>Google Maps</dt>
            <dd>
              {lead.business_profile_url || lead.maps_url ? (
                <span className="ld-map-links">
                  {isHttpUrl(lead.business_profile_url) ? (
                    <a className="ld-link" href={lead.business_profile_url} target="_blank" rel="noopener noreferrer">
                      <FiMapPin size={12} /> Business profile <FiExternalLink size={11} />
                    </a>
                  ) : null}
                  {isHttpUrl(lead.maps_url) ? (
                    <a className="ld-link" href={lead.maps_url} target="_blank" rel="noopener noreferrer">
                      Map location <FiExternalLink size={11} />
                    </a>
                  ) : null}
                </span>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt>Product</dt>
            <dd>{lead.product_name || '—'}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{sourceLabel(lead.source)}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{lead.assigned_name || <span className="crm-muted">Unassigned</span>}</dd>
          </div>
          <div className="ld-kv-switch">
            <dt>WhatsApp opt-in</dt>
            <dd>
              <Switch
                checked={Number(lead.whatsapp_active) === 1}
                disabled={readOnly || waSaving}
                onChange={toggleWhatsapp}
                label={Number(lead.whatsapp_active) === 1 ? 'Opted in' : 'Not opted in'}
              />
            </dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd title={formatDateTime(lead.created_at)}>
              {formatDateTime(lead.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}
              {lead.created_by_name ? <span className="ld-kv-sub"> · by {lead.created_by_name}</span> : null}
            </dd>
          </div>
          <div>
            <dt>Last activity</dt>
            <dd title={formatDateTime(lead.last_activity_at)}>{lead.last_activity_at ? formatRelative(lead.last_activity_at) : '—'}</dd>
          </div>
          <div>
            <dt>In stage since</dt>
            <dd title={formatDateTime(lead.stage_changed_at)}>{lead.stage_changed_at ? formatRelative(lead.stage_changed_at) : '—'}</dd>
          </div>
        </dl>
      )}
    </SideCard>
  );
}

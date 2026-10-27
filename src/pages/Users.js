import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiUserCheck, FiUserX } from 'react-icons/fi';
import api from '../api/client';
import ActionMenu from '../components/ActionMenu';
import FormField from '../components/FormField';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import RefreshButton from '../components/RefreshButton';
import SearchableSelect from '../components/SearchableSelect';
import { PanelTableSkeleton } from '../components/Skeleton';
import Switch from '../components/crm/Switch';
import { formatOptionLabel } from '../utils/format';
import { formatRelative } from '../utils/crm';
import '../styles/leads-upgrade.css';
import {
  clearFieldError,
  validateForm,
  validators,
} from '../utils/validation';

const emptyForm = {
  name: '',
  email: '',
  role: 'sales',
  phone: '',
  status: 'active',
  auto_assign: true,
};

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'sales', label: 'Sales' },
];

const schema = {
  name: [
    validators.required('Name is required'),
    validators.minLength(2, 'Name must be at least 2 characters'),
  ],
  phone: [
    validators.required('Mobile number is required'),
    validators.phone('Enter a valid 10-digit mobile number'),
  ],
  email: [validators.email('Enter a valid email address')],
  role: [
    validators.required('Role is required'),
    validators.oneOf(['admin', 'sales'], 'Select a valid role'),
  ],
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    try {
      setTableLoading(true);
      const { data } = await api.get('/users', {
        params: { page, limit },
      });
      if (Array.isArray(data)) {
        setUsers(data);
        setTotal(data.length);
        setTotalPages(1);
      } else {
        setUsers(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load users');
    } finally {
      setTableLoading(false);
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => clearFieldError(prev, name));
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setForm(emptyForm);
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = validateForm(schema, form);
    setErrors(result.errors);
    if (!result.valid) return;

    try {
      await api.post('/users', {
        ...form,
        auto_assign: form.role === 'sales' ? Boolean(form.auto_assign) : false,
      });
      toast.success('User created');
      closeCreate();
      if (page === 1) load();
      else setPage(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    }
  };

  const updateStatus = async (user) => {
    try {
      await api.put(`/users/${user.id}`, {
        status: user.status === 'active' ? 'inactive' : 'active',
      });
      toast.success(
        user.status === 'active' ? 'User deactivated' : 'User activated'
      );
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    }
  };

  const toggleAutoAssign = async (user, next) => {
    const previous = user.auto_assign;
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, auto_assign: next ? 1 : 0 } : u))
    );
    try {
      await api.put(`/users/${user.id}`, { auto_assign: next });
      toast.success(
        next
          ? `${user.name} will receive auto-assigned leads`
          : `${user.name} removed from auto-assign`
      );
    } catch (err) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, auto_assign: previous } : u))
      );
      toast.error(err.response?.data?.message || 'Failed to update auto-assign');
    }
  };

  if (loading && users.length === 0) {
    return <PanelTableSkeleton rows={6} cols={6} />;
  }

  return (
    <div className="page users-page">
      <header className="page-header">
        <div>
          <h1>Users & roles</h1>
          <p>
            Create admins and sales users. They sign in with mobile OTP. Your
            own account is managed from profile, not this list.
          </p>
        </div>
        <div className="page-header-actions">
          <RefreshButton
            onRefresh={async () => {
              try {
                await load();
                toast.success('Users refreshed');
              } catch {
                /* load toasts */
              }
            }}
          />
          <button type="button" className="btn primary" onClick={() => setCreateOpen(true)}>
            <FiPlus size={15} />
            Add user
          </button>
        </div>
      </header>

      <section className="panel leads-panel">
        <div className="leads-toolbar">
          <div className="leads-toolbar-title">
            <h2>Team</h2>
            <span className="count-chip">{total} total</span>
          </div>
        </div>

        <div className="table-wrap">
          {tableLoading ? (
            <p className="hint" style={{ padding: 12 }}>
              Loading…
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="col-serial">#</th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="lu-col-switch">Auto-assign</th>
                  <th className="lu-col-num">Open leads</th>
                  <th className="lu-col-seen">Last seen</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan="10">No other users yet.</td>
                  </tr>
                )}
                {users.map((user, index) => (
                  <tr key={user.id}>
                    <td className="col-serial">{(page - 1) * limit + index + 1}</td>
                    <td>
                      <strong>{user.name}</strong>
                    </td>
                    <td>{user.phone || '—'}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`role-badge role-${user.role}`}>
                        {formatOptionLabel(user.role)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status status-${
                          user.status === 'active' ? 'active' : 'inactive'
                        }`}
                      >
                        {formatOptionLabel(user.status)}
                      </span>
                    </td>
                    <td className="lu-col-switch">
                      {user.role === 'sales' ? (
                        <Switch
                          checked={Boolean(Number(user.auto_assign))}
                          disabled={user.status !== 'active'}
                          onChange={(next) => toggleAutoAssign(user, next)}
                        />
                      ) : (
                        <span className="crm-muted">—</span>
                      )}
                    </td>
                    <td className="lu-col-num">
                      {user.open_leads != null ? Number(user.open_leads).toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="lu-col-seen" title={user.last_seen_at || ''}>
                      {user.last_seen_at ? formatRelative(user.last_seen_at) : (
                        <span className="crm-muted">Never</span>
                      )}
                    </td>
                    <td className="actions-col">
                      <ActionMenu
                        items={[
                          {
                            label:
                              user.status === 'active' ? 'Deactivate' : 'Activate',
                            icon:
                              user.status === 'active' ? (
                                <FiUserX size={14} />
                              ) : (
                                <FiUserCheck size={14} />
                              ),
                            danger: user.status === 'active',
                            onClick: () => updateStatus(user),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
        />
      </section>

      <Modal
        open={createOpen}
        title="Create user"
        onClose={closeCreate}
        footer={
          <>
            <button type="button" className="btn" onClick={closeCreate}>
              Cancel
            </button>
            <button type="submit" form="user-create-form" className="btn primary">
              Create user
            </button>
          </>
        }
      >
        <form
          id="user-create-form"
          className="form-grid"
          onSubmit={handleSubmit}
          noValidate
        >
          <FormField label="Name *" error={errors.name}>
            <input
              name="name"
              value={form.name}
              onChange={onChange}
              placeholder="Full name"
              className={errors.name ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Mobile *" error={errors.phone}>
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={onChange}
              placeholder="10-digit mobile"
              className={errors.phone ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Email" error={errors.email}>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              placeholder="name@example.com"
              className={errors.email ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Role *" error={errors.role}>
            <SearchableSelect
              value={form.role}
              options={roleOptions}
              clearable={false}
              invalid={Boolean(errors.role)}
              onChange={(val) => {
                setForm((prev) => ({ ...prev, role: val || 'sales' }));
                setErrors((prev) => clearFieldError(prev, 'role'));
              }}
            />
          </FormField>
          {form.role === 'sales' && (
            <FormField
              className="full"
              hint="New leads are shared round-robin among sales users with auto-assign on."
            >
              <Switch
                checked={form.auto_assign}
                onChange={(next) => setForm((prev) => ({ ...prev, auto_assign: next }))}
                label="Include in auto-assign (round-robin)"
              />
            </FormField>
          )}
        </form>
      </Modal>
    </div>
  );
}

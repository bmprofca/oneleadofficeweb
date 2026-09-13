import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { FiUser } from 'react-icons/fi';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import FormField from '../components/FormField';
import RefreshButton from '../components/RefreshButton';
import { formatOptionLabel } from '../utils/format';
import {
  clearFieldError,
  validateForm,
  validators,
} from '../utils/validation';

export default function Profile() {
  const { user, setUserFromProfile } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const refreshProfile = async () => {
    const { data } = await api.get('/auth/me');
    setUserFromProfile(data);
    setForm({
      name: data.name || '',
      email: data.email || '',
    });
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => clearFieldError(prev, name));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = validateForm(
      {
        name: [
          validators.required('Full name is required'),
          validators.minLength(2, 'Name must be at least 2 characters'),
        ],
        email: [validators.email('Enter a valid email address')],
      },
      form
    );
    setErrors(result.errors);
    if (!result.valid) return;

    setSaving(true);
    try {
      const { data } = await api.put('/auth/me', form);
      setUserFromProfile(data);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Profile</h1>
          <p>View and update your account details.</p>
        </div>
        <div className="page-header-actions">
          <RefreshButton
            onRefresh={async () => {
              try {
                await refreshProfile();
                toast.success('Profile refreshed');
              } catch (err) {
                toast.error(err.response?.data?.message || 'Failed to refresh');
              }
            }}
          />
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>
            <FiUser size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Account
          </h2>
        </div>
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <FormField label="Full name *" error={errors.name}>
            <input
              name="name"
              value={form.name}
              onChange={onChange}
              placeholder="Enter your full name"
              className={errors.name ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Email" error={errors.email}>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              placeholder="Enter your email"
              className={errors.email ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Mobile">
            <input value={user?.phone || ''} disabled placeholder="Mobile number" />
          </FormField>
          <FormField label="Role">
            <input
              value={formatOptionLabel(user?.role || '')}
              disabled
              placeholder="Role"
            />
          </FormField>
          <div className="full">
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

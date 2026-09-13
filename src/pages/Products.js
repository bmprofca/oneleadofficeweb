import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { FiEdit2, FiEye, FiPlus, FiSearch, FiTrash2, FiUsers } from 'react-icons/fi';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import ActionMenu from '../components/ActionMenu';
import ConfirmModal from '../components/ConfirmModal';
import FormField from '../components/FormField';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import RefreshButton from '../components/RefreshButton';
import SearchableSelect from '../components/SearchableSelect';
import { PanelTableSkeleton } from '../components/Skeleton';
import { formatOptionLabel } from '../utils/format';
import {
  clearFieldError,
  validateForm,
  validators,
} from '../utils/validation';

const emptyForm = {
  name: '',
  description: '',
  status: 'active',
};

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const schema = {
  name: [
    validators.required('Product name is required'),
    validators.minLength(2, 'Product name must be at least 2 characters'),
  ],
  status: [
    validators.required('Status is required'),
    validators.oneOf(['active', 'inactive'], 'Select a valid status'),
  ],
};

export default function Products() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [modalMode, setModalMode] = useState(null);
  const [activeProduct, setActiveProduct] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/products', {
        params: {
          page,
          limit,
          search: debouncedSearch || undefined,
        },
      });
      if (Array.isArray(data)) {
        setProducts(data);
        setTotal(data.length);
        setTotalPages(1);
      } else {
        setProducts(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => clearFieldError(prev, name));
  };

  const openCreate = () => {
    setActiveProduct(null);
    setForm(emptyForm);
    setErrors({});
    setModalMode('create');
  };

  const openEdit = (product) => {
    setActiveProduct(product);
    setForm({
      name: product.name || '',
      description: product.description || '',
      status: product.status || 'active',
    });
    setErrors({});
    setModalMode('edit');
  };

  const openView = (product) => {
    setActiveProduct(product);
    setModalMode('view');
  };

  const closeModal = () => {
    setModalMode(null);
    setActiveProduct(null);
    setForm(emptyForm);
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasRole('admin')) return;
    const result = validateForm(schema, form);
    setErrors(result.errors);
    if (!result.valid) return;

    try {
      if (modalMode === 'edit' && activeProduct) {
        await api.put(`/products/${activeProduct.id}`, form);
        toast.success('Product updated');
      } else {
        await api.post('/products', form);
        toast.success('Product created');
      }
      closeModal();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const handleDelete = (product) => {
    setConfirmDelete(product);
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/products/${confirmDelete.id}`);
      toast.success('Product deleted');
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && products.length === 0) {
    return <PanelTableSkeleton rows={6} cols={5} />;
  }

  return (
    <div className="page products-page">
      <header className="page-header">
        <div>
          <h1>Products</h1>
          <p>Manage company products. Each product has its own leads.</p>
        </div>
        <div className="page-header-actions">
          <RefreshButton
            onRefresh={async () => {
              try {
                await load();
                toast.success('Products refreshed');
              } catch {
                /* load toasts */
              }
            }}
          />
          {hasRole('admin') && (
            <button type="button" className="btn primary" onClick={openCreate}>
              <FiPlus size={15} />
              Add product
            </button>
          )}
        </div>
      </header>

      <section className="panel leads-panel">
        <div className="leads-toolbar">
          <div className="leads-toolbar-title">
            <h2>All products</h2>
            <span className="count-chip">{total} total</span>
          </div>
          <div className="filter-bar filter-bar-1">
            <div className="filter-search">
              <FiSearch size={15} />
              <input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="col-serial">#</th>
                <th className="col-name">Name</th>
                <th className="col-product">Leads</th>
                <th className="col-status">Status</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td colSpan="5">No products found.</td>
                </tr>
              )}
              {products.map((product, index) => (
                <tr key={product.id}>
                  <td className="col-serial">{(page - 1) * limit + index + 1}</td>
                  <td className="col-name">
                    <strong>{product.name}</strong>
                    {product.description ? (
                      <div>
                        <small>{product.description}</small>
                      </div>
                    ) : null}
                  </td>
                  <td className="col-product">{product.lead_count || 0}</td>
                  <td className="col-status">
                    <span className={`status status-${product.status}`}>
                      {formatOptionLabel(product.status)}
                    </span>
                  </td>
                  <td className="actions-col">
                    <ActionMenu
                      items={[
                        {
                          label: 'View details',
                          icon: <FiEye size={14} />,
                          onClick: () => openView(product),
                        },
                        {
                          label: 'View leads',
                          icon: <FiUsers size={14} />,
                          onClick: () => navigate(`/leads?product_id=${product.id}`),
                        },
                        ...(hasRole('admin')
                          ? [
                              {
                                label: 'Edit',
                                icon: <FiEdit2 size={14} />,
                                onClick: () => openEdit(product),
                              },
                              {
                                label: 'Delete',
                                icon: <FiTrash2 size={14} />,
                                danger: true,
                                onClick: () => handleDelete(product),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
        open={modalMode === 'create' || modalMode === 'edit'}
        title={modalMode === 'edit' ? 'Edit product' : 'Add product'}
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="btn" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="product-form" className="btn primary">
              {modalMode === 'edit' ? 'Save changes' : 'Create product'}
            </button>
          </>
        }
      >
        <form id="product-form" className="form-grid" onSubmit={handleSubmit} noValidate>
          <FormField label="Product name *" className="full" error={errors.name}>
            <input
              name="name"
              value={form.name}
              onChange={onChange}
              placeholder="Enter product name"
              className={errors.name ? 'invalid' : ''}
            />
          </FormField>
          <FormField label="Status" error={errors.status}>
            <SearchableSelect
              value={form.status}
              options={statusOptions}
              clearable={false}
              invalid={Boolean(errors.status)}
              onChange={(val) => {
                setForm((prev) => ({ ...prev, status: val || 'active' }));
                setErrors((prev) => clearFieldError(prev, 'status'));
              }}
            />
          </FormField>
          <FormField label="Description" className="full" error={errors.description}>
            <textarea
              name="description"
              rows="4"
              value={form.description}
              onChange={onChange}
              placeholder="Brief product description"
              className={errors.description ? 'invalid' : ''}
            />
          </FormField>
        </form>
      </Modal>

      <Modal
        open={modalMode === 'view'}
        title="Product details"
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="btn" onClick={closeModal}>
              Close
            </button>
            {hasRole('admin') && activeProduct && (
              <button
                type="button"
                className="btn primary"
                onClick={() => openEdit(activeProduct)}
              >
                Edit
              </button>
            )}
          </>
        }
      >
        {activeProduct && (
          <div className="detail-grid">
            <div className="detail-item">
              <span>Name</span>
              <strong>{activeProduct.name}</strong>
            </div>
            <div className="detail-item">
              <span>Status</span>
              <strong>
                <span className={`status status-${activeProduct.status}`}>
                  {formatOptionLabel(activeProduct.status)}
                </span>
              </strong>
            </div>
            <div className="detail-item">
              <span>Linked leads</span>
              <strong>{activeProduct.lead_count || 0}</strong>
            </div>
            <div className="detail-item full">
              <span>Description</span>
              <strong>{activeProduct.description || '—'}</strong>
            </div>
            <div className="full" style={{ marginTop: 4 }}>
              <Link className="btn" to={`/leads?product_id=${activeProduct.id}`}>
                View leads for this product
              </Link>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={Boolean(confirmDelete)}
        title="Delete product?"
        message={
          confirmDelete
            ? `Delete "${confirmDelete.name}"? This is only allowed if no leads are linked to it.`
            : ''
        }
        confirmLabel="Delete product"
        loading={deleting}
        onConfirm={confirmDeleteAction}
        onClose={() => {
          if (!deleting) setConfirmDelete(null);
        }}
      />
    </div>
  );
}

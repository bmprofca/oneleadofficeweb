import api from '../api/client';

const PAGE_LIMITS = [5, 10, 20, 50, 100];

function normalizePageResult(data, mapItem) {
  if (Array.isArray(data)) {
    const items = data.map(mapItem);
    return { items, total: items.length, hasMore: false };
  }
  const items = (data.items || []).map(mapItem);
  const total = Number(data.total ?? items.length);
  const page = Number(data.page || 1);
  const limit = Number(data.limit || items.length || 20);
  const totalPages = Number(data.totalPages || Math.max(1, Math.ceil(total / limit)));
  return {
    items,
    total,
    hasMore: page < totalPages,
  };
}

export function createApiLoader(endpoint, { mapItem, params: baseParams = {} } = {}) {
  return async ({ search = '', page = 1, limit = 20 } = {}) => {
    const safeLimit = PAGE_LIMITS.includes(Number(limit)) ? Number(limit) : 20;
    const { data } = await api.get(endpoint, {
      params: {
        ...baseParams,
        search: search || undefined,
        page,
        limit: safeLimit,
      },
    });
    return normalizePageResult(data, mapItem);
  };
}

export const loadLeadsOptions = createApiLoader('/leads', {
  mapItem: (lead) => ({
    value: lead.id,
    label: lead.name,
    meta: lead.phone || lead.email || undefined,
  }),
});

export const loadProductsOptions = createApiLoader('/products', {
  params: { status: 'active' },
  mapItem: (product) => ({
    value: product.id,
    label: product.name,
  }),
});

export const loadAllProductsOptions = createApiLoader('/products', {
  mapItem: (product) => ({
    value: product.id,
    label: product.name,
    meta: product.status,
  }),
});

export const loadUsersOptions = createApiLoader('/users/assignable', {
  mapItem: (user) => ({
    value: user.id,
    label: user.name,
    meta: user.role,
  }),
});

export const loadAdminUsersOptions = createApiLoader('/users', {
  mapItem: (user) => ({
    value: user.id,
    label: user.name,
    meta: user.role,
  }),
});

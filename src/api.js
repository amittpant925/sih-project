const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export async function apiRequest(path, options = {}) {
  const token = window.localStorage.getItem('directfarm_token');
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(`Unable to connect to DirectFarm API at ${API_BASE_URL}. Start the backend with "npm run server" and check your API URL.`);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Something went wrong. Please try again.');
  return payload;
}

export const authApi = {
  login: (body) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  register: (body) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  me: () => apiRequest('/auth/me'),
  createQrSession: () => apiRequest('/auth/qr/session', { method: 'POST' }),
  qrStatus: (sessionId) => apiRequest(`/auth/qr/session/${sessionId}`),
  approveQrSession: (sessionId, token) => apiRequest(`/auth/qr/session/${sessionId}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }),
};

export const productApi = {
  list: (params) => apiRequest(`/products?${new URLSearchParams(params)}`),
  create: (body) => apiRequest('/products', { method: 'POST', body: JSON.stringify(body) }),
};

export const orderApi = {
  create: (body) => apiRequest('/orders', { method: 'POST', body: JSON.stringify(body) }),
};

export const listingApi = {
  create: (body) => apiRequest('/listings', { method: 'POST', body: JSON.stringify(body) }),
  activeAuctions: () => apiRequest('/listings/active-auctions'),
  get: (id) => apiRequest(`/listings/${id}`),
  bid: (body) => apiRequest('/bids', { method: 'POST', body: JSON.stringify(body) }),
  reserve: (body) => apiRequest('/reservations', { method: 'POST', body: JSON.stringify(body) }),
  purchase: (listingId, body) => apiRequest(`/listings/${listingId}/purchase`, { method: 'POST', body: JSON.stringify(body) }),
};

export const batchApi = {
  create: (body) => apiRequest('/batches', { method: 'POST', body: JSON.stringify(body) }),
  verify: (batchId) => apiRequest(`/verify-batch/${encodeURIComponent(batchId)}`),
};

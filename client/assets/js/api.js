/**
 * api.js
 * -----------------------------------------------------------------------
 * Thin wrapper around the Fetch API for talking to the Moamenoon Cars
 * backend. Every other JS file (auth.js, search.js, main.js, ...) should
 * go through the `api` object defined here instead of calling fetch()
 * directly, so auth headers, error handling, and the base URL stay
 * consistent across the whole app.
 * -----------------------------------------------------------------------
 */

const API_BASE_URL = window.location.origin + '/api';
const TOKEN_KEY = 'moamenoon_token';
const USER_KEY = 'moamenoon_user';

/**
 * Builds the headers object for a request, attaching the JWT if present.
 */
function buildHeaders(isFormData) {
  const headers = {};
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return headers;
}

/**
 * Core request function. Throws an Error with a readable message on
 * non-2xx responses so callers can simply try/catch.
 */
async function request(path, { method = 'GET', body, isFormData = false } = {}) {
  const options = {
    method,
    headers: buildHeaders(isFormData),
  };

  if (body !== undefined) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch (networkErr) {
    throw new Error('Network error — please check your connection and try again.');
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
  }

  if (!response.ok) {
    const message = (data && data.message) || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

const api = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, body, isFormData = false) => request(path, { method: 'POST', body, isFormData }),
  put: (path, body, isFormData = false) => request(path, { method: 'PUT', body, isFormData }),
  delete: (path) => request(path, { method: 'DELETE' }),

  // ---------------- Token / user helpers ----------------
  setToken: (token) => localStorage.setItem(TOKEN_KEY, token),
  getToken: () => localStorage.getItem(TOKEN_KEY),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),

  setUser: (user) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  getUser: () => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch (e) {
      return null;
    }
  },
  clearUser: () => localStorage.removeItem(USER_KEY),

  isLoggedIn: () => Boolean(localStorage.getItem(TOKEN_KEY)),
};

// Expose globally since we're not using ES modules (vanilla script tags)
window.api = api;

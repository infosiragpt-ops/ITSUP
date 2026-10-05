import { useCallback, useEffect, useRef, useState } from 'react';

const TOKEN_KEY = 'isup_token';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(t) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload });
  } catch {
    throw new Error('No pudimos conectarnos con el servidor. Revisa tu conexión.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event('isup:logout'));
  }
  if (!res.ok) throw new Error(data.error || 'Ocurrió un error inesperado');
  return data;
}

api.get = (p) => api(p);
api.post = (p, body) => api(p, { method: 'POST', body: body ?? {} });
api.put = (p, body) => api(p, { method: 'PUT', body: body ?? {} });
api.del = (p) => api(p, { method: 'DELETE' });
api.form = (p, form, method = 'POST') => api(p, { method, form });

/** Fetch hook. Keeps previous data while reloading so screens don't flash. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, loading: !!path, error: null });
  const current = useRef(path);
  current.current = path;

  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: s.data == null, error: null }));
    try {
      const data = await api(path);
      if (current.current === path) setState({ data, loading: false, error: null });
    } catch (e) {
      if (current.current === path) setState({ data: null, loading: false, error: e.message });
    }
  }, [path]);

  useEffect(() => { setState({ data: null, loading: !!path, error: null }); load(); }, [load]);

  const setData = useCallback((fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })), []);
  return { ...state, reload: load, setData };
}

export const fileUrl = (path, name) => `/uploads/${path}${name ? `?name=${encodeURIComponent(name)}` : ''}`;

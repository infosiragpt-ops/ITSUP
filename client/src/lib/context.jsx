import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { api, getToken, setToken } from './api.js';
import { Button, Modal } from '../components/ui.jsx';

/* ---------------- Auth ---------------- */

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api.get('/auth/me').then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('isup:logout', onLogout);
    return () => window.removeEventListener('isup:logout', onLogout);
  }, []);

  const login = useCallback(async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    setToken(r.token);
    setUser(r.user);
    return r.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, login, logout, setUser }), [user, ready, login, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

/* ---------------- Theme ---------------- */

export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('isup_theme', next); } catch {}
    setTheme(next);
  }, [theme]);
  return { theme, toggle };
}

/* ---------------- Toasts & confirm ---------------- */

const UiCtx = createContext(null);

export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirm] = useState(null);
  const resolver = useRef(null);

  const toast = useCallback((message, tone = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    resolver.current = resolve;
    setConfirm(opts);
  }), []);

  const close = (v) => {
    resolver.current?.(v);
    setConfirm(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  const icons = { success: CheckCircle2, error: AlertCircle, info: Info };

  return (
    <UiCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 left-1/2 z-[100] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2" aria-live="polite">
        {toasts.map((t) => {
          const Icon = icons[t.tone] || Info;
          return (
            <div key={t.id} className="animate-scale-in flex items-start gap-3 rounded-xl bg-night px-4 py-3 text-sm text-[#F7F5EE] shadow-lift">
              <Icon size={18} className={t.tone === 'error' ? 'mt-px shrink-0 text-[#F19A8F]' : 'mt-px shrink-0 text-[#9ED2A8]'} />
              <span className="flex-1">{t.message}</span>
              <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-white/50 hover:text-white" aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <Modal
        open={!!confirmState}
        onClose={() => close(false)}
        title={confirmState?.title || '¿Estás seguro?'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>Cancelar</Button>
            <Button variant={confirmState?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {confirmState?.confirmText || 'Confirmar'}
            </Button>
          </>
        }
      >
        <p className="text-sm whitespace-pre-line text-muted">{confirmState?.message}</p>
      </Modal>
    </UiCtx.Provider>
  );
}

export const useUi = () => useContext(UiCtx);

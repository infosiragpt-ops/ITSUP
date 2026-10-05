import { useState } from 'react';
import { Save, KeyRound, Moon, Sun, Mail, IdCard, GraduationCap } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useAuth, useTheme, useUi } from '../../lib/context.jsx';
import { Avatar, Badge, Button, Card, Field, Input, PageHeader, Textarea, cx } from '../../components/ui.jsx';
import { ROLE_LABEL, fullName } from '../../lib/format.js';

const COLORS = ['#C96442', '#5B7B6F', '#6A5ACD', '#B8860B', '#2F6F8F', '#8B4C6B', '#4F6D3A', '#3D3929'];

export default function Profile() {
  const { user, setUser } = useAuth();
  const { theme, toggle } = useTheme();
  const { toast } = useUi();
  const [form, setForm] = useState({ first_name: user.first_name, last_name: user.last_name, phone: user.phone || '', bio: user.bio || '', avatar_color: user.avatar_color });
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.put('/auth/profile', form);
      setUser(r.user);
      if (user.role === 'student' && form.phone && form.bio && !user.onboarding?.profile) {
        const o = await api.put('/auth/onboarding', { key: 'profile', value: true });
        setUser((u) => ({ ...u, onboarding: o.onboarding }));
      }
      toast('Perfil actualizado');
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  };
  const changePwd = async (e) => {
    e.preventDefault();
    if (pwd.next !== pwd.confirm) return toast('Las contraseñas nuevas no coinciden', 'error');
    setSavingPwd(true);
    try {
      await api.put('/auth/password', pwd);
      setPwd({ current: '', next: '', confirm: '' });
      toast('Contraseña actualizada');
    } catch (err) { toast(err.message, 'error'); } finally { setSavingPwd(false); }
  };

  return (
    <div className="animate-fade-up mx-auto max-w-4xl">
      <PageHeader title="Mi perfil" subtitle="Así te ven tus docentes y compañeros en el aula virtual." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit p-6 text-center">
          <Avatar user={{ ...user, ...form }} size={88} className="mx-auto" />
          <div className="mt-4 text-lg font-semibold text-ink">{fullName({ ...user, ...form })}</div>
          <Badge tone="primary" className="mt-1">{ROLE_LABEL[user.role]}</Badge>
          <div className="mt-5 space-y-2 text-left text-sm text-ink-2">
            <div className="flex items-center gap-2"><Mail size={15} className="text-muted" /> <span className="truncate">{user.email}</span></div>
            {user.code && <div className="flex items-center gap-2"><IdCard size={15} className="text-muted" /> {user.code}</div>}
            {user.program && <div className="flex items-center gap-2"><GraduationCap size={15} className="text-muted" /> {user.program.name}{user.cycle ? ` · Ciclo ${user.cycle}` : ''}</div>}
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <Button variant="secondary" className="w-full" icon={theme === 'dark' ? Sun : Moon} onClick={toggle}>{theme === 'dark' ? 'Usar modo claro' : 'Usar modo oscuro'}</Button>
          </div>
        </Card>
        <div className="space-y-6">
          <Card as="form" onSubmit={save} className="space-y-4 p-6">
            <h2 className="font-semibold text-ink">Información personal</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nombres"><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field>
              <Field label="Apellidos"><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
              <Field label="Celular" className="sm:col-span-2"><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9XX XXX XXX" /></Field>
              <Field label="Sobre mí" className="sm:col-span-2" hint="Cuéntale a tu clase quién eres, a qué te dedicas o qué te motiva."><Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></Field>
            </div>
            <div>
              <span className="mb-2 block text-[13px] font-medium text-ink-2">Color de avatar</span>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, avatar_color: c })} aria-label={`Color ${c}`}
                    className={cx('h-8 w-8 rounded-full ring-offset-2 ring-offset-surface transition', form.avatar_color === c && 'ring-2 ring-ink')} style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="flex justify-end"><Button type="submit" icon={Save} loading={saving}>Guardar cambios</Button></div>
          </Card>
          <Card as="form" onSubmit={changePwd} className="space-y-4 p-6">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><KeyRound size={17} className="text-primary" /> Cambiar contraseña</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Actual"><Input type="password" autoComplete="current-password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} /></Field>
              <Field label="Nueva" hint="Mínimo 8 caracteres"><Input type="password" autoComplete="new-password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} /></Field>
              <Field label="Confirmar"><Input type="password" autoComplete="new-password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} /></Field>
            </div>
            <div className="flex justify-end"><Button type="submit" variant="secondary" loading={savingPwd} disabled={!pwd.current || !pwd.next}>Actualizar contraseña</Button></div>
          </Card>
        </div>
      </div>
    </div>
  );
}

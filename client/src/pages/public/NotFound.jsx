import { Compass } from 'lucide-react';
import { Button } from '../../components/ui.jsx';
import { Logo } from '../../components/brand.jsx';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
      <Logo className="mb-12" />
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Compass size={30} /></div>
      <h1 className="font-display mt-6 text-4xl font-semibold text-ink">Esta página no existe</h1>
      <p className="mt-3 max-w-md text-muted">Es posible que el enlace esté mal escrito o que el contenido se haya movido.</p>
      <div className="mt-8 flex gap-3">
        <Button to="/" variant="secondary">Ir al inicio</Button>
        <Button to="/app">Ir a mi aula</Button>
      </div>
    </div>
  );
}

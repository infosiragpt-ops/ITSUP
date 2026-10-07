import { Component } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';
import { Button } from './ui.jsx';

const RELOAD_KEY = 'isup_chunk_reload';
// Tras un despliegue, los archivos de la versión anterior ya no existen: se recarga la página una sola vez
const isChunkError = (e) => /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError/i.test(String(e?.message || e));

class Boundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error(error);
    if (isChunkError(error)) {
      try {
        if (!sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, '1');
          window.location.reload();
        }
      } catch {}
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger"><AlertTriangle size={26} /></div>
        <h1 className="font-display mt-5 text-2xl font-semibold text-ink">No pudimos mostrar esta página</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">Ocurrió un problema al cargar el contenido. Vuelve a intentarlo; si continúa, escríbenos y lo resolvemos.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button icon={RotateCw} onClick={() => window.location.reload()}>Recargar</Button>
          <Button variant="secondary" icon={Home} href="/">Ir al inicio</Button>
        </div>
      </div>
    );
  }
}

/** Evita la pantalla en blanco: si una página falla se muestra un aviso, y al cambiar de ruta se reintenta. */
export default function ErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return <Boundary key={pathname}>{children}</Boundary>;
}

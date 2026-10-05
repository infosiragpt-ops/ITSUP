// Aplica el tema guardado antes de pintar la página (evita el parpadeo). Archivo externo para una CSP sin 'unsafe-inline'.
try {
  var t = localStorage.getItem('isup_theme');
  if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.dataset.theme = 'dark';
} catch (e) {}

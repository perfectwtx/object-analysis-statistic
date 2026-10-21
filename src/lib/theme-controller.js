export const THEME_KEYS = ['system', 'light', 'dark', 'eyecare'];

export function createThemeController(env = {}) {
  const query = env.matchMedia?.('(prefers-color-scheme: dark)');
  const normalize = (mode) => THEME_KEYS.includes(mode) ? mode : 'system';
  const read = () => {
    try { return normalize(env.storage?.getItem('themeMode') || env.storage?.getItem('oa-theme')); }
    catch { return 'system'; }
  };
  let mode = read();
  const resolve = (value) => value === 'system' ? query?.matches === false ? 'light' : 'dark' : value;
  let snapshot = { mode, theme: resolve(mode) };
  const listeners = new Set();
  function sync() {
    const theme = resolve(mode);
    const root = env.document?.documentElement;
    if (root) {
      root.dataset.theme = theme; root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
      for (const key of ['light', 'dark', 'eyecare']) root.classList.toggle(key, key === theme);
    }
    if (snapshot.mode !== mode || snapshot.theme !== theme) {
      snapshot = { mode, theme }; listeners.forEach((listener) => listener());
    }
    return theme;
  }
  const storageChanged = (event) => {
    if (event.key && !['themeMode', 'oa-theme'].includes(event.key)) return;
    mode = read(); sync();
  };
  return {
    getSnapshot: () => snapshot,
    resolve: (value) => resolve(normalize(value)),
    apply: sync,
    setMode(value) {
      mode = normalize(value);
      try { env.storage?.setItem('themeMode', mode); env.storage?.setItem('oa-theme', resolve(mode)); } catch { /* keep in-memory choice */ }
      return sync();
    },
    subscribe(listener) {
      if (!listeners.size) {
        if (query?.addEventListener) query.addEventListener('change', sync); else query?.addListener?.(sync);
        env.addEventListener?.('storage', storageChanged);
      }
      listeners.add(listener); sync();
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          if (query?.removeEventListener) query.removeEventListener('change', sync); else query?.removeListener?.(sync);
          env.removeEventListener?.('storage', storageChanged);
        }
      };
    },
  };
}

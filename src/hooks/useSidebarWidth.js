import { useEffect, useRef, useState } from 'react';
export function resizedWidth(width, key) {
  const next = key === 'Home' ? 240 : key === 'End' ? 640 : key === 'ArrowLeft' ? width - 16 : key === 'ArrowRight' ? width + 16 : width;
  return Math.min(640, Math.max(240, next));
}
export function useSidebarWidth() {
  const [sidebarW, setWidth] = useState(() => {
    try { const saved = Number(localStorage.getItem('wbSidebarW')); return saved >= 240 && saved <= 640 ? saved : 320; }
    catch { return 320; }
  });
  const cleanup = useRef(null);
  useEffect(() => () => cleanup.current?.(), []);
  const save = (width) => { setWidth(width); try { localStorage.setItem('wbSidebarW', String(width)); } catch { /* optional persistence */ } };
  const onResizeStart = (event) => {
    event.preventDefault(); cleanup.current?.();
    const startX = event.clientX, startWidth = sidebarW; let width = sidebarW;
    document.body.classList.add('col-resizing');
    const move = (e) => { width = Math.min(640, Math.max(240, startWidth + e.clientX - startX)); setWidth(width); };
    const stop = () => {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      document.body.classList.remove('col-resizing'); cleanup.current = null;
    };
    const up = () => { stop(); save(width); };
    // Keep the exact registered handlers for unmount cleanup.
    cleanup.current = () => { stop(); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up, { once: true });
  };
  const onResizeKeyDown = (event) => {
    if (!['Home', 'End', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); save(resizedWidth(sidebarW, event.key));
  };
  return { sidebarW, onResizeStart, onResizeKeyDown };
}

export const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const BASE_KEY = 'apiBaseOverride';
const DEFAULT_TIMEOUT = 120_000;

export function getBaseUrl() {
  return localStorage.getItem(BASE_KEY) || API_BASE;
}

export function setBaseUrl(url) {
  if (url) localStorage.setItem(BASE_KEY, url.replace(/\/+$/, ''));
  else localStorage.removeItem(BASE_KEY);
}

export async function request(path, { method = 'GET', body, headers, signal, timeout = DEFAULT_TIMEOUT } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('请求超时')), timeout);
  const onAbort = () => ctrl.abort(new Error('已取消'));
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    const res = await fetch(`${getBaseUrl()}${path}`, { method, body, headers, signal: ctrl.signal });
    const text = await res.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = text; }
    }
    if (!res.ok) {
      const err = new Error(payload?.error || payload?.title || (typeof payload === 'string' ? payload : `HTTP ${res.status}`));
      err.status = res.status;
      err.payload = payload;
      err.notFound = res.status === 404;
      err.notImplemented = res.status === 404 || res.status === 501;
      throw err;
    }
    return payload;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(e.message || '请求被取消');
    if (e instanceof TypeError) {
      throw new Error(`无法连接后端服务（${getBaseUrl()}）。请确认 ObjectAnalyzer.Api 已启动。`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

export async function tryRequest(path, opts) {
  try {
    const data = await request(path, opts);
    return { data, unavailable: false };
  } catch (e) {
    if (e.notFound || e.notImplemented || e.status === 404 || e.status === 501) {
      return { data: null, unavailable: true, error: e.message, status: e.status };
    }
    throw e;
  }
}
